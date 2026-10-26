// External (sister-chapter) accounts. Uses the member doc id as the Auth uid (same as member-auth).
//   action 'createChapterAdmin': KL ADMIN / SUPER_ADMIN; { loId, members: [{ name, email, dob? }] }
//   action 'inviteMember':       active CHAPTER_ADMIN (forced to own chapter, role AFFILIATE) or KL admin
//                                naming a chapter; { loId?, members: [...] }. Invited accounts are active.
//   action 'setStatus':          { memberId, status } — transition table in netlify/lib/externalAccounts.mjs;
//                                keeps memberCards in sync (create / delete via shouldHaveCard).
//   action 'resendInvite':       { memberId } — password setup email again.
//   action 'deleteAccount':      { memberId } — PERMANENT. Scope in canDeleteAccount (KL admin: any external;
//                                chapter admin: own-chapter AFFILIATE). One batch deletes the member doc, its
//                                memberEmails slot(s), memberCards, emailChangeRequests and publicBusinessListings
//                                docs plus writes the auditLog entry; then the Auth user is deleted. If that fails
//                                the response says authDeleted: false and a KL admin can call again (retry path).
// Caller role / status / loId come from the caller's Firestore member doc, never the body.
// Every call writes one auditLog entry; responses never contain emails.
import { Timestamp } from 'firebase-admin/firestore';
import { db, auth, hasAdminCredentials } from '../lib/firebaseAdmin.mjs';
import { sendPasswordSetupEmail, memberEmail } from '../lib/memberAuth.mjs';
import {
  validateInvitees, resolveCreateScope, checkChapter, checkCap, buildExternalMemberDoc, buildEmailSlot,
  emailSlotId, cardFor, checkStatusTransition, statusUpdates, withStatus, canManageMember, CAP_COUNTED_STATUSES,
  isKlAdmin, canDeleteAccount, canRetryAccountDeletion, planAccountDeletion,
} from '../lib/externalAccounts.mjs';

const ALLOWED_ORIGINS = ['https://app.jcikl.cc', 'http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'];
const ACTIONS = ['createChapterAdmin', 'inviteMember', 'setStatus', 'resendInvite', 'deleteAccount'];
const DELETE_AUDIT_ACTION = 'external_accounts_deleteAccount';

/** Metadata of an earlier deleteAccount audit entry for this id, or null (the retry guard). */
async function priorDeletion(memberId) {
  const snap = await db.collection('auditLog').where('targetId', '==', memberId).get();
  const entry = snap.docs.map(d => d.data()).find(d => d.action === DELETE_AUDIT_ACTION);
  return entry ? (entry.metadata ?? {}) : null;
}

/**
 * Permanent delete: one batch (planAccountDeletion docs + this call's auditLog entry), then the Auth user.
 * The audit entry is in the batch so a later retry can prove this id was an external account deleted here.
 * Returns whether the Auth user is gone (a missing Auth user counts as gone).
 */
async function deleteAccount(callerUid, memberId, metadata) {
  const slots = await db.collection('memberEmails').where('memberId', '==', memberId).get();
  const auditRef = db.collection('auditLog').doc();
  const batch = db.batch();
  for (const [col, id] of planAccountDeletion(memberId, slots.docs.map(d => d.id))) batch.delete(db.collection(col).doc(id));
  batch.set(auditRef, {
    action: DELETE_AUDIT_ACTION,
    performedBy: callerUid,
    targetCollection: 'members',
    targetId: memberId,
    before: null,
    after: null,
    // No email and no slot ids (a slot id is the email).
    metadata: { ...metadata, slotsDeleted: slots.size, authDeleted: null },
    timestamp: Timestamp.now(),
    _source: 'netlify-function',
  });
  await batch.commit();
  let authDeleted = true;
  try {
    await auth.deleteUser(memberId);
  } catch (e) {
    if (e.code !== 'auth/user-not-found') {
      authDeleted = false;
      console.error('[external-accounts] deleteUser failed (retry deleteAccount as a KL admin):', memberId, e.code || e.message);
    }
  }
  await auditRef.update({ 'metadata.authDeleted': authDeleted })
    .catch(err => console.error('[external-accounts] audit update failed:', memberId, err.code || err.message));
  return authDeleted;
}

async function emailTaken(email) {
  const slot = await db.collection('memberEmails').doc(emailSlotId(email)).get();
  if (slot.exists) return true;
  try {
    await auth.getUserByEmail(email);
    return true;
  } catch (e) {
    if (e.code === 'auth/user-not-found') return false;
    throw e;
  }
}

async function audit(action, callerUid, targetId, metadata) {
  await db.collection('auditLog').add({
    action: `external_accounts_${action}`,
    performedBy: callerUid,
    targetCollection: 'members',
    targetId,
    before: null,
    after: null,
    metadata,
    timestamp: Timestamp.now(),
    _source: 'netlify-function',
  });
}

/** Create one account: Auth user (uid = pre-generated member id) → one batch (member + email slot + card). */
async function createOne({ role, loId, chapter, invitee, callerUid }) {
  if (await emailTaken(invitee.email)) return { status: 'skipped', reason: 'email already registered' };
  const memberRef = db.collection('members').doc();
  const uid = memberRef.id;
  await auth.createUser({ uid, email: invitee.email, emailVerified: false, displayName: invitee.name });
  const now = Timestamp.now();
  const nowIso = now.toDate().toISOString();
  const memberDoc = buildExternalMemberDoc({ role, loId, chapter, invitee, callerUid, nowIso, createdAt: now });
  try {
    const batch = db.batch();
    batch.create(memberRef, memberDoc);
    batch.create(db.collection('memberEmails').doc(emailSlotId(invitee.email)), buildEmailSlot(invitee.email, uid, now));
    const card = cardFor(memberDoc, nowIso);
    if (card) batch.set(db.collection('memberCards').doc(uid), card);
    await batch.commit();
  } catch (e) {
    // Roll back the Auth user so a failed profile write leaves no orphan account.
    await auth.deleteUser(uid).catch(err => console.error('[external-accounts] rollback deleteUser failed:', uid, err.code || err.message));
    console.error('[external-accounts] batch failed:', e.code || e.message);
    return { status: 'error', reason: e.code === 6 || e.code === 'already-exists' ? 'email already registered' : 'profile write failed' };
  }
  // Side effect only after the profile exists.
  let emailSent = true;
  try { await sendPasswordSetupEmail(invitee.email); } catch { emailSent = false; }
  return { memberId: uid, status: 'created', emailSent };
}

export default async (req) => {
  const origin = req.headers.get('origin') ?? '';
  const cors = {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
  const json = (body, status = 200) => Response.json(body, { status, headers: cors });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: cors });
  if (!hasAdminCredentials) return json({ error: 'Missing Firebase Admin credentials' }, 500);

  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);
  let callerUid, caller;
  try {
    const decoded = await auth.verifyIdToken(authHeader.slice(7));
    callerUid = decoded.uid;
    caller = (await db.collection('members').doc(callerUid).get()).data() ?? null;
  } catch {
    return json({ error: 'Unauthorized' }, 401);
  }
  if (!caller) return json({ error: 'Forbidden' }, 403);

  const body = await req.json().catch(() => ({}));
  const action = body.action;
  if (!ACTIONS.includes(action)) return json({ error: `action must be one of ${ACTIONS.join(', ')}` }, 400);

  try {
    if (action === 'createChapterAdmin' || action === 'inviteMember') {
      const scope = resolveCreateScope(action, caller, body.loId);
      if (!scope.ok) return json({ error: scope.error }, scope.status);
      const valid = validateInvitees(body.members);
      if (!valid.ok) return json({ error: valid.error }, 400);

      const chapterSnap = await db.collection('sisterChapters').doc(scope.loId).get();
      const chapter = chapterSnap.exists ? chapterSnap.data() : null;
      const chapterOk = checkChapter(chapter);
      if (!chapterOk.ok) return json({ error: chapterOk.error }, chapterOk.status);

      // Only active / suspended members use up a place (M2): self-registered pending / rejected docs do not.
      const existing = (await db.collection('members')
        .where('loId', '==', scope.loId)
        .where('affiliation.status', 'in', CAP_COUNTED_STATUSES)
        .count().get()).data().count;
      const cap = checkCap(existing, valid.invitees.length);
      if (!cap.ok) return json({ error: cap.error }, cap.status);

      const results = [];
      for (let i = 0; i < valid.invitees.length; i++) {
        try {
          results.push({ index: i, ...(await createOne({ ...scope, chapter, invitee: valid.invitees[i], callerUid })) });
        } catch (e) {
          console.error('[external-accounts] create failed:', e.code || e.message);
          results.push({ index: i, status: 'error', reason: e.code === 'auth/email-already-exists' ? 'email already registered' : 'unexpected error' });
        }
      }
      const summary = results.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), {});
      await audit(action, callerUid, `chapter:${scope.loId}`, {
        loId: scope.loId, role: scope.role, summary,
        results: results.map(({ index, memberId, status }) => ({ index, memberId: memberId ?? null, status })),
      });
      return json({ action, loId: scope.loId, summary, results });
    }

    // setStatus / resendInvite / deleteAccount: one target member.
    const memberId = typeof body.memberId === 'string' ? body.memberId : '';
    if (!memberId) return json({ error: 'memberId is required' }, 400);
    const ref = db.collection('members').doc(memberId);
    const snap = await ref.get();
    const target = snap.exists ? snap.data() : null;

    if (action === 'deleteAccount') {
      if (!target) {
        // Retry: profile already deleted but the Auth step failed. KL admin + earlier deleteAccount audit only.
        const prior = isKlAdmin(caller) ? await priorDeletion(memberId) : null;
        if (!canRetryAccountDeletion(caller, callerUid, memberId, prior !== null)) return json({ error: 'Member not found' }, 404);
        const authDeleted = await deleteAccount(callerUid, memberId, { role: prior.role ?? null, loId: prior.loId ?? null, retry: true });
        return json({ action, memberId, authDeleted, retry: true });
      }
      const check = canDeleteAccount(caller, callerUid, memberId, target);
      if (!check.ok) return json({ error: check.error }, check.status);
      const authDeleted = await deleteAccount(callerUid, memberId, {
        role: target.role, loId: target.loId, status: target.affiliation?.status ?? null, retry: false,
      });
      return json({ action, memberId, authDeleted, retry: false });
    }

    if (action === 'setStatus') {
      const check = checkStatusTransition(caller, callerUid, memberId, target, body.status);
      if (!check.ok) return json({ error: check.error }, check.status);
      const nowIso = new Date().toISOString();
      const updates = { ...statusUpdates(caller, callerUid, target, body.status, nowIso), updatedAt: Timestamp.now() };
      const after = withStatus(target, updates);
      const card = cardFor(after, nowIso);
      const batch = db.batch();
      batch.update(ref, updates);
      const cardRef = db.collection('memberCards').doc(memberId);
      if (card) batch.set(cardRef, card);
      else batch.delete(cardRef);
      await batch.commit();
      await audit(action, callerUid, memberId, { from: target.affiliation?.status ?? null, to: body.status, card: card ? 'upsert' : 'delete' });
      return json({ action, memberId, status: body.status });
    }

    // resendInvite
    if (!canManageMember(caller, callerUid, memberId, target)) return json({ error: 'Forbidden' }, 403);
    const email = memberEmail(target);
    if (!email) return json({ error: 'Member has no valid email' }, 400);
    try {
      const user = await auth.getUser(memberId);
      if ((user.email ?? '').toLowerCase() !== email) return json({ error: 'Login account email differs from the profile; fix manually' }, 409);
    } catch (e) {
      if (e.code === 'auth/user-not-found') return json({ error: 'Member has no login account' }, 409);
      throw e;
    }
    let emailSent = true;
    try { await sendPasswordSetupEmail(email); } catch { emailSent = false; }
    await audit(action, callerUid, memberId, { emailSent });
    return json({ action, memberId, emailSent });
  } catch (err) {
    console.error('[external-accounts] error:', err);
    return json({ error: 'Internal server error' }, 500);
  }
};
