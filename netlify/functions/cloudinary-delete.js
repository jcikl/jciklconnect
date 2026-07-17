/**
 * Cloudinary Delete Proxy (SEC-001)
 * Performs signed asset deletion server-side so CLOUDINARY_API_SECRET
 * never needs to be exposed in the browser bundle via a VITE_ variable.
 *
 * Requires env vars (no VITE_ prefix — server-side only):
 *   CLOUDINARY_CLOUD_NAME
 *   CLOUDINARY_API_KEY
 *   CLOUDINARY_API_SECRET
 *
 * NOTE: The `cloudinary` npm package must be installed in this directory:
 *   npm install cloudinary --prefix netlify/functions
 */

const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.VITE_FIREBASE_PROJECT_ID,
      clientEmail: process.env.VITE_FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.VITE_FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

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

  // Require a valid Firebase ID token
  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return { statusCode: 401, headers: cors, body: JSON.stringify({ error: 'Unauthorized' }) };
  }
  const idToken = authHeader.split('Bearer ')[1];
  try {
    await getAuth().verifyIdToken(idToken);
  } catch {
    return { statusCode: 401, headers: cors, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  let body = {};
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { publicId } = body;
  if (!publicId || typeof publicId !== 'string' || publicId.trim() === '') {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'publicId is required' }) };
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    console.error('[cloudinary-delete] Missing Cloudinary env vars (CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET)');
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: 'Server misconfiguration' }) };
  }

  try {
    // Use the cloudinary SDK for signed deletion
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const cloudinary = require('cloudinary').v2;
    cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });

    const result = await cloudinary.uploader.destroy(publicId.trim());

    if (result.result === 'ok' || result.result === 'not found') {
      return { statusCode: 200, headers: cors, body: JSON.stringify({ success: true, result: result.result }) };
    }
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: `Cloudinary returned: ${result.result}` }) };
  } catch (err) {
    console.error('[cloudinary-delete] Error:', err);
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: 'Failed to delete asset' }) };
  }
};
