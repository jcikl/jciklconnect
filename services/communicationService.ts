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
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/constants';
import { NewsPost, Notification, UserRole } from '../types';
import { isDevMode } from '../utils/devMode';
import { MOCK_POSTS, MOCK_NOTIFICATIONS } from './mockData';
import { EmailService, EmailMessage } from './emailService';

export class CommunicationService {
  // Get all posts
  static async getAllPosts(): Promise<NewsPost[]> {
    // Check dev mode first - if enabled, return mock data immediately
    if (isDevMode()) {
      console.log('[DEV MODE] getAllPosts: Returning mock posts');
      return MOCK_POSTS;
    }
    
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
      // If error occurs and we're in dev mode, return mock data instead
      if (isDevMode()) {
        console.log('[DEV MODE] getAllPosts: Error occurred, returning mock posts');
        return MOCK_POSTS;
      }
      console.error('Error fetching posts:', error);
      throw error;
    }
  }

  // Create post
  static async createPost(postData: Omit<NewsPost, 'id' | 'timestamp'>): Promise<string> {
    if (isDevMode()) {
      // In dev mode, return a mock ID
      const mockId = `mock-post-${Date.now()}`;
      return mockId;
    }
    
    try {
      const newPost = {
        ...postData,
        timestamp: Timestamp.now(),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };
      
      const docRef = await addDoc(collection(db, COLLECTIONS.COMMUNICATION), newPost);
      return docRef.id;
    } catch (error) {
      console.error('Error creating post:', error);
      throw error;
    }
  }

  // Update post
  static async updatePost(postId: string, updates: Partial<NewsPost>): Promise<void> {
    try {
      const postRef = doc(db, COLLECTIONS.COMMUNICATION, postId);
      await updateDoc(postRef, {
        ...updates,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error('Error updating post:', error);
      throw error;
    }
  }

  // Delete post
  static async deletePost(postId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, COLLECTIONS.COMMUNICATION, postId));
    } catch (error) {
      console.error('Error deleting post:', error);
      throw error;
    }
  }

  // Like post
  static async likePost(postId: string, memberId: string): Promise<void> {
    if (isDevMode()) {
      console.log(`[DEV MODE] Simulating like on post ${postId} by member ${memberId}`);
      return;
    }
    
    try {
      const postRef = doc(db, COLLECTIONS.COMMUNICATION, postId);
      const postSnap = await getDoc(postRef);
      
      if (postSnap.exists()) {
        const currentLikes = postSnap.data().likes || 0;
        await updateDoc(postRef, {
          likes: currentLikes + 1,
          likedBy: [...(postSnap.data().likedBy || []), memberId],
        });
      }
    } catch (error) {
      console.error('Error liking post:', error);
      throw error;
    }
  }

  // Get notifications
  static async getNotifications(memberId: string): Promise<Notification[]> {
    if (isDevMode()) {
      return MOCK_NOTIFICATIONS;
    }
    
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
      console.error('Error fetching notifications:', error);
      throw error;
    }
  }

  // Mark notification as read
  static async markNotificationAsRead(notificationId: string): Promise<void> {
    if (isDevMode()) {
      console.log(`[DEV MODE] Simulating marking notification ${notificationId} as read`);
      return;
    }
    
    try {
      const notifRef = doc(db, COLLECTIONS.NOTIFICATIONS, notificationId);
      await updateDoc(notifRef, {
        read: true,
        readAt: Timestamp.now(),
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }

  // Create notification
  static async createNotification(notificationData: Omit<Notification, 'id' | 'timestamp' | 'read'>): Promise<string> {
    try {
      const newNotification = {
        ...notificationData,
        timestamp: Timestamp.now(),
        read: false,
        createdAt: Timestamp.now(),
      };
      
      const docRef = await addDoc(collection(db, COLLECTIONS.NOTIFICATIONS), newNotification);
      return docRef.id;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
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
      console.error('Error sending email notification:', error);
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
      console.error('Error sending bulk email notifications:', error);
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
  ): Promise<{ postId: string; emailsSent: number; notificationsSent: number }> {
    if (isDevMode()) {
      console.log('[DEV MODE] Would create announcement:', announcementData);
      return {
        postId: `mock-announcement-${Date.now()}`,
        emailsSent: 0,
        notificationsSent: 0,
      };
    }

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
      let notificationsSent = 0;

      // Send email notifications if requested
      if (announcementData.sendEmail) {
        const emailAddresses = targetMembers
          .filter(m => m?.email)
          .map(m => m.email);

        if (emailAddresses.length > 0) {
          try {
            const emailMessages: EmailMessage[] = emailAddresses.map(email => ({
              to: email,
              subject: `[${announcementData.priority}] ${announcementData.title}`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #0066CC;">${announcementData.title}</h2>
                  <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    ${announcementData.content.replace(/\n/g, '<br>')}
                  </div>
                  ${announcementData.expiresDate && `
                    <p style="color: #666; font-size: 12px;">
                      This announcement expires on ${new Date(announcementData.expiresDate).toLocaleDateString()}
                    </p>
                  `}
                </div>
              `,
              text: `${announcementData.title}\n\n${announcementData.content}`,
              tags: ['announcement', announcementData.priority.toLowerCase()],
            }));

            await EmailService.sendBulkEmails(emailMessages);
            emailsSent = emailAddresses.length;
          } catch (error) {
            console.error('Error sending announcement emails:', error);
          }
        }
      }

      // Send in-app notifications if requested
      if (announcementData.sendNotification) {
        for (const member of targetMembers) {
          if (member?.id) {
            try {
              await this.createNotification({
                memberId: member.id,
                title: announcementData.title,
                message: announcementData.content.substring(0, 200),
                type: announcementData.priority === 'Urgent' ? 'error' : announcementData.priority === 'High' ? 'warning' : 'info',
              });
              notificationsSent++;
            } catch (error) {
              console.error(`Error sending notification to member ${member.id}:`, error);
            }
          }
        }
      }

      return {
        postId,
        emailsSent,
        notificationsSent,
      };
    } catch (error) {
      console.error('Error creating announcement:', error);
      throw error;
    }
  }
}

