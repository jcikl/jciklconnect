// Firebase Auth accounts for member profiles.
// The Auth uid is the member's Firestore doc id, so on login hooks/useAuth.tsx finds members/{uid}
// directly and no profile copy is needed (copying is rejected by firestore.rules anyway).
import { FieldValue } from 'firebase-admin/firestore';
import { db, auth } from './firebaseAdmin.mjs';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const E164_RE = /^\+[1-9]\d{7,14}$/;

/** Malaysian-first phone normalisation to E.164. Returns null when the result is not a valid E.164 number. */
export function normalizeMyPhone(raw) {
  if (raw == null) return null;
  let p = String(raw).replace(/[\s\-().]/g, '');
  if (!p) return null;
  if (p.startsWith('00')) p = '+' + p.slice(2);
  else if (p.startsWith('0')) p = '+60' + p.slice(1);
  else if (p.startsWith('60')) p = '+' + p;
  else if (/^1\d{7,9}$/.test(p)) p = '+60' + p; // Malaysian mobile typed without the leading 0
  else if (!p.startsWith('+')) return null;   // unknown country without +: do not guess
  return E164_RE.test(p) ? p : null;
}

export function memberEmail(m) {
  const e = (m?.contact?.email ?? m?.email ?? '').trim().toLowerCase();
  return EMAIL_RE.test(e) ? e : null;
}

const memberName = (m) => m?.general?.name || m?.name || undefined;

async function lookup(fn) {
  try { return await fn(); } catch (e) { if (e.code === 'auth/user-not-found') return null; throw e; }
}

/**
 * Decide what to do for one member without changing anything.
 * status: ready | create | replace_orphan | skipped | conflict
 */
export async function planMemberAuth(memberId, m, { replaceOrphans = false, duplicateEmails = new Set() } = {}) {
  const email = memberEmail(m);
  const phone = normalizeMyPhone(m?.contact?.phone ?? m?.phone);
  const base = { memberId, email, phone, phoneNote: null };

  const own = await lookup(() => auth.getUser(memberId));
  if (own) return { ...base, status: 'ready', reason: 'auth account already uses this member id' };
  if (!email) return { ...base, status: 'skipped', reason: 'missing or invalid email' };
  if (duplicateEmails.has(email)) return { ...base, status: 'skipped', reason: 'email shared by several member profiles' };

  const byEmail = await lookup(() => auth.getUserByEmail(email));
  if (byEmail) {
    const linkedProfile = await db.collection('members').doc(byEmail.uid).get();
    if (linkedProfile.exists) return { ...base, status: 'conflict', reason: 'email belongs to another member profile (duplicate profile)' };
    // An invite-created orphan has no way to sign in yet: no password, no linked provider, and no token
    // ever issued. (lastSignInTime is not reliable: the Auth emulator stamps it at creation.)
    const neverUsable = byEmail.providerData.length === 0 && !byEmail.metadata?.lastRefreshTime;
    if (!neverUsable) return { ...base, status: 'conflict', reason: 'email has an account that has been used to sign in; resolve manually' };
    if (!replaceOrphans) return { ...base, status: 'conflict', reason: 'email has an unused orphan account (tick "replace orphan accounts" to rebuild it)', orphanUid: byEmail.uid };
    base.orphanUid = byEmail.uid;
  }

  if (!phone && (m?.contact?.phone ?? m?.phone)) base.phoneNote = 'phone not in a valid format; account created without phone';
  if (phone) {
    const byPhone = await lookup(() => auth.getUserByPhoneNumber(phone));
    if (byPhone && byPhone.uid !== base.orphanUid) { base.phone = null; base.phoneNote = 'phone already used by another account; account created without phone'; }
  }
  return { ...base, status: base.orphanUid ? 'replace_orphan' : 'create', reason: base.orphanUid ? 'unused orphan account will be replaced' : 'account will be created' };
}

/** Apply a plan from planMemberAuth. Returns the final per-member result. */
export async function applyMemberAuth(plan, m) {
  if (plan.status !== 'create' && plan.status !== 'replace_orphan') return plan;
  if (plan.status === 'replace_orphan') await auth.deleteUser(plan.orphanUid);
  const props = { uid: plan.memberId, email: plan.email, emailVerified: false, displayName: memberName(m) };
  try {
    await auth.createUser(plan.phone ? { ...props, phoneNumber: plan.phone } : props);
  } catch (e) {
    if (e.code === 'auth/phone-number-already-exists' && plan.phone) {
      await auth.createUser(props);
      return { ...plan, status: 'created', phone: null, phoneNote: 'phone already used by another account; account created without phone' };
    }
    throw e;
  }
  return { ...plan, status: plan.status === 'replace_orphan' ? 'replaced' : 'created' };
}

/**
 * Firebase password-reset email used as the "set up your password" invite.
 * Same mechanism as netlify/functions/send-invite.mjs; logs to emailLogs.
 */
export async function sendPasswordSetupEmail(email) {
  const apiKey = process.env.FIREBASE_WEB_API_KEY;
  if (!apiKey) throw new Error('FIREBASE_WEB_API_KEY env var missing — cannot send password setup email');
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestType: 'PASSWORD_RESET', email }),
  });
  const ok = res.ok;
  const errBody = ok ? null : await res.text();
  await db.collection('emailLogs').add({
    recipientEmail: email,
    emailType: 'invitation',
    sentAt: FieldValue.serverTimestamp(),
    success: ok,
    ...(ok ? {} : { errorMessage: `sendOobCode HTTP ${res.status}: ${errBody}` }),
    triggeredBy: 'netlify-function',
    subject: 'JCI KL — Set up your password',
  }).catch(err => console.error('[memberAuth] Failed to write email log:', err));
  if (!ok) throw new Error('Failed to send password setup email');
}

/** Emails that appear on more than one member profile (lower-cased). */
export function findDuplicateEmails(memberDocs) {
  const counts = new Map();
  for (const d of memberDocs) {
    const e = memberEmail(d.data());
    if (e) counts.set(e, (counts.get(e) ?? 0) + 1);
  }
  return new Set([...counts].filter(([, c]) => c > 1).map(([e]) => e));
}
