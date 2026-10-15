// `npm run local:seed` — rebuild the local copy from the backup.
// Wipes previous local data, starts the emulators, runs seed.mjs inside them,
// and saves the result to .local/emulator-data for `npm run dev:local`.
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { ROOT, LOCAL_PROJECT_ID, EMULATOR_DATA_DIR, BACKUP_DIR } from "./config.mjs";

console.log(`Seeding local emulators from ${BACKUP_DIR}`);
fs.rmSync(EMULATOR_DATA_DIR, { recursive: true, force: true });

const result = spawnSync(
  "firebase",
  [
    "emulators:exec",
    "--only", "firestore,auth,storage",
    "--project", LOCAL_PROJECT_ID,
    "--export-on-exit", `"${EMULATOR_DATA_DIR}"`,
    `"node scripts/local/seed.mjs"`,
  ],
  { cwd: ROOT, stdio: "inherit", shell: true, env: process.env }
);

if (result.error?.code === "ENOENT") {
  console.error("Firebase CLI not found. Install it with: npm install -g firebase-tools");
}
process.exit(result.status ?? 1);
