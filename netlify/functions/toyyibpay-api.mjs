/**
 * ToyyibPay API Proxy
 * Forwards requests to ToyyibPay API server-side to bypass browser CORS restrictions.
 * Supported actions: getCategories, getCategoryDetails, createCategory, createBill, getBills, getSettlements
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

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

// FIX 3: Allowlist of safe params that may be forwarded to ToyyibPay createBill
const CREATE_BILL_ALLOWED_PARAMS = [
  'billName', 'billDescription', 'billAmount', 'billTo',
  'billEmail', 'billPhone', 'billSplitPayment', 'billSplitPaymentArgs',
  'categoryCode', // required by ToyyibPay to assign the bill to a category
];

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
        // BOARD+ can toggle sandbox/production mode — persisted to Firestore
        if (typeof params.isSandbox !== 'boolean') {
          return Response.json({ error: 'isSandbox (boolean) required' }, { status: 400, headers: cors });
        }
        await getFirestore().doc('systemConfig/toyyibpay').set(
          { isSandbox: params.isSandbox, updatedAt: new Date().toISOString(), updatedBy: decodedUid },
          { merge: true }
        );
        result = { isSandbox: params.isSandbox };
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
        // NET-008: Input validation before forwarding to ToyyibPay
        const rawAmount = Number(params.billAmount);
        if (!params.billAmount || isNaN(rawAmount) || rawAmount <= 0) {
          return Response.json({ error: 'Invalid input: billAmount must be a positive number' }, { status: 400, headers: cors });
        }
        if (!params.billName || String(params.billName).length > 255) {
          return Response.json({ error: 'Invalid input: billName is required and must be ≤255 characters' }, { status: 400, headers: cors });
        }
        if (!params.billDescription || String(params.billDescription).length > 255) {
          return Response.json({ error: 'Invalid input: billDescription is required and must be ≤255 characters' }, { status: 400, headers: cors });
        }
        if (params.billEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(params.billEmail)) {
          return Response.json({ error: 'Invalid input: billEmail has an invalid format' }, { status: 400, headers: cors });
        }

        // FIX 3: Only forward explicitly allowlisted params; lock callback/return URLs
        const sanitized = {};
        for (const key of CREATE_BILL_ALLOWED_PARAMS) {
          if (params[key] !== undefined) sanitized[key] = params[key];
        }
        // Lock callback URL to our own webhook — never accept from caller.
        // NET-005: Append ?secret=... so the callback handler can verify the request
        // originated from ToyyibPay via a shared-secret we control.
        const baseCallbackUrl =
          process.env.TOYYIBPAY_CALLBACK_URL ||
          'https://app.jcikl.cc/.netlify/functions/toyyibpay-callback';
        const webhookSecret = process.env.TOYYIBPAY_WEBHOOK_SECRET;
        sanitized.billCallbackUrl = webhookSecret
          ? `${baseCallbackUrl}?secret=${encodeURIComponent(webhookSecret)}`
          : baseCallbackUrl;
        // Restrict return URL to our own domain (SEC-A-010).
        // localhost is only allowed in non-production environments to prevent payment
        // gateway callbacks from following http:// redirects in production.
        const returnUrl = params.billReturnUrl || '';
        const isProduction = process.env.NODE_ENV === 'production' ||
          (process.env.URL || '').includes('app.jcikl.cc');
        const isAllowedReturn =
          returnUrl.startsWith('https://app.jcikl.cc') ||
          (!isProduction && (
            returnUrl.startsWith('http://localhost:3000') ||
            returnUrl.startsWith('http://localhost:3001')
          ));
        sanitized.billReturnUrl = isAllowedReturn
          ? returnUrl
          : 'https://app.jcikl.cc/payment/result';
        result = await callToyyib('createBill', sanitized, isSandbox);
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
