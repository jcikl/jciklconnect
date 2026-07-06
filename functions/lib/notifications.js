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
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
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
        createdAt: admin.firestore.FieldValue.serverTimestamp()
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
            createdAt: admin.firestore.FieldValue.serverTimestamp()
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
    const now = new Date();
    const reminderDate = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000)); // 7 days from now
    // Get pending dues transactions that are due soon
    const pendingDuesSnapshot = await db.collection('duesTransactions')
        .where('status', '==', 'pending')
        .where('dueDate', '<=', reminderDate)
        .get();
    if (pendingDuesSnapshot.empty) {
        console.log('No pending dues requiring reminders');
        return null;
    }
    const batch = db.batch();
    let reminderCount = 0;
    for (const duesDoc of pendingDuesSnapshot.docs) {
        const dues = duesDoc.data();
        // Skip senators (they don't pay dues)
        if (dues.membershipType === 'senator') {
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
});
// Function to send event reminders
exports.sendEventReminders = functions.pubsub
    .schedule('0 8 * * *') // Every day at 8 AM
    .onRun(async (context) => {
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
    const batch = db.batch();
    let reminderCount = 0;
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
                    message: `Don't forget about "${event.title}" tomorrow at ${event.startDate.toDate().toLocaleTimeString()}.`,
                    data: {
                        eventId: eventDoc.id,
                        eventTitle: event.title,
                        startDate: event.startDate,
                        location: event.location
                    },
                    read: false,
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                });
                reminderCount++;
            }
        }
    }
    if (reminderCount > 0) {
        await batch.commit();
        console.log(`Sent ${reminderCount} event reminders`);
    }
    return null;
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
exports.sendBirthdayNotifications = functions.pubsub
    .schedule('0 0 * * *')
    .timeZone('Asia/Kuala_Lumpur')
    .onRun(async (_context) => {
    const now = new Date();
    const todayMonth = now.getMonth() + 1; // 1-12
    const todayDay = now.getDate();
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
    // 1. Send personal birthday wish to each birthday member
    const personalWishes = birthdayMembers.map(({ id, name }) => sendFcmPush(id, `Happy Birthday, ${name}! 🎂`, 'Wishing you a wonderful day filled with joy! From everyone at JCI KL.', 'birthday_self', { type: 'birthday_self' }).catch(err => console.error(`Failed birthday push for ${id}:`, err)));
    // 2. Announce to all other members
    const allMemberIds = membersSnap.docs.map(d => d.id);
    const birthdayIds = new Set(birthdayMembers.map(m => m.id));
    const otherMemberIds = allMemberIds.filter(id => !birthdayIds.has(id));
    const birthdayNames = birthdayMembers.map(m => m.name).join(' & ');
    const announcementBody = birthdayMembers.length === 1
        ? `Today is ${birthdayNames}'s birthday! 🎉 Send them your wishes.`
        : `Today is ${birthdayNames}'s birthday! 🎉 Send them your wishes.`;
    const announcements = otherMemberIds.map(id => sendFcmPush(id, 'Birthday Today! 🎂', announcementBody, 'birthday_announcement', { type: 'birthday_announcement', names: birthdayNames }).catch(err => console.error(`Failed announcement push for ${id}:`, err)));
    await Promise.all([...personalWishes, ...announcements]);
    console.log(`Birthday notifications sent: ${birthdayMembers.length} personal, ${otherMemberIds.length} announcements.`);
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