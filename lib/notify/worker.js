// lib/notify/worker.js
// The app's one service worker: push, and on a phone the saved copy of the app.
const SW = "/firebase-messaging-sw.js";

/** The service worker's address, carrying which Firebase project to use. */
export function workerUrl() {
  const p = new URLSearchParams({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
  });
  return `${SW}?${p}`;
}
