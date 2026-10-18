// Shared Firebase Admin setup for Netlify Functions.
// Lives outside netlify/functions/ so Netlify does not deploy it as a function of its own.
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

// SEC-CF05: FIREBASE_ADMIN_* names (no VITE_ prefix) so Vite never injects the private key into the browser bundle.
const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
const usingEmulator = !!process.env.FIRESTORE_EMULATOR_HOST;

export const hasAdminCredentials = !!(projectId && clientEmail && privateKey) || usingEmulator;

if (!getApps().length) {
  if (projectId && clientEmail && privateKey) {
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  } else if (usingEmulator) {
    // Local verification only: Admin SDK talks to the Firestore emulator without credentials.
    initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'demo-jcikl' });
  } else {
    console.error('[firebaseAdmin] Missing Firebase Admin credentials — functions using it will fail');
  }
}

export const db = hasAdminCredentials ? getFirestore() : null;
export const messaging = hasAdminCredentials ? getMessaging() : null;

// The client saves the push token on the member document (services/notificationService.ts).
export async function getMemberFcmToken(memberId) {
  const snap = await db.collection('members').doc(memberId).get();
  return snap.data()?.fcmToken || null;
}
