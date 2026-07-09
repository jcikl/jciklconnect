import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.VITE_FIREBASE_PROJECT_ID,
      clientEmail: process.env.VITE_FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.VITE_FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
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
