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

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { v2 as cloudinary } from 'cloudinary';

if (!getApps().length) {
  initializeApp({
    credential: cert({
      // SEC-CF05: FIREBASE_ADMIN_* (no VITE_ prefix) so Vite never injects these into the browser bundle.
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const ALLOWED_ORIGINS = ['https://app.jcikl.cc', 'http://localhost:3000', 'http://localhost:3001'];
const ALLOWED_PUBLIC_ID_PREFIXES = ['jciklconnect/', 'jci-kl/', 'JCIKL/'];

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

  // Require a valid Firebase ID token
  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader?.startsWith('Bearer ')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers: cors });
  }
  const idToken = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await getAuth().verifyIdToken(idToken);
    const memberDoc = await getFirestore().collection('members').doc(decodedToken.uid).get();
    const role = memberDoc.data()?.role;
    const ALLOWED_ROLES = ['BOARD', 'ADMIN', 'SUPER_ADMIN'];
    if (!memberDoc.exists || !ALLOWED_ROLES.includes(role)) {
      return Response.json({ error: 'Insufficient permissions' }, { status: 403, headers: cors });
    }
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers: cors });
  }

  let body = {};
  try {
    body = await req.json().catch(() => ({}));
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400, headers: cors });
  }

  const { publicId } = body;
  if (!publicId || typeof publicId !== 'string' || publicId.trim() === '') {
    return Response.json({ error: 'publicId is required' }, { status: 400, headers: cors });
  }
  const normalizedPublicId = publicId.trim();
  if (
    normalizedPublicId.includes('..') ||
    normalizedPublicId.startsWith('/') ||
    !ALLOWED_PUBLIC_ID_PREFIXES.some(prefix => normalizedPublicId.startsWith(prefix))
  ) {
    return Response.json({ error: 'publicId is outside the allowed asset scope' }, { status: 403, headers: cors });
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    console.error('[cloudinary-delete] Missing Cloudinary env vars (CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET)');
    return Response.json({ error: 'Server misconfiguration' }, { status: 500, headers: cors });
  }

  try {
    cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });

    const result = await cloudinary.uploader.destroy(normalizedPublicId);

    if (result.result === 'ok' || result.result === 'not found') {
      return Response.json({ success: true, result: result.result }, { headers: cors });
    }
    return Response.json({ error: `Cloudinary returned: ${result.result}` }, { status: 400, headers: cors });
  } catch (err) {
    console.error('[cloudinary-delete] Error:', err);
    return Response.json({ error: 'Failed to delete asset' }, { status: 500, headers: cors });
  }
};
