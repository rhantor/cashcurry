// lib/notifications/ensureNotificationSetup.js

/**
 * Registers SW and (optionally) asks for permission with cooldown.
 * Returns:
 *  - granted: boolean (Notification.permission === 'granted')
 *  - grantedNow: boolean (permission was just granted in this call)
 */
export async function ensureNotificationSetup({ askCooldownDays = 30 } = {}) {
  if (typeof window === "undefined")
    return { granted: false, grantedNow: false };

  const hasNotif = "Notification" in window;
  const hasSW = "serviceWorker" in navigator;

  // 1) Register service worker (idempotent)
  if (hasSW) {
    try {
      await navigator.serviceWorker.register("/notification-sw.js");
      await navigator.serviceWorker.ready;
    } catch (e) {
      console.warn("SW register failed:", e);
    }
  }

  if (!hasNotif) return { granted: false, grantedNow: false };

  // 2) Ask with cooldown
  const KEY = "notifAskedAt";
  const last = Number(localStorage.getItem(KEY) || 0);
  const cooldown = askCooldownDays * 24 * 60 * 60 * 1000;
  let grantedNow = false;

  const before = Notification.permission; // 'default' | 'granted' | 'denied'
  if (before === "default" && Date.now() - last >= cooldown) {
    try {
      const res = await Notification.requestPermission();
      localStorage.setItem(KEY, String(Date.now()));
      grantedNow = res === "granted";
    } catch (e) {
      console.warn("Permission request failed:", e);
      localStorage.setItem(KEY, String(Date.now()));
    }
  }

  const granted = Notification.permission === "granted";
  return { granted, grantedNow };
}

/**
 * Shows a local notification via service worker if possible
 * (falls back to window Notification).
 */
export async function showLocalNotification(
  title,
  { body = "", url = "/", tag = "pos-generic" } = {}
) {
  if (typeof window === "undefined") return;

  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg && "showNotification" in reg) {
      await reg.showNotification(title, {
        body,
        tag,
        data: { url },
      });
      return;
    }
  } catch (e) {
    console.warn("SW showNotification failed, falling back:", e);
  }

  try {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body, tag });
    }
  } catch (e) {
    console.warn("Window Notification failed:", e);
  }
}
