import admin from "firebase-admin";

/**
 * FIREBASE_SERVICE_ACCOUNT should be a stringified JSON of your service account key.
 * On Vercel: Add this to Project Settings > Environment Variables.
 * On Local: Add FIREBASE_SERVICE_ACCOUNT="..." to your .env.local file.
 *
 * Under `npm run dev:local` FIRESTORE_EMULATOR_HOST is set: the SDK then talks
 * to the emulators and needs no credentials, only the emulator's project id.
 */
const useEmulator = !!process.env.FIRESTORE_EMULATOR_HOST;
let serviceAccount = null;

if (useEmulator) {
  // No service account on purpose — never hand production credentials to a local session.
} else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } catch (error) {
    console.error("Firebase Admin: Failed to parse FIREBASE_SERVICE_ACCOUNT env var.", error);
  }
} else {
  console.warn("Firebase Admin: FIREBASE_SERVICE_ACCOUNT not found in environment variables.");
}

if (!admin.apps.length && useEmulator) {
  admin.initializeApp({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID });
} else if (!admin.apps.length && serviceAccount) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } catch (error) {
    console.error("Firebase Admin: Initialization failed.", error);
  }
}

const adminDb = admin.apps.length ? admin.firestore() : null;
const adminAuth = admin.apps.length ? admin.auth() : null;

export { admin, adminDb, adminAuth };
