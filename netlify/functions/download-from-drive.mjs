/**
 * Google Drive Download Proxy
 * Fetches a Drive file's binary content via Service Account so the browser
 * never needs user-level Google auth to view uploaded receipts/PDFs.
 *
 * GET /.netlify/functions/download-from-drive?fileId=<DRIVE_FILE_ID>
 * Requires: Authorization: Bearer <Firebase ID token>
 *
 * Reuses the same env vars as upload-to-drive.mjs:
 *   GOOGLE_SA_EMAIL
 *   GOOGLE_SA_PRIVATE_KEY
 *   FIREBASE_ADMIN_PROJECT_ID / FIREBASE_ADMIN_CLIENT_EMAIL / FIREBASE_ADMIN_PRIVATE_KEY
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { SignJWT, importPKCS8 } from 'jose';

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const ALLOWED_ORIGINS = ['https://app.jcikl.cc', 'http://localhost:3000', 'http://localhost:3001'];

async function getGoogleAccessToken() {
  const clientEmail = process.env.GOOGLE_SA_EMAIL;
  const privateKeyRaw = process.env.GOOGLE_SA_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!clientEmail || !privateKeyRaw) throw new Error('Missing Google SA credentials');

  const privateKey = await importPKCS8(privateKeyRaw, 'RS256');
  const now = Math.floor(Date.now() / 1000);

  const jwt = await new SignJWT({ scope: 'https://www.googleapis.com/auth/drive.readonly' })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer(clientEmail)
    .setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(privateKey);

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`Google OAuth failed: ${JSON.stringify(data)}`);
  return data.access_token;
}

export default async (req, context) => {
  const requestOrigin = req.headers.get('origin') ?? '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(requestOrigin) ? requestOrigin : ALLOWED_ORIGINS[0];
  const cors = {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Vary': 'Origin',
  };

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'GET') return new Response('Method Not Allowed', { status: 405, headers: cors });

  // Verify Firebase ID token
  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers: cors });
  }
  try {
    await getAuth().verifyIdToken(authHeader.split('Bearer ')[1]);
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers: cors });
  }

  const url = new URL(req.url);
  const fileId = url.searchParams.get('fileId');
  if (!fileId || !/^[a-zA-Z0-9_-]+$/.test(fileId)) {
    return Response.json({ error: 'Invalid fileId' }, { status: 400, headers: cors });
  }

  try {
    const accessToken = await getGoogleAccessToken();

    // Fetch file metadata to get mimeType and name
    const metaRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,mimeType&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const meta = await metaRes.json();
    if (!meta.name) {
      return Response.json({ error: 'File not found' }, { status: 404, headers: cors });
    }

    // Download file content
    const fileRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!fileRes.ok) {
      return Response.json({ error: 'Download failed' }, { status: fileRes.status, headers: cors });
    }

    const contentType = meta.mimeType || fileRes.headers.get('content-type') || 'application/octet-stream';
    const fileBuffer = await fileRes.arrayBuffer();

    return new Response(fileBuffer, {
      status: 200,
      headers: {
        ...cors,
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${encodeURIComponent(meta.name)}"`,
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch (err) {
    console.error('[download-from-drive] Error:', err?.message ?? err);
    return Response.json({ error: 'Download failed' }, { status: 500, headers: cors });
  }
};
