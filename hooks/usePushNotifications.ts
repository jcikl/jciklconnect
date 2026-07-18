import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { useState, useEffect, useRef } from 'react';
import { app } from '../config/firebase';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || '';

export const usePushNotifications = () => {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const isRequestingRef = useRef(false);

  useEffect(() => {
    if (typeof Notification !== 'undefined') {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = async (): Promise<string | null> => {
    if (typeof Notification === 'undefined') return null;
    if (isRequestingRef.current) return null;
    isRequestingRef.current = true;
    setLoading(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === 'granted') {
        const messaging = getMessaging(app);
        const fcmToken = await getToken(messaging, { vapidKey: VAPID_KEY });
        setToken(fcmToken);
        return fcmToken;
      }
      return null;
    } catch {
      return null;
    } finally {
      setLoading(false);
      isRequestingRef.current = false;
    }
  };

  // Listen for foreground messages
  useEffect(() => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    let unsubscribe: (() => void) | undefined;
    try {
      const messaging = getMessaging(app);
      unsubscribe = onMessage(messaging, (payload) => {
        const title = payload.notification?.title ?? 'Notification';
        const body = payload.notification?.body ?? '';
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification(title, { body });
        }
      });
    } catch {
      // Firebase messaging not available (e.g. dev mode without service worker)
    }
    return () => { unsubscribe?.(); };
  }, [permission]);

  return { permission, token, loading, requestPermission };
};
