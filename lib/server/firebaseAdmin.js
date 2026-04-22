import admin from "firebase-admin";

// Use environment variable for Vercel/Production
// On local, you can still use the file if you want, but for Vercel this is required
let serviceAccount = null;

try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } else {
    // Fallback for local development if the variable isn't set
    // This will work locally as long as the file exists
    serviceAccount = require("./serviceAccountKey.json");
  }
} catch (error) {
  console.warn("Firebase Admin: Service account not found or invalid. Server-side Firebase features may not work.");
}

if (!admin.apps.length && serviceAccount) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const adminDb = admin.firestore();
const adminAuth = admin.auth();

export { admin, adminDb, adminAuth };
