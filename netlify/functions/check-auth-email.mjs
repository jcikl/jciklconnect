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

export default async (req, context) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // Verify caller identity — only BOARD+ may check Firebase Auth account status
  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader?.startsWith('Bearer ')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const idToken = authHeader.split('Bearer ')[1];
  try {
    const decoded = await getAuth().verifyIdToken(idToken);
    const callerDoc = await getFirestore().collection('members').doc(decoded.uid).get();
    const callerRole = callerDoc.data()?.role;
    if (!['BOARD', 'ADMIN', 'SUPER_ADMIN'].includes(callerRole)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let email;
  try {
    ({ email } = await req.json().catch(() => ({})));
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }
  if (!email) {
    return Response.json({ error: 'email is required' }, { status: 400 });
  }

  try {
    const user = await getAuth().getUserByEmail(email);
    return Response.json({
      exists: true,
      providers: user.providerData.map(p => p.providerId),
    });
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      return Response.json({ exists: false, providers: [] });
    }
    console.error('[check-auth-email] error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
};
