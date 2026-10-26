// Own-email change support. The caller can only act on their own member doc (uid from the ID token).
//   action 'request':  { newEmail } -> { available }  Checks no Auth account / memberEmails slot owned by someone else
//                      holds it, and when free records emailChangeRequests/{uid} = { newEmail, requestedAt }.
//                      The client calls verifyBeforeUpdateEmail only after this succeeds.
//   action 'finalize': after the user clicked the verification link, the signed-in Auth email (verified) must match a
//                      recent request (utils canFinalizeEmailChange); only then it moves contact.email (and the legacy
//                      top-level email when present) and the memberEmails slot, and deletes the request, in ONE batch.
//                      An Auth email that differs from contact.email without a request is left alone.
// Why a function: firestore.rules only lets admins delete/update memberEmails slots, so a member cannot move
// their own slot from the client. Responses never contain other people's data.
import { Timestamp } from 'firebase-admin/firestore';
import { db, auth, hasAdminCredentials } from '../lib/firebaseAdmin.mjs';
import { emailSlotId } from '../lib/externalAccounts.mjs';
import { canFinalizeEmailChange } from '../lib/selfEmail.mjs';

const json = (body, status = 200) => Response.json(body, { status });
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  if (!hasAdminCredentials) return json({ error: 'Server not configured' }, 500);

  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);
  let decoded;
  try {
    decoded = await auth.verifyIdToken(authHeader.slice(7));
  } catch {
    return json({ error: 'Unauthorized' }, 401);
  }
  const memberRef = db.collection('members').doc(decoded.uid);
  const memberSnap = await memberRef.get();
  const member = memberSnap.data();
  if (!member || member.role === 'INACTIVE') return json({ error: 'Forbidden' }, 403);

  const body = await req.json().catch(() => ({}));

  try {
    if (body.action === 'request') {
      const newEmail = typeof body.newEmail === 'string' ? body.newEmail.trim() : '';
      if (!EMAIL_RE.test(newEmail)) return json({ error: 'Invalid email' }, 400);
      let taken = false;
      try {
        const existing = await auth.getUserByEmail(newEmail);
        if (existing.uid !== decoded.uid) taken = true;
      } catch (err) {
        if (err.code !== 'auth/user-not-found') throw err;
      }
      if (!taken) {
        const slot = await db.collection('memberEmails').doc(emailSlotId(newEmail)).get();
        if (slot.exists && slot.data()?.memberId !== decoded.uid) taken = true;
      }
      if (taken) return json({ available: false });
      await db.collection('emailChangeRequests').doc(decoded.uid).set({ newEmail, requestedAt: new Date().toISOString() });
      return json({ available: true });
    }

    if (body.action === 'finalize') {
      const authEmail = decoded.email_verified === true ? decoded.email : null;
      const oldEmail = member.contact?.email;
      if (!authEmail || !EMAIL_RE.test(authEmail)) return json({ synced: false, reason: 'not-verified' });
      if (oldEmail && oldEmail.toLowerCase() === authEmail.toLowerCase()) return json({ synced: false, reason: 'unchanged' });

      const requestRef = db.collection('emailChangeRequests').doc(decoded.uid);
      const request = (await requestRef.get()).data();
      if (!canFinalizeEmailChange(request, authEmail)) return json({ synced: false, reason: 'no-request' });

      const newSlotRef = db.collection('memberEmails').doc(emailSlotId(authEmail));
      const newSlot = await newSlotRef.get();
      if (newSlot.exists && newSlot.data()?.memberId !== decoded.uid) {
        return json({ error: 'This email is already used by another member' }, 409);
      }

      const now = Timestamp.now();
      const batch = db.batch();
      const updates = { 'contact.email': authEmail, updatedAt: now };
      if (typeof member.email === 'string') updates.email = authEmail;
      batch.update(memberRef, updates);
      if (oldEmail) {
        const oldSlotRef = db.collection('memberEmails').doc(emailSlotId(oldEmail));
        const oldSlot = await oldSlotRef.get();
        if (oldSlot.exists && oldSlot.data()?.memberId === decoded.uid) batch.delete(oldSlotRef);
      }
      batch.set(newSlotRef, { email: authEmail, memberId: decoded.uid, createdAt: now });
      batch.delete(requestRef);
      await batch.commit();
      return json({ synced: true });
    }

    return json({ error: "action must be 'request' or 'finalize'" }, 400);
  } catch (err) {
    console.error('[self-email] error:', err);
    return json({ error: 'Request failed' }, 500);
  }
};
