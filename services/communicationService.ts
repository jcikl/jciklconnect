// Communication Service - CRUD Operations
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  writeBatch,
  increment,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/constants';
import { NewsPost, Notification, UserRole } from '../types';
import { isDevMode, withDevMode } from '../utils/devMode';
import { MOCK_POSTS, MOCK_NOTIFICATIONS } from './mockData';
import { EmailService, EmailMessage } from './emailService';
import { errorLoggingService } from './errorLoggingService';
import { apiCache as cacheService } from './cacheService';

export class CommunicationService {
  // Get all posts
  static async getAllPosts(): Promise<NewsPost[]> {
    return withDevMode(
      () => { console.log('[DEV MODE] getAllPosts: Returning mock posts'); return MOCK_POSTS; },
      async () => {
        try {
          const snapshot = await getDocs(
            query(collection(db, COLLECTIONS.COMMUNICATION), orderBy('timestamp', 'desc'))
          );
          return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp?.toDate?.()?.toISOString() || doc.data().timestamp,
          } as NewsPost));
        } catch (error) {
          if (isDevMode()) {
            console.log('[DEV MODE] getAllPosts: Error occurred, returning mock posts');
            return MOCK_POSTS;
          }
          errorLoggingService.logError(error as Error, { action: 'CommunicationService.getAllPosts' });
          throw error;
        }
      }
    );
  }

  // Create post
  static async createPost(postData: Omit<NewsPost, 'id' | 'timestamp'>): Promise<string> {
    return withDevMode(
      () => `mock-post-${Date.now()}`,
      async () => {
        try {
          // P1 fix: write authorId as a dedicated top-level field so Firestore rules
          // can evaluate resource.data.authorId == request.auth.uid for self-delete.
          const newPost = {
            ...postData,
            authorId: postData.author?.id || '',
            timestamp: Timestamp.now(),
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          };

          const docRef = await addDoc(collection(db, COLLECTIONS.COMMUNICATION), newPost);
          // P2 fix: invalidate communication cache after write
          cacheService.deleteByPrefix(COLLECTIONS.COMMUNICATION + ':');
          return docRef.id;
        } catch (error) {
          errorLoggingService.logError(error as Error, { action: 'CommunicationService.createPost' });
          throw error;
        }
      }
    );
  }

  // Update post
  static async updatePost(postId: string, updates: Partial<NewsPost>): Promise<void> {
    // FIX 4: add devMode guard consistent with all other service methods
    return withDevMode(
      () => { console.log(`[DEV MODE] updatePost: Simulating update for post ${postId}`, updates); },
      async () => {
        try {
          const postRef = doc(db, COLLECTIONS.COMMUNICATION, postId);
          await updateDoc(postRef, {
            ...updates,
            updatedAt: Timestamp.now(),
          });
          // P2 fix: invalidate communication cache after write
          cacheService.deleteByPrefix(COLLECTIONS.COMMUNICATION + ':');
        } catch (error) {
          errorLoggingService.logError(error as Error, { action: 'CommunicationService.updatePost' });
          throw error;
        }
      }
    );
  }

  // Delete post
  static async deletePost(postId: string): Promise<void> {
    return withDevMode(
      () => { console.log(`[DEV MODE] deletePost: Simulating delete for post ${postId}`); },
      async () => {
        try {
          await deleteDoc(doc(db, COLLECTIONS.COMMUNICATION, postId));
          // P2 fix: invalidate communication cache after write
          cacheService.deleteByPrefix(COLLECTIONS.COMMUNICATION + ':');
        } catch (error) {
          errorLoggingService.logError(error as Error, { action: 'CommunicationService.deletePost' });
          throw error;
        }
      }
    );
  }

  // Like post
  static async likePost(postId: string, memberId: string): Promise<void> {
    return withDevMode(
      () => { console.log(`[DEV MODE] Simulating like on post ${postId} by member ${memberId}`); },
      async () => {
        try {
          // FIX 2: use atomic increment + arrayUnion to avoid race condition on concurrent likes
          const postRef = doc(db, COLLECTIONS.COMMUNICATION, postId);
          await updateDoc(postRef, {
            likes: increment(1),
            likedBy: arrayUnion(memberId),
          });
          cacheService.deleteByPrefix(COLLECTIONS.COMMUNICATION + ':');
        } catch (error) {
          errorLoggingService.logError(error as Error, { action: 'CommunicationService.likePost' });
          throw error;
        }
      }
    );
  }

  // Get notifications
  static async getNotifications(memberId: string): Promise<Notification[]> {
    return withDevMode(
      () => MOCK_NOTIFICATIONS,
      async () => {
        try {
          const q = query(
            collection(db, COLLECTIONS.NOTIFICATIONS),
            where('memberId', '==', memberId),
            orderBy('timestamp', 'desc'),
            orderBy('read', 'asc')
          );

          const snapshot = await getDocs(q);
          return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp?.toDate?.()?.toISOString() || doc.data().timestamp,
          } as Notification));
        } catch (error) {
          errorLoggingService.logError(error as Error, { action: 'CommunicationService.getNotifications' });
          throw error;
        }
      }
    );
  }

  // Mark notification as read
  static async markNotificationAsRead(notificationId: string): Promise<void> {
    return withDevMode(
      () => { console.log(`[DEV MODE] Simulating marking notification ${notificationId} as read`); },
      async () => {
        try {
          const notifRef = doc(db, COLLECTIONS.NOTIFICATIONS, notificationId);
          await updateDoc(notifRef, {
            read: true,
            readAt: Timestamp.now(),
          });
          cacheService.deleteByPrefix(COLLECTIONS.NOTIFICATIONS + ':');
        } catch (error) {
          errorLoggingService.logError(error as Error, { action: 'CommunicationService.markNotificationAsRead' });
          throw error;
        }
      }
    );
  }

  static async deleteNotification(notificationId: string): Promise<void> {
    return withDevMode(
      () => { console.log(`[DEV MODE] Simulating deleting notification ${notificationId}`); },
      async () => {
        try {
          const notifRef = doc(db, COLLECTIONS.NOTIFICATIONS, notificationId);
          const notifSnap = await getDoc(notifRef);
          if (notifSnap.exists()) {
            const data = notifSnap.data();
            // isDismissible defaults to true when absent (backward compat)
            if (data.isDismissible === false) {
              throw new Error('This notification cannot be deleted');
            }
          }
          await deleteDoc(notifRef);
          cacheService.deleteByPrefix(COLLECTIONS.NOTIFICATIONS + ':');
        } catch (error) {
          errorLoggingService.logError(error as Error, { action: 'CommunicationService.deleteNotification' });
          throw error;
        }
      }
    );
  }

  // Mark all notifications as read for a member
  static async markAllAsRead(memberId: string): Promise<void> {
    return withDevMode(
      () => { console.log(`[DEV MODE] markAllAsRead for member ${memberId}`); },
      async () => {
        try {
          const q = query(
            collection(db, COLLECTIONS.NOTIFICATIONS),
            where('memberId', '==', memberId),
            where('read', '==', false)
          );
          const snapshot = await getDocs(q);
          if (snapshot.empty) return;

          const now = Timestamp.now();
          const batch = writeBatch(db);
          snapshot.docs.forEach(d => {
            batch.update(d.ref, { read: true, readAt: now });
          });
          await batch.commit();
          cacheService.deleteByPrefix(COLLECTIONS.NOTIFICATIONS + ':');
        } catch (error) {
          errorLoggingService.logError(error as Error, { action: 'CommunicationService.markAllAsRead' });
          throw error;
        }
      }
    );
  }

  // Create notification
  static async createNotification(notificationData: Omit<Notification, 'id' | 'timestamp' | 'read'> & { isDismissible?: boolean }): Promise<string> {
    return withDevMode(
      () => { console.log('[DEV MODE] createNotification:', notificationData); return 'mock-notification-id'; },
      async () => {
        try {
          const newNotification = {
            ...notificationData,
            timestamp: Timestamp.now(),
            read: false,
            createdAt: Timestamp.now(),
          };

          const docRef = await addDoc(collection(db, COLLECTIONS.NOTIFICATIONS), newNotification);
          cacheService.deleteByPrefix(COLLECTIONS.NOTIFICATIONS + ':');
          return docRef.id;
        } catch (error) {
          errorLoggingService.logError(error as Error, { action: 'CommunicationService.createNotification' });
          throw error;
        }
      }
    );
  }

  // Bulk create notifications using writeBatch for atomic delivery.
  // Chunks into pages of 499 to stay under the Firestore 500-operation limit.
  static async bulkCreateNotifications(
    notifications: Array<Omit<Notification, 'id' | 'timestamp' | 'read'> & { isDismissible?: boolean }>
  ): Promise<void> {
    return withDevMode(
      () => { console.log(`[DEV MODE] bulkCreateNotifications: ${notifications.length} notifications`); },
      async () => {
        if (notifications.length === 0) return;
        const now = Timestamp.now();
        const CHUNK = 499;
        try {
          for (let i = 0; i < notifications.length; i += CHUNK) {
            const chunk = notifications.slice(i, i + CHUNK);
            const batch = writeBatch(db);
            chunk.forEach(n => {
              const ref = doc(collection(db, COLLECTIONS.NOTIFICATIONS));
              batch.set(ref, { ...n, timestamp: now, read: false, createdAt: now });
            });
            await batch.commit();
          }
          cacheService.deleteByPrefix(COLLECTIONS.NOTIFICATIONS + ':');
        } catch (error) {
          errorLoggingService.logError(error as Error, { action: 'CommunicationService.bulkCreateNotifications' });
          throw error;
        }
      }
    );
  }

  // Send email notification
  static async sendEmailNotification(
    memberId: string,
    subject: string,
    message: string,
    options?: {
      html?: string;
      cc?: string | string[];
      bcc?: string | string[];
    }
  ): Promise<string> {
    if (isDevMode()) {
      console.log(`[DEV MODE] Would send email to member ${memberId}: ${subject}`);
      return `dev-email-${memberId}`;
    }
    try {
      // Get member email
      const { MembersService } = await import('./membersService');
      const member = await MembersService.getMemberById(memberId);
      
      if (!member?.email) {
        throw new Error(`Member ${memberId} not found or has no email`);
      }

      // Send email
      const emailMessage: EmailMessage = {
        to: member.email,
        subject,
        text: message,
        html: options?.html || message.replace(/\n/g, '<br>'),
        cc: options?.cc,
        bcc: options?.bcc,
        tags: ['notification', 'system'],
        metadata: {
          memberId,
          type: 'notification',
        },
      };

      return await EmailService.sendEmail(emailMessage);
    } catch (error) {
      errorLoggingService.logError(error as Error, { action: 'CommunicationService.sendEmailNotification' });
      throw error;
    }
  }

  // Send bulk email notifications
  static async sendBulkEmailNotifications(
    memberIds: string[],
    subject: string,
    message: string,
    options?: {
      html?: string;
      batchSize?: number;
    }
  ): Promise<{ success: number; failed: number }> {
    if (isDevMode()) {
      console.log(`[DEV MODE] Would send bulk email to ${memberIds.length} members: ${subject}`);
      return { success: 0, failed: 0 };
    }
    try {
      const { MembersService } = await import('./membersService');

      // Get all member emails
      const members = await Promise.all(
        memberIds.map(id => MembersService.getMemberById(id))
      );
      
      const validEmails = members
        .filter(m => m?.email)
        .map(m => m!.email);

      if (validEmails.length === 0) {
        return { success: 0, failed: memberIds.length };
      }

      // Prepare email messages
      const messages: EmailMessage[] = validEmails.map(email => ({
        to: email,
        subject,
        text: message,
        html: options?.html || message.replace(/\n/g, '<br>'),
        tags: ['notification', 'bulk'],
        metadata: {
          type: 'bulk_notification',
        },
      }));

      // Send bulk emails
      const result = await EmailService.sendBulkEmails(messages, {
        batchSize: options?.batchSize || 10,
      });

      return {
        success: result.success,
        failed: result.failed + (memberIds.length - validEmails.length),
      };
    } catch (error) {
      errorLoggingService.logError(error as Error, { action: 'CommunicationService.sendBulkEmailNotifications' });
      throw error;
    }
  }

  // Create and distribute announcement
  static async createAnnouncement(
    announcementData: {
      title: string;
      content: string;
      priority: 'Low' | 'Normal' | 'High' | 'Urgent';
      targetAudience: 'All Members' | 'Board Only' | 'Specific Roles' | 'Specific Members';
      selectedRoles?: string[];
      selectedMembers?: string[];
      scheduledDate?: string;
      expiresDate?: string;
      sendEmail?: boolean;
      sendNotification?: boolean;
    },
    authorId: string
  ): Promise<{ postId: string; emailsSent: number; emailsFailed: number; notificationsSent: number; failedNotifications?: Array<{ memberId: string; reason: string }> }> {
    return withDevMode(
      () => {
        console.log('[DEV MODE] Would create announcement:', announcementData);
        return {
          postId: `mock-announcement-${Date.now()}`,
          emailsSent: 0,
          emailsFailed: 0,
          notificationsSent: 0,
        };
      },
      async () => {
        try {
          const { MembersService } = await import('./membersService');
      const { EmailService } = await import('./emailService');

      // Get target members
      let targetMembers: any[] = [];
      if (announcementData.targetAudience === 'All Members') {
        targetMembers = await MembersService.getAllMembers();
      } else if (announcementData.targetAudience === 'Board Only') {
        targetMembers = await MembersService.getMembersByRole(UserRole.BOARD);
      } else if (announcementData.targetAudience === 'Specific Roles' && announcementData.selectedRoles) {
        const allMembers = await MembersService.getAllMembers();
        targetMembers = allMembers.filter(m => announcementData.selectedRoles!.includes(m.role));
      } else if (announcementData.targetAudience === 'Specific Members' && announcementData.selectedMembers) {
        targetMembers = await Promise.all(
          announcementData.selectedMembers.map(id => MembersService.getMemberById(id))
        );
        targetMembers = targetMembers.filter(Boolean);
      }

      // Create post
      const author = await MembersService.getMemberById(authorId);
      const postData: Omit<NewsPost, 'id' | 'timestamp'> = {
        author: {
          id: authorId,  // FIX 1: persist author ID so posts can be attributed and edited
          name: author?.name || 'System',
          avatar: author?.avatar || '',
          role: author?.role || 'Admin',
        },
        content: `${announcementData.title}\n\n${announcementData.content}`,
        likes: 0,
        comments: 0,
        type: 'Announcement',
      };

      const postId = await this.createPost(postData);

      let emailsSent = 0;
      let emailsFailed = 0;
      let notificationsSent = 0;

      // Send email notifications if requested
      if (announcementData.sendEmail) {
        const emailAddresses = targetMembers
          .filter(m => m?.email)
          .map(m => m.email);

        if (emailAddresses.length > 0) {
          // FIX 3: send each email individually so partial failures are counted, not swallowed
          const emailResults = await Promise.allSettled(
            emailAddresses.map(email => {
              const msg: EmailMessage = {
                to: email,
                subject: `[${announcementData.priority}] ${announcementData.title}`,
                html: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #0066CC;">${announcementData.title}</h2>
                    <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                      ${announcementData.content.replace(/\n/g, '<br>')}
                    </div>
                    ${announcementData.expiresDate ? `
                      <p style="color: #666; font-size: 12px;">
                        This announcement expires on ${new Date(announcementData.expiresDate).toLocaleDateString()}
                      </p>
                    ` : ''}
                  </div>
                `,
                text: `${announcementData.title}\n\n${announcementData.content}`,
                tags: ['announcement', announcementData.priority.toLowerCase()],
              };
              return EmailService.sendEmail(msg);
            })
          );
          emailResults.forEach((result, i) => {
            if (result.status === 'fulfilled') {
              emailsSent++;
            } else {
              emailsFailed++;
              errorLoggingService.logError(
                result.reason instanceof Error ? result.reason : new Error(String(result.reason)),
                { component: 'CommunicationService.createAnnouncement', additionalData: { email: emailAddresses[i] } }
              );
            }
          });
        }
      }

      // Send in-app notifications if requested — use writeBatch for atomic delivery
      if (announcementData.sendNotification) {
        const notifiableMembers = targetMembers.filter(m => m?.id);
        if (notifiableMembers.length > 0) {
          const notifType: 'info' | 'warning' | 'error' =
            announcementData.priority === 'Urgent' ? 'error' :
            announcementData.priority === 'High' ? 'warning' : 'info';
          try {
            await this.bulkCreateNotifications(
              notifiableMembers.map(member => ({
                memberId: member.id as string,
                title: announcementData.title,
                message: announcementData.content.substring(0, 200),
                type: notifType,
              }))
            );
            notificationsSent = notifiableMembers.length;
          } catch (error) {
            errorLoggingService.logError(error as Error, {
              action: 'CommunicationService.createAnnouncement.sendNotification',
            });
          }
        }
      }

      return {
        postId,
        emailsSent,
        emailsFailed,
        notificationsSent,
      };
      } catch (error) {
        errorLoggingService.logError(error as Error, { action: 'CommunicationService.createAnnouncement' });
        throw error;
      }
    }
  );
  }

  /**
   * Processes daily birthday notifications at 1 PM.
   * Checks if today's birthdays have already been processed and if it's past 1 PM.
   */
  static async processDailyBirthdays(): Promise<{ processed: boolean; count: number }> {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const currentHour = today.getHours();

    // Check if it's past 1 PM (13:00)
    if (currentHour < 13 && !isDevMode()) {
      return { processed: false, count: 0 };
    }

    if (isDevMode()) {
      console.log('[DEV MODE] processDailyBirthdays: Checking birthdays...');
    }

    try {
      // Check if already processed today using a system config document
      const configRef = doc(db, COLLECTIONS.SYSTEM_CONFIG, 'birthday_processor');
      const configSnap = await getDoc(configRef);
      
      if (configSnap.exists() && configSnap.data().lastProcessedDate === todayStr && !isDevMode()) {
        return { processed: false, count: 0 };
      }

      // Fetch all members
      const { MembersService } = await import('./membersService');
      const allMembers = await MembersService.getAllMembers();
      
      const todayMonth = today.getMonth() + 1;
      const todayDate = today.getDate();
      
      const birthdayMembers = allMembers.filter(m => {
        if (!m.dateOfBirth) return false;
        const [y, mStr, dStr] = m.dateOfBirth.split('-');
        return parseInt(mStr) === todayMonth && parseInt(dStr) === todayDate;
      });

      if (birthdayMembers.length === 0) {
        // Still update the date so we don't keep checking every 15 mins for nothing
        if (!isDevMode()) {
          await updateDoc(configRef, { lastProcessedDate: todayStr, updatedAt: Timestamp.now() });
        }
        return { processed: true, count: 0 };
      }

      // Create a persistent announcement for all members
      const birthdayNames = birthdayMembers.map(m => m.name).join(', ');
      await this.createAnnouncement({
        title: `🎂 Happy Birthday!`,
        content: `Today we celebrate the birthday${birthdayMembers.length > 1 ? 's' : ''} of: ${birthdayNames}. Let's wish them a fantastic day!`,
        priority: 'Normal',
        targetAudience: 'All Members',
        sendNotification: true,
        sendEmail: false
      }, 'system-admin'); // Triggered as system admin

      // Mark as processed
      if (!isDevMode()) {
        await updateDoc(configRef, { 
          lastProcessedDate: todayStr, 
          updatedAt: Timestamp.now() 
        });
      } else {
        console.log(`[DEV MODE] processDailyBirthdays: Processed birthdays for ${birthdayNames}`);
      }

      return { processed: true, count: birthdayMembers.length };
    } catch (error) {
      errorLoggingService.logError(error as Error, { action: 'CommunicationService.processDailyBirthdays' });
      // If document doesn't exist, create it (excluding dev mode)
      if (!isDevMode()) {
        try {
          const configRef = doc(db, COLLECTIONS.SYSTEM_CONFIG, 'birthday_processor');
          const configSnap = await getDoc(configRef);
          if (!configSnap.exists()) {
             const { setDoc } = await import('firebase/firestore');
             await setDoc(configRef, { 
               lastProcessedDate: '', 
               updatedAt: Timestamp.now() 
             });
          }
        } catch (e) {
          errorLoggingService.logError(e as Error, { action: 'CommunicationService.processDailyBirthdays.initConfig' });
        }
      }
      throw error;
    }
  }
}

