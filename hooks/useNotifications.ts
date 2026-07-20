import { useState, useEffect, useCallback } from 'react';
import { useToast } from '../components/ui/Common';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { COLLECTIONS } from '../config/constants';
import { Notification } from '../types';
import { CommunicationService } from '../services/communicationService';
import { errorLoggingService } from '../services/errorLoggingService';
import { isDevMode } from '../utils/devMode';
import { MOCK_NOTIFICATIONS } from '../services/mockData';

interface UseNotificationsResult {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
}

export function useNotifications(memberId: string | undefined): UseNotificationsResult {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    if (!memberId) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    if (isDevMode()) {
      setNotifications(MOCK_NOTIFICATIONS);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, COLLECTIONS.NOTIFICATIONS),
      where('memberId', '==', memberId),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      snapshot => {
        const items: Notification[] = snapshot.docs.map(d => ({
          id: d.id,
          ...d.data(),
          timestamp: d.data().timestamp?.toDate?.()?.toISOString() || d.data().timestamp,
        } as Notification));
        setNotifications(items);
        setLoading(false);
        setError(null);
      },
      err => {
        errorLoggingService.logError(err, { action: 'useNotifications-onSnapshot', memberId });
        setError(err.message);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [memberId]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await CommunicationService.markNotificationAsRead(notificationId);
    } catch (err) {
      errorLoggingService.logError(err, { action: 'useNotifications-markAsRead', notificationId });
      showToast('操作失败，请重试', 'error');
    }
  }, [showToast]);

  const markAllAsRead = useCallback(async () => {
    if (!memberId) return;
    try {
      await CommunicationService.markAllAsRead(memberId);
    } catch (err) {
      errorLoggingService.logError(err, { action: 'useNotifications-markAllAsRead', memberId });
      showToast('操作失败，请重试', 'error');
    }
  }, [memberId, showToast]);

  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      await CommunicationService.deleteNotification(notificationId);
    } catch (err) {
      errorLoggingService.logError(err, { action: 'useNotifications-deleteNotification', notificationId });
      showToast('操作失败，请重试', 'error');
    }
  }, [showToast]);

  return { notifications, unreadCount, loading, error, markAsRead, markAllAsRead, deleteNotification };
}
