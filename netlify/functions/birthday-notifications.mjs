import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

// Initialize Firebase Admin (runs once per cold start)
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

async function sendFcmPush(memberId, title, body, type, extraData = {}) {
  // Write in-app notification doc
  await db.collection('notifications').add({
    memberId,
    type,
    title,
    message: body,
    data: extraData,
    read: false,
    createdAt: new Date().toISOString(),
  });

  // Get FCM token
  const userDoc = await db.collection('users').doc(memberId).get();
  const fcmToken = userDoc.data()?.fcmToken;
  if (!fcmToken) return;

  await messaging.send({
    token: fcmToken,
    notification: { title, body },
    webpush: {
      notification: {
        icon: '/favicon-128x128.png',
        badge: '/favicon-64x64.png',
      },
    },
    data: { type, ...extraData },
  });
}

export const handler = async () => {
  try {
    // Get today's date in Malaysia timezone (UTC+8)
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kuala_Lumpur' }));
    const todayMonth = now.getMonth() + 1;
    const todayDay = now.getDate();

    // "MMDD" index — e.g. July 6 → "0706"
    const todayMMDD = String(todayMonth).padStart(2, '0') + String(todayDay).padStart(2, '0');
    console.log(`Checking birthdays for ${todayMMDD}`);

    // Precise query: only birthday members (typically 0-3 reads)
    const birthdaySnap = await db.collection('members')
      .where('status', '==', 'active')
      .where('birthdayMMDD', '==', todayMMDD)
      .get();

    if (birthdaySnap.empty) {
      console.log('No birthdays today.');
      return { statusCode: 200, body: 'No birthdays today.' };
    }

    const birthdayMembers = birthdaySnap.docs.map(doc => {
      const m = doc.data();
      const firstName = (m.name || '').split(' ')[0] || m.name;
      return { id: doc.id, name: firstName };
    });

    // Fetch all other active members for announcements
    const allSnap = await db.collection('members')
      .where('status', '==', 'active')
      .select('__name__')
      .get();

    const birthdayIds = new Set(birthdayMembers.map(m => m.id));
    const otherMemberIds = allSnap.docs.map(d => d.id).filter(id => !birthdayIds.has(id));
    const birthdayNames = birthdayMembers.map(m => m.name).join(' & ');

    const tasks = [
      // Personal wishes to birthday members
      ...birthdayMembers.map(({ id, name }) =>
        sendFcmPush(
          id,
          `Happy Birthday, ${name}! 🎂`,
          'Wishing you a wonderful day filled with joy! From everyone at JCI KL.',
          'birthday_self'
        ).catch(err => console.error(`Push failed for ${id}:`, err))
      ),
      // Announcements to all other members
      ...otherMemberIds.map(id =>
        sendFcmPush(
          id,
          'Birthday Today! 🎉',
          `Today is ${birthdayNames}'s birthday! Send them your wishes.`,
          'birthday_announcement',
          { names: birthdayNames }
        ).catch(err => console.error(`Announcement failed for ${id}:`, err))
      ),
    ];

    await Promise.all(tasks);

    const msg = `Done: ${birthdayMembers.length} personal, ${otherMemberIds.length} announcements.`;
    console.log(msg);
    return { statusCode: 200, body: msg };

  } catch (err) {
    console.error('Birthday function error:', err);
    return { statusCode: 500, body: String(err) };
  }
};

// Netlify Scheduled Function — runs every day at 8:00 AM Malaysia time (00:00 UTC)
export const config = {
  schedule: '0 0 * * *',
};
