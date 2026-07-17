import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

// Function to handle member promotion from Probation to Full
export const checkMemberPromotion = functions.firestore
  .document('members/{memberId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const memberId = context.params.memberId;

    // Only check Probation members
    if (after.membershipType !== 'probation' && after.membershipType !== 'Probation') {
      return null;
    }

    // Check if promotion progress was updated
    if (!after.promotionProgress || 
        JSON.stringify(before.promotionProgress) === JSON.stringify(after.promotionProgress)) {
      return null;
    }

    const progress = after.promotionProgress;
    
    // Check if all requirements are met
    const allRequirementsMet = 
      progress.bodMeetingAttended &&
      progress.eventOrganizerParticipation &&
      progress.eventParticipation &&
      progress.jciInspireCompleted;

    if (allRequirementsMet && !progress.promotedToFull) {
      try {
        // Idempotency: re-read the member to confirm not already promoted before committing.
        // Retries triggered by a transient batch.commit() failure would otherwise double-promote.
        const freshSnap = await db.collection('members').doc(memberId).get();
        if (freshSnap.data()?.promotionProgress?.promotedToFull === true) {
          console.log(`Member ${memberId} already promoted — skipping (idempotent retry)`);
          return null;
        }

        // Promote to Full Member — batch member update + notification atomically
        const batch = db.batch();
        batch.update(db.collection('members').doc(memberId), {
          membershipType: 'full',
          'promotionProgress.promotedToFull': true,
          'promotionProgress.completedDate': admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        const notifRef = db.collection('notifications').doc();
        batch.set(notifRef, {
          memberId: memberId,
          type: 'promotion',
          title: 'Congratulations! You have been promoted to Full Member',
          message: 'You have successfully completed all requirements and have been promoted from Probation Member to Full Member. Your dues for next renewal will be RM300.',
          read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        await batch.commit();

        console.log(`Member ${memberId} promoted from Probation to Full Member`);
      } catch (error) {
        console.error(`[checkMemberPromotion] Failed to promote member ${memberId}:`, error);
        // Re-throw transient errors so Cloud Functions retries with backoff.
        // The idempotency check above ensures retries are safe.
        throw error;
      }
    }

    return null;
  });

// Function to handle annual dues renewal
export const generateDuesRenewal = functions.runWith({ timeoutSeconds: 300 }).https.onCall(async (data, context) => {
  // Verify admin permissions
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const userDoc = await db.collection('members').doc(context.auth.uid).get();
  if (!userDoc.exists || !['BOARD', 'ADMIN'].includes(userDoc.data()?.role)) {
    throw new functions.https.HttpsError('permission-denied', 'User must be board member or admin');
  }

  const { duesYear } = data;
  if (!duesYear || typeof duesYear !== 'number') {
    throw new functions.https.HttpsError('invalid-argument', 'Valid dues year is required');
  }

  const previousYear = duesYear - 1;
  
  // CF-06 fix: dues records are written to 'transactions' (not the nonexistent 'duesTransactions'),
  // with type='Income', category='Membership', status='Cleared', and a duesYear field.
  const previousYearDues = await db.collection('transactions')
    .where('type', '==', 'Income')
    .where('category', '==', 'Membership')
    .where('status', '==', 'Cleared')
    .where('duesYear', '==', previousYear)
    .get();

  const renewalMemberIds = new Set(previousYearDues.docs.map(doc => doc.data().memberId));

  // Pre-fetch ALL dues transactions for targetYear in one query (avoids N+1 per-member queries)
  const existingDuesTxns = await db.collection('transactions')
    .where('type', '==', 'DUES')
    .where('duesYear', '==', duesYear)
    .get();
  const membersWithDues = new Set(existingDuesTxns.docs.map(d => d.data().memberId));

  // Get all current members
  const membersSnapshot = await db.collection('members').get();
  const batch = db.batch();
  let renewalCount = 0;

  for (const memberDoc of membersSnapshot.docs) {
    const member = memberDoc.data();
    const memberId = memberDoc.id;

    // Skip if already has dues transaction for this year (single-query idempotency check)
    if (membersWithDues.has(memberId)) {
      continue;
    }

    // Determine dues amount based on membership type
    let amount = 0;
    switch (member.membershipType?.toLowerCase?.() || member.membershipType) {
      case 'probation':
        amount = 350;
        break;
      case 'full':
        amount = 300;
        break;
      case 'honorary':
        // Verify age requirement
        if (member.age <= 40) {
          console.warn(`Honorary member ${memberId} is not over 40 years old`);
          continue;
        }
        amount = 50;
        break;
      case 'senator':
        // Verify senator certification
        if (!member.senatorCertified) {
          console.warn(`Senator ${memberId} does not have valid certification`);
          continue;
        }
        amount = 0;
        break;
      case 'visiting':
        // Verify non-Malaysian citizenship
        if (member.citizenship === 'Malaysian') {
          console.warn(`Visiting member ${memberId} has Malaysian citizenship`);
          continue;
        }
        amount = 500;
        break;
      default:
        console.warn(`Unknown membership type for member ${memberId}: ${member.membershipType}`);
        continue;
    }

    // Create dues transaction (type: 'DUES' + duesYear field enables single-query idempotency check)
    const duesTransactionRef = db.collection('transactions').doc();
    batch.set(duesTransactionRef, {
      memberId: memberId,
      membershipType: member.membershipType,
      type: 'DUES',
      duesYear: duesYear,
      amount: amount,
      status: amount === 0 ? 'paid' : 'pending', // Senators are automatically paid
      isRenewal: renewalMemberIds.has(memberId),
      dueDate: new Date(duesYear, 2, 31), // March 31st
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    renewalCount++;
  }

  await batch.commit();

  return {
    success: true,
    renewalCount: renewalCount,
    duesYear: duesYear
  };
});

// ─── Scheduled: Oct 1 — auto-initiate dues renewal for next year ─────────────

export const autoInitiateDuesRenewal = functions.pubsub
  .schedule('0 0 1 10 *')
  .timeZone('Asia/Kuala_Lumpur')
  .onRun(async () => {
    const nowMYT = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kuala_Lumpur' }));
    const targetYear = nowMYT.getFullYear() + 1;
    const prevYear = targetYear - 1;
    console.log(`[autoInitiateDuesRenewal] Initiating dues renewal for ${targetYear}`);

    // Load membership config rules
    const configSnap = await db.collection('systemSettings').doc('membershipRules').get();
    const configRules: Record<string, { duesAmount: number }> = configSnap.exists
      ? (configSnap.data()?.rules ?? {})
      : {};
    const DEFAULT_DUES: Record<string, number> = {
      Probation: 300, Official: 300, Visiting: 500, Associate: 50, Honorary: 0, Senator: 0,
    };
    const getDues = (type: string) =>
      configRules[type]?.duesAmount ?? DEFAULT_DUES[type] ?? 0;

    // Find all Cleared Membership Income transactions from prevYear
    const txSnap = await db.collection('transactions')
      .where('category', '==', 'Membership')
      .where('type', '==', 'Income')
      .where('status', '==', 'Cleared')
      .get();

    const eligibleMemberIds = new Set<string>();
    for (const doc of txSnap.docs) {
      const d = doc.data();
      // Use duesYear field when present; fall back to parsing projectId for historical docs
      let txYear: number;
      if (d.duesYear != null) {
        txYear = d.duesYear as number;
      } else {
        txYear = d.projectId ? parseInt((d.projectId as string).split(' ')[0]) : 0;
        if (d.projectId) console.warn(`[autoInitiateDuesRenewal] Doc ${doc.id} missing duesYear — fell back to projectId parse`);
      }
      if (txYear === prevYear && d.memberId) eligibleMemberIds.add(d.memberId as string);
    }

    // Find already-initiated transactions for targetYear (idempotency via dedicated duesYear field)
    const existingSnap = await db.collection('transactions')
      .where('category', '==', 'Membership')
      .where('type', '==', 'Income')
      .where('duesYear', '==', targetYear)
      .get();
    const alreadyInitiated = new Set<string>();
    for (const doc of existingSnap.docs) {
      const d = doc.data();
      if (d.memberId) alreadyInitiated.add(d.memberId as string);
    }
    // Secondary fallback: catch historical docs that lack duesYear (written before this fix)
    if (alreadyInitiated.size === 0) {
      const fallbackSnap = await db.collection('transactions')
        .where('category', '==', 'Membership')
        .where('type', '==', 'Income')
        .get();
      for (const doc of fallbackSnap.docs) {
        const d = doc.data();
        if (d.duesYear != null) continue; // already handled above
        const txYear = d.projectId ? parseInt((d.projectId as string).split(' ')[0]) : 0;
        if (txYear === targetYear && d.memberId) {
          console.warn(`[autoInitiateDuesRenewal] Fallback idempotency: doc ${doc.id} matched via projectId parse`);
          alreadyInitiated.add(d.memberId as string);
        }
      }
    }

    let created = 0;
    const batchLimit = 490;
    let batch = db.batch();
    let batchCount = 0;

    const flush = async () => { await batch.commit(); batch = db.batch(); batchCount = 0; };

    for (const memberId of eligibleMemberIds) {
      if (alreadyInitiated.has(memberId)) continue;

      const memberSnap = await db.collection('members').doc(memberId).get();
      if (!memberSnap.exists) continue;
      const m = memberSnap.data()!;
      if (m.status === 'Inactive' || m.membershipType === 'Guest') continue;

      const type: string = m.membershipType ?? 'Probation';
      const baseDues = getDues(type);
      if (baseDues === 0) continue; // Honorary / Senator

      const initFee = (m.hasPaidInitiationFee || m.jciCareer?.hasPaidInitiationFee) ? 0 : 50;
      const totalDues = baseDues + initFee;

      const txRef = db.collection('transactions').doc();
      batch.set(txRef, {
        memberId,
        type: 'Income',
        category: 'Membership',
        status: 'Pending',
        amount: totalDues,
        duesYear: targetYear,
        projectId: `${targetYear} membership`,
        transactionType: 'dues',
        description: `${targetYear} ${type} Dues Renewal`,
        date: `${targetYear}-01-01`,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Write membership record on member document
      batch.update(db.collection('members').doc(memberId), {
        [`membership.${targetYear}`]: {
          year: targetYear,
          dues: totalDues,
          amount: 0,
          status: 'pending',
          transactionId: [txRef.id],
          purpose: `${targetYear} ${type} Renewal`,
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // In-app notification
      const notifRef = db.collection('notifications').doc();
      batch.set(notifRef, {
        memberId,
        type: 'dues_renewal',
        title: `${targetYear} 年度会费通知`,
        message: `您的 ${targetYear} 年度 ${type} 会费为 RM${totalDues}，请尽快完成缴费。`,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      created++;
      batchCount += 3;
      if (batchCount >= batchLimit) await flush();
    }

    if (batchCount > 0) await flush();
    console.log(`[autoInitiateDuesRenewal] Done. Created ${created} renewal records for ${targetYear}.`);
    return null;
  });

// ─── Scheduled: Jan 1 — send dues reminders (in-app + WhatsApp campaign flag) ─

export const sendAnnualDuesReminders = functions.pubsub
  .schedule('0 10 1 1 *')
  .timeZone('Asia/Kuala_Lumpur')
  .onRun(async () => {
    const nowMYT = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kuala_Lumpur' }));
    const year = nowMYT.getFullYear();
    console.log(`[sendAnnualDuesReminders] Sending dues reminders for ${year}`);

    const membersSnap = await db.collection('members')
      .where('status', '==', 'Active')
      .get();

    const pendingMemberIds: string[] = [];
    let batch = db.batch();
    let batchCount = 0;
    const flush = async () => { await batch.commit(); batch = db.batch(); batchCount = 0; };

    for (const doc of membersSnap.docs) {
      const m = doc.data();
      const memberId = doc.id;
      const rec = m.membership?.[String(year)];
      if (!rec) continue;
      const status: string = rec.status ?? '';
      if (!['pending', 'partial', 'overdue'].includes(status)) continue;
      if (m.membershipType === 'Guest' || m.membershipType === 'Honorary' || m.membershipType === 'Senator') continue;

      const outstanding = Math.max(0, (rec.dues ?? 0) - (rec.amount ?? 0));

      const notifRef = db.collection('notifications').doc();
      batch.set(notifRef, {
        memberId,
        type: 'dues_reminder',
        title: `${year} 年度会费提醒`,
        message: `温馨提醒：您 ${year} 年度的 ${m.membershipType ?? ''} 会费 RM${outstanding} 尚未缴清。请尽快完成缴费以维持您的会籍权益。`,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      pendingMemberIds.push(memberId);
      batchCount++;
      if (batchCount >= 490) await flush();
    }

    if (batchCount > 0) await flush();

    // Write WhatsApp campaign flag — Dashboard picks this up and prompts admin to run bulk WA
    if (pendingMemberIds.length > 0) {
      await db.collection('systemSettings').doc('pendingWhatsAppCampaign').set({
        year,
        memberIds: pendingMemberIds,
        triggeredAt: admin.firestore.FieldValue.serverTimestamp(),
        dismissed: false,
      });
    }

    console.log(`[sendAnnualDuesReminders] Sent ${pendingMemberIds.length} in-app reminders for ${year}.`);
    return null;
  });

export const membershipFunctions = {
  checkMemberPromotion,
  generateDuesRenewal,
  autoInitiateDuesRenewal,
  sendAnnualDuesReminders,
};