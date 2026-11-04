/* eslint-env serviceworker */
/* global firebase */
// public/firebase-messaging-sw.js — the app's one service worker for push
// (roadmap 4.3). The Firebase project comes in the address it is registered
// with (lib/notify/push.js), so the same file serves production and
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

// ── The saved copy of the app, on phones only (lib/device/model.js) ──────────
// The app's code never changes under one address, so a saved copy is always
// right. A page may have changed, so the server is asked first and a saved page
// answers only when the server is slow or out of reach. Sign-out clears saved
// pages (lib/device/client.js). Data never passes through here: Firebase is on
// another address, and /api is left alone.
const PHONE_AGENTS = /Android|iPhone|iPad|iPod|Mobile|CashCurryStaffApp/i;
const CODE_CACHE = "cc-code-v1";
const PAGE_CACHE = "cc-pages-v1";
const LAST_PAGE = "/__last-page";
const SLOW_PAGE_MS = 3000;
const MOST_CODE_FILES = 400;
// Signing in and public links need the server. A kiosk is a shared screen.
const NOT_SAVED = ["/login", "/signup", "/reset-password", "/unauthorized", "/join", "/kiosk"];

const isCode = (path) => path.startsWith("/_next/static/") || /^\/(icons|logo|stickers)\//.test(path);
const isSaved = (path) => !NOT_SAVED.some((p) => path === p || path.startsWith(`${p}/`));

async function savedCode(request) {
  const cache = await caches.open(CODE_CACHE);
  const saved = await cache.match(request);
  if (saved) return saved;
  const res = await fetch(request);
  if (res.ok && res.type === "basic") {
    await cache.put(request, res.clone());
    const files = await cache.keys();
    await Promise.all(files.slice(0, Math.max(0, files.length - MOST_CODE_FILES)).map((f) => cache.delete(f)));
  }
  return res;
}

const NO_CONNECTION = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>No connection</title><body style="font-family:system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:16px;box-sizing:border-box;text-align:center"><h1 style="font-size:20px;margin:0 0 8px">No connection</h1><p style="margin:0 0 16px">Check your internet, then try again.</p><button onclick="location.reload()" style="font-size:16px;padding:10px 20px">Try again</button></body>`;

/** No connection and this page was never saved: the last saved page, else a plain note. */
async function whenUnreachable(cache) {
  const last = await cache.match(LAST_PAGE);
  if (last) return Response.redirect(new URL(await last.text(), self.location.origin).href, 302);
  return new Response(NO_CONNECTION, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

async function savedPage(event) {
  const path = new URL(event.request.url).pathname;
  const cache = await caches.open(PAGE_CACHE);
  const fresh = fetch(event.request).then(async (res) => {
    if (res.ok && res.type === "basic" && isSaved(path)) {
      await cache.put(path, res.clone());
      await cache.put(LAST_PAGE, new Response(path));
    }
    return res;
  });
  const saved = await cache.match(path);
  if (!saved) return fresh.catch(() => whenUnreachable(cache));
  event.waitUntil(fresh.catch(() => {}));
  const slow = new Promise((answer) => setTimeout(() => answer(saved), SLOW_PAGE_MS));
  return Promise.race([fresh.catch(() => saved), slow]);
}

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith("cc-") && n !== CODE_CACHE && n !== PAGE_CACHE).map((n) => caches.delete(n)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || !PHONE_AGENTS.test(self.navigator.userAgent)) return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isCode(url.pathname)) event.respondWith(savedCode(request));
  else if (request.mode === "navigate") event.respondWith(savedPage(event));
});
