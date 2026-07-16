// Communication Data Hook
import { useCallback } from 'react';
import { CommunicationService } from '../services/communicationService';
import { NewsPost, Notification } from '../types';
import { useToast } from '../components/ui/Common';
import { useAuth } from './useAuth';
import { isDevMode } from '../utils/devMode';
import { useFirestoreCollection } from './useFirestoreCollection';

export const useCommunication = () => {
  const { member, loading: authLoading, isDevMode: isDevModeFromAuth } = useAuth();
  const { showToast } = useToast();

  // Only fetch when auth has resolved, member is logged in, and not in dev mode
  const enabled = !authLoading && !!member && !isDevMode() && !isDevModeFromAuth;

  const { data: posts, loading: loading1, error: error1, reload: reloadPosts } = useFirestoreCollection<NewsPost>({
    loader: () => CommunicationService.getAllPosts(),
    enabled,
    deps: [enabled],
  });

  const { data: notifications, loading: loading2, error: error2, reload: reloadNotifications } = useFirestoreCollection<Notification>({
    loader: () => CommunicationService.getNotifications(member!.id),
    enabled,
    deps: [enabled, member?.id],
  });

  // Include authLoading so components keep their spinner while auth resolves
  const loading = authLoading || loading1 || loading2;

  const loadData = useCallback(async () => {
    await reloadPosts();
    await reloadNotifications();
  }, [reloadPosts, reloadNotifications]);

  const createPost = async (postData: Omit<NewsPost, 'id' | 'timestamp'>) => {
    try {
      const id = await CommunicationService.createPost(postData);
      await loadData();
      showToast('Post created successfully', 'success');
      return id;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create post';
      showToast(errorMessage, 'error');
      throw err;
    }
  };

  const likePost = async (postId: string) => {
    if (!member) {
      showToast('Please login to like posts', 'error');
      return;
    }
    try {
      await CommunicationService.likePost(postId, member.id);
      await loadData();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to like post';
      showToast(errorMessage, 'error');
      throw err;
    }
  };

  const markNotificationAsRead = async (notificationId: string) => {
    try {
      await CommunicationService.markNotificationAsRead(notificationId);
      await loadData();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to mark notification as read';
      showToast(errorMessage, 'error');
      throw err;
    }
  };

  const deleteNotification = useCallback(async (notificationId: string) => {
    await CommunicationService.deleteNotification(notificationId);
  }, []);

  return {
    posts,
    notifications,
    loading,
    error: error1 || error2,
    loadData,
    createPost,
    likePost,
    markNotificationAsRead,
    deleteNotification,
  };
};
