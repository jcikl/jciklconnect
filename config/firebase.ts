// Firebase Configuration
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { initializeAppCheck, ReCaptchaV3Provider, AppCheck } from 'firebase/app-check';
import { isDevMode } from '../utils/devMode';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCVjUeVrU_OJFrP0eR416EVuUOixmHmY0Q',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'jci-lo-management-app.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'jci-lo-management-app',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'jci-lo-management-app.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '212717402010',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:212717402010:web:f8d6fd34154c8bab85ec23',
};

// Validate Firebase configuration
if (typeof window !== 'undefined') {
  const requiredEnvVars = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_STORAGE_BUCKET',
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_APP_ID',
  ];

  const missingVars = requiredEnvVars.filter(
    (varName) => !import.meta.env[varName]
  );

  if (missingVars.length > 0) {
    if (import.meta.env.PROD) {
      throw new Error(
        `[firebase] Missing required env vars: ${missingVars.join(', ')}. ` +
        'Check your deployment config — the app will not function correctly without these.'
      );
    }
    console.warn(
      `⚠️ Missing Firebase environment variables: ${missingVars.join(', ')}\n` +
      'Using fallback values. Set up your .env file for a proper local config.'
    );
  }
}

// Initialize Firebase
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;
let appCheck: AppCheck | undefined;

if (typeof window !== 'undefined') {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  auth = getAuth(app);

  // Only set persistence if not in dev mode (to avoid Firebase API calls)
  if (!isDevMode()) {
    setPersistence(auth, browserLocalPersistence).catch((error) => {
      console.error('Error setting auth persistence:', error);
    });
  }

  // persistentLocalCache only in production — HMR in dev causes re-init errors
  if (import.meta.env.PROD) {
    try {
      db = initializeFirestore(app, { localCache: persistentLocalCache() });
    } catch {
      db = getFirestore(app);
    }
  } else {
    db = getFirestore(app);
  }
  storage = getStorage(app);

  // Firebase App Check — blocks requests from non-app clients
  // In dev: set window.FIREBASE_APPCHECK_DEBUG_TOKEN = true in browser console to get a debug token
  // In production: uses reCAPTCHA v3 (requires VITE_RECAPTCHA_SITE_KEY env var)
  const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
  if (import.meta.env.PROD && recaptchaSiteKey) {
    appCheck = initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(recaptchaSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
  } else if (import.meta.env.DEV) {
    // Expose debug token flag so devs can copy the token from the console and register it in Firebase Console
    (self as unknown as Record<string, unknown>).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }
}

export { app, auth, db, storage, appCheck };
export default app;

