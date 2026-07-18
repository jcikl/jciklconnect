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

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }
  const idToken = authHeader.split('Bearer ')[1];
  try {
    const decoded = await getAuth().verifyIdToken(idToken);
    const callerDoc = await db.collection('members').doc(decoded.uid).get();
    const role = callerDoc.data()?.role;
    if (!['ADMIN', 'SUPER_ADMIN'].includes(role)) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden' }) };
    }
  } catch {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
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
