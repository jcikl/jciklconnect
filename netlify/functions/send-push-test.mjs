import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.VITE_FIREBASE_PROJECT_ID,
      clientEmail: process.env.VITE_FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.VITE_FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();
const messaging = getMessaging();

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { memberId, title, message } = body;
  if (!memberId || !title || !message) {
    return { statusCode: 400, body: JSON.stringify({ error: 'memberId, title, and message are required' }) };
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
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, pushed: false, reason: 'No FCM token registered for this member' }),
      };
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

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, pushed: true }),
    };
  } catch (err) {
    console.error('send-push-test error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || 'Internal server error' }),
    };
  }
};
