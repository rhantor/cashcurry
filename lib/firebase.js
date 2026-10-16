// lib/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getStorage, connectStorageEmulator } from "firebase/storage";

// `npm run dev:local` sets this so the app talks to the Firebase emulators on
// this machine (seeded from a backup) instead of the production project.
export const USE_EMULATOR = process.env.NEXT_PUBLIC_USE_EMULATOR === "true";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);

// Secondary app — used ONLY for createUserWithEmailAndPassword so the
// owner's main auth session is NOT replaced by the newly created user.
const secondaryApp = initializeApp(firebaseConfig, "secondary");
const secondaryAuth = getAuth(secondaryApp);

// Connect once per page load; hot reload re-runs this module but the SDK
// instances survive and throw if connected twice.
//
// The emulators run on the machine that serves the page: 127.0.0.1 on that
// machine, or its Wi-Fi address when the page is opened from a phone
// (`npm run dev:phone`).
const EMULATOR_HOST =
  typeof window !== "undefined" && window.location.hostname && window.location.hostname !== "localhost"
    ? window.location.hostname
    : "127.0.0.1";
if (USE_EMULATOR && !globalThis.__ccEmulatorsConnected) {
  globalThis.__ccEmulatorsConnected = true;
  connectFirestoreEmulator(db, EMULATOR_HOST, 8080);
  connectStorageEmulator(storage, EMULATOR_HOST, 9199);
  connectAuthEmulator(auth, `http://${EMULATOR_HOST}:9099`, { disableWarnings: true });
  connectAuthEmulator(secondaryAuth, `http://${EMULATOR_HOST}:9099`, { disableWarnings: true });
}

export { db, auth, storage, app, secondaryAuth };
