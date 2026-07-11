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

// POST { uid } OR { email }
// Deletes a Firebase Auth account for an orphaned user (no members record).
export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let uid, email;
  try {
    ({ uid, email } = JSON.parse(event.body));
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  if (!uid && !email) {
    return { statusCode: 400, body: JSON.stringify({ error: 'uid or email is required' }) };
  }

  try {
    const auth = getAuth();

    if (!uid && email) {
      const user = await auth.getUserByEmail(email);
      uid = user.uid;
    }

    await auth.deleteUser(uid);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deleted: true }),
    };
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleted: false, reason: 'not_found' }),
      };
    }
    console.error('[delete-auth-user] error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
