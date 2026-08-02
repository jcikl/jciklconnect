import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

async function getZoomToken() {
  const credentials = Buffer.from(
    `${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`
  ).toString('base64');
  const res = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${process.env.ZOOM_ACCOUNT_ID}`,
    { method: 'POST', headers: { Authorization: `Basic ${credentials}` } }
  );
  if (!res.ok) throw new Error(`Zoom OAuth failed: ${res.status}`);
  const data = await res.json();
  return data.access_token;
}

export default async (req, context) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader?.startsWith('Bearer ')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    await getAuth().verifyIdToken(authHeader.split('Bearer ')[1]);
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let meetingId;
  try {
    ({ meetingId } = await req.json().catch(() => ({})));
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }
  if (!meetingId) {
    return Response.json({ error: 'meetingId is required' }, { status: 400 });
  }

  try {
    const token = await getZoomToken();
    const res = await fetch(`https://api.zoom.us/v2/meetings/${meetingId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    // 204 = deleted, 404 = already gone — both are acceptable
    if (!res.ok && res.status !== 404) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || `Zoom delete failed: ${res.status}`);
    }

    return Response.json({ cancelled: true });
  } catch (err) {
    console.error('[zoom-cancel-meeting]', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
};
