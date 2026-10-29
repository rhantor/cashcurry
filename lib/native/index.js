// lib/native — what the staff Android app (Capacitor, capacitor.config.ts)
// adds to the web pages: a fingerprint lock and native push. Everything here
// does nothing in a browser; plugins load only inside the app.
import { Capacitor, registerPlugin } from "@capacitor/core";
import { collection, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

/** Running inside the Android app? */
export const isNativeApp = () => typeof window !== "undefined" && Capacitor.isNativePlatform();

// ── fingerprint lock ─────────────────────────────────────────────────────────
// Staff stay signed in (like WhatsApp); with the lock on, opening the app —
// or coming back to it after a while — asks for a fingerprint (or face /
// screen lock, whatever the phone has). The fingerprint never leaves the
// phone: Android checks it and only says yes or no. Saved per phone.
const LOCK_KEY = "cc.fingerprintLock";
/** How long the app can be in the background before it locks again. */
export const RELOCK_AFTER_MS = 60 * 1000;

export function lockEnabled() {
  try {
    return localStorage.getItem(LOCK_KEY) === "1";
  } catch {
    return false;
  }
}

function setLock(on) {
  try {
    if (on) localStorage.setItem(LOCK_KEY, "1");
    else localStorage.removeItem(LOCK_KEY);
  } catch {
    // private storage unavailable: the lock simply stays off
  }
}

async function biometric() {
  const { NativeBiometric } = await import("@capgo/capacitor-native-biometric");
  return NativeBiometric;
}

/** Can this phone check a fingerprint (or face) at all? */
export async function fingerprintAvailable() {
  if (!isNativeApp()) return false;
  try {
    const r = await (await biometric()).isAvailable({ useFallback: false });
    return !!r?.isAvailable;
  } catch {
    return false;
  }
}

/** Ask for the fingerprint. True when it matched. */
export async function checkFingerprint(reason = "Unlock Cash Curry") {
  try {
    await (await biometric()).verifyIdentity({ reason, title: "Cash Curry", subtitle: reason, negativeButtonText: "Use PIN", maxAttempts: 5 });
    return true;
  } catch {
    return false;
  }
}

/** Turn the lock on (after one successful check) or off. */
export async function setFingerprintLock(on) {
  if (on && !(await checkFingerprint("Turn on fingerprint unlock"))) return false;
  setLock(on);
  return true;
}

// ── push ─────────────────────────────────────────────────────────────────────
// The app's own push (Firebase Cloud Messaging). The token goes in the same
// place as browser tokens (companies/{c}/users/{uid}/fcmTokens), so the
// server's notifications reach the app too (functions/notify.js).

// A build without google-services.json has no Firebase, and register() then
// crashes the app on every open. The app's own PushSetup plugin says whether
// Firebase is there; an older build without the plugin counts as "not there".
const PushSetup = registerPlugin("PushSetup");
async function pushReady() {
  try {
    return (await PushSetup.status()).ready === true;
  } catch {
    return false;
  }
}

/** "on" | "off" | "blocked" for the app's notifications. */
export async function nativePushState() {
  const { PushNotifications } = await import("@capacitor/push-notifications");
  const p = await PushNotifications.checkPermissions();
  return p.receive === "granted" ? "on" : p.receive === "denied" ? "blocked" : "off";
}

/**
 * Ask for permission (once), register with Firebase and save this phone's
 * token. `onOpen(link)` runs when a notification is tapped.
 */
export async function startNativePush({ companyId, uid, ask = false, onOpen }) {
  const { PushNotifications } = await import("@capacitor/push-notifications");
  let perm = await PushNotifications.checkPermissions();
  if (perm.receive === "prompt" && ask) perm = await PushNotifications.requestPermissions();
  if (perm.receive !== "granted") return perm.receive === "denied" ? "blocked" : "off";

  await PushNotifications.removeAllListeners();
  await PushNotifications.addListener("registration", ({ value }) => {
    if (!value || !companyId || !uid) return;
    setDoc(doc(collection(db, "companies", companyId, "users", uid, "fcmTokens"), value), { createdAt: serverTimestamp(), ua: "android-app", platform: "android" }, { merge: true }).catch(() => {});
  });
  await PushNotifications.addListener("pushNotificationActionPerformed", ({ notification }) => {
    const link = notification?.data?.link;
    if (link && onOpen) onOpen(link);
  });
  await PushNotifications.register();
  return "on";
}
