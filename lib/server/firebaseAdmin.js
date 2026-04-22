import admin from "firebase-admin";

/**
 * FIREBASE_SERVICE_ACCOUNT should be a stringified JSON of your service account key.
 * On Vercel: Add this to Project Settings > Environment Variables.
 * On Local: Add FIREBASE_SERVICE_ACCOUNT="..." to your .env.local file.
 */
let serviceAccount = null;

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } catch (error) {
    console.error("Firebase Admin: Failed to parse FIREBASE_SERVICE_ACCOUNT env var.", error);
  }
} else {
  console.warn("Firebase Admin: FIREBASE_SERVICE_ACCOUNT not found in environment variables.");
}

if (!admin.apps.length && serviceAccount) {
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
