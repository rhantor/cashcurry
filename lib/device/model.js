// lib/device/model.js
// Phones keep a copy of the app and of what was last on screen, so it opens at
// once and still shows something on a bad connection. Computers don't: office
// PCs are shared, and a computer on a desk rarely loses its connection.
//
// public/firebase-messaging-sw.js repeats PHONE_AGENTS (a service worker can't
// import this); tests/device/device.test.js checks that the two match.
export const PHONE_AGENTS = /Android|iPhone|iPad|iPod|Mobile|CashCurryStaffApp/i;

/** Does this device keep a copy? An iPad can call itself a Mac, so touch counts too. */
export function keepsCopy(agent = "", touchPoints = 0) {
  return PHONE_AGENTS.test(agent) || (/Macintosh/.test(agent) && touchPoints > 1);
}

/** This device, in the browser. Never on the server. */
export function deviceKeepsCopy() {
  if (typeof navigator === "undefined") return false;
  return keepsCopy(navigator.userAgent, navigator.maxTouchPoints);
}

// A saved copy shows first on every open and the server's answer follows, so
// only say "offline" when that answer hasn't come after a few seconds.
export const OFFLINE_AFTER_MS = 5000;
