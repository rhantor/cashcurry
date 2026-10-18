/* eslint-env serviceworker */
/* global firebase, clients */
// public/firebase-messaging-sw.js — the app's one service worker for push
// (roadmap 4.3). The Firebase project comes in the address it is registered
// with (lib/notifications/push.js), so the same file serves production and
// the staging project.

importScripts("https://www.gstatic.com/firebasejs/10.12.3/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.3/firebase-messaging-compat.js");

const params = new URL(self.location.href).searchParams;
const config = {
  apiKey: params.get("apiKey"),
  projectId: params.get("projectId"),
  messagingSenderId: params.get("messagingSenderId"),
  appId: params.get("appId"),
};

if (config.apiKey && config.projectId) {
  firebase.initializeApp(config);
  const messaging = firebase.messaging();

  // In the background: show it. (The server sends title, body and the page to open.)
  messaging.onBackgroundMessage((payload) => {
    const title = payload.notification?.title || "Cash Curry";
    self.registration.showNotification(title, {
      body: payload.notification?.body || "",
      tag: payload.data?.type || "cash-curry",
      data: { link: payload.data?.link || "/" },
      icon: "/icons/icon-192.png",
    });
  });
}

// Tapping a notification opens its page — in an open tab if there is one.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = event.notification?.data?.link || event.notification?.data?.FCM_MSG?.data?.link || "/";
  const url = new URL(link, self.location.origin).href;
  event.waitUntil(
    (async () => {
      const open = await clients.matchAll({ type: "window", includeUncontrolled: true });
      const tab = open.find((c) => c.url.startsWith(self.location.origin));
      if (tab) {
        await tab.focus();
        return "navigate" in tab ? tab.navigate(url) : undefined;
      }
      return clients.openWindow ? clients.openWindow(url) : undefined;
    })()
  );
});
