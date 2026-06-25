// Messaging Service - Handles 1-to-1, group, and project-specific messaging
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/constants';
import { isDevMode } from '../utils/devMode';

export interface Message {
  id?: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  content: string;
  type: 'text' | 'image' | 'file' | 'system';
  attachments?: Array<{
    type: 'image' | 'file';
    url: string;
    name: string;
    size?: number;
  }>;
  readBy: string[]; // Array of member IDs who have read this message
  createdAt: Date | Timestamp;
  editedAt?: Date | Timestamp;
}

export interface Conversation {
  id?: string;
  type: 'direct' | 'group' | 'project';
  name?: string; // For group and project conversations
  participants: string[]; // Array of member IDs
  projectId?: string; // For project-specific conversations
  lastMessage?: {
    content: string;
    senderId: string;
    timestamp: Date | Timestamp;
  };
  lastActivity: Date | Timestamp;
  createdBy: string;
  createdAt: Date | Timestamp;
  unreadCount?: Record<string, number>; // Unread count per participant
}

export class MessagingService {
  // Create a new conversation
  static async createConversation(
    type: 'direct' | 'group' | 'project',
    participants: string[],
    createdBy: string,
    name?: string,
    projectId?: string
  ): Promise<string> {
    if (isDevMode()) {
      console.log('[Dev Mode] Would create conversation:', { type, participants, name, projectId });
      return 'mock-conversation-id';
    }

    try {
      // For direct messages, check if conversation already exists
      if (type === 'direct' && participants.length === 2) {
        const existing = await this.findDirectConversation(participants[0], participants[1]);
        if (existing) {
          return existing.id!;
        }
      }

      const conversationData: Omit<Conversation, 'id'> = {
        type,
        name,
        participants,
        projectId,
        createdBy,
        lastActivity: Timestamp.now(),
        createdAt: Timestamp.now(),
        unreadCount: {},
      };

      const docRef = await addDoc(collection(db, COLLECTIONS.CONVERSATIONS || 'conversations'), conversationData);
      return docRef.id;
    } catch (error) {
      console.error('Error creating conversation:', error);
      throw error;
    }
  }

  // Find existing direct conversation between two members
  static async findDirectConversation(memberId1: string, memberId2: string): Promise<Conversation | null> {
    if (isDevMode()) {
      return null;
    }

    try {
      const snapshot = await getDocs(
        query(
          collection(db, COLLECTIONS.CONVERSATIONS || 'conversations'),
          where('type', '==', 'direct'),
          where('participants', 'array-contains', memberId1)
        )
      );

      const conversation = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Conversation))
        .find(conv => 
          conv.participants.includes(memberId1) && 
          conv.participants.includes(memberId2) &&
          conv.participants.length === 2
        );

      return conversation || null;
    } catch (error) {
      console.error('Error finding direct conversation:', error);
      return null;
    }
  }

  // Get all conversations for a member
  static async getConversations(memberId: string): Promise<Conversation[]> {
    if (isDevMode()) {
      return [];
    }

    try {
      const snapshot = await getDocs(
        query(
          collection(db, COLLECTIONS.CONVERSATIONS || 'conversations'),
          where('participants', 'array-contains', memberId),
          orderBy('lastActivity', 'desc')
        )
      );

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        lastActivity: doc.data().lastActivity?.toDate?.() || doc.data().lastActivity,
        createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
        lastMessage: doc.data().lastMessage ? {
          ...doc.data().lastMessage,
          timestamp: doc.data().lastMessage.timestamp?.toDate?.() || doc.data().lastMessage.timestamp,
        } : undefined,
      } as Conversation));
    } catch (error) {
      console.error('Error fetching conversations:', error);
      throw error;
    }
  }

  // Get messages for a conversation
  static async getMessages(conversationId: string, limitCount: number = 50): Promise<Message[]> {
    if (isDevMode()) {
      return [];
    }

    try {
      const snapshot = await getDocs(
        query(
          collection(db, COLLECTIONS.MESSAGES || 'messages'),
          where('conversationId', '==', conversationId),
          orderBy('createdAt', 'desc'),
          limit(limitCount)
        )
      );

      return snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
          editedAt: doc.data().editedAt?.toDate?.() || doc.data().editedAt,
        } as Message))
        .reverse(); // Reverse to show oldest first
    } catch (error) {
      console.error('Error fetching messages:', error);
      throw error;
    }
  }

  // Send a message
  static async sendMessage(
    conversationId: string,
    senderId: string,
    senderName: string,
    senderAvatar: string | undefined,
    content: string,
    type: 'text' | 'image' | 'file' = 'text',
    attachments?: Message['attachments']
  ): Promise<string> {
    if (isDevMode()) {
      console.log('[Dev Mode] Would send message:', { conversationId, senderId, content });
      return 'mock-message-id';
    }

    try {
      const messageData: Omit<Message, 'id'> = {
        conversationId,
        senderId,
        senderName,
        senderAvatar,
        content,
        type,
        attachments,
        readBy: [senderId], // Sender has read their own message
        createdAt: Timestamp.now(),
      };

      const docRef = await addDoc(collection(db, COLLECTIONS.MESSAGES || 'messages'), messageData);

      // Update conversation's last message and activity
      const conversationRef = doc(db, COLLECTIONS.CONVERSATIONS || 'conversations', conversationId);
      const conversationDoc = await getDoc(conversationRef);
      
      if (conversationDoc.exists()) {
        const conversation = conversationDoc.data() as Conversation;
        const participants = conversation.participants || [];
        
        // Update unread counts (increment for all participants except sender)
        const unreadCount = conversation.unreadCount || {};
        participants.forEach(participantId => {
          if (participantId !== senderId) {
            unreadCount[participantId] = (unreadCount[participantId] || 0) + 1;
          }
        });

        await updateDoc(conversationRef, {
          lastMessage: {
            content: content.substring(0, 100), // Truncate for preview
            senderId,
            timestamp: Timestamp.now(),
          },
          lastActivity: Timestamp.now(),
          unreadCount,
        });
      }

      return docRef.id;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  // Mark messages as read
  static async markAsRead(conversationId: string, memberId: string): Promise<void> {
    if (isDevMode()) {
      return;
    }

    try {
      // Get unread messages
      const messages = await this.getMessages(conversationId, 100);
      const unreadMessages = messages.filter(m => !m.readBy.includes(memberId));

      // Update each unread message
      const updatePromises = unreadMessages.map(message => {
        const messageRef = doc(db, COLLECTIONS.MESSAGES || 'messages', message.id!);
        return updateDoc(messageRef, {
          readBy: [...message.readBy, memberId],
        });
      });

      await Promise.all(updatePromises);

      // Reset unread count for this member
      const conversationRef = doc(db, COLLECTIONS.CONVERSATIONS || 'conversations', conversationId);
      const conversationDoc = await getDoc(conversationRef);
      
      if (conversationDoc.exists()) {
        const conversation = conversationDoc.data() as Conversation;
        const unreadCount = conversation.unreadCount || {};
        unreadCount[memberId] = 0;

        await updateDoc(conversationRef, { unreadCount });
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
      throw error;
    }
  }

  // Subscribe to real-time messages for a conversation
  static subscribeToMessages(
    conversationId: string,
    callback: (messages: Message[]) => void
  ): () => void {
    if (isDevMode()) {
      return () => {}; // Return empty unsubscribe function
    }

    const messagesRef = collection(db, COLLECTIONS.MESSAGES || 'messages');
    const q = query(
      messagesRef,
      where('conversationId', '==', conversationId),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
        editedAt: doc.data().editedAt?.toDate?.() || doc.data().editedAt,
      } as Message));
      callback(messages);
    }, (error) => {
      console.error('Error subscribing to messages:', error);
    });

    return unsubscribe;
  }

  // Subscribe to real-time conversations for a member
  static subscribeToConversations(
    memberId: string,
    callback: (conversations: Conversation[]) => void
  ): () => void {
    if (isDevMode()) {
      return () => {}; // Return empty unsubscribe function
    }

    const conversationsRef = collection(db, COLLECTIONS.CONVERSATIONS || 'conversations');
    const q = query(
      conversationsRef,
      where('participants', 'array-contains', memberId),
      orderBy('lastActivity', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const conversations = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        lastActivity: doc.data().lastActivity?.toDate?.() || doc.data().lastActivity,
        createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
        lastMessage: doc.data().lastMessage ? {
          ...doc.data().lastMessage,
          timestamp: doc.data().lastMessage.timestamp?.toDate?.() || doc.data().lastMessage.timestamp,
        } : undefined,
      } as Conversation));
      callback(conversations);
    }, (error) => {
      console.error('Error subscribing to conversations:', error);
    });

    return unsubscribe;
  }
}

