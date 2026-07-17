// Firebase Configuration
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, setPersistence, browserSessionPersistence } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { initializeAppCheck, ReCaptchaV3Provider, AppCheck } from 'firebase/app-check';
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
let appCheck: AppCheck | undefined;

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

  // Firebase App Check — blocks requests from non-app clients
  // In dev: set window.FIREBASE_APPCHECK_DEBUG_TOKEN = true in browser console to get a debug token
  // In production: uses reCAPTCHA v3 (requires VITE_RECAPTCHA_SITE_KEY env var)
  const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
  // AUTH-005: App Check must not be silently skipped in production — a missing key means
  // direct Firestore/Auth API calls from scripts or Postman will be accepted without attestation.
  if (import.meta.env.PROD && !recaptchaSiteKey) {
    throw new Error(
      '[firebase] VITE_RECAPTCHA_SITE_KEY is required in production — App Check cannot be disabled. ' +
      'Set the key in the Netlify dashboard and ensure App Check enforcement is enabled in the Firebase Console.'
    );
  }
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

