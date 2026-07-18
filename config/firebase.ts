// Firebase Configuration
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, setPersistence, browserSessionPersistence } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { isDevMode } from '../utils/devMode';

// No hardcoded fallbacks — if env var is missing, Firebase init will fail loudly (intentional).
// SEC-009: Hardcoded Firebase config fallbacks removed. All values must come from environment variables.
// Note: public/firebase-messaging-sw.js intentionally retains hardcoded values — service workers
// cannot access Vite env vars (import.meta.env is unavailable in that context).
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
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
if (typeof window !== 'undefined') {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  auth = getAuth(app);

  // AUTH-002: Use browserSessionPersistence so sessions are cleared on browser close.
  // This prevents unattended/shared devices from granting instant access to the next user.
  // If a "Remember me" feature is added in the future, switch to browserLocalPersistence
  // only when the user explicitly opts in on the login form.
  if (!isDevMode()) {
    setPersistence(auth, browserSessionPersistence).catch((error) => {
      console.error('Error setting auth persistence:', error);
    });
  }

  // persistentLocalCache only in production — HMR in dev causes re-init errors
  if (import.meta.env.PROD) {
    try {
      db = initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager()
        })
      });
    } catch {
      db = getFirestore(app);
    }
  } else {
    db = getFirestore(app);
  }
  storage = getStorage(app);

  // P0: Initialize App Check with ReCaptchaV3Provider.
  // Conditional on env var so local dev without a key doesn't crash.
  if (import.meta.env.VITE_RECAPTCHA_SITE_KEY) {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(import.meta.env.VITE_RECAPTCHA_SITE_KEY),
      isTokenAutoRefreshEnabled: true,
    });
  } else {
    if (import.meta.env.PROD) {
      console.error('[Firebase] CRITICAL: VITE_RECAPTCHA_SITE_KEY is missing. App Check is disabled — Firestore is unprotected against unauthenticated access. Add the key to Netlify environment variables.');
    } else {
      console.warn('[Firebase] App Check disabled in dev mode (VITE_RECAPTCHA_SITE_KEY not set).');
    }
  }

}

export { app, auth, db, storage };
export default app;

