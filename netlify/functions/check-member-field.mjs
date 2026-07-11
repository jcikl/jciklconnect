import { initializeApp, getApps, cert } from 'firebase-admin/app';
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

// Checks if a given field value already exists in the members collection.
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
    const snap = await db.collection('members').where(field, '==', value).limit(1).get();
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exists: !snap.empty }),
    };
  } catch (err) {
    console.error('[check-member-field] error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
