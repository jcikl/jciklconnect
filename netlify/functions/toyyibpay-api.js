/**
 * ToyyibPay API Proxy
 * Forwards requests to ToyyibPay API server-side to bypass browser CORS restrictions.
 * Supported actions: getCategories, getCategoryDetails, createCategory, createBill, getBills, getSettlements
 */

const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

if (!getApps().length) {
  initializeApp({
    credential: cert({
      // TODO SEC-010: Rename Netlify dashboard vars to FIREBASE_ADMIN_PROJECT_ID,
      // FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY (no VITE_ prefix).
      // VITE_ naming risks accidentally bundling these into the browser build if added to .env.
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL || process.env.VITE_FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_ADMIN_PRIVATE_KEY || process.env.VITE_FIREBASE_PRIVATE_KEY)?.replace(/\\n/g, '\n'),
    }),
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

const SECRET_KEY = process.env.TOYYIBPAY_SECRET_KEY;
if (!SECRET_KEY) throw new Error('TOYYIBPAY_SECRET_KEY env var not set');
const IS_SANDBOX = process.env.TOYYIBPAY_SANDBOX !== 'false'; // default sandbox
const BASE_URL = IS_SANDBOX
  ? 'https://dev.toyyibpay.com/index.php/api'
  : 'https://toyyibpay.com/index.php/api';

async function callToyyib(endpoint, extraParams = {}) {
  const params = new URLSearchParams({ userSecretKey: SECRET_KEY, ...extraParams });
  const response = await fetch(`${BASE_URL}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  if (!response.ok) throw new Error(`ToyyibPay ${endpoint} HTTP ${response.status}`);
  return response.json();
}

// Try to call ToyyibPay; return fallback when endpoint is unsupported (404/405) or returns non-JSON
async function callToyyibOrEmpty(endpoint, extraParams = {}, fallback = []) {
  try {
    return await callToyyib(endpoint, extraParams);
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

exports.handler = async (event) => {
  // FIX 2: Only reflect origin back if it is in the allowlist
  const requestOrigin = event.headers.origin || event.headers.Origin || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(requestOrigin) ? requestOrigin : ALLOWED_ORIGINS[0];
  const cors = {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: cors, body: 'Method Not Allowed' };
  }

  // Require Firebase ID token for all requests
  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return { statusCode: 401, headers: cors, body: JSON.stringify({ error: 'Unauthorized' }) };
  }
  const idToken = authHeader.split('Bearer ')[1];
  let decodedUid, callerRole;
  try {
    const decoded = await getAuth().verifyIdToken(idToken);
    decodedUid = decoded.uid;
    const callerDoc = await getFirestore().collection('members').doc(decoded.uid).get();
    callerRole = callerDoc.data()?.role;
  } catch {
    return { statusCode: 401, headers: cors, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  let body = {};
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers: cors, body: 'Invalid JSON' };
  }

  const { action, ...params } = body;

  // createCategory and createBill are BOARD+-only; all other actions require only authentication
  if (
    (action === 'createCategory' || action === 'createBill') &&
    !['BOARD', 'ADMIN', 'SUPER_ADMIN'].includes(callerRole)
  ) {
    return { statusCode: 403, headers: cors, body: JSON.stringify({ error: 'Forbidden' }) };
  }

  try {
    let result;
    switch (action) {
      case 'getCategories':
        // ToyyibPay has no "list all" endpoint — getCategoryDetails requires a specific categoryCode.
        // The client now calls getCategoryDetails per code; this action is kept for compatibility.
        result = [];
        break;
      case 'getCategoryDetails':
        if (!params.categoryCode) return { statusCode: 400, headers: cors, body: 'categoryCode required' };
        result = await callToyyib('getCategoryDetails', { categoryCode: params.categoryCode });
        break;
      case 'createCategory':
        if (!params.catname || !params.catdescription) return { statusCode: 400, headers: cors, body: 'catname and catdescription required' };
        result = await callToyyib('createCategory', { catname: params.catname, catdescription: params.catdescription });
        break;
      case 'createBill': {
        // NET-008: Input validation before forwarding to ToyyibPay
        const rawAmount = Number(params.billAmount);
        if (!params.billAmount || isNaN(rawAmount) || rawAmount <= 0) {
          return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Invalid input: billAmount must be a positive number' }) };
        }
        if (!params.billName || String(params.billName).length > 255) {
          return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Invalid input: billName is required and must be ≤255 characters' }) };
        }
        if (!params.billDescription || String(params.billDescription).length > 255) {
          return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Invalid input: billDescription is required and must be ≤255 characters' }) };
        }
        if (params.billEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(params.billEmail)) {
          return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Invalid input: billEmail has an invalid format' }) };
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
        result = await callToyyib('createBill', sanitized);
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
        if (!params.billCode) return { statusCode: 400, headers: cors, body: 'billCode required' };
        result = await callToyyib('getBillTransactions', {
          billCode: params.billCode,
          ...(params.billpaymentStatus ? { billpaymentStatus: params.billpaymentStatus } : {}),
        });
        break;
      default:
        return { statusCode: 400, headers: cors, body: `Unknown action: ${action}` };
    }
    return {
      statusCode: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
      body: JSON.stringify(result),
    };
  } catch (err) {
    console.error(`[toyyibpay-api] action=${action} error:`, err);
    return {
      statusCode: 502,
      headers: { ...cors, 'Content-Type': 'application/json' },
      // NET-003: never expose internal error details to the caller
      body: JSON.stringify({ error: 'Upstream payment service error' }),
    };
  }
};
