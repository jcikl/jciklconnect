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
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!getApps().length) {
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

const ALLOWED_ORIGINS = ['https://app.jcikl.cc', 'http://localhost:3000', 'http://localhost:3001'];
const BOARD_ROLES = ['BOARD', 'ADMIN', 'SUPER_ADMIN'];

export default async (req, context) => {
  const requestOrigin = req.headers.get('origin') ?? '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(requestOrigin) ? requestOrigin : ALLOWED_ORIGINS[0];
  const cors = {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: cors });

  // Verify Firebase ID token — BOARD+ only
  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers: cors });
  }
  try {
    const decoded = await getAuth().verifyIdToken(authHeader.split('Bearer ')[1]);
    const callerDoc = await getFirestore().collection('members').doc(decoded.uid).get();
    const role = callerDoc.data()?.role;
    if (!BOARD_ROLES.includes(role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403, headers: cors });
    }
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers: cors });
  }

  const whapiToken = process.env.WHAPI_API_TOKEN;
  if (!whapiToken) {
    return Response.json({ error: 'WHAPI_API_TOKEN not configured' }, { status: 500, headers: cors });
  }

  let body;
  try {
    body = await req.json().catch(() => ({}));
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400, headers: cors });
  }

  const { op, groupId, to, message } = body;
  const whapiHeaders = { Accept: 'application/json', Authorization: `Bearer ${whapiToken}`, 'Content-Type': 'application/json' };

  try {
    let whapiRes, data;
    if (op === 'limits') {
      whapiRes = await fetch('https://gate.whapi.cloud/limits', { headers: whapiHeaders });
    } else if (op === 'group') {
      if (!groupId) return Response.json({ error: 'groupId required' }, { status: 400, headers: cors });
      if (!/^[a-zA-Z0-9_\-@.]{1,64}$/.test(groupId)) {
        return Response.json({ error: 'Invalid groupId format' }, { status: 400, headers: cors });
      }
      whapiRes = await fetch(`https://gate.whapi.cloud/groups/${groupId}`, { headers: whapiHeaders });
    } else if (op === 'send') {
      if (!to || !message) return Response.json({ error: 'to and message required' }, { status: 400, headers: cors });
      whapiRes = await fetch('https://gate.whapi.cloud/messages/text', {
        method: 'POST',
        headers: whapiHeaders,
        body: JSON.stringify({ to, body: message }),
      });
    } else {
      return Response.json({ error: `Unknown op: ${op}` }, { status: 400, headers: cors });
    }

    if (whapiRes.status === 204) {
      return Response.json({}, { headers: cors });
    }
    data = await whapiRes.json().catch(() => ({}));
    return Response.json(data, { status: whapiRes.ok ? 200 : whapiRes.status, headers: cors });
  } catch (err) {
    console.error('[whapi-proxy] error:', err.message);
    return Response.json({ error: 'Internal server error' }, { status: 500, headers: cors });
  }
};
