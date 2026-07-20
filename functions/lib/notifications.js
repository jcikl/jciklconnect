"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationFunctions = exports.sendBirthdayNotifications = exports.sendEventReminders = exports.sendDuesRenewalReminders = exports.markNotificationRead = exports.sendBulkNotifications = exports.sendNotification = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const db = admin.firestore();
// Function to send notification
exports.sendNotification = functions.https.onCall(async (data, context) => {
    var _a;
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    // Only BOARD, ADMIN, and SUPER_ADMIN may send notifications to other members
    const callerDoc = await db.collection('members').doc(context.auth.uid).get();
    const callerRole = (_a = callerDoc.data()) === null || _a === void 0 ? void 0 : _a.role;
    if (!['ADMIN', 'SUPER_ADMIN', 'BOARD'].includes(callerRole)) {
        throw new functions.https.HttpsError('permission-denied', 'Insufficient role to send notifications');
    }
    const { memberId, type, title, message, data: notificationData } = data;
    if (!memberId || !type || !title || !message) {
        throw new functions.https.HttpsError('invalid-argument', 'Member ID, type, title, and message are required');
    }
    // Create notification document
    const notificationDoc = await db.collection('notifications').add({
        memberId: memberId,
        type: type,
        title: title,
        message: message,
        data: notificationData || {},
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    // In a real implementation, you might also send push notifications, emails, etc.
    console.log(`Notification sent to member ${memberId}: ${title}`);
    return {
        notificationId: notificationDoc.id,
        success: true
    };
});
// Function to send bulk notifications
exports.sendBulkNotifications = functions.https.onCall(async (data, context) => {
    var _a;
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    // Verify admin permissions
    const userDoc = await db.collection('members').doc(context.auth.uid).get();
    if (!userDoc.exists || !['BOARD', 'ADMIN'].includes((_a = userDoc.data()) === null || _a === void 0 ? void 0 : _a.role)) {
        throw new functions.https.HttpsError('permission-denied', 'User must be board member or admin');
    }
    const { memberIds, type, title, message, data: notificationData } = data;
    if (!memberIds || !Array.isArray(memberIds) || !type || !title || !message) {
        throw new functions.https.HttpsError('invalid-argument', 'Member IDs array, type, title, and message are required');
    }
    const batch = db.batch();
    const notificationIds = [];
    // Create notification for each member
    for (const memberId of memberIds) {
        const notificationRef = db.collection('notifications').doc();
        batch.set(notificationRef, {
            memberId: memberId,
            type: type,
            title: title,
            message: message,
            data: notificationData || {},
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        notificationIds.push(notificationRef.id);
    }
    await batch.commit();
    console.log(`Bulk notifications sent to ${memberIds.length} members: ${title}`);
    return {
        notificationIds: notificationIds,
        memberCount: memberIds.length,
        success: true
    };
});
// Function to mark notification as read
exports.markNotificationRead = functions.https.onCall(async (data, context) => {
    var _a;
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const { notificationId } = data;
    if (!notificationId) {
        throw new functions.https.HttpsError('invalid-argument', 'Notification ID is required');
    }
    // Get notification document
    const notificationDoc = await db.collection('notifications').doc(notificationId).get();
    if (!notificationDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Notification not found');
    }
    const notification = notificationDoc.data();
    if (!notification) {
        throw new functions.https.HttpsError('not-found', 'Notification data not found');
    }
    // Verify user can mark this notification as read
    if (notification.memberId !== context.auth.uid) {
        // Check if user is admin
        const userDoc = await db.collection('members').doc(context.auth.uid).get();
        if (!userDoc.exists || !['BOARD', 'ADMIN'].includes((_a = userDoc.data()) === null || _a === void 0 ? void 0 : _a.role)) {
            throw new functions.https.HttpsError('permission-denied', 'User can only mark their own notifications as read');
        }
    }
    // Mark as read
    await db.collection('notifications').doc(notificationId).update({
        read: true,
        readAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return {
        success: true,
        notificationId: notificationId
    };
});
// Function to send dues renewal reminders
exports.sendDuesRenewalReminders = functions.pubsub
    .schedule('0 9 * * 1') // Every Monday at 9 AM
    .onRun(async (context) => {
    var _a, _b;
    try {
        const now = new Date();
        const reminderDate = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000)); // 7 days from now
        const currentYear = now.getFullYear();
        // Get pending dues transactions that are due soon
        const pendingDuesSnapshot = await db.collection('duesTransactions')
            .where('status', '==', 'pending')
            .where('dueDate', '<=', reminderDate)
            .get();
        if (pendingDuesSnapshot.empty) {
            console.log('No pending dues requiring reminders');
            return null;
        }
        // Idempotency: fetch existing unread dues_reminder notifications for this year
        // to avoid sending duplicates when Cloud Scheduler retries a failed invocation.
        const existingRemindersSnap = await db.collection('notifications')
            .where('type', '==', 'dues_reminder')
            .where('read', '==', false)
            .get();
        const alreadyRemindedThisYear = new Set();
        for (const doc of existingRemindersSnap.docs) {
            const d = doc.data();
            if (((_b = (_a = d.data) === null || _a === void 0 ? void 0 : _a.duesYear) !== null && _b !== void 0 ? _b : d.duesYear) === currentYear && d.memberId) {
                alreadyRemindedThisYear.add(d.memberId);
            }
        }
        const batch = db.batch();
        let reminderCount = 0;
        for (const duesDoc of pendingDuesSnapshot.docs) {
            const dues = duesDoc.data();
            // Skip senators (they don't pay dues)
            if (dues.membershipType === 'senator') {
                continue;
            }
            // Skip members who already have an unread dues_reminder this year (retry safety)
            if (alreadyRemindedThisYear.has(dues.memberId)) {
                continue;
            }
            // Create reminder notification
            const notificationRef = db.collection('notifications').doc();
            batch.set(notificationRef, {
                memberId: dues.memberId,
                type: 'dues_reminder',
                title: 'Dues Payment Reminder',
                message: `Your ${dues.duesYear} membership dues of RM${dues.amount} are due soon. Please make your payment to maintain your membership status.`,
                data: {
                    duesTransactionId: duesDoc.id,
                    amount: dues.amount,
                    duesYear: dues.duesYear,
                    membershipType: dues.membershipType
                },
                read: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
            reminderCount++;
        }
        if (reminderCount > 0) {
            await batch.commit();
            console.log(`Sent ${reminderCount} dues renewal reminders`);
        }
        return null;
    }
    catch (error) {
        console.error('[sendDuesRenewalReminders] Fatal error — aborting run:', error);
        return null;
    }
});
// Function to send event reminders
exports.sendEventReminders = functions.pubsub
    .schedule('0 8 * * *') // Every day at 8 AM
    .onRun(async (context) => {
    try {
        const now = new Date();
        const tomorrow = new Date(now.getTime() + (24 * 60 * 60 * 1000));
        const dayAfterTomorrow = new Date(now.getTime() + (48 * 60 * 60 * 1000));
        // Get events happening tomorrow
        const upcomingEventsSnapshot = await db.collection('events')
            .where('startDate', '>=', tomorrow)
            .where('startDate', '<', dayAfterTomorrow)
            .get();
        if (upcomingEventsSnapshot.empty) {
            console.log('No events tomorrow requiring reminders');
            return null;
        }
        // F08 fix: flush batches at BATCH_LIMIT to stay under the 500-op Firestore cap
        const BATCH_LIMIT = 490;
        let batch = db.batch();
        let batchCount = 0;
        let reminderCount = 0;
        const flushBatch = async () => {
            if (batchCount > 0) {
                await batch.commit();
                batch = db.batch();
                batchCount = 0;
            }
        };
        for (const eventDoc of upcomingEventsSnapshot.docs) {
            const event = eventDoc.data();
            // Send reminder to all registered attendees
            if (event.attendees && Array.isArray(event.attendees)) {
                for (const attendeeId of event.attendees) {
                    const notificationRef = db.collection('notifications').doc();
                    batch.set(notificationRef, {
                        memberId: attendeeId,
                        type: 'event_reminder',
                        title: 'Event Reminder',
                        message: `Don't forget about "${event.title}" tomorrow at ${event.startDate.toDate().toLocaleTimeString('en-MY', { timeZone: 'Asia/Kuala_Lumpur', hour: '2-digit', minute: '2-digit' })}.`,
                        data: {
                            eventId: eventDoc.id,
                            eventTitle: event.title,
                            startDate: event.startDate,
                            location: event.location
                        },
                        read: false,
                        createdAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                    batchCount++;
                    reminderCount++;
                    if (batchCount >= BATCH_LIMIT) {
                        await flushBatch();
                    }
                }
            }
        }
        await flushBatch();
        if (reminderCount > 0) {
            console.log(`Sent ${reminderCount} event reminders`);
        }
        return null;
    }
    catch (error) {
        console.error('[sendEventReminders] Fatal error — aborting run:', error);
        return null;
    }
});
// ─── Helper: send FCM push + create Firestore notification doc ───────────────
async function sendFcmPush(memberId, title, body, type, data = {}) {
    var _a;
    // Write in-app notification
    await db.collection('notifications').add({
        memberId,
        type,
        title,
        message: body,
        data,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    // Look up FCM token from users collection
    const userDoc = await db.collection('users').doc(memberId).get();
    const fcmToken = (_a = userDoc.data()) === null || _a === void 0 ? void 0 : _a.fcmToken;
    if (!fcmToken)
        return;
    await admin.messaging().send({
        token: fcmToken,
        notification: { title, body },
        webpush: {
            notification: {
                icon: '/favicon-128x128.png',
                badge: '/favicon-64x64.png',
            },
        },
        data,
    });
}
// ─── Birthday notifications (runs daily 8 AM Malaysia time = 0:00 UTC) ────────
// Single source of truth — Netlify function is disabled; no client-side writes.
exports.sendBirthdayNotifications = functions.pubsub
    .schedule('0 0 * * *')
    .timeZone('Asia/Kuala_Lumpur')
    .onRun(async (_context) => {
    const nowMYT = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kuala_Lumpur' }));
    const todayMonth = nowMYT.getMonth() + 1; // 1-12
    const todayDay = nowMYT.getDate();
    // YYYY-MM-DD in Malaysia time — used as the dedup key suffix
    const todayDateStr = `${nowMYT.getFullYear()}-${String(todayMonth).padStart(2, '0')}-${String(todayDay).padStart(2, '0')}`;
    // Fetch all active members
    const membersSnap = await db.collection('members')
        .where('status', '==', 'active')
        .get();
    if (membersSnap.empty)
        return null;
    const birthdayMembers = [];
    for (const doc of membersSnap.docs) {
        const m = doc.data();
        if (!m.dateOfBirth)
            continue;
        // dateOfBirth stored as "YYYY-MM-DD"
        const parts = m.dateOfBirth.split('-');
        if (parts.length < 3)
            continue;
        const bMonth = parseInt(parts[1], 10);
        const bDay = parseInt(parts[2], 10);
        if (bMonth === todayMonth && bDay === todayDay) {
            const firstName = (m.name || '').split(' ')[0] || m.name;
            birthdayMembers.push({ id: doc.id, name: firstName });
        }
    }
    if (birthdayMembers.length === 0) {
        console.log('No birthdays today.');
        return null;
    }
    console.log(`Birthdays today: ${birthdayMembers.map(m => m.name).join(', ')}`);
    // ── Dedup: check birthdayNotificationsSent before sending ────────────────
    // Personal wishes: one doc per member per date → {memberId}_{date}
    const sentRefs = birthdayMembers.map(({ id }) => db.collection('birthdayNotificationsSent').doc(`${id}_${todayDateStr}`));
    const sentDocs = sentRefs.length > 0 ? await db.getAll(...sentRefs) : [];
    const alreadySentIds = new Set(sentDocs.filter(d => d.exists).map(d => d.id.replace(`_${todayDateStr}`, '')));
    const newBirthdayMembers = birthdayMembers.filter(({ id }) => !alreadySentIds.has(id));
    // Announcements: one control doc per date → announcements_{date}
    const announcementSentRef = db.collection('birthdayNotificationsSent').doc(`announcements_${todayDateStr}`);
    const announcementSentDoc = await announcementSentRef.get();
    const announcementsAlreadySent = announcementSentDoc.exists;
    if (newBirthdayMembers.length === 0 && announcementsAlreadySent) {
        console.log('All birthday notifications already sent today — skipping (retry safety).');
        return null;
    }
    // 2. Determine other members for announcements
    const allMemberIds = membersSnap.docs.map(d => d.id);
    const birthdayIds = new Set(birthdayMembers.map(m => m.id));
    const otherMemberIds = announcementsAlreadySent ? [] : allMemberIds.filter(id => !birthdayIds.has(id));
    const birthdayNames = birthdayMembers.map(m => m.name).join(' & ');
    const announcementBody = `Today is ${birthdayNames}'s birthday! 🎉 Send them your wishes.`;
    // F12 fix: collect all Firestore notification objects first, then write in
    // batches of 490 to avoid rate-limiting from hundreds of concurrent .add() calls.
    // FCM sends remain as Promise.all (they cannot be Firestore-batched).
    const BATCH_LIMIT = 490;
    const now2 = admin.firestore.FieldValue.serverTimestamp();
    const firestoreNotifs = [];
    // Personal birthday wishes (new members only — deduped)
    for (const { id, name } of newBirthdayMembers) {
        firestoreNotifs.push({
            memberId: id,
            type: 'birthday_self',
            title: `Happy Birthday, ${name}! 🎂`,
            message: 'Wishing you a wonderful day filled with joy! From everyone at JCI KL.',
            data: { type: 'birthday_self' },
            read: false,
            createdAt: now2,
            timestamp: now2,
        });
    }
    // Announcements to other members (skipped if already sent today)
    for (const id of otherMemberIds) {
        firestoreNotifs.push({
            memberId: id,
            type: 'birthday_announcement',
            title: 'Birthday Today! 🎂',
            message: announcementBody,
            data: { type: 'birthday_announcement', names: birthdayNames },
            read: false,
            createdAt: now2,
            timestamp: now2,
        });
    }
    // Write Firestore notifications in capped batches
    let fsBatch = db.batch();
    let fsCount = 0;
    for (const payload of firestoreNotifs) {
        fsBatch.set(db.collection('notifications').doc(), payload);
        fsCount++;
        if (fsCount >= BATCH_LIMIT) {
            await fsBatch.commit();
            fsBatch = db.batch();
            fsCount = 0;
        }
    }
    if (fsCount > 0)
        await fsBatch.commit();
    // ── Record sent status for retry-safety dedup ─────────────────────────────
    const sentBatch = db.batch();
    for (const { id } of newBirthdayMembers) {
        sentBatch.set(db.collection('birthdayNotificationsSent').doc(`${id}_${todayDateStr}`), { sentAt: admin.firestore.FieldValue.serverTimestamp(), type: 'personal' });
    }
    if (otherMemberIds.length > 0) {
        sentBatch.set(announcementSentRef, {
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
            count: otherMemberIds.length,
        });
    }
    await sentBatch.commit();
    // Send FCM pushes concurrently (cannot be batched via Firestore)
    // Look up FCM tokens and send — kept separate from Firestore writes above.
    const sendFcmOnly = async (memberId, title, body, data) => {
        var _a;
        const userDoc = await db.collection('users').doc(memberId).get();
        const fcmToken = (_a = userDoc.data()) === null || _a === void 0 ? void 0 : _a.fcmToken;
        if (!fcmToken)
            return;
        await admin.messaging().send({
            token: fcmToken,
            notification: { title, body },
            webpush: {
                notification: {
                    icon: '/favicon-128x128.png',
                    badge: '/favicon-64x64.png',
                },
            },
            data,
        });
    };
    const personalFcm = newBirthdayMembers.map(({ id, name }) => sendFcmOnly(id, `Happy Birthday, ${name}! 🎂`, 'Wishing you a wonderful day filled with joy! From everyone at JCI KL.', { type: 'birthday_self' }).catch(err => console.error(`Failed birthday FCM for ${id}:`, err)));
    const announcementFcm = otherMemberIds.map(id => sendFcmOnly(id, 'Birthday Today! 🎂', announcementBody, { type: 'birthday_announcement', names: birthdayNames }).catch(err => console.error(`Failed announcement FCM for ${id}:`, err)));
    await Promise.all([...personalFcm, ...announcementFcm]);
    console.log(`Birthday notifications sent: ${newBirthdayMembers.length} personal, ${otherMemberIds.length} announcements.`);
    return null;
});
exports.notificationFunctions = {
    sendNotification: exports.sendNotification,
    sendBulkNotifications: exports.sendBulkNotifications,
    markNotificationRead: exports.markNotificationRead,
    sendDuesRenewalReminders: exports.sendDuesRenewalReminders,
    sendEventReminders: exports.sendEventReminders,
    sendBirthdayNotifications: exports.sendBirthdayNotifications,
};
//# sourceMappingURL=notifications.js.map