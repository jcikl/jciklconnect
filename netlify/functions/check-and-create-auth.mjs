import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
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

// POST { email }
// Checks if email is in members collection.
// - Not a member        → { isMember: false }
// - Member, auth exists → { isMember: true, authExists: true }  (wrong password case)
// - Member, no auth     → creates Auth account → { isMember: true, created: true }
//   (caller should then call sendPasswordResetEmail client-side)
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
    const db = getFirestore();
    const snap = await db.collection('members').where('email', '==', email).limit(1).get();

    if (snap.empty) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isMember: false }),
      };
    }

    // Check if Auth account already exists
    try {
      await getAuth().getUserByEmail(email);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isMember: true, authExists: true }),
      };
    } catch (authErr) {
      if (authErr.code !== 'auth/user-not-found') throw authErr;
    }

    // Create Auth account with a random temp password (will be overwritten via reset)
    const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8).toUpperCase() + '1!';
    await getAuth().createUser({ email, password: tempPassword });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isMember: true, created: true }),
    };
  } catch (err) {
    console.error('[check-and-create-auth] error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
