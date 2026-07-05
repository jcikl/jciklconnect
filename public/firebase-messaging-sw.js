importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyCVjUeVrU_OJFrP0eR416EVuUOixmHmY0Q',
  authDomain: 'jci-lo-management-app.firebaseapp.com',
  projectId: 'jci-lo-management-app',
  storageBucket: 'jci-lo-management-app.firebasestorage.app',
  messagingSenderId: '212717402010',
  appId: '1:212717402010:web:f8d6fd34154c8bab85ec23',
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  const { title, body, icon } = payload.notification || {};
  self.registration.showNotification(title || 'JCI KL', {
    body: body || '',
    icon: icon || '/favicon-128x128.png',
    badge: '/favicon-64x64.png',
    data: payload.data,
  });
});

// Handle notification click — open/focus the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) return clientList[0].focus();
      return clients.openWindow('/');
    })
  );
});
