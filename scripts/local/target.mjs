// Where the seed scripts write: the local emulators (the default), or the real
// project with --confirm —
//   CC_TARGET=live     the live database: the made-up demo company beside the
//                      clients' companies, for showing the app to people (6 Nov)
//   CC_TARGET=staging  the "staging" database (31 Oct, for preview deployments
//                      with NEXT_PUBLIC_FIRESTORE_DATABASE=staging); each demo
//                      login's users/{uid} is also kept in the live database,
//                      because cross-service storage.rules read only that one
// On the real project only the demo company (companies/demo-company) and demo
// logins (Auth uid demo-…, @demo.test) are ever written, so they are easy to
// find and remove (scripts/demo/remove-demo.mjs).
//
// The real project uses GOOGLE_APPLICATION_CREDENTIALS (set by scripts/demo/seed-demo.mjs).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";
import { LOCAL_PROJECT_ID, LOCAL_DIR } from "./config.mjs";

const TARGET = process.env.CC_TARGET || "local";
export const STAGING = TARGET === "staging";
export const LIVE = TARGET === "live";
/** On the real project (live or staging), not the emulators. */
export const REAL = STAGING || LIVE;
export const REAL_PROJECT = "pos-system-448bc";
export const STAGING_DATABASE = "staging";
export const DEMO_COMPANY = "demo-company";

if (!["local", "live", "staging"].includes(TARGET)) {
  console.error(`Unknown CC_TARGET "${TARGET}".`);
  process.exit(1);
}
if (REAL) {
  if (!process.argv.includes("--confirm")) {
    console.error(`This writes the demo company to the ${LIVE ? "live" : `"${STAGING_DATABASE}"`} database of the real project ${REAL_PROJECT}. Add --confirm.`);
    process.exit(1);
  }
  for (const v of ["FIRESTORE_EMULATOR_HOST", "FIREBASE_AUTH_EMULATOR_HOST", "FIREBASE_STORAGE_EMULATOR_HOST"]) delete process.env[v];
} else {
  for (const v of ["FIRESTORE_EMULATOR_HOST", "FIREBASE_AUTH_EMULATOR_HOST"]) {
    if (!process.env[v]) {
      console.error(`${v} is not set — refusing to run outside the emulators. Use \`npm run local:seed\`.`);
      process.exit(1);
    }
  }
}

const app = initializeApp({ projectId: REAL ? REAL_PROJECT : LOCAL_PROJECT_ID });
/** The database the demo company goes into. */
export const db = STAGING ? getFirestore(app, STAGING_DATABASE) : getFirestore(app);
/** The live database — staging only, and only for the demo logins' users/{uid} that storage.rules reads. */
export const liveDb = STAGING ? getFirestore(app) : null;
export const auth = getAuth(app);

const files = {
  local: { password: "dev-password.txt", prefix: "local", accounts: "DEV_ACCOUNTS.md", guide: "DEMO_GUIDE.md" },
  live: { password: "live-demo-password.txt", prefix: "demo", accounts: "LIVE_DEMO_ACCOUNTS.md", guide: "LIVE_DEMO_GUIDE.md" },
  staging: { password: "staging-password.txt", prefix: "stage", accounts: "STAGING_ACCOUNTS.md", guide: "STAGING_GUIDE.md" },
}[TARGET];

/** The shared password of the demo logins, kept in .local (git-ignored), one per target. */
export function demoPassword() {
  const file = path.join(LOCAL_DIR, files.password);
  fs.mkdirSync(LOCAL_DIR, { recursive: true });
  if (!fs.existsSync(file)) fs.writeFileSync(file, `${files.prefix}-${crypto.randomBytes(6).toString("hex")}\n`);
  return fs.readFileSync(file, "utf8").trim();
}
export const ACCOUNTS_FILE = path.join(LOCAL_DIR, files.accounts);
export const GUIDE_FILE = path.join(LOCAL_DIR, files.guide);

/** Never anything but the demo company or a demo login on the real project. */
export function assertDemo({ uid, email, companyId, path: docPath } = {}) {
  if (!REAL) return;
  if (uid !== undefined && !String(uid).startsWith("demo-")) throw new Error(`Not a demo login: ${uid}`);
  if (email !== undefined && email !== null && !String(email).endsWith("@demo.test")) throw new Error(`Not a demo email: ${email}`);
  if (companyId !== undefined && companyId !== DEMO_COMPANY) throw new Error(`Not the demo company: ${companyId}`);
  if (docPath !== undefined && !(docPath.startsWith(`companies/${DEMO_COMPANY}`) || /^(users|usernames|staffLogins|entitlements|joinLinks)\//.test(docPath))) {
    throw new Error(`Not a demo document: ${docPath}`);
  }
}

/** A demo login: made, or its password reset when it is there already (seeded again). */
export async function demoLogin({ uid, email, password, displayName }) {
  assertDemo({ uid, email });
  try {
    await auth.createUser({ uid, email, emailVerified: true, password, displayName });
  } catch (e) {
    if (e.code !== "auth/uid-already-exists" && e.code !== "auth/email-already-exists") throw e;
    await auth.updateUser(uid, { email, password, displayName });
  }
}

/** Mirror a demo login's users/{uid} into the live database (staging only — storage.rules reads it there). */
export async function mirrorUser(uid, data) {
  if (!liveDb) return;
  assertDemo({ uid, companyId: data.companyId });
  const { companyId, role, branchId = null, staffId = null, userName = "", email = "" } = data;
  await liveDb.doc(`users/${uid}`).set({ companyId, role, branchId, staffId, userName, email, demo: true });
}

/** Keep a file in storage: the emulator's own API locally (its JSON API crashed the suite, 31 Oct), the real bucket otherwise. */
export async function putFile(p, body, contentType) {
  if (REAL) {
    if (!p.includes(`/${DEMO_COMPANY}/`)) throw new Error(`Not a demo file: ${p}`);
    const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    if (!bucket) throw new Error("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET is not set");
    await getStorage(app).bucket(bucket).file(p).save(Buffer.from(body), { contentType, resumable: false });
    return;
  }
  const res = await fetch(`http://${process.env.FIREBASE_STORAGE_EMULATOR_HOST}/v0/b/${LOCAL_PROJECT_ID}.appspot.com/o?name=${encodeURIComponent(p)}`, {
    method: "POST",
    headers: { Authorization: "Bearer owner", "Content-Type": contentType },
    body,
  });
  if (!res.ok) throw new Error(`storage ${res.status} for ${p}`);
}
