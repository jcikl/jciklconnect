const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

// SEC-CF05: Use FIREBASE_ADMIN_* names (no VITE_ prefix) so Vite never injects
// the private key into the browser bundle. Align Netlify dashboard env var names.
const _fbProjectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const _fbClientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const _fbPrivateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!_fbProjectId || !_fbClientEmail || !_fbPrivateKey) {
  console.error('[birthday-notifications] Missing Firebase Admin credentials — function will not initialise');
} else if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: _fbProjectId,
      clientEmail: _fbClientEmail,
      privateKey: _fbPrivateKey,
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

exports.handler = async (_event) => {
  // DISABLED: Birthday notifications are now sent exclusively by the Firebase Cloud Function
  // `sendBirthdayNotifications` (functions/src/notifications.ts) which includes dedup via
  // the birthdayNotificationsSent collection. This Netlify function is kept for reference only.
  return { statusCode: 200, body: 'Birthday notifications are handled by the Cloud Function scheduler.' };

  // --- dead code below --- (kept for reference)
  if (!_fbProjectId || !_fbClientEmail || !_fbPrivateKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Missing Firebase Admin credentials' }) };
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

    const today = now.toISOString().split('T')[0];

    const sendIfNotSent = async (memberId, sendFn) => {
      const sentKey = memberId + '_' + today;
      const sentRef = db.collection('birthdayNotificationsSent').doc(sentKey);
      const alreadySent = await sentRef.get();
      if (alreadySent.exists) {
        console.log(`Already sent to ${memberId} today, skipping.`);
        return;
      }
      await sendFn();
      await sentRef.set({ sentAt: new Date().toISOString() });
    };

    await Promise.all([
      ...birthdayMembers.map(({ id, name }) =>
        sendIfNotSent(id, () =>
          sendFcmPush(id, `Happy Birthday, ${name}!`, 'Wishing you a wonderful day filled with joy! From everyone at JCI KL.', 'birthday_self')
        ).catch(err => console.error(`Push failed for ${id}:`, err))
      ),
      ...otherMemberIds.map(id =>
        sendIfNotSent(id, () =>
          sendFcmPush(id, 'Birthday Today!', `Today is ${birthdayNames}'s birthday! Send them your wishes.`, 'birthday_announcement', { names: birthdayNames })
        ).catch(err => console.error(`Announcement failed for ${id}:`, err))
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

// Schedule removed — function is disabled. Birthday notifications run via Cloud Function only.
// exports.config = { schedule: '0 0 * * *' };
