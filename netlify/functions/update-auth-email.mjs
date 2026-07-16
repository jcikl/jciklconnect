import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.VITE_FIREBASE_PROJECT_ID,
      clientEmail: process.env.VITE_FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.VITE_FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
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
export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }
  const idToken = authHeader.split('Bearer ')[1];

  let uid, newEmail;
  try {
    ({ uid, newEmail } = JSON.parse(event.body));
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body' }) };
  }
  if (!uid || !newEmail) {
    return { statusCode: 400, body: JSON.stringify({ error: 'uid and newEmail are required' }) };
  }

  try {
    const decoded = await getAuth().verifyIdToken(idToken);
    const callerDoc = await getFirestore().collection('members').doc(decoded.uid).get();
    const role = callerDoc.data()?.role;
    if (!['ADMIN', 'SUPER_ADMIN'].includes(role) && decoded.uid !== uid) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden' }) };
    }
  } catch {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const auth = getAuth();

  try {
    // Does this member have an Auth account at all?
    try {
      const user = await auth.getUser(uid);
      if (user.email?.toLowerCase() === newEmail.toLowerCase()) {
        return { statusCode: 200, body: JSON.stringify({ updated: false, reason: 'unchanged' }) };
      }
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        return { statusCode: 200, body: JSON.stringify({ updated: false, reason: 'no-auth-account' }) };
      }
      throw err;
    }

    // Is the new email already taken by a DIFFERENT auth account?
    try {
      const existing = await auth.getUserByEmail(newEmail);
      if (existing.uid !== uid) {
        return {
          statusCode: 409,
          body: JSON.stringify({ error: 'This email is already used by another account' }),
        };
      }
    } catch (err) {
      if (err.code !== 'auth/user-not-found') throw err;
      // not found → free to use
    }

    await auth.updateUser(uid, { email: newEmail, emailVerified: false });
    return { statusCode: 200, body: JSON.stringify({ updated: true }) };
  } catch (err) {
    console.error('[update-auth-email] error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
