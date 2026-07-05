import { getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging';
import { doc, setDoc, deleteField, updateDoc } from 'firebase/firestore';
import { app, db } from '../config/firebase';
import { isDevMode } from '../utils/devMode';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

let messaging: Messaging | null = null;

function getMessagingInstance(): Messaging | null {
  if (typeof window === 'undefined') return null;
  if (!messaging) {
    try {
      messaging = getMessaging(app);
    } catch {
      return null;
    }
  }
  return messaging;
}

/** Request permission and register FCM token for the current user */
export async function registerPushNotifications(userId: string): Promise<string | null> {
  if (isDevMode()) return null;
  if (!VAPID_KEY) {
    console.warn('Push notifications: VITE_FIREBASE_VAPID_KEY not set.');
    return null;
  }

  const m = getMessagingInstance();
  if (!m) return null;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;

    const token = await getToken(m, { vapidKey: VAPID_KEY });
    if (token) {
      await setDoc(
        doc(db, 'users', userId),
        { fcmToken: token, fcmUpdatedAt: new Date().toISOString() },
        { merge: true }
      );
    }
    return token;
  } catch (err) {
    console.error('FCM registration failed:', err);
    return null;
  }
}

/** Remove FCM token on logout */
export async function unregisterPushNotifications(userId: string): Promise<void> {
  if (isDevMode()) return;
  try {
    await updateDoc(doc(db, 'users', userId), { fcmToken: deleteField() });
  } catch {
    // ignore — user may not have a token
  }
}

/** Listen for foreground messages — pass a handler to show an in-app toast */
export function onForegroundMessage(handler: (payload: { title: string; body: string }) => void) {
  const m = getMessagingInstance();
  if (!m) return () => {};
  return onMessage(m, (payload) => {
    const title = payload.notification?.title || 'JCI KL';
    const body = payload.notification?.body || '';
    handler({ title, body });
  });
}
