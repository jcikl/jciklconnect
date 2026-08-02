import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

/**
 * Sync a member's Firebase Auth login email after their profile email changes.
 * POST { uid, newEmail }
 *  → 200 { updated: true }                        Auth email changed
 *  → 200 { updated: false, reason: 'no-auth-account' }  member has no Auth account yet (nothing to sync)
 *  → 409 { error }                                newEmail already used by a different Auth account
 */
export default async (req, context) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader?.startsWith('Bearer ')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const idToken = authHeader.split('Bearer ')[1];

  let uid, newEmail;
  try {
    ({ uid, newEmail } = await req.json().catch(() => ({})));
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }
  if (!uid || !newEmail) {
    return Response.json({ error: 'uid and newEmail are required' }, { status: 400 });
  }

  try {
    const decoded = await getAuth().verifyIdToken(idToken);
    const callerDoc = await getFirestore().collection('members').doc(decoded.uid).get();
    const role = callerDoc.data()?.role;
    const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(role);

    // INACTIVE accounts may not update any email, even their own
    if (role === 'INACTIVE') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Non-admins may only update their own email
    if (!isAdmin && decoded.uid !== uid) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const auth = getAuth();

  try {
    // Does this member have an Auth account at all?
    try {
      const user = await auth.getUser(uid);
      if (user.email?.toLowerCase() === newEmail.toLowerCase()) {
        return Response.json({ updated: false, reason: 'unchanged' });
      }
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        return Response.json({ updated: false, reason: 'no-auth-account' });
      }
      throw err;
    }

    // Is the new email already taken by a DIFFERENT auth account?
    try {
      const existing = await auth.getUserByEmail(newEmail);
      if (existing.uid !== uid) {
        return Response.json(
          { error: 'This email is already used by another account' },
          { status: 409 },
        );
      }
    } catch (err) {
      if (err.code !== 'auth/user-not-found') throw err;
      // not found → free to use
    }

    await auth.updateUser(uid, { email: newEmail, emailVerified: false });
    return Response.json({ updated: true });
  } catch (err) {
    console.error('[update-auth-email] error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
};
