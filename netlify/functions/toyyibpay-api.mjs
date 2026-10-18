/**
 * ToyyibPay API Proxy
 * Forwards requests to ToyyibPay API server-side to bypass browser CORS restrictions.
 * Supported actions: getCategories, getCategoryDetails, createCategory, createBill, getBills, getSettlements
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { resolveReturnUrl, resolveCallbackUrl } from '../lib/siteUrl.mjs';
import { buildCreateBillParams } from '../lib/toyyibBill.mjs';

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
if (!projectId || !clientEmail || !privateKey) {
  throw new Error('[toyyibpay-api] Missing FIREBASE_ADMIN_* env vars');
}

if (!getApps().length) {
  initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

// FIX 2: Restrict CORS to known origins only
const ALLOWED_ORIGINS = ['https://app.jcikl.cc', 'http://localhost:3000', 'http://localhost:3001'];

// FIX 3: the createBill allowlist now lives in netlify/lib/toyyibBill.mjs (buildCreateBillParams).

// Sandbox key = TOYYIBPAY_SECRET_KEY, Production key = TOYYIBPAY_SECRET_KEY_PROD.
// Mode (sandbox vs production) is read from Firestore systemConfig/toyyibpay at request time,
// falling back to TOYYIBPAY_SANDBOX env var if Firestore is unavailable.
const SECRET_KEY_SANDBOX = process.env.TOYYIBPAY_SECRET_KEY;
const SECRET_KEY_PROD = process.env.TOYYIBPAY_SECRET_KEY_PROD || process.env.TOYYIBPAY_SECRET_KEY;
if (!SECRET_KEY_SANDBOX) throw new Error('TOYYIBPAY_SECRET_KEY env var not set');

const ENV_SANDBOX_DEFAULT = process.env.TOYYIBPAY_SANDBOX !== 'false'; // env fallback

async function getToyyibMode() {
  try {
    const snap = await getFirestore().doc('systemConfig/toyyibpay').get();
    if (snap.exists) {
      const data = snap.data();
      if (typeof data.isSandbox === 'boolean') return data.isSandbox;
    }
  } catch (err) {
    console.warn('[toyyibpay-api] Could not read systemConfig/toyyibpay, using env fallback:', err.message);
  }
  return ENV_SANDBOX_DEFAULT;
}

async function callToyyib(endpoint, extraParams = {}, isSandbox) {
  const secretKey = isSandbox ? SECRET_KEY_SANDBOX : SECRET_KEY_PROD;
  const baseUrl = isSandbox
    ? 'https://dev.toyyibpay.com/index.php/api'
    : 'https://toyyibpay.com/index.php/api';
  const params = new URLSearchParams({ userSecretKey: secretKey, ...extraParams });
  const response = await fetch(`${baseUrl}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  if (!response.ok) throw new Error(`ToyyibPay ${endpoint} HTTP ${response.status}`);
  return response.json();
}

// Try to call ToyyibPay; return fallback when endpoint is unsupported (404/405) or returns non-JSON
async function callToyyibOrEmpty(endpoint, extraParams = {}, isSandbox, fallback = []) {
  try {
    return await callToyyib(endpoint, extraParams, isSandbox);
  } catch (err) {
    const isUnsupported =
      err.message.includes('HTTP 404') ||
      err.message.includes('HTTP 405') ||
      err instanceof SyntaxError ||
      err.name === 'SyntaxError';
    if (isUnsupported) {
      console.warn(`[toyyibpay-api] ${endpoint} not available (${err.message}), returning fallback`);
      return fallback;
    }
    throw err;
  }
}

export default async (req, context) => {
  // FIX 2: Only reflect origin back if it is in the allowlist
  const requestOrigin = req.headers.get('origin') ?? '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(requestOrigin) ? requestOrigin : ALLOWED_ORIGINS[0];
  const cors = {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: cors });
  }

  // Require Firebase ID token for all requests
  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader?.startsWith('Bearer ')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers: cors });
  }
  const idToken = authHeader.split('Bearer ')[1];
  let decodedUid, callerRole;
  try {
    const decoded = await getAuth().verifyIdToken(idToken);
    decodedUid = decoded.uid;
    const callerDoc = await getFirestore().collection('members').doc(decoded.uid).get();
    callerRole = callerDoc.data()?.role;
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers: cors });
  }

  let body = {};
  try {
    body = await req.json().catch(() => ({}));
  } catch {
    return new Response('Invalid JSON', { status: 400, headers: cors });
  }

  const { action, ...params } = body;

  // createCategory, createBill, and setMode are BOARD+-only; all other actions require only authentication
  if (
    (action === 'createCategory' || action === 'createBill' || action === 'setMode') &&
    !['BOARD', 'ADMIN', 'SUPER_ADMIN'].includes(callerRole)
  ) {
    return Response.json({ error: 'Forbidden' }, { status: 403, headers: cors });
  }

  // Resolve sandbox/production mode once per request from Firestore (with env fallback)
  const isSandbox = await getToyyibMode();

  try {
    let result;
    switch (action) {
      case 'getMode':
        // Returns current mode so client can build correct payment URLs
        result = { isSandbox, hasProdKey: !!process.env.TOYYIBPAY_SECRET_KEY_PROD };
        break;
      case 'setMode': {
        // BOARD+ can toggle sandbox/production mode — persisted to Firestore.
        // Older clients sent the flag as the string "true"/"false"; accept both forms.
        const rawMode = params.isSandbox;
        const nextIsSandbox = rawMode === true || rawMode === 'true' ? true
          : rawMode === false || rawMode === 'false' ? false
          : null;
        if (nextIsSandbox === null) {
          return Response.json({ error: 'isSandbox (boolean) required' }, { status: 400, headers: cors });
        }
        if (!nextIsSandbox && !process.env.TOYYIBPAY_SECRET_KEY_PROD) {
          return Response.json({ error: 'TOYYIBPAY_SECRET_KEY_PROD is not configured' }, { status: 400, headers: cors });
        }
        await getFirestore().doc('systemConfig/toyyibpay').set(
          { isSandbox: nextIsSandbox, updatedAt: new Date().toISOString(), updatedBy: decodedUid },
          { merge: true }
        );
        result = { isSandbox: nextIsSandbox };
        break;
      }
      case 'getCategories':
        // ToyyibPay has no "list all" endpoint — getCategoryDetails requires a specific categoryCode.
        // The client now calls getCategoryDetails per code; this action is kept for compatibility.
        result = [];
        break;
      case 'getCategoryDetails':
        if (!params.categoryCode) return new Response('categoryCode required', { status: 400, headers: cors });
        result = await callToyyib('getCategoryDetails', { categoryCode: params.categoryCode }, isSandbox);
        break;
      case 'createCategory':
        if (!params.catname || !params.catdescription) return new Response('catname and catdescription required', { status: 400, headers: cors });
        result = await callToyyib('createCategory', { catname: params.catname, catdescription: params.catdescription }, isSandbox);
        break;
      case 'createBill': {
        // NET-008 / FIX 3: validate and allowlist in netlify/lib/toyyibBill.mjs. It also fixes the
        // price setting (fixed amount) and payer-info flags server-side; they used to be stripped
        // by the allowlist, so ToyyibPay rejected every bill ("billPriceSetting parameter is empty").
        const built = buildCreateBillParams(params);
        if (!built.ok) return Response.json({ error: built.error }, { status: 400, headers: cors });
        const sanitized = built.params;
        // Lock callback URL to our own webhook — never accept from caller.
        // NET-005: Append ?secret=... so the callback handler can verify the request
        // originated from ToyyibPay via a shared-secret we control.
        // The site domain comes from Netlify's URL / DEPLOY_PRIME_URL (netlify/lib/siteUrl.mjs);
        // it used to be hard-coded to app.jcikl.cc, a domain the site no longer serves.
        const baseCallbackUrl = resolveCallbackUrl();
        if (!baseCallbackUrl) throw new Error('Cannot determine ToyyibPay callback URL (TOYYIBPAY_CALLBACK_URL / URL not set)');
        const webhookSecret = process.env.TOYYIBPAY_WEBHOOK_SECRET;
        sanitized.billCallbackUrl = webhookSecret
          ? `${baseCallbackUrl}?secret=${encodeURIComponent(webhookSecret)}`
          : baseCallbackUrl;
        // Restrict return URL to our own origins (SEC-A-010); localhost only outside production.
        const resolvedReturnUrl = resolveReturnUrl(params.billReturnUrl);
        if (!resolvedReturnUrl) throw new Error('Cannot determine ToyyibPay return URL (URL not set)');
        sanitized.billReturnUrl = resolvedReturnUrl;
        result = await callToyyib('createBill', sanitized, isSandbox);
        // Diagnostics for missing payment callbacks: where ToyyibPay will POST (secret never logged).
        console.log('[toyyibpay-api] createBill', JSON.stringify({
          mode: isSandbox ? 'sandbox' : 'production',
          billCode: Array.isArray(result) ? result[0]?.BillCode ?? null : null,
          callbackUrl: baseCallbackUrl,
          callbackHasSecret: !!webhookSecret,
          returnUrl: sanitized.billReturnUrl,
          externalRef: sanitized.billExternalReferenceNo ?? null,
        }));
        break;
      }
      case 'getBills':
        // ToyyibPay has no "list all bills" endpoint — getBillTransactions requires a specific billCode.
        // Return empty array; bills are tracked in our own Firestore instead.
        result = [];
        break;
      case 'getSettlements':
        // Get Settlement Summary is Enterprise Partner only — not available for regular accounts.
        result = [];
        break;
      case 'getBillTransactions':
        // Check transactions for a specific bill
        if (!params.billCode) return new Response('billCode required', { status: 400, headers: cors });
        result = await callToyyib('getBillTransactions', {
          billCode: params.billCode,
          ...(params.billpaymentStatus ? { billpaymentStatus: params.billpaymentStatus } : {}),
        }, isSandbox);
        break;
      default:
        return new Response(`Unknown action: ${action}`, { status: 400, headers: cors });
    }
    return Response.json(result, { headers: cors });
  } catch (err) {
    console.error(`[toyyibpay-api] action=${action} error:`, err);
    // NET-003: never expose internal error details to the caller
    return Response.json({ error: 'Upstream payment service error' }, { status: 502, headers: cors });
  }
};
