// Membership dues bills created on the server (toyyibpay-api action createDuesBill).
// Members could not create these themselves: createBill is BOARD+ only, and the client-side flow
// wrote toyyibCategories / the member's membership fields, which the rules deny to members.
// The amount is computed here from the member record and membership rules, never taken from the caller.

import { FieldValue } from 'firebase-admin/firestore';

// Mirrors services/membershipConfigService.ts (FIRST_YEAR_REGISTRATION_FEE, GUEST_ENTRY_FEE,
// DEFAULT_MEMBERSHIP_RULES duesAmount) — keep both in sync.
export const FIRST_YEAR_REGISTRATION_FEE = 50;
export const GUEST_ENTRY_FEE = 350;
const DEFAULT_DUES = { Guest: 0, Probation: 300, Official: 300, Honorary: 0, Senator: 0, Visiting: 500, Associate: 50 };

const BOARD_ROLES = ['BOARD', 'ADMIN', 'SUPER_ADMIN'];

/** Members may create a dues bill for themselves; BOARD+ may create one for any member. */
export function canCreateDuesBillFor(callerUid, callerRole, memberId) {
  return memberId === callerUid || BOARD_ROLES.includes(callerRole);
}

export function membershipTypeOf(member) {
  return member?.jciCareer?.membershipType ?? member?.membershipType ?? null;
}

export function isGuestMember(member) {
  return membershipTypeOf(member) === 'Guest';
}

/** First dues year = no paid / over-paid dues record for any earlier year (same rule as useToyyibPayment). */
export function isFirstDuesYear(member, year) {
  const history = member?.jciCareer?.membershipDuesHistory;
  if (!history) return true;
  return !Object.keys(history).some(y =>
    Number(y) < year && (history[y]?.status === 'paid' || history[y]?.status === 'over paid'));
}

/** Guests pay the one-time entry fee; others pay their type's dues (+ registration fee in the first year). */
export function duesAmountFor(member, year, rules) {
  const type = membershipTypeOf(member);
  if (type === 'Guest') return GUEST_ENTRY_FEE;
  const base = rules?.[type]?.duesAmount ?? DEFAULT_DUES[type] ?? 0;
  if (!base) return 0;
  return isFirstDuesYear(member, year) ? base + FIRST_YEAR_REGISTRATION_FEE : base;
}

/** Same format as ToyyibService.formatMembershipBillDescription. */
export function duesBillDescription(member, year) {
  const name = member?.general?.name ?? '';
  const phone = member?.contact?.phone ?? '';
  const idSuffix = member?.general?.idNumber?.slice(-4);
  const prefix = `[${year} Renewal Membership]`;
  if (isGuestMember(member) || !idSuffix) return `${prefix} ${name}, ${phone}`;
  return `${prefix} ${name} (${idSuffix}), ${phone}`;
}

export function paymentUrlFor(billCode, isSandbox) {
  return `https://${isSandbox ? 'dev.' : ''}toyyibpay.com/${billCode}`;
}

/**
 * Create (or reuse) the member's dues bill for `year`.
 * `createBill(rawParams)` calls ToyyibPay and returns the new bill code.
 * @returns {Promise<{ billCode: string, paymentUrl: string, isExisting: boolean } | { status: number, error: string }>}
 */
export async function createDuesBill({ db, memberId, year, isSandbox, createBill }) {
  const memberRef = db.collection('members').doc(memberId);
  const memberSnap = await memberRef.get();
  if (!memberSnap.exists) return { status: 404, error: 'Member not found' };
  const member = memberSnap.data();

  const rulesSnap = await db.doc('systemSettings/membershipRules').get();
  const amount = duesAmountFor(member, year, rulesSnap.exists ? rulesSnap.data()?.rules : null);
  if (!(amount > 0)) return { status: 400, error: 'No membership dues are payable for this membership type.' };

  // The year's category is set up by the board on the ToyyibPay page; members never create one.
  const catSnap = await db.collection('toyyibCategories')
    .where('linkedType', '==', 'membership')
    .where('linkedYear', '==', String(year))
    .where('isActive', '==', true)
    .limit(1)
    .get();
  if (catSnap.empty) {
    return { status: 409, error: `Online payment for ${year} membership dues is not open yet. Please contact the treasurer or secretary.` };
  }
  const categoryDoc = catSnap.docs[0];
  const categoryCode = categoryDoc.data().categoryCode || categoryDoc.id;

  // Reuse an existing bill unless it failed (status 3).
  const existingSnap = await db.collection('toyyibBills')
    .where('memberId', '==', memberId)
    .where('categoryCode', '==', categoryCode)
    .limit(10)
    .get();
  const active = existingSnap.docs.map(d => d.data()).find(b => b.billpaymentStatus !== '3');
  if (active) {
    const billIsSandbox = typeof active.isSandbox === 'boolean' ? active.isSandbox : isSandbox;
    return { billCode: active.billCode, paymentUrl: paymentUrlFor(active.billCode, billIsSandbox), isExisting: true };
  }

  const billName = `${year} Renewal Membership`;
  const billDescription = duesBillDescription(member, year);
  const billTo = member.general?.name ?? '';
  const billEmail = member.contact?.email ?? '';
  const billPhone = member.contact?.phone ?? '';
  const externalRef = `JCI-${Date.now()}`;
  const billCode = await createBill({
    categoryCode, billName, billDescription,
    billAmount: String(Math.round(amount * 100)), // ToyyibPay expects sen
    billTo, billEmail, billPhone,
    billPaymentChannel: '2',
    billExternalReferenceNo: externalRef,
  });
  const paymentUrl = paymentUrlFor(billCode, isSandbox);

  // Bill record, category count and the member's link to the bill are written together.
  const toyyibFields = {
    toyyibBillCode: billCode,
    toyyibPaymentUrl: paymentUrl,
    toyyibPaymentStatus: '2',
    toyyibBillName: billName,
  };
  const memberUpdate = { updatedAt: FieldValue.serverTimestamp() };
  for (const [k, v] of Object.entries(toyyibFields)) {
    memberUpdate[`membership.${year}.${k}`] = v;
    // The member pages read the dues record from jciCareer.membershipDuesHistory.
    memberUpdate[`jciCareer.membershipDuesHistory.${year}.${k}`] = v;
  }
  const batch = db.batch();
  batch.set(db.collection('toyyibBills').doc(), {
    billCode, categoryCode, billName, billDescription,
    billAmount: amount, billTo, billEmail,
    billpaymentStatus: '2',
    year, memberId, isSandbox,
    billExternalReferenceNo: externalRef,
    createdAt: FieldValue.serverTimestamp(),
  });
  batch.set(categoryDoc.ref, { billCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  batch.update(memberRef, memberUpdate);
  try {
    await batch.commit();
  } catch (err) {
    // The bill exists at ToyyibPay but not in our records — log the code so it can be reconciled.
    console.error(`[toyyib-dues] Bill ${billCode} created at ToyyibPay but Firestore write failed for member ${memberId}:`, err);
    throw err;
  }

  return { billCode, paymentUrl, isExisting: false };
}
