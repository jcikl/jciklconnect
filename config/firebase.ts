// Firebase Configuration
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
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
    console.warn(
      `⚠️ Missing Firebase environment variables: ${missingVars.join(', ')}\n` +
      'Please check your .env file and ensure all Firebase configuration values are set.'
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
  
  // Only set persistence if not in dev mode (to avoid Firebase API calls)
  if (!isDevMode()) {
    // Set persistence to LOCAL (default, but explicit for clarity)
    // This ensures user stays logged in across browser sessions
    setPersistence(auth, browserLocalPersistence).catch((error) => {
      // Only log error if not in dev mode
      if (!isDevMode()) {
        console.error('Error setting auth persistence:', error);
      }
    });
  }
  
  db = getFirestore(app);
  storage = getStorage(app);
}

export { app, auth, db, storage };
export default app;

