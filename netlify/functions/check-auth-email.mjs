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

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // Verify caller identity — only BOARD+ may check Firebase Auth account status
  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }
  const idToken = authHeader.split('Bearer ')[1];
  try {
    const decoded = await getAuth().verifyIdToken(idToken);
    const callerDoc = await getFirestore().collection('members').doc(decoded.uid).get();
    const callerRole = callerDoc.data()?.role;
    if (!['BOARD', 'ADMIN', 'SUPER_ADMIN'].includes(callerRole)) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden' }) };
    }
  } catch {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  let email;
  try {
    ({ email } = JSON.parse(event.body));
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body' }) };
  }
  if (!email) {
    return { statusCode: 400, body: JSON.stringify({ error: 'email is required' }) };
  }

  try {
    const user = await getAuth().getUserByEmail(email);
    return {
      statusCode: 200,
      body: JSON.stringify({
        exists: true,
        providers: user.providerData.map(p => p.providerId),
      }),
    };
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      return { statusCode: 200, body: JSON.stringify({ exists: false, providers: [] }) };
    }
    console.error('[check-auth-email] error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
