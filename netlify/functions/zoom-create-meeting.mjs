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

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // Verify caller is an authenticated member
  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }
  try {
    await getAuth().verifyIdToken(authHeader.split('Bearer ')[1]);
  } catch {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  let topic, startTime, duration, alternativeHostEmail;
  try {
    ({ topic, startTime, duration, alternativeHostEmail } = JSON.parse(event.body));
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body' }) };
  }
  if (!topic || !startTime || !duration) {
    return { statusCode: 400, body: JSON.stringify({ error: 'topic, startTime and duration are required' }) };
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
        ...(alternativeHostEmail ? { alternative_hosts: alternativeHostEmail } : {}),
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
      // If alternative host caused the error, retry without it
      if (alternativeHostEmail && data.code === 1010) {
        const retryBody = { ...body, settings: { ...body.settings, alternative_hosts: undefined } };
        const retry = await fetch(`https://api.zoom.us/v2/users/${hostUserId}/meetings`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(retryBody),
        });
        const retryData = await retry.json();
        if (!retry.ok) throw new Error(retryData.message || 'Zoom API error');
        return {
          statusCode: 200,
          body: JSON.stringify({
            meetingId: retryData.id,
            joinUrl: retryData.join_url,
            hostUrl: retryData.start_url,
            password: retryData.password,
            alternativeHostSet: false,
          }),
        };
      }
      throw new Error(data.message || 'Zoom API error');
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        meetingId: data.id,
        joinUrl: data.join_url,
        hostUrl: data.start_url,
        password: data.password,
        alternativeHostSet: !!alternativeHostEmail,
      }),
    };
  } catch (err) {
    console.error('[zoom-create-meeting]', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
