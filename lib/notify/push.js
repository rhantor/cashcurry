// lib/notify/push.js
// Push on this device (roadmap 4.3). The browser is asked for permission
// only when the person taps "Turn on" — never by itself after login. Once
// allowed, each sign-in refreshes this device's token quietly, saved at
// companies/{c}/users/{uid}/fcmTokens/{token} for the server to send to.
//
// The local emulators have no push service: there it says "not available".
import { deleteToken, getMessaging, getToken, isSupported, onMessage } from "firebase/messaging";
import { collection, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { app, db, USE_EMULATOR } from "@/lib/firebase";

const SW = "/firebase-messaging-sw.js";

/** The service worker's address, carrying which Firebase project to use. */
function workerUrl() {
  const p = new URLSearchParams({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
  });
  return `${SW}?${p}`;
}

/** iPhone/iPad: push works only from the app added to the home screen. */
export const needsHomeScreen = () =>
  typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.matchMedia?.("(display-mode: standalone)").matches;

/**
 * Where push stands on this device:
 * "on" | "off" (can be turned on) | "blocked" (denied in the browser) |
 * "homescreen" (iPhone: add to home screen first) | "unavailable".
 */
export async function pushState() {
  if (typeof window === "undefined" || USE_EMULATOR) return "unavailable";
  if (needsHomeScreen()) return "homescreen";
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !(await isSupported().catch(() => false))) return "unavailable";
  if (Notification.permission === "denied") return "blocked";
  return Notification.permission === "granted" ? "on" : "off";
}

async function saveToken({ companyId, uid }) {
  const reg = await navigator.serviceWorker.register(workerUrl());
  await navigator.serviceWorker.ready;
  const token = await getToken(getMessaging(app), { vapidKey: process.env.NEXT_PUBLIC_VAPID_KEY, serviceWorkerRegistration: reg });
  if (!token) return null;
  await setDoc(doc(collection(db, "companies", companyId, "users", uid, "fcmTokens"), token), { createdAt: serverTimestamp(), ua: navigator.userAgent }, { merge: true });
  return token;
}

/** "Turn on": asks the browser, then saves this device. Returns the new state. */
export async function enablePush({ companyId, uid }) {
  const state = await pushState();
  if (state !== "off" && state !== "on") return state;
  if ((await Notification.requestPermission()) !== "granted") return Notification.permission === "denied" ? "blocked" : "off";
  await saveToken({ companyId, uid });
  return "on";
}

/** After sign-in: if push is already allowed, keep this device's token fresh. Never asks. */
export async function refreshPush({ companyId, uid }) {
  if ((await pushState()) !== "on" || !companyId || !uid) return;
  try {
    await saveToken({ companyId, uid });
  } catch (e) {
    console.warn("push refresh failed:", e?.message);
  }
}

/** Stop push on this device (e.g. a shared tablet). */
export async function disablePush() {
  try {
    await deleteToken(getMessaging(app));
  } catch {
    /* nothing to remove */
  }
}

/** While the app is open, a push arrives here instead of the system tray. */
export async function onForegroundPush(handler) {
  if ((await pushState()) !== "on") return () => {};
  return onMessage(getMessaging(app), (p) => handler({ title: p.notification?.title, body: p.notification?.body, link: p.data?.link }));
}
