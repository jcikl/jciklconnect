/**
 * audit-log.mjs — Netlify Function
 *
 * Writes an audit log entry to Firestore using the Firebase Admin SDK.
 * This function exists so that BOARD-role users (who lack direct Firestore
 * write permission on the auditLog collection) can still produce audit entries
 * for security-sensitive operations they are allowed to perform.
 *
 * The caller must provide a valid Firebase ID token in the Authorization header.
 * The function verifies the token, checks the caller's role, and writes the
 * entry under the server's admin credentials.
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!getApps().length) {
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

const ALLOWED_ORIGINS = ['https://app.jcikl.cc', 'http://localhost:3000', 'http://localhost:3001'];
// Only roles that can perform auditable actions are permitted.
const ALLOWED_ROLES = ['BOARD', 'ADMIN', 'SUPER_ADMIN'];
const AUDIT_LOG_COLLECTION = 'auditLog';

export const handler = async (event) => {
  const origin = event.headers?.origin ?? '';
  const corsHeaders = {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // Verify Firebase ID token
  const authHeader = event.headers?.authorization ?? '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) {
    return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'Missing authorization token' }) };
  }

  let decodedToken;
  try {
    decodedToken = await getAuth().verifyIdToken(idToken);
  } catch {
    return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'Invalid or expired token' }) };
  }

  // Verify the caller has an auditable role
  const db = getFirestore();
  const callerSnap = await db.collection('members').doc(decodedToken.uid).get();
  const callerRole = callerSnap.exists ? (callerSnap.data()?.role ?? callerSnap.data()?.jciCareer?.role) : null;
  if (!ALLOWED_ROLES.includes(callerRole)) {
    return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ error: 'Insufficient role to write audit log' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body ?? '{}');
  } catch {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { action, targetCollection, targetId, before, after, metadata } = body;
  if (!action || !targetCollection || !targetId) {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'action, targetCollection, and targetId are required' }) };
  }

  try {
    await db.collection(AUDIT_LOG_COLLECTION).add({
      action,
      performedBy: decodedToken.uid,
      targetCollection,
      targetId,
      before: before ?? null,
      after: after ?? null,
      metadata: metadata ?? null,
      timestamp: Timestamp.now(),
      _source: 'netlify-function',
    });
    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ ok: true }) };
  } catch (error) {
    console.error('[audit-log] Firestore write failed:', error);
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: 'Failed to write audit log' }) };
  }
};
