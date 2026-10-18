// Seed the local Firebase emulators from a company backup.
//
// Run through `npm run local:seed`, which starts the emulators with
// `firebase emulators:exec` and runs this script inside them. The emulator
// host variables it sets are checked below, so this script can only ever
// write to the emulators, never to production.
//
// Backup layout (made by backup_saffron_empire/export-script.cjs):
//   company/company.json                 -> companies/{companyId}
//   company/<name>.json                  -> companies/{companyId}/<name>/*
//   company/root_users.json              -> users/*
//   company/root_usernames.json          -> usernames/*
//   company/root_entitlements.json       -> entitlements/{companyId}
//   branches/<name>/branch.json          -> companies/{companyId}/branches/{branchId}
//   branches/<name>/data/<name>.json     -> companies/{companyId}/branches/{branchId}/<name>/*
// Nested sub-collections arrive as a `__subcollections` field on each row.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { LOCAL_PROJECT_ID, LOCAL_DIR, BACKUP_DIR } from "./config.mjs";

for (const v of ["FIRESTORE_EMULATOR_HOST", "FIREBASE_AUTH_EMULATOR_HOST"]) {
  if (!process.env[v]) {
    console.error(`${v} is not set — refusing to run outside the emulators. Use \`npm run local:seed\`.`);
    process.exit(1);
  }
}

if (!fs.existsSync(path.join(BACKUP_DIR, "company", "company.json"))) {
  console.error(`No backup found at ${BACKUP_DIR}. Set CC_BACKUP_DIR to the backup folder.`);
  process.exit(1);
}

initializeApp({ projectId: LOCAL_PROJECT_ID });
const db = getFirestore();
const auth = getAuth();

const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

// ── value restoration ────────────────────────────────────────────────────────
// The export turned every Firestore Timestamp into an ISO string, and the app
// also stores some times as ISO strings itself, so the original type is lost.
// Readers in the app accept both; the few that need a real Timestamp read
// top-level `*At` / `timestamp` fields, so those are restored as Timestamps.
// Everything else (business `date` fields, nested maps, installment arrays)
// is written back exactly as exported.
const ISO_FULL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const isTimeKey = (k) => /At$/.test(k) || k === "timestamp";

// Push tokens identify real staff phones; a local copy must never hold them.
const DROP_SUBCOLLECTIONS = new Set(["fcmTokens"]);
const DROP_FIELDS = new Set(["fcmToken", "fcmTokens"]);

// The export wrote `{ id: doc.id, ...data }`, so a document whose data has its
// own `id` field lost its real id. Payroll salary entries are the known case:
// they copy the slip (whose `id` is the staff id) and live at
// payroll_{runId}_{staffId} (see markPayrollRunPaid), so several months of the
// same staff member would otherwise collapse into one document.
function docIdFor(colPath, row) {
  if (colPath.endsWith("/salaries") && row.source === "payroll" && row.payrollRunId && row.staffId) {
    return `payroll_${row.payrollRunId}_${row.staffId}`;
  }
  return row.id;
}

function toDocData(row, docId) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (k === "__subcollections" || DROP_FIELDS.has(k)) continue;
    // `id` is the document id unless the document carried its own `id` field.
    if (k === "id" && v === docId) continue;
    out[k] = isTimeKey(k) && typeof v === "string" && ISO_FULL.test(v)
      ? Timestamp.fromDate(new Date(v))
      : v;
  }
  return out;
}

// ── writer ───────────────────────────────────────────────────────────────────
const writer = db.bulkWriter();
let docCount = 0;
const counts = {};
const written = new Set();

function writeDoc(docPath, row, docId = row.id) {
  // Two rows mapping to one path means data would be silently lost.
  if (written.has(docPath)) throw new Error(`Duplicate document path in backup: ${docPath}`);
  written.add(docPath);
  writer.set(db.doc(docPath), toDocData(row, docId));
  docCount++;
  const col = docPath.split("/").at(-2);
  counts[col] = (counts[col] || 0) + 1;
  for (const [sub, rows] of Object.entries(row.__subcollections || {})) {
    if (DROP_SUBCOLLECTIONS.has(sub)) continue;
    writeCollection(`${docPath}/${sub}`, rows);
  }
}

function writeCollection(colPath, rows) {
  for (const row of Array.isArray(rows) ? rows : [rows]) {
    if (!row?.id) continue;
    const docId = docIdFor(colPath, row);
    writeDoc(`${colPath}/${docId}`, row, docId);
  }
}

// ── company ──────────────────────────────────────────────────────────────────
const companyDir = path.join(BACKUP_DIR, "company");
const company = readJson(path.join(companyDir, "company.json"));
const companyPath = `companies/${company.id}`;
writeDoc(companyPath, company);

for (const file of fs.readdirSync(companyDir).filter((f) => f.endsWith(".json"))) {
  const name = file.replace(/\.json$/, "");
  const rows = readJson(path.join(companyDir, file));
  if (name === "company") continue;
  if (name === "root_users") writeCollection("users", rows);
  else if (name === "root_usernames") writeCollection("usernames", rows);
  else if (name === "root_entitlements") writeCollection("entitlements", rows);
  else writeCollection(`${companyPath}/${name}`, rows);
}

// ── branches ─────────────────────────────────────────────────────────────────
const branchNames = {};
const branchesDir = path.join(BACKUP_DIR, "branches");
for (const folder of fs.readdirSync(branchesDir)) {
  const branch = readJson(path.join(branchesDir, folder, "branch.json"));
  branchNames[branch.id] = branch.name?.trim() || folder;
  const branchPath = `${companyPath}/branches/${branch.id}`;
  writeDoc(branchPath, branch);
  const dataDir = path.join(branchesDir, folder, "data");
  if (!fs.existsSync(dataDir)) continue;
  for (const file of fs.readdirSync(dataDir).filter((f) => f.endsWith(".json"))) {
    writeCollection(`${branchPath}/${file.replace(/\.json$/, "")}`, readJson(path.join(dataDir, file)));
  }
}

await writer.close();
console.log(`Firestore: ${docCount} documents written`);
console.log(Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, n]) => `  ${k}: ${n}`).join("\n"));

// ── monthly summaries ────────────────────────────────────────────────────────
// What the Cloud Functions keep up to date, built here in one go (the seed
// runs without the Functions emulator). Same code as the functions use.
const summaries = createRequire(import.meta.url)("../../functions/summaries.js");
const built = await summaries.rebuildCompany(db, company.id);
console.log(`Summaries: ${Object.values(built).reduce((n, m) => n + m.length, 0)} branch-months`);

// ── login accounts ───────────────────────────────────────────────────────────
// Real passwords cannot be exported, so every account gets one shared local
// password. It is generated once and kept in .local/ (git-ignored) so it stays
// the same across re-seeds.
fs.mkdirSync(LOCAL_DIR, { recursive: true });
const pwFile = path.join(LOCAL_DIR, "dev-password.txt");
if (!fs.existsSync(pwFile)) fs.writeFileSync(pwFile, `local-${crypto.randomBytes(6).toString("hex")}\n`);
const password = fs.readFileSync(pwFile, "utf8").trim();

const users = readJson(path.join(companyDir, "root_users.json"));
const usernames = readJson(path.join(companyDir, "root_usernames.json"));
const usernameByUid = {};
for (const u of usernames) if (u.uid && !u.id.startsWith("@")) usernameByUid[u.uid] ??= u.id;

const accounts = [];
for (const u of users) {
  if (!u.email) continue;
  await auth.createUser({
    uid: u.id,
    email: u.email,
    emailVerified: true,
    password,
    displayName: u.fullName || u.name || u.userName || undefined,
  });
  accounts.push({
    role: u.role,
    login: usernameByUid[u.id] || u.email,
    name: u.fullName || u.name || u.userName || "",
    branch: branchNames[u.branchId] || (u.branchId ? u.branchId : "— (company)"),
  });
}

const roleOrder = ["owner", "superAdmin", "gm", "branchAdmin", "manager", "inCharge", "accountant", "supervisor", "cashier", "staff"];
accounts.sort((a, b) => roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role) || a.branch.localeCompare(b.branch));
fs.writeFileSync(
  path.join(LOCAL_DIR, "DEV_ACCOUNTS.md"),
  [
    "# Local login accounts",
    "",
    "These exist only in the local emulators (`npm run dev:local`).",
    "Every account uses the password in `dev-password.txt` (same folder).",
    "",
    "| Role | Log in with | Name | Branch |",
    "|---|---|---|---|",
    ...accounts.map((a) => `| ${a.role} | ${a.login} | ${a.name} | ${a.branch} |`),
    "",
  ].join("\n")
);
console.log(`Auth: ${accounts.length} login accounts created — see .local/DEV_ACCOUNTS.md`);
