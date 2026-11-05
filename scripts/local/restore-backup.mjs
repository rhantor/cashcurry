// `npm run backup:restore -- <backup folder>` — load a backup made by
// backup:production into the running local emulators, then read everything back
// and check it matches, document by document. Only runs on the emulators.
//
// The emulators must be empty. Push tokens are left out on purpose. Every login
// gets the shared local password in .local/dev-password.txt.
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, GeoPoint, getFirestore, Timestamp } from "firebase-admin/firestore";
import { LOCAL_DIR, LOCAL_PROJECT_ID } from "./config.mjs";
import { decodeValue, encodeValue, forLocalCopy, isDroppedLocally, stableText, walkFirestore } from "./backupCodec.mjs";

for (const v of ["FIRESTORE_EMULATOR_HOST", "FIREBASE_AUTH_EMULATOR_HOST"]) {
  if (!process.env[v]) {
    console.error(`${v} is not set: refusing to run outside the emulators.`);
    process.exit(1);
  }
}
const dir = process.argv[2] && path.resolve(process.argv[2]);
if (!dir || !fs.existsSync(path.join(dir, "firestore.jsonl"))) {
  console.error("Usage: npm run backup:restore -- <backup folder>");
  process.exit(1);
}

initializeApp({ projectId: process.env.GCLOUD_PROJECT || LOCAL_PROJECT_ID });
const db = getFirestore();
if ((await db.listCollections()).length) {
  console.error("These emulators already hold data. Start them empty.");
  process.exit(1);
}

const expected = new Map();
const writer = db.bulkWriter();
const rows = readline.createInterface({ input: fs.createReadStream(path.join(dir, "firestore.jsonl")) });
let left = 0;
for await (const line of rows) {
  const { path: docPath, data } = JSON.parse(line);
  if (isDroppedLocally(docPath)) {
    left++;
    continue;
  }
  const kept = forLocalCopy(data);
  expected.set(docPath, stableText(kept));
  writer.set(db.doc(docPath), decodeValue(kept, db, { Timestamp, GeoPoint, FieldValue }));
}
await writer.close();
console.log(`Restored ${expected.size} documents (${left} push tokens left out)`);

// Read everything back and compare.
const seen = new Set();
const different = [];
await walkFirestore(db, async (doc) => {
  seen.add(doc.ref.path);
  if (expected.get(doc.ref.path) !== stableText(encodeValue(doc.data()))) different.push(doc.ref.path);
});
const missing = [...expected.keys()].filter((p) => !seen.has(p));
console.log(`Checked: ${seen.size} read back, ${missing.length} missing, ${different.length} different`);
for (const p of [...missing, ...different].slice(0, 20)) console.log(`  ${p}`);

const password = fs.readFileSync(path.join(LOCAL_DIR, "dev-password.txt"), "utf8").trim();
const accounts = JSON.parse(fs.readFileSync(path.join(dir, "auth-users.json"), "utf8"));
let made = 0;
for (const a of accounts) {
  await getAuth().createUser({
    uid: a.uid,
    ...(a.email ? { email: a.email, password, emailVerified: true } : {}),
    ...(a.displayName ? { displayName: a.displayName } : {}),
    disabled: a.disabled,
  });
  if (a.customClaims) await getAuth().setCustomUserClaims(a.uid, a.customClaims);
  made++;
}
console.log(`Auth: ${made} accounts`);
process.exit(missing.length || different.length ? 1 : 0);
