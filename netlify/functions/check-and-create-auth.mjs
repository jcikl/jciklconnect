import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

// POST { email }
// Checks if email is in members collection.
// - Not a member        → { isMember: false }
// - Member, auth exists → { isMember: true, authExists: true }  (wrong password case)
// - Member, no auth     → creates Auth account → { isMember: true, created: true }
//   (caller should then call sendPasswordResetEmail client-side)
// Requires a valid Firebase ID token from a BOARD, ADMIN, or SUPER_ADMIN caller.
export default async (req, context) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // Verify caller identity — only privileged roles may check/create auth accounts
  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader?.startsWith('Bearer ')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const idToken = authHeader.split('Bearer ')[1];
  try {
    const auth = getAuth();
    const decoded = await auth.verifyIdToken(idToken);
    const db = getFirestore();
    const callerDoc = await db.collection('members').doc(decoded.uid).get();
    const callerRole = callerDoc.data()?.role;
    if (!['ADMIN', 'SUPER_ADMIN', 'BOARD'].includes(callerRole)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
  } catch {
    return Response.json({ error: 'Invalid or expired token' }, { status: 401 });
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
    const db = getFirestore();
    const snap = await db.collection('members').where('email', '==', email).limit(1).get();

    if (snap.empty) {
      return Response.json({ isMember: false });
    }

    // Check if Auth account already exists
    try {
      await getAuth().getUserByEmail(email);
      return Response.json({ isMember: true, authExists: true });
    } catch (authErr) {
      if (authErr.code !== 'auth/user-not-found') throw authErr;
    }

    // Create Auth account with a random temp password (will be overwritten via reset)
    const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8).toUpperCase() + '1!';
    await getAuth().createUser({ email, password: tempPassword });

    return Response.json({ isMember: true, created: true });
  } catch (err) {
    console.error('[check-and-create-auth] error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
};
