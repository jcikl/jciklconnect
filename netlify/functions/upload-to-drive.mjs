/**
 * Google Drive Upload Proxy
 * Uploads payment request receipts/invoices to a Google Shared Drive folder.
 * Uses a Service Account so credentials never reach the browser.
 *
 * Required env vars (no VITE_ prefix — server-side only):
 *   GOOGLE_SA_EMAIL          — service account client_email
 *   GOOGLE_SA_PRIVATE_KEY    — service account private_key (with \\n escaped)
 *   GOOGLE_DRIVE_PR_FOLDER_ID — target Shared Drive folder ID
 *
 * Also requires (already set):
 *   FIREBASE_ADMIN_PROJECT_ID
 *   FIREBASE_ADMIN_CLIENT_EMAIL
 *   FIREBASE_ADMIN_PRIVATE_KEY
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
  if (!clientEmail || !privateKeyRaw) throw new Error('Missing GOOGLE_SA_EMAIL / GOOGLE_SA_PRIVATE_KEY env vars');

  const privateKey = await importPKCS8(privateKeyRaw, 'RS256');
  const now = Math.floor(Date.now() / 1000);

  const jwt = await new SignJWT({ scope: 'https://www.googleapis.com/auth/drive.file' })
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

async function getOrCreateSubfolder(accessToken, parentId, folderName) {
  const safeFolder = folderName.replace(/['"\\]/g, '');
  const query = encodeURIComponent(
    `mimeType='application/vnd.google-apps.folder' and name='${safeFolder}' and '${parentId}' in parents and trashed=false`
  );
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const searchData = await searchRes.json();
  if (searchData.files?.length > 0) return searchData.files[0].id;

  const createRes = await fetch(
    'https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: safeFolder,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId],
      }),
    }
  );
  const created = await createRes.json();
  if (!created.id) throw new Error(`Failed to create subfolder: ${JSON.stringify(created)}`);
  return created.id;
}

export default async (req, context) => {
  const requestOrigin = req.headers.get('origin') ?? '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(requestOrigin) ? requestOrigin : ALLOWED_ORIGINS[0];
  const cors = {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: cors });

  // Verify Firebase ID token — any authenticated member may upload their own PR
  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers: cors });
  }
  try {
    await getAuth().verifyIdToken(authHeader.split('Bearer ')[1]);
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers: cors });
  }

  let formData;
  try {
    formData = await req.formData();
  } catch {
    return Response.json({ error: 'Invalid form data' }, { status: 400, headers: cors });
  }

  const file = formData.get('file');
  const year = String(formData.get('year') ?? new Date().getFullYear());
  const month = String(formData.get('month') ?? String(new Date().getMonth() + 1).padStart(2, '0'));
  const projectName = String(formData.get('projectName') ?? 'General').replace(/[^\w\s\-().&]/g, '').trim() || 'General';

  if (!file || typeof file === 'string') {
    return Response.json({ error: 'file is required' }, { status: 400, headers: cors });
  }

  const rootFolderId = process.env.GOOGLE_DRIVE_PR_FOLDER_ID;
  if (!rootFolderId) {
    console.error('[upload-to-drive] Missing GOOGLE_DRIVE_PR_FOLDER_ID');
    return Response.json({ error: 'Server misconfiguration' }, { status: 500, headers: cors });
  }

  try {
    const accessToken = await getGoogleAccessToken();
    // Build year / month / project folder hierarchy
    const yearFolderId = await getOrCreateSubfolder(accessToken, rootFolderId, year);
    const monthFolderId = await getOrCreateSubfolder(accessToken, yearFolderId, month);
    const subfolderId = await getOrCreateSubfolder(accessToken, monthFolderId, projectName);

    const date = new Date().toISOString().split('T')[0];
    const fileName = `${date}_${file.name}`;
    const mimeType = file.type || 'application/octet-stream';

    const metadata = JSON.stringify({ name: fileName, parents: [subfolderId] });
    const boundary = 'jcikl_drive_boundary_a8f3d';
    const fileBuffer = await file.arrayBuffer();

    const encoder = new TextEncoder();
    const parts = [
      encoder.encode(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`),
      encoder.encode(`--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`),
      new Uint8Array(fileBuffer),
      encoder.encode(`\r\n--${boundary}--`),
    ];
    const totalLength = parts.reduce((s, p) => s + p.length, 0);
    const body = new Uint8Array(totalLength);
    let offset = 0;
    for (const part of parts) { body.set(part, offset); offset += part.length; }

    const uploadRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink,name',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
          'Content-Length': String(totalLength),
        },
        body,
      }
    );

    const driveFile = await uploadRes.json();
    if (!driveFile.id) {
      console.error('[upload-to-drive] Drive API error:', driveFile);
      return Response.json({ error: 'Drive upload failed' }, { status: 500, headers: cors });
    }

    return Response.json(
      { url: driveFile.webViewLink, fileId: driveFile.id, name: driveFile.name },
      { headers: cors }
    );
  } catch (err) {
    console.error('[upload-to-drive] Error:', err?.message ?? err);
    return Response.json({ error: 'Upload failed' }, { status: 500, headers: cors });
  }
};
