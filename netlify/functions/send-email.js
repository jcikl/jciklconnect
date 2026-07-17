const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
const fetch = require('node-fetch');

// SEC: server-side env vars only — no VITE_ prefix so Vite never bundles these into the browser.
const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!getApps().length) {
  initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

const ALLOWED_ORIGINS = ['https://app.jcikl.cc', 'http://localhost:3000', 'http://localhost:3001'];

// Roles that are allowed to send emails via this endpoint (MEMBER and above).
const ALLOWED_ROLES = ['MEMBER', 'BOARD', 'ADMIN', 'SUPER_ADMIN'];

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

  // --- Auth: verify Firebase ID Token ---
  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return { statusCode: 401, headers: cors, body: JSON.stringify({ success: false, error: 'Unauthorized' }) };
  }
  const idToken = authHeader.split('Bearer ')[1];

  try {
    const decoded = await getAuth().verifyIdToken(idToken);
    const callerDoc = await getFirestore().collection('members').doc(decoded.uid).get();
    const role = callerDoc.data()?.role;
    if (!ALLOWED_ROLES.includes(role)) {
      return { statusCode: 403, headers: cors, body: JSON.stringify({ success: false, error: 'Forbidden' }) };
    }
  } catch {
    return { statusCode: 401, headers: cors, body: JSON.stringify({ success: false, error: 'Unauthorized' }) };
  }

  // --- Parse body ---
  let to, subject, html, provider, from;
  try {
    ({ to, subject, html, provider, from } = JSON.parse(event.body));
  } catch {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ success: false, error: 'Invalid request body' }) };
  }

  // --- Input validation ---
  if (!to || !subject || !html || !provider) {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ success: false, error: 'Missing required fields: to, subject, html, provider' }) };
  }
  if (!['sendgrid', 'resend', 'mailgun'].includes(provider)) {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ success: false, error: 'Invalid provider. Must be sendgrid, resend, or mailgun.' }) };
  }

  // P1: Validate and allowlist the from address to prevent header injection.
  const ALLOWED_FROM = ['no-reply@jcikl.cc', 'noreply@jcikl.cc'];
  const sender = from && ALLOWED_FROM.includes(from) ? from : 'no-reply@jcikl.cc';

  // P1: Guard against recipient flooding and oversized HTML payloads.
  const toArr = Array.isArray(to) ? to : [to];
  if (toArr.length > 50) {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Too many recipients' }) };
  }
  if (html && html.length > 100000) {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'HTML body too large' }) };
  }

  // Normalise `to` to a string (single address) or comma-joined string
  const toAddress = Array.isArray(to) ? to.join(',') : to;

  try {
    let messageId;

    if (provider === 'sendgrid') {
      const apiKey = process.env.SENDGRID_API_KEY;
      if (!apiKey) throw new Error('SENDGRID_API_KEY env var not configured');

      const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{
            to: Array.isArray(to) ? to.map(e => ({ email: e })) : [{ email: to }],
          }],
          from: { email: sender, name: 'JCI Kuala Lumpur' },
          subject,
          content: [{ type: 'text/html', value: html }],
        }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`SendGrid error ${res.status}: ${errBody}`);
      }
      messageId = res.headers.get('x-message-id') || `sg-${Date.now()}`;

    } else if (provider === 'resend') {
      const apiKey = process.env.RESEND_API_KEY;
      if (!apiKey) throw new Error('RESEND_API_KEY env var not configured');

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: sender,
          to: Array.isArray(to) ? to : [to],
          subject,
          html,
        }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`Resend error ${res.status}: ${errBody}`);
      }
      const data = await res.json();
      messageId = data.id || `resend-${Date.now()}`;

    } else if (provider === 'mailgun') {
      const apiKey = process.env.MAILGUN_API_KEY;
      const domain = process.env.MAILGUN_DOMAIN;
      if (!apiKey || !domain) throw new Error('MAILGUN_API_KEY or MAILGUN_DOMAIN env var not configured');

      // Mailgun uses form-encoded body
      const params = new URLSearchParams();
      params.append('from', sender);
      params.append('to', toAddress);
      params.append('subject', subject);
      params.append('html', html);

      const credentials = Buffer.from(`api:${apiKey}`).toString('base64');
      const res = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`Mailgun error ${res.status}: ${errBody}`);
      }
      const data = await res.json();
      messageId = data.id || `mg-${Date.now()}`;
    }

    console.log('[send-email] Sent via', provider, '| recipients:', toArr.length, '| messageId:', messageId);
    return {
      statusCode: 200,
      headers: cors,
      body: JSON.stringify({ success: true, messageId }),
    };
  } catch (err) {
    console.error('[send-email] error:', err);
    return {
      statusCode: 500,
      headers: cors,
      body: JSON.stringify({ success: false, error: 'Internal server error' }),
    };
  }
};
