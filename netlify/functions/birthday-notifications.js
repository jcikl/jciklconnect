const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

// NOTE: These env vars should be renamed to FIREBASE_* (without VITE_ prefix) to avoid
// accidental inclusion in the Vite client bundle. Update Netlify env var settings when renaming.

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
  await db.collection('notifications').add({
    memberId, type, title,
    message: body,
    data: extraData,
    read: false,
    createdAt: new Date().toISOString(),
  });

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

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const cronSecret = process.env.CRON_SECRET;
  const requestSecret = event.headers['x-cron-secret'] || event.headers['X-Cron-Secret'];
  if (!cronSecret || requestSecret !== cronSecret) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  try {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kuala_Lumpur' }));
    const todayMMDD = String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
    console.log(`Checking birthdays for ${todayMMDD}`);

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
      return { id: doc.id, name: (m.name || '').split(' ')[0] || m.name };
    });

    const allSnap = await db.collection('members')
      .where('status', '==', 'active')
      .select('__name__')
      .get();

    const birthdayIds = new Set(birthdayMembers.map(m => m.id));
    const otherMemberIds = allSnap.docs.map(d => d.id).filter(id => !birthdayIds.has(id));
    const birthdayNames = birthdayMembers.map(m => m.name).join(' & ');

    await Promise.all([
      ...birthdayMembers.map(({ id, name }) =>
        sendFcmPush(id, `Happy Birthday, ${name}!`, 'Wishing you a wonderful day filled with joy! From everyone at JCI KL.', 'birthday_self')
          .catch(err => console.error(`Push failed for ${id}:`, err))
      ),
      ...otherMemberIds.map(id =>
        sendFcmPush(id, 'Birthday Today!', `Today is ${birthdayNames}'s birthday! Send them your wishes.`, 'birthday_announcement', { names: birthdayNames })
          .catch(err => console.error(`Announcement failed for ${id}:`, err))
      ),
    ]);

    const msg = `Done: ${birthdayMembers.length} personal, ${otherMemberIds.length} announcements.`;
    console.log(msg);
    return { statusCode: 200, body: msg };
  } catch (err) {
    console.error('Birthday function error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};

exports.config = { schedule: '0 0 * * *' };
