/* eslint-env serviceworker */
/* eslint-disable no-undef */
// public/firebase-messaging-sw.js

// Import Firebase scripts (10.x compat recommended; 9.x also OK)
importScripts(
  "https://www.gstatic.com/firebasejs/10.12.3/firebase-app-compat.js"
);
importScripts(
  "https://www.gstatic.com/firebasejs/10.12.3/firebase-messaging-compat.js"
);

// Initialize Firebase inside the service worker
firebase.initializeApp({
  apiKey: "AIzaSyCDnc0kdUqpPVsHFrNvrlmszP4DG9-PJtc",
  authDomain: "pos-system-448bc.firebaseapp.com",
  projectId: "pos-system-448bc",
  storageBucket: "pos-system-448bc.appspot.com",
  messagingSenderId: "856030481645",
  appId: "1:856030481645:web:9746b42468d4ba2c58d0e4",
  measurementId: "G-EYY90X5N2Y",
});

const messaging = firebase.messaging();

// ✅ Background notifications
messaging.onBackgroundMessage((payload) => {
  // Example expected payload:
  // {
  //   notification: { title: "...", body: "..." },
  //   data: { link: "/entry-data/sales-entry?branch=..." }
  // }

  const title = payload.notification?.title || "New Notification";
  const body = payload.notification?.body || "You have a new message.";
  const link = payload.data?.link || "/";

  // Use icons only if they exist in /public; otherwise remove these lines
  self.registration.showNotification(title, {
    body,
    tag: "reports-fcm",
    data: { link },
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-72.png",
  });
});

// ✅ Clicking the banner opens/focuses your app
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification?.data?.link || "/";

  event.waitUntil(
    (async () => {
      const allClients = await clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      // Focus an existing tab if we find one
      for (const client of allClients) {
        if ("focus" in client && client.url.includes(self.location.origin)) {
          return client.focus();
        }
      }
      // Or open a new one
      if (clients.openWindow) return clients.openWindow(url);
    })()
  );
});
