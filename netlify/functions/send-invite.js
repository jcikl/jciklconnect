const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

const rateLimitMap = new Map() // callerUid -> { count, resetAt }
const RATE_LIMIT = 10 // max invites per window
const RATE_WINDOW_MS = 10 * 60 * 1000 // 10 minutes

// SEC-CF05: FIREBASE_ADMIN_* (no VITE_ prefix) so Vite never injects these into the browser bundle.
const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

console.log('[send-invite] init check:', {
  hasProjectId: !!projectId,
  hasClientEmail: !!clientEmail,
  hasPrivateKey: !!privateKey,
});

if (!getApps().length) {
  initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

// NET-011: Restrict CORS to known origins only (mirrors toyyibpay-api.js pattern)
const ALLOWED_ORIGINS = ['https://app.jcikl.cc', 'http://localhost:3000', 'http://localhost:3001'];

exports.handler = async (event) => {
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

  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return { statusCode: 401, headers: cors, body: JSON.stringify({ error: 'Unauthorized' }) };
  }
  const idToken = authHeader.split('Bearer ')[1];
  let callerUid;
  try {
    const decoded = await getAuth().verifyIdToken(idToken);
    callerUid = decoded.uid;
    const callerDoc = await getFirestore().collection('members').doc(callerUid).get();
    const role = callerDoc.data()?.role;
    if (!['ADMIN', 'SUPER_ADMIN'].includes(role)) {
      return { statusCode: 403, headers: cors, body: JSON.stringify({ error: 'Forbidden' }) };
    }
  } catch {
    return { statusCode: 401, headers: cors, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  // NET-007: rate limit per caller (resets on cold start)
  const now = Date.now()
  const entry = rateLimitMap.get(callerUid) || { count: 0, resetAt: now + RATE_WINDOW_MS }
  if (now > entry.resetAt) { entry.count = 0; entry.resetAt = now + RATE_WINDOW_MS }
  if (entry.count >= RATE_LIMIT) {
    return { statusCode: 429, headers: cors, body: JSON.stringify({ error: 'Rate limit exceeded. Try again later.' }) }
  }
  entry.count++
  rateLimitMap.set(callerUid, entry)

  let email;
  try {
    ({ email } = JSON.parse(event.body));
  } catch {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  // NET-006: validate email format, type, and length
  if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Invalid email address' }) }
  }

  const auth = getAuth();

  try {
    try {
      await auth.getUserByEmail(email);
    } catch (notFoundErr) {
      if (notFoundErr.code === 'auth/user-not-found') {
        await auth.createUser({ email, emailVerified: false });
      } else {
        throw notFoundErr;
      }
    }

    const link = await auth.generatePasswordResetLink(email);

    // TODO (TEMPORARY — must replace before production): Deliver this link via a
    // transactional email provider (Resend / SendGrid / Nodemailer) instead of
    // logging it server-side. The link is a one-time account-access token; logging
    // it is acceptable for internal admin use only. Remove the console.log and add
    // proper email delivery once an email integration is in place.
    console.log('[send-invite] Invite link for', email, ':', link);

    return {
      statusCode: 200,
      headers: cors,
      body: JSON.stringify({
        success: true,
        message: 'User account created. Password reset link logged server-side. Check Netlify function logs or Firebase Console for the link. Email delivery integration pending.',
      }),
    };
  } catch (err) {
    console.error('[send-invite] error:', err);
    // NET-002: never expose internal error details to the caller
    return {
      statusCode: 500,
      headers: cors,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
