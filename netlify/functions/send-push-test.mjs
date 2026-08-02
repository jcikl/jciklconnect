import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

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
const messaging = getMessaging();

export default async (req, context) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader?.startsWith('Bearer ')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const idToken = authHeader.split('Bearer ')[1];
  try {
    const decoded = await getAuth().verifyIdToken(idToken);
    const callerDoc = await db.collection('members').doc(decoded.uid).get();
    const role = callerDoc.data()?.role;
    if (!['ADMIN', 'SUPER_ADMIN'].includes(role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body;
  try {
    body = await req.json().catch(() => ({}));
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { memberId, title, message } = body;
  if (!memberId || !title || !message) {
    return Response.json({ error: 'memberId, title, and message are required' }, { status: 400 });
  }

  try {
    // Write in-app notification
    await db.collection('notifications').add({
      memberId,
      type: 'test',
      title,
      message,
      data: {},
      read: false,
      createdAt: new Date().toISOString(),
    });

    // Get FCM token
    const userDoc = await db.collection('users').doc(memberId).get();
    const fcmToken = userDoc.data()?.fcmToken;

    if (!fcmToken) {
      return Response.json({ success: true, pushed: false, reason: 'No FCM token registered for this member' });
    }

    await messaging.send({
      token: fcmToken,
      notification: { title, body: message },
      webpush: {
        notification: {
          icon: '/favicon-128x128.png',
          badge: '/favicon-64x64.png',
        },
      },
      data: { type: 'test' },
    });

    return Response.json({ success: true, pushed: true });
  } catch (err) {
    console.error('send-push-test error:', err);
    return Response.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
};
