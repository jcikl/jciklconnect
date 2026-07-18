/**
 * Whapi API Proxy (SEC — keep WHAPI_API_TOKEN server-side)
 * Routes Whapi calls through this function so the token is never
 * stored in the browser or sent from the client.
 *
 * Requires env vars (no VITE_ prefix):
 *   WHAPI_API_TOKEN   — the Whapi channel API token
 *   FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY
 *
 * Supported operations (sent in request body as JSON):
 *   { op: 'limits' }
 *   { op: 'group', groupId: string }
 *   { op: 'send', to: string, message: string }
 */
const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!getApps().length) {
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

const ALLOWED_ORIGINS = ['https://app.jcikl.cc', 'http://localhost:3000', 'http://localhost:3001'];
const BOARD_ROLES = ['BOARD', 'ADMIN', 'SUPER_ADMIN'];

exports.handler = async (event) => {
  const requestOrigin = event.headers.origin || event.headers.Origin || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(requestOrigin) ? requestOrigin : ALLOWED_ORIGINS[0];
  const cors = {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: cors, body: 'Method Not Allowed' };

  // Verify Firebase ID token — BOARD+ only
  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return { statusCode: 401, headers: cors, body: JSON.stringify({ error: 'Unauthorized' }) };
  }
  try {
    const decoded = await getAuth().verifyIdToken(authHeader.split('Bearer ')[1]);
    const callerDoc = await getFirestore().collection('members').doc(decoded.uid).get();
    const role = callerDoc.data()?.role;
    if (!BOARD_ROLES.includes(role)) {
      return { statusCode: 403, headers: cors, body: JSON.stringify({ error: 'Forbidden' }) };
    }
  } catch {
    return { statusCode: 401, headers: cors, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const whapiToken = process.env.WHAPI_API_TOKEN;
  if (!whapiToken) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: 'WHAPI_API_TOKEN not configured' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { op, groupId, to, message } = body;
  const whapiHeaders = { Accept: 'application/json', Authorization: `Bearer ${whapiToken}`, 'Content-Type': 'application/json' };

  try {
    let whapiRes, data;
    if (op === 'limits') {
      whapiRes = await fetch('https://gate.whapi.cloud/limits', { headers: whapiHeaders });
    } else if (op === 'group') {
      if (!groupId) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'groupId required' }) };
      if (!/^[a-zA-Z0-9_\-@.]{1,64}$/.test(groupId)) {
        return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Invalid groupId format' }) };
      }
      whapiRes = await fetch(`https://gate.whapi.cloud/groups/${groupId}`, { headers: whapiHeaders });
    } else if (op === 'send') {
      if (!to || !message) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'to and message required' }) };
      whapiRes = await fetch('https://gate.whapi.cloud/messages/text', {
        method: 'POST',
        headers: whapiHeaders,
        body: JSON.stringify({ to, body: message }),
      });
    } else {
      return { statusCode: 400, headers: cors, body: JSON.stringify({ error: `Unknown op: ${op}` }) };
    }

    if (whapiRes.status === 204) {
      return { statusCode: 200, headers: cors, body: JSON.stringify({}) };
    }
    data = await whapiRes.json().catch(() => ({}));
    return { statusCode: whapiRes.ok ? 200 : whapiRes.status, headers: cors, body: JSON.stringify(data) };
  } catch (err) {
    console.error('[whapi-proxy] error:', err.message);
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
