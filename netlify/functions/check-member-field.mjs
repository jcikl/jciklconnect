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

// Checks if a given field value already exists in the members collection.
// members collection is the sole source of truth for registration eligibility.
// Supports: field=email, field=phone
// Requires a valid Firebase ID token from a BOARD, ADMIN, or SUPER_ADMIN caller.
export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // Verify caller identity — only BOARD+ may enumerate PII fields
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
