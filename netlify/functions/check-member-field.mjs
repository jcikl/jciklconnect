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
export default async (req, context) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // Verify caller identity — only BOARD+ may enumerate PII fields
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

  let field, value;
  try {
    ({ field, value } = await req.json().catch(() => ({})));
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!field || !value || !['email', 'phone'].includes(field)) {
    return Response.json({ error: 'field (email|phone) and value are required' }, { status: 400 });
  }

  try {
    const db = getFirestore();
    const snap = await db.collection('members').where(field, '==', value).limit(1).get();
    return Response.json({ exists: !snap.empty });
  } catch (err) {
    console.error('[check-member-field] error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
};
