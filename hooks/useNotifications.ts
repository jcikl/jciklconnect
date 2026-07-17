import { useState, useEffect, useCallback } from 'react';
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
        console.error('[useNotifications] onSnapshot error:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [memberId]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = useCallback(async (notificationId: string) => {
    await CommunicationService.markNotificationAsRead(notificationId);
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!memberId) return;
    await CommunicationService.markAllAsRead(memberId);
  }, [memberId]);

  const deleteNotification = useCallback(async (notificationId: string) => {
    await CommunicationService.deleteNotification(notificationId);
  }, []);

  return { notifications, unreadCount, loading, error, markAsRead, markAllAsRead, deleteNotification };
}
