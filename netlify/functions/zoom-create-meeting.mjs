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
    {
      method: 'POST',
      headers: { Authorization: `Basic ${credentials}` },
    }
  );
  if (!res.ok) throw new Error(`Zoom OAuth failed: ${res.status}`);
  const data = await res.json();
  return data.access_token;
}

export default async (req, context) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // Verify caller is an authenticated member
  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader?.startsWith('Bearer ')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    await getAuth().verifyIdToken(authHeader.split('Bearer ')[1]);
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let topic, startTime, duration;
  try {
    ({ topic, startTime, duration } = await req.json().catch(() => ({})));
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }
  if (!topic || !startTime || !duration) {
    return Response.json({ error: 'topic, startTime and duration are required' }, { status: 400 });
  }

  try {
    const token = await getZoomToken();
    const hostUserId = process.env.ZOOM_HOST_USER_ID; // JCI KL's Zoom user ID or email

    const body = {
      topic,
      type: 2, // scheduled meeting
      start_time: startTime, // ISO 8601
      duration,             // minutes
      timezone: 'Asia/Kuala_Lumpur',
      settings: {
        host_video: true,
        participant_video: true,
        join_before_host: true,
        waiting_room: false,
      },
    };

    const res = await fetch(`https://api.zoom.us/v2/users/${hostUserId}/meetings`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || 'Zoom API error');
    }

    return Response.json({
      meetingId: data.id,
      joinUrl: data.join_url,
      hostUrl: data.start_url,
      password: data.password,
    });
  } catch (err) {
    console.error('[zoom-create-meeting]', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
};
