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

// Checks if a given field value already exists in the members collection.
// For email: also checks Firebase Auth to catch Google-linked accounts.
// Supports: field=email, field=phone
export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let field, value;
  try {
    ({ field, value } = JSON.parse(event.body));
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  if (!field || !value || !['email', 'phone'].includes(field)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'field (email|phone) and value are required' }) };
  }

  try {
    const db = getFirestore();

    // Check members collection
    const snap = await db.collection('members').where(field, '==', value).limit(1).get();
    if (!snap.empty) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exists: true }),
      };
    }

    // For email: also check Firebase Auth (catches Google-linked accounts not yet in members)
    if (field === 'email') {
      try {
        await getAuth().getUserByEmail(value);
        // Auth user found — email is taken
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ exists: true, authOnly: true }),
        };
      } catch (authErr) {
        if (authErr.code !== 'auth/user-not-found') throw authErr;
        // auth/user-not-found means email is free
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exists: false }),
    };
  } catch (err) {
    console.error('[check-member-field] error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
