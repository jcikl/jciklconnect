import { createHmac } from 'node:crypto';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();
const ZOOM_BOOKINGS = 'zoomBookings';

function verifySignature(secret, timestamp, body, signature) {
  const message = `v0:${timestamp}:${body}`;
  const expected = 'v0=' + createHmac('sha256', secret).update(message).digest('hex');
  return expected === signature;
}

export default async (req, context) => {
  let bodyText;
  try {
    bodyText = await req.text();
  } catch {
    return new Response('Failed to read body', { status: 400 });
  }

  // Zoom URL validation challenge (sent when registering the webhook endpoint)
  let payload;
  try {
    payload = JSON.parse(bodyText);
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  if (payload.event === 'endpoint.url_validation') {
    try {
      const { plainToken } = payload.payload;
      const secret = process.env.ZOOM_WEBHOOK_SECRET_TOKEN;
      if (!secret) return new Response('ZOOM_WEBHOOK_SECRET_TOKEN not configured', { status: 500 });
      const encryptedToken = createHmac('sha256', secret).update(plainToken).digest('hex');
      return new Response(JSON.stringify({ plainToken, encryptedToken }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      return new Response(`Validation error: ${err.message}`, { status: 500 });
    }
  }

  // Verify signature for all other events
  const secret = process.env.ZOOM_WEBHOOK_SECRET_TOKEN;
  if (secret) {
    const timestamp = req.headers.get('x-zm-request-timestamp') ?? '';
    const signature = req.headers.get('x-zm-signature') ?? '';
    if (!verifySignature(secret, timestamp, bodyText, signature)) {
      return new Response('Unauthorized', { status: 401 });
    }
  }

  const { event, payload: eventPayload } = payload;

  const meetingId = eventPayload?.object?.id;
  if (!meetingId) return new Response('OK');

  if (event === 'meeting.deleted' || event === 'meeting.ended') {
    const snap = await db.collection(ZOOM_BOOKINGS)
      .where('zoomMeetingId', '==', meetingId)
      .where('status', '==', 'confirmed')
      .limit(1)
      .get();
    if (!snap.empty) await snap.docs[0].ref.update({ status: 'cancelled' });
  }

  if (event === 'meeting.recovered') {
    const snap = await db.collection(ZOOM_BOOKINGS)
      .where('zoomMeetingId', '==', meetingId)
      .where('status', '==', 'cancelled')
      .limit(1)
      .get();
    if (!snap.empty) await snap.docs[0].ref.update({ status: 'confirmed' });
  }

  return new Response('OK');
};
