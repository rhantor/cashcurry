// Shared settings for the local (emulator) development setup.
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

// A `demo-` project id makes the emulators refuse every call to real Google
// services, so nothing local can ever reach production.
export const LOCAL_PROJECT_ID = "demo-cashcurry";

// Git-ignored folder for emulator data, the local password and account list.
export const LOCAL_DIR = path.join(ROOT, ".local");
export const EMULATOR_DATA_DIR = path.join(LOCAL_DIR, "emulator-data");

export const BACKUP_DIR = process.env.CC_BACKUP_DIR
  ? path.resolve(process.env.CC_BACKUP_DIR)
  : path.resolve(ROOT, "../backup_saffron_empire");

// What the web app needs to talk to the emulators. Real environment variables
// win over .env.local in Next.js, so these override the production config.
export const NEXT_LOCAL_ENV = {
  NEXT_PUBLIC_USE_EMULATOR: "true",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: LOCAL_PROJECT_ID,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: `${LOCAL_PROJECT_ID}.firebaseapp.com`,
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: `${LOCAL_PROJECT_ID}.appspot.com`,
  // Server-side admin SDK (API routes)
  FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
  FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
  FIREBASE_STORAGE_EMULATOR_HOST: "127.0.0.1:9199",
  GCLOUD_PROJECT: LOCAL_PROJECT_ID,
};
