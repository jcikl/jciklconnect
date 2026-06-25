// Messaging Hook - Manages messaging state and operations
import { useState, useEffect, useCallback } from 'react';
import { MessagingService, Conversation, Message } from '../services/messagingService';
import { useToast } from '../components/ui/Common';
import { useAuth } from './useAuth';
import { isDevMode } from '../utils/devMode';

export const useMessaging = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { member } = useAuth();
  const { showToast } = useToast();

  // Load conversations
  const loadConversations = useCallback(async () => {
    if (!member || isDevMode()) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await MessagingService.getConversations(member.id);
      setConversations(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load conversations';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  }, [member, showToast]);

  // Load messages for a conversation
  const loadMessages = useCallback(async (conversationId: string) => {
    if (isDevMode()) {
      setMessages([]);
      return;
    }

    try {
      setError(null);
      const data = await MessagingService.getMessages(conversationId);
      setMessages(data);

      // Mark messages as read
      if (member) {
        await MessagingService.markAsRead(conversationId, member.id);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load messages';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    }
  }, [member, showToast]);

  // Send a message
  const sendMessage = useCallback(async (
    conversationId: string,
    content: string,
    type: 'text' | 'image' | 'file' = 'text',
    attachments?: Message['attachments']
  ) => {
    if (!member) {
      showToast('Please login to send messages', 'error');
      return;
    }

    try {
      setError(null);
      await MessagingService.sendMessage(
        conversationId,
        member.id,
        member.name,
        member.avatar,
        content,
        type,
        attachments
      );
      
      // Reload messages
      await loadMessages(conversationId);
      await loadConversations();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
      setError(errorMessage);
      showToast(errorMessage, 'error');
      throw err;
    }
  }, [member, showToast, loadMessages, loadConversations]);

  // Create a new conversation
  const createConversation = useCallback(async (
    type: 'direct' | 'group' | 'project',
    participants: string[],
    name?: string,
    projectId?: string
  ) => {
    if (!member) {
      showToast('Please login to create conversations', 'error');
      return;
    }

    try {
      setError(null);
      const conversationId = await MessagingService.createConversation(
        type,
        participants,
        member.id,
        name,
        projectId
      );
      
      await loadConversations();
      return conversationId;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create conversation';
      setError(errorMessage);
      showToast(errorMessage, 'error');
      throw err;
    }
  }, [member, showToast, loadConversations]);

  // Select a conversation
  const selectConversation = useCallback(async (conversation: Conversation) => {
    setSelectedConversation(conversation);
    if (conversation.id) {
      await loadMessages(conversation.id);
    }
  }, [loadMessages]);

  // Initialize
  useEffect(() => {
    if (member) {
      loadConversations();
    }
  }, [member, loadConversations]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!member || isDevMode() || !selectedConversation?.id) {
      return;
    }

    const unsubscribe = MessagingService.subscribeToMessages(selectedConversation.id, (newMessages) => {
      setMessages(newMessages);
    });

    return () => {
      unsubscribe();
    };
  }, [member, selectedConversation?.id]);

  // Subscribe to conversation updates
  useEffect(() => {
    if (!member || isDevMode()) {
      return;
    }

    const unsubscribe = MessagingService.subscribeToConversations(member.id, (newConversations) => {
      setConversations(newConversations);
    });

    return () => {
      unsubscribe();
    };
  }, [member]);

  return {
    conversations,
    messages,
    selectedConversation,
    loading,
    error,
    sendMessage,
    createConversation,
    selectConversation,
    loadConversations,
    loadMessages,
  };
};

