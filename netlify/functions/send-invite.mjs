import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const rateLimitMap = new Map() // callerUid -> { count, resetAt }
const RATE_LIMIT = 10 // max invites per window
const RATE_WINDOW_MS = 10 * 60 * 1000 // 10 minutes

// SEC-CF05: FIREBASE_ADMIN_* (no VITE_ prefix) so Vite never injects these into the browser bundle.
const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

// P1: Credential boolean log removed — it leaks presence/absence of secrets to logs.

if (!getApps().length) {
  initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

// NET-011: Restrict CORS to known origins only (mirrors toyyibpay-api.js pattern)
const ALLOWED_ORIGINS = ['https://app.jcikl.cc', 'http://localhost:3000', 'http://localhost:3001'];

export default async (req, context) => {
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

  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader?.startsWith('Bearer ')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers: cors });
  }
  const idToken = authHeader.split('Bearer ')[1];
  let callerUid;
  try {
    const decoded = await getAuth().verifyIdToken(idToken);
    callerUid = decoded.uid;
    const callerDoc = await getFirestore().collection('members').doc(callerUid).get();
    const role = callerDoc.data()?.role;
    if (!['ADMIN', 'SUPER_ADMIN'].includes(role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403, headers: cors });
    }
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers: cors });
  }

  // NET-007: rate limit per caller (resets on cold start)
  const now = Date.now()
  const entry = rateLimitMap.get(callerUid) || { count: 0, resetAt: now + RATE_WINDOW_MS }
  if (now > entry.resetAt) { entry.count = 0; entry.resetAt = now + RATE_WINDOW_MS }
  if (entry.count >= RATE_LIMIT) {
    return Response.json({ error: 'Rate limit exceeded. Try again later.' }, { status: 429, headers: cors });
  }
  entry.count++
  rateLimitMap.set(callerUid, entry)

  let email;
  try {
    ({ email } = await req.json().catch(() => ({})));
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400, headers: cors });
  }

  // NET-006: validate email format, type, and length
  if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: 'Invalid email address' }, { status: 400, headers: cors });
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

    // Use Firebase's built-in password-reset email infrastructure (same template
    // configured in Firebase Console → Authentication → Templates).
    // The REST endpoint triggers the actual email delivery without a third-party
    // email service; the only requirement is the project's Web API key.
    // P1: Use FIREBASE_WEB_API_KEY (no VITE_ prefix) — set this separately in the Netlify dashboard.
    // VITE_-prefixed vars are bundled into the browser by Vite and must not be used server-side.
    const apiKey = process.env.FIREBASE_WEB_API_KEY;
    if (!apiKey) {
      throw new Error('FIREBASE_WEB_API_KEY env var missing — cannot send reset email');
    }
    const resetRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestType: 'PASSWORD_RESET', email }),
      }
    );
    if (!resetRes.ok) {
      // P2 Fix: consume body to avoid connection leaks; do not log it as it may contain the member email address.
      const errBody = await resetRes.text();
      console.error('[send-invite] sendOobCode failed, status:', resetRes.status);
      const sendError = new Error('Failed to send password reset email');
      // Log failed send
      try {
        const db = getFirestore();
        await db.collection('emailLogs').add({
          recipientEmail: email,
          emailType: 'invitation',
          sentAt: FieldValue.serverTimestamp(),
          success: false,
          errorMessage: `sendOobCode HTTP ${resetRes.status}: ${errBody}`,
          triggeredBy: 'netlify-function',
          subject: 'JCI KL — Set up your password',
        });
      } catch (logError) {
        console.error('[send-invite] Failed to write email log (failure):', logError);
      }
      throw sendError;
    }

    console.log('[send-invite] Password reset email sent, target redacted');

    // Log successful send
    try {
      const db = getFirestore();
      await db.collection('emailLogs').add({
        recipientEmail: email,
        emailType: 'invitation',
        sentAt: FieldValue.serverTimestamp(),
        success: true,
        triggeredBy: 'netlify-function',
        subject: 'JCI KL — Set up your password',
      });
    } catch (logError) {
      console.error('[send-invite] Failed to write email log (success):', logError);
      // Don't throw — logging failure should not break email delivery
    }

    return Response.json(
      {
        success: true,
        message: 'Invite sent. The member will receive a password-setup email shortly.',
      },
      { headers: cors }
    );
  } catch (err) {
    console.error('[send-invite] error:', err);
    // NET-002: never expose internal error details to the caller
    return Response.json({ error: 'Internal server error' }, { status: 500, headers: cors });
  }
};
