// `npm run local:reminders` — run the hourly reminders once against the running
// emulators, because the emulators don't fire scheduled functions by themselves.
// They land in the bell; there is no push locally. Emulators only.
//
//   npm run local:reminders                                  as of now
//   npm run local:reminders -- --at 2026-11-08T18:00+08:00   as if it were then
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { LOCAL_PROJECT_ID, ROOT } from "./config.mjs";

process.env.FIRESTORE_EMULATOR_HOST ||= "127.0.0.1:8080";
process.env.FUNCTIONS_EMULATOR = "true"; // notify.js logs pushes instead of sending them

const i = process.argv.indexOf("--at");
const now = i > 0 ? new Date(process.argv[i + 1]) : new Date();
if (Number.isNaN(now.getTime())) {
  console.error("--at wants a date and time, like 2026-11-08T18:00+08:00");
  process.exit(1);
}

spawnSync("node", ["scripts/build-functions-engine.mjs"], { cwd: ROOT, stdio: "inherit" });

initializeApp({ projectId: LOCAL_PROJECT_ID });
const require = createRequire(import.meta.url);
const notify = require(path.join(ROOT, "functions", "notify.js"))({ db: getFirestore(), fcm: null, FieldValue });

console.log(`Running the reminders as of ${now.toISOString()}`);
await notify.warrantyReminders(now);
console.log("Done. Check the bell in the app.");
