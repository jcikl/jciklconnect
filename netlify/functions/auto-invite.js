const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!getApps().length) {
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

const ALLOWED_ORIGINS = ['https://app.jcikl.cc', 'http://localhost:3000', 'http://localhost:3001'];

// Rate limit by email (3 attempts per 10 min) to prevent abuse
const rateLimitMap = new Map(); // email -> { count, resetAt }
const RATE_LIMIT = 3;
const RATE_WINDOW_MS = 10 * 60 * 1000;

const NEUTRAL_RESPONSE = {
  success: true,
  message: 'If an account exists for this email, a password setup email has been sent.',
};

exports.handler = async (event) => {
  const requestOrigin = event.headers.origin || event.headers.Origin || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(requestOrigin) ? requestOrigin : ALLOWED_ORIGINS[0];
  const cors = {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: cors, body: 'Method Not Allowed' };

  let email;
  try {
    ({ email } = JSON.parse(event.body));
  } catch {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { statusCode: 200, headers: cors, body: JSON.stringify(NEUTRAL_RESPONSE) };
  }

  const emailKey = email.toLowerCase();
  const now = Date.now();
  const entry = rateLimitMap.get(emailKey) || { count: 0, resetAt: now + RATE_WINDOW_MS };
  if (now > entry.resetAt) { entry.count = 0; entry.resetAt = now + RATE_WINDOW_MS; }
  if (entry.count >= RATE_LIMIT) {
    // Return neutral — don't reveal rate limiting to probers
    return { statusCode: 200, headers: cors, body: JSON.stringify(NEUTRAL_RESPONSE) };
  }
  entry.count++;
  rateLimitMap.set(emailKey, entry);

  try {
    const db = getFirestore();
    const auth = getAuth();

    // Check if this email belongs to a known member
    const snap = await db.collection('members')
      .where('contact.email', '==', emailKey)
      .limit(1)
      .get();

    // Also check flat email field (legacy)
    let found = !snap.empty;
    if (!found) {
      const snap2 = await db.collection('members')
        .where('email', '==', emailKey)
        .limit(1)
        .get();
      found = !snap2.empty;
    }

    if (!found) {
      // Not a member — return neutral, don't create account
      return { statusCode: 200, headers: cors, body: JSON.stringify(NEUTRAL_RESPONSE) };
    }

    // Create Firebase Auth account if it doesn't exist yet
    try {
      await auth.getUserByEmail(emailKey);
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        await auth.createUser({ email: emailKey, emailVerified: false });
      } else {
        throw err;
      }
    }

    // Send password reset email via Firebase REST API
    const apiKey = process.env.VITE_FIREBASE_API_KEY;
    if (!apiKey) throw new Error('VITE_FIREBASE_API_KEY missing');

    const resetRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestType: 'PASSWORD_RESET', email: emailKey }),
      }
    );

    if (!resetRes.ok) {
      const errBody = await resetRes.text();
      console.error('[auto-invite] sendOobCode failed:', resetRes.status, errBody);
      // Log failed send
      try {
        await db.collection('emailLogs').add({
          recipientEmail: emailKey,
          emailType: 'auto_invitation',
          sentAt: FieldValue.serverTimestamp(),
          success: false,
          errorMessage: `sendOobCode HTTP ${resetRes.status}: ${errBody}`,
          triggeredBy: 'netlify-function',
          subject: 'JCI KL — Set up your password',
        });
      } catch (logError) {
        console.error('[auto-invite] Failed to write email log (failure):', logError);
      }
      // Still return neutral — don't expose internal errors
    } else {
      console.log('[auto-invite] password setup email sent to', emailKey);
      // Log successful send
      try {
        await db.collection('emailLogs').add({
          recipientEmail: emailKey,
          emailType: 'auto_invitation',
          sentAt: FieldValue.serverTimestamp(),
          success: true,
          triggeredBy: 'netlify-function',
          subject: 'JCI KL — Set up your password',
        });
      } catch (logError) {
        console.error('[auto-invite] Failed to write email log (success):', logError);
        // Don't throw — logging failure should not break email delivery
      }
    }

    return { statusCode: 200, headers: cors, body: JSON.stringify(NEUTRAL_RESPONSE) };
  } catch (err) {
    console.error('[auto-invite] error:', err);
    return { statusCode: 200, headers: cors, body: JSON.stringify(NEUTRAL_RESPONSE) };
  }
};
