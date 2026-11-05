// `npm run backup:production` — a full copy of a real project into a folder
// outside this repository. It only ever reads: nothing here writes to Firestore,
// Auth, Storage or the rules.
//
//   npm run backup:production -- --project <id> --out <folder>
//   npm run backup:production -- --project <id> --out <folder> --files <folder>
//
// <out>/firestore.jsonl       every document with its real path and value types
// <out>/auth-users.json       login accounts, without password hashes
// <out>/live-firestore.rules, live-storage.rules   the rules running now
// <out>/storage-files.json    every stored file: name, size, checksum
// <out>/by-company/<id>/      the older folder layout the finance tests read
// --files <folder>            also download stored files; ones already there
//                             with the right size are skipped
//
// Uses lib/server/serviceAccountKey.json (git-ignored), else Google application
// default credentials. Test it with `npm run backup:restore`.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getSecurityRules } from "firebase-admin/security-rules";
import { getStorage } from "firebase-admin/storage";
import { encodeValue, layoutRow, walkFirestore } from "./local/backupCodec.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : null;
};
const fail = (message) => {
  console.error(message);
  process.exit(1);
};

const project = arg("--project");
const outArg = arg("--out");
if (!project || !outArg) fail("Usage: npm run backup:production -- --project <id> --out <folder> [--files <folder>]");
for (const v of ["FIRESTORE_EMULATOR_HOST", "FIREBASE_AUTH_EMULATOR_HOST", "FIREBASE_STORAGE_EMULATOR_HOST"]) {
  if (process.env[v]) fail(`${v} is set: this would back up the emulators. Unset it first.`);
}

// The repository is public, so a backup may never sit inside it.
const insideRepo = (p) => {
  const rel = path.relative(root, p);
  return !rel.startsWith("..") && !path.isAbsolute(rel);
};
const out = path.resolve(outArg);
const filesDir = arg("--files") ? path.resolve(arg("--files")) : null;
if (insideRepo(out) || (filesDir && insideRepo(filesDir))) fail("A backup must be outside the repository.");
if (fs.existsSync(path.join(out, "firestore.jsonl"))) fail(`${out} already holds a backup. Choose a new folder.`);

function storageBucket() {
  if (arg("--bucket")) return arg("--bucket");
  const env = fs.readFileSync(path.join(root, ".env.local"), "utf8");
  const found = env.match(/^NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=["']?([^"'\r\n]+)/m);
  if (!found) fail("No storage bucket found. Pass --bucket <name>.");
  return found[1];
}

const keyFile = path.join(root, "lib", "server", "serviceAccountKey.json");
const bucketName = storageBucket();
initializeApp({
  projectId: project,
  storageBucket: bucketName,
  credential: fs.existsSync(keyFile) ? cert(JSON.parse(fs.readFileSync(keyFile, "utf8"))) : applicationDefault(),
});

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const writeJson = (p, data) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
};

fs.mkdirSync(out, { recursive: true });
const startedAt = new Date().toISOString();

// ── rules ─────────────────────────────────────────────────────────────────────
const rules = getSecurityRules();
const rulesText = (set) => set.source.map((s) => s.content).join("\n");
fs.writeFileSync(path.join(out, "live-firestore.rules"), rulesText(await rules.getFirestoreRuleset()));
fs.writeFileSync(path.join(out, "live-storage.rules"), rulesText(await rules.getStorageRuleset(bucketName)));
log("Live rules saved");

// ── firestore ─────────────────────────────────────────────────────────────────
const lines = fs.createWriteStream(path.join(out, "firestore.jsonl"));
const counts = {};
const companies = {};
let docCount = 0;
await walkFirestore(getFirestore(), async (doc) => {
  const data = encodeValue(doc.data());
  if (!lines.write(`${JSON.stringify({ path: doc.ref.path, data })}\n`)) {
    await new Promise((r) => lines.once("drain", r));
  }
  docCount++;
  const col = doc.ref.parent.id;
  counts[col] = (counts[col] || 0) + 1;
  if (docCount % 2000 === 0) log(`  ${docCount} documents`);

  // companies/{c}, companies/{c}/{col}/{d}, companies/{c}/branches/{b}, companies/{c}/branches/{b}/{col}/{d}
  const p = doc.ref.path.split("/");
  if (p[0] !== "companies") return;
  const c = (companies[p[1]] ||= { company: null, cols: {}, branches: {} });
  const b = p[2] === "branches" && p[3] ? (c.branches[p[3]] ||= { doc: null, cols: {} }) : null;
  if (p.length === 2) c.company = layoutRow(doc.id, data);
  else if (b && p.length === 4) b.doc = layoutRow(doc.id, data);
  else if (b && p.length === 6) (b.cols[p[4]] ||= []).push(layoutRow(doc.id, data));
  else if (!b && p.length === 4) (c.cols[p[2]] ||= []).push(layoutRow(doc.id, data));
});
await new Promise((resolve, reject) => lines.end((e) => (e ? reject(e) : resolve())));
log(`Firestore: ${docCount} documents`);

for (const [id, c] of Object.entries(companies)) {
  if (!c.company) continue;
  const base = path.join(out, "by-company", id);
  writeJson(path.join(base, "company", "company.json"), c.company);
  for (const [col, rows] of Object.entries(c.cols)) writeJson(path.join(base, "company", `${col}.json`), rows);
  for (const [branchId, b] of Object.entries(c.branches)) {
    if (!b.doc) continue;
    writeJson(path.join(base, "branches", branchId, "branch.json"), b.doc);
    for (const [col, rows] of Object.entries(b.cols)) writeJson(path.join(base, "branches", branchId, "data", `${col}.json`), rows);
  }
}

// ── auth ──────────────────────────────────────────────────────────────────────
const accounts = [];
let pageToken;
do {
  const page = await getAuth().listUsers(1000, pageToken);
  for (const u of page.users) {
    accounts.push({
      uid: u.uid,
      email: u.email ?? null,
      emailVerified: u.emailVerified,
      phoneNumber: u.phoneNumber ?? null,
      displayName: u.displayName ?? null,
      disabled: u.disabled,
      customClaims: u.customClaims ?? null,
      providers: u.providerData.map((x) => x.providerId),
      createdAt: u.metadata.creationTime,
      lastSignInAt: u.metadata.lastSignInTime ?? null,
    });
  }
  pageToken = page.pageToken;
} while (pageToken);
writeJson(path.join(out, "auth-users.json"), accounts);
log(`Auth: ${accounts.length} accounts`);

// ── storage ───────────────────────────────────────────────────────────────────
const [files] = await getStorage().bucket().getFiles();
writeJson(path.join(out, "storage-files.json"), files.map((f) => ({
  name: f.name,
  size: Number(f.metadata.size || 0),
  md5: f.metadata.md5Hash ?? null,
  updated: f.metadata.updated ?? null,
})));
log(`Storage: ${files.length} files listed`);

const failed = [];
let downloaded = 0;
if (filesDir) {
  const pending = files.filter((f) => !f.name.endsWith("/")).filter((f) => {
    const dest = path.join(filesDir, ...f.name.split("/"));
    return !(fs.existsSync(dest) && fs.statSync(dest).size === Number(f.metadata.size || 0));
  });
  log(`Storage: downloading ${pending.length} new or changed files`);
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (pending.length) {
      const f = pending.shift();
      const dest = path.join(filesDir, ...f.name.split("/"));
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      try {
        await f.download({ destination: dest });
        if (++downloaded % 200 === 0) log(`  ${downloaded} files`);
      } catch (e) {
        failed.push({ name: f.name, error: e.message });
      }
    }
  }));
  log(`Storage: ${downloaded} downloaded, ${failed.length} failed`);
}

writeJson(path.join(out, "MANIFEST.json"), {
  project,
  startedAt,
  finishedAt: new Date().toISOString(),
  firestoreDocs: docCount,
  byCollection: Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b))),
  authAccounts: accounts.length,
  storageFiles: files.length,
  filesDownloaded: downloaded,
  failed,
});
log(`Done: ${out}`);
process.exit(failed.length ? 1 : 0);
