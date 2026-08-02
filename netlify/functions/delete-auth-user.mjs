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

// POST { uid } OR { email }
// Deletes a Firebase Auth account for an orphaned user (no members record).
export default async (req, context) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader?.startsWith('Bearer ')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const idToken = authHeader.split('Bearer ')[1];
  try {
    const decoded = await getAuth().verifyIdToken(idToken);
    const callerDoc = await getFirestore().collection('members').doc(decoded.uid).get();
    const role = callerDoc.data()?.role;
    if (!['ADMIN', 'SUPER_ADMIN'].includes(role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let uid, email;
  try {
    ({ uid, email } = await req.json().catch(() => ({})));
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!uid && !email) {
    return Response.json({ error: 'uid or email is required' }, { status: 400 });
  }

  try {
    const auth = getAuth();

    if (!uid && email) {
      const user = await auth.getUserByEmail(email);
      uid = user.uid;
    }

    await auth.deleteUser(uid);

    return Response.json({ deleted: true });
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      return Response.json({ deleted: false, reason: 'not_found' });
    }
    console.error('[delete-auth-user] error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
};
