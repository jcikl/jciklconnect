// IMPORTANT: Keep this version in sync with firebase version in package.json
// Current firebase package.json version: check package.json firebase field
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Firebase Web API keys are not secret — security is enforced by Firestore rules and App Check.
// Update this config manually if the Firebase project changes. See: https://firebase.google.com/docs/web/setup
firebase.initializeApp({
  apiKey: 'AIzaSyCVjUeVrU_OJFrP0eR416EVuUOixmHmY0Q',
  authDomain: 'jci-lo-management-app.firebaseapp.com',
  projectId: 'jci-lo-management-app',
  storageBucket: 'jci-lo-management-app.firebasestorage.app',
  messagingSenderId: '212717402010',
  appId: '1:212717402010:web:f8d6fd34154c8bab85ec23',
});

// Ensure the new SW takes control immediately on update
self.addEventListener('install', event => {
  // ERR-R-003: precache the app shell so navigation works offline.
  event.waitUntil(
    caches.open('app-shell-v1').then(cache => cache.add('/index.html')).then(() => self.skipWaiting())
  );
});
self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

// ERR-R-003: intercept navigation requests and serve cached /index.html when offline.
// This enables deep links (/members, /events, /finance, etc.) to work without a network connection.
self.addEventListener('fetch', event => {
  const req = event.request;
  // Only handle same-origin navigation requests (page loads / history navigations).
  if (req.mode === 'navigate' && new URL(req.url).origin === self.location.origin) {
    event.respondWith(
      fetch(req).catch(() =>
        caches.match('/index.html').then(cached => cached || fetch('/index.html'))
      )
    );
  }
  // All other requests (API, Firestore, Firebase SDK scripts) fall through to the browser default.
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage(async (payload) => {
  const { title, body, icon } = payload.notification || {};
  try {
    await self.registration.showNotification(title || 'JCI KL', {
      body: body || '',
      icon: icon || '/favicon-128x128.png',
      badge: '/favicon-64x64.png',
      data: payload.data,
    });
  } catch (err) {
    console.error('showNotification failed:', err);
  }
});

// Handle notification click — navigate to the notification's target route
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      const match = clientList.find(c => c.url.includes(targetUrl) || targetUrl === '/');
      if (match) return match.focus();
      return clients.openWindow(targetUrl);
    })
  );
});
