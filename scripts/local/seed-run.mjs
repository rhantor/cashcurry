// Rebuild the local copy. Wipes previous local data, starts the emulators,
// runs seed.mjs inside them, and saves the result to .local/emulator-data for
// `npm run dev:local`.
//
//   npm run local:seed          made-up demo company (default — no client data)
//   npm run local:seed:backup   a real company backup (CC_BACKUP_DIR or .local/backup-path.txt)
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { ROOT, LOCAL_DIR, LOCAL_PROJECT_ID, EMULATOR_DATA_DIR, BACKUP_DIR } from "./config.mjs";
import { buildDemoCompany, writeBackupFolder, demoGuide } from "./demo/demoCompany.mjs";
import { EXPORT_NAME, checkFirestoreExport, ensurePrev, fsyncTree, keptDirFor, prevDirFor } from "./exportSafety.mjs";

const useBackup = process.argv.includes("--backup");
let source = BACKUP_DIR;

if (!useBackup) {
  const demo = buildDemoCompany(new Date());
  source = path.join(LOCAL_DIR, "demo-backup");
  writeBackupFolder(demo, source);
  fs.writeFileSync(
    path.join(LOCAL_DIR, "DEMO_GUIDE.md"),
    `# Demo company — what you should see\n\nSeeded ${new Date().toLocaleString()}. Log in with any account in DEV_ACCOUNTS.md.\n\n${demoGuide(demo)}`
  );
  console.log("Demo company built — walkthrough in .local/DEMO_GUIDE.md");
}

// The seed builds monthly summaries with the functions' engine bundle.
spawnSync("node", ["scripts/build-functions-engine.mjs"], { cwd: ROOT, stdio: "inherit" });

console.log(`Seeding local emulators from ${source}`);
fs.rmSync(EMULATOR_DATA_DIR, { recursive: true, force: true });

const result = spawnSync(
  "firebase",
  [
    "emulators:exec",
    "--only", "firestore,auth,storage",
    "--project", LOCAL_PROJECT_ID,
    "--export-on-exit", `"${EMULATOR_DATA_DIR}"`,
    `"node scripts/local/seed.mjs && node scripts/link-staff-logins.mjs${useBackup ? "" : " && node scripts/local/demo/demoExtras.mjs"}"`,
  ],
  { cwd: ROOT, stdio: "inherit", shell: true, env: { ...process.env, CC_BACKUP_DIR: source } }
);

if (result.error?.code === "ENOENT") {
  console.error("Firebase CLI not found. Install it with: npm install -g firebase-tools");
}
if (result.status === 0) {
  // The CLI renames its export into place without flushing it to disk
  // (12 Nov 2026: a power cut left files of zero bytes). Flush and check.
  for (const f of [EXPORT_NAME, "auth_export", "storage_export", "firebase-export-metadata.json"]) {
    fsyncTree(path.join(EMULATOR_DATA_DIR, f));
  }
  const check = checkFirestoreExport(path.join(EMULATOR_DATA_DIR, EXPORT_NAME), LOCAL_PROJECT_ID);
  if (!check.ok) {
    console.error(`The seeded data did not save properly (${check.reason}). Run the seed again.`);
    process.exit(1);
  }
  console.log(`Local data written to disk and checked: ${check.records} records.`);
  // The spare copy belongs to the old data now: set it aside, keep a fresh one.
  const keepDir = keptDirFor(EMULATOR_DATA_DIR);
  const prev = prevDirFor(keepDir);
  if (fs.existsSync(prev)) fs.renameSync(prev, `${prev}-before-seed-${Date.now()}`);
  ensurePrev({ dataDir: EMULATOR_DATA_DIR, keepDir, projectId: LOCAL_PROJECT_ID });
}
process.exit(result.status ?? 1);
