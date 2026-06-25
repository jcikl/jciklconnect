import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

// Function to send notification
export const sendNotification = functions.https.onCall(async (data, context) => {
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
export const sendBulkNotifications = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  // Verify admin permissions
  const userDoc = await db.collection('members').doc(context.auth.uid).get();
  if (!userDoc.exists || !['BOARD', 'ADMIN'].includes(userDoc.data()?.role)) {
    throw new functions.https.HttpsError('permission-denied', 'User must be board member or admin');
  }

  const { memberIds, type, title, message, data: notificationData } = data;

  if (!memberIds || !Array.isArray(memberIds) || !type || !title || !message) {
    throw new functions.https.HttpsError('invalid-argument', 'Member IDs array, type, title, and message are required');
  }

  const batch = db.batch();
  const notificationIds: string[] = [];

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
export const markNotificationRead = functions.https.onCall(async (data, context) => {
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
    if (!userDoc.exists || !['BOARD', 'ADMIN'].includes(userDoc.data()?.role)) {
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
export const sendDuesRenewalReminders = functions.pubsub
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
export const sendEventReminders = functions.pubsub
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

export const notificationFunctions = {
  sendNotification,
  sendBulkNotifications,
  markNotificationRead,
  sendDuesRenewalReminders,
  sendEventReminders
};