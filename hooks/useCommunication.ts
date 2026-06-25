// Communication Data Hook
import { useState, useEffect } from 'react';
import { CommunicationService } from '../services/communicationService';
import { NewsPost, Notification } from '../types';
import { useToast } from '../components/ui/Common';
import { useAuth } from './useAuth';
import { isDevMode } from '../utils/devMode';

export const useCommunication = () => {
  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { member, loading: authLoading, isDevMode: isDevModeFromAuth } = useAuth();
  const { showToast } = useToast();

  const loadData = async () => {
    // Don't load data if auth is still loading
    if (authLoading) {
      return;
    }

    // Skip Firebase calls in developer mode (check multiple sources)
    const inDevMode = isDevMode() || isDevModeFromAuth;
    if (inDevMode) {
      console.log('[DEV MODE] Skipping communication data load from Firebase');
      setPosts([]);
      setNotifications([]);
      setLoading(false);
      setError(null);
      return;
    }

    // Only fetch when logged in (member exists); avoid Firestore without auth
    if (!member) {
      setPosts([]);
      setNotifications([]);
      setLoading(false);
      setError(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const [postsData, notifsData] = await Promise.all([
        CommunicationService.getAllPosts(),
        member ? CommunicationService.getNotifications(member.id) : Promise.resolve([]),
      ]);
      setPosts(postsData);
      setNotifications(notifsData);
    } catch (err) {
      // Check dev mode again in catch block
      const inDevMode = isDevMode() || isDevModeFromAuth;
      if (!inDevMode) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load communication data';
        setError(errorMessage);
        showToast(errorMessage, 'error');
      } else {
        // In dev mode, silently fail and use mock data
        console.log('[DEV MODE] Error caught but ignored:', err);
        setError(null);
        setPosts([]);
        setNotifications([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Wait for auth to finish loading before loading communication data
    if (!authLoading) {
      const inDevMode = isDevMode() || isDevModeFromAuth;
      if (inDevMode) {
        console.log('[DEV MODE] Skipping communication data load in useEffect');
        setPosts([]);
        setNotifications([]);
        setLoading(false);
        setError(null);
        return;
      }
      // Only fetch when logged in (member exists)
      if (!member) {
        setPosts([]);
        setNotifications([]);
        setLoading(false);
        setError(null);
        return;
      }
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member, authLoading, isDevModeFromAuth]);

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

  return {
    posts,
    notifications,
    loading,
    error,
    loadData,
    createPost,
    likePost,
    markNotificationAsRead,
  };
};

