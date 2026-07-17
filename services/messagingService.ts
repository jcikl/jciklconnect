// Messaging Service - Handles 1-to-1, group, and project-specific messaging
import {
  collection,
  doc,
  getDoc,
  getDocs,
  writeBatch,
  query,
  where,
  orderBy,
  limit,
  increment,
  arrayUnion,
  Timestamp,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/constants';
import { isDevMode, withDevMode } from '../utils/devMode';
import { logListener } from './firestoreLogger';
import { apiCache } from './cacheService';

const CONV_COLLECTION = COLLECTIONS.CONVERSATIONS || 'conversations';
const MSG_COLLECTION = COLLECTIONS.MESSAGES || 'messages';

// Cache TTL: 3 minutes for conversations (frequently updated)
const CACHE_TTL_CONVERSATIONS = 3 * 60 * 1000;

function convCacheKey(memberId: string): string {
  return `conversations:member:${memberId}`;
}

function invalidateConversationsCache(memberId: string): void {
  apiCache.deleteByPrefix(`conversations:member:${memberId}`);
}

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
    return withDevMode(
      () => {
        console.log('[Dev Mode] Would create conversation:', { type, participants, name, projectId });
        return 'mock-conversation-id';
      },
      async () => {
        try {
          // For direct messages, check if conversation already exists
          if (type === 'direct' && participants.length === 2) {
            const existing = await this.findDirectConversation(participants[0], participants[1]);
            if (existing) {
              return existing.id!;
            }
          }

          // Fix P1-C: ensure participants always includes createdBy so both UIDs are present
          const allParticipants = Array.from(new Set([...participants, createdBy]));

          // Initialize unreadCount to 0 for every participant
          const unreadCount: Record<string, number> = {};
          allParticipants.forEach(uid => { unreadCount[uid] = 0; });

          const conversationData: Omit<Conversation, 'id'> = {
            type,
            name,
            participants: allParticipants,
            projectId,
            createdBy,
            lastActivity: Timestamp.now(),
            createdAt: Timestamp.now(),
            unreadCount,
          };

          // Use writeBatch so future callers can extend atomically; single-doc creation is safe as addDoc
          const batch = writeBatch(db);
          const newConvRef = doc(collection(db, CONV_COLLECTION));
          batch.set(newConvRef, conversationData);
          await batch.commit();

          // Invalidate cache for all participants
          allParticipants.forEach(uid => invalidateConversationsCache(uid));

          return newConvRef.id;
        } catch (error) {
          console.error('Error creating conversation:', error);
          throw error;
        }
      }
    );
  }

  // Find existing direct conversation between two members
  static async findDirectConversation(memberId1: string, memberId2: string): Promise<Conversation | null> {
    return withDevMode(
      () => null,
      async () => {
        try {
          const snapshot = await getDocs(
            query(
              collection(db, CONV_COLLECTION),
              where('type', '==', 'direct'),
              where('participants', 'array-contains', memberId1)
            )
          );

          const conversation = snapshot.docs
            .map(d => ({ id: d.id, ...d.data() } as Conversation))
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
    );
  }

  // Get all conversations for a member (Fix P2: cache by memberId)
  static async getConversations(memberId: string): Promise<Conversation[]> {
    return withDevMode(
      () => [],
      async () => {
        return apiCache.getOrSet(
          convCacheKey(memberId),
          async () => {
            const snapshot = await getDocs(
              query(
                collection(db, CONV_COLLECTION),
                where('participants', 'array-contains', memberId),
                orderBy('lastActivity', 'desc')
              )
            );

            return snapshot.docs.map(d => ({
              id: d.id,
              ...d.data(),
              lastActivity: d.data().lastActivity?.toDate?.() || d.data().lastActivity,
              createdAt: d.data().createdAt?.toDate?.() || d.data().createdAt,
              lastMessage: d.data().lastMessage ? {
                ...d.data().lastMessage,
                timestamp: d.data().lastMessage.timestamp?.toDate?.() || d.data().lastMessage.timestamp,
              } : undefined,
            } as Conversation));
          },
          CACHE_TTL_CONVERSATIONS
        );
      }
    );
  }

  // Get messages for a conversation
  static async getMessages(conversationId: string, limitCount: number = 50): Promise<Message[]> {
    return withDevMode(
      () => [],
      async () => {
        try {
          const snapshot = await getDocs(
            query(
              collection(db, MSG_COLLECTION),
              where('conversationId', '==', conversationId),
              orderBy('createdAt', 'desc'),
              limit(limitCount)
            )
          );

          return snapshot.docs
            .map(d => ({
              id: d.id,
              ...d.data(),
              createdAt: d.data().createdAt?.toDate?.() || d.data().createdAt,
              editedAt: d.data().editedAt?.toDate?.() || d.data().editedAt,
            } as Message))
            .reverse(); // Reverse to show oldest first
        } catch (error) {
          console.error('Error fetching messages:', error);
          throw error;
        }
      }
    );
  }

  // Send a message (Fix P1: atomic writeBatch for message + conversation update)
  static async sendMessage(
    conversationId: string,
    senderId: string,
    senderName: string,
    senderAvatar: string | undefined,
    content: string,
    type: 'text' | 'image' | 'file' = 'text',
    attachments?: Message['attachments']
  ): Promise<string> {
    return withDevMode(
      () => {
        console.log('[Dev Mode] Would send message:', { conversationId, senderId, content });
        return 'mock-message-id';
      },
      async () => {
        try {
          // Fetch conversation first to compute unreadCounts (read before batch)
          const conversationRef = doc(db, CONV_COLLECTION, conversationId);
          const conversationDoc = await getDoc(conversationRef);

          const now = Timestamp.now();
          const batch = writeBatch(db);

          // (a) New message document
          const newMsgRef = doc(collection(db, MSG_COLLECTION));
          const messageData: Omit<Message, 'id'> = {
            conversationId,
            senderId,
            senderName,
            senderAvatar,
            content,
            type,
            attachments,
            readBy: [senderId], // Sender has read their own message
            createdAt: now,
          };
          batch.set(newMsgRef, messageData);

          // (b) Update conversation lastMessage + unreadCounts atomically
          if (conversationDoc.exists()) {
            const conversation = conversationDoc.data() as Conversation;
            const participants = conversation.participants || [];

            // P1 — use increment() per-participant to avoid read-then-write race
            const unreadIncrements: Record<string, ReturnType<typeof increment>> = {};
            participants.forEach(pid => {
              if (pid !== senderId) {
                unreadIncrements[`unreadCount.${pid}`] = increment(1);
              }
            });

            batch.update(conversationRef, {
              lastMessage: {
                content: content.substring(0, 100),
                senderId,
                timestamp: now,
              },
              lastActivity: now,
              ...unreadIncrements,
            });

            // Invalidate conversations cache for all participants
            participants.forEach(uid => invalidateConversationsCache(uid));
          }

          await batch.commit();

          return newMsgRef.id;
        } catch (error) {
          console.error('Error sending message:', error);
          throw error;
        }
      }
    );
  }

  // Mark messages as read (Fix P1: single writeBatch for all updates)
  static async markAsRead(conversationId: string, memberId: string): Promise<void> {
    return withDevMode(
      () => {},
      async () => {
        try {
          // P1: limit to 490 to leave headroom for the conversation update op in the same batch.
          // Fetch conversation and unread messages in parallel.
          const [messages, conversationDoc] = await Promise.all([
            this.getMessages(conversationId, 490),
            getDoc(doc(db, CONV_COLLECTION, conversationId)),
          ]);

          const unreadMessages = messages.filter(m => !m.readBy.includes(memberId));

          if (unreadMessages.length === 0 && !conversationDoc.exists()) return;

          const batch = writeBatch(db);

          // P1: use arrayUnion so concurrent markAsRead calls don't clobber each other.
          for (const message of unreadMessages) {
            const messageRef = doc(db, MSG_COLLECTION, message.id!);
            batch.update(messageRef, {
              readBy: arrayUnion(memberId),
            });
          }

          // Reset unread count for this member on the conversation
          if (conversationDoc.exists()) {
            const conversation = conversationDoc.data() as Conversation;
            const unreadCount = { ...(conversation.unreadCount || {}) };
            unreadCount[memberId] = 0;
            batch.update(doc(db, CONV_COLLECTION, conversationId), { unreadCount });
          }

          await batch.commit();

          // Invalidate conversations cache for this member
          invalidateConversationsCache(memberId);
        } catch (error) {
          console.error('Error marking messages as read:', error);
          throw error;
        }
      }
    );
  }

  // Subscribe to real-time messages for a conversation
  static subscribeToMessages(
    conversationId: string,
    callback: (messages: Message[]) => void
  ): () => void {
    if (isDevMode()) {
      return () => {}; // Return empty unsubscribe function
    }

    const messagesRef = collection(db, MSG_COLLECTION);
    const q = query(
      messagesRef,
      where('conversationId', '==', conversationId),
      orderBy('createdAt', 'asc')
    );

    logListener('messages', 'messagingService.subscribeToMessages');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate?.() || d.data().createdAt,
        editedAt: d.data().editedAt?.toDate?.() || d.data().editedAt,
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

    const conversationsRef = collection(db, CONV_COLLECTION);
    const q = query(
      conversationsRef,
      where('participants', 'array-contains', memberId),
      orderBy('lastActivity', 'desc')
    );

    logListener('conversations', 'messagingService.subscribeToConversations');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const conversations = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
        lastActivity: d.data().lastActivity?.toDate?.() || d.data().lastActivity,
        createdAt: d.data().createdAt?.toDate?.() || d.data().createdAt,
        lastMessage: d.data().lastMessage ? {
          ...d.data().lastMessage,
          timestamp: d.data().lastMessage.timestamp?.toDate?.() || d.data().lastMessage.timestamp,
        } : undefined,
      } as Conversation));
      callback(conversations);
    }, (error) => {
      console.error('Error subscribing to conversations:', error);
    });

    return unsubscribe;
  }
}
