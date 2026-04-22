/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
// lib/notifications/registerFcm.js
import {
  getMessaging,
  getToken,
  onMessage,
  isSupported,
} from "firebase/messaging";
import { app, db } from "@/lib/firebase";
import { collection, doc, setDoc, serverTimestamp } from "firebase/firestore";

export async function registerFcm({ companyId, uid }) {
  if (typeof window === "undefined") return null;
  if (!(await isSupported())) return null;

  try {
    await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    await navigator.serviceWorker.ready;
  } catch (e) {
    console.warn("FCM SW register failed:", e);
  }

  const perm = await Notification.requestPermission();
  if (perm !== "granted") return null;

  const messaging = getMessaging(app);
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_KEY;

  const reg = await navigator.serviceWorker.getRegistration();
  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration: reg,
  });
  if (!token) return null;

  await setDoc(
    doc(
      collection(db, "companies", companyId, "users", uid, "fcmTokens"),
      token
    ),
    { createdAt: serverTimestamp(), ua: navigator.userAgent },
    { merge: true }
  );

  onMessage(messaging, (payload) => {
    const t = payload.notification?.title || "Update";
    const b = payload.notification?.body || "";
    console.log("FCM foreground:", payload);
    // hook into your toast system here if you want
  });

  return token;
}
