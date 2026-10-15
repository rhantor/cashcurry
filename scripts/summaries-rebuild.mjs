// `npm run summaries:rebuild` — recompute every branch's monthly summaries
// (companies/{c}/branches/{b}/summaries/{YYYY-MM}) from the records, with the
// same code the Cloud Functions run.
//
//   npm run summaries:rebuild                                  local emulators
//   npm run summaries:rebuild -- --project <id> --confirm      a real project
//
// A real project needs Google credentials (gcloud auth application-default
// login). Run it once after deploying the functions, and whenever ENGINE_VERSION
// is bumped. Re-running is harmless: each month is recomputed in full.
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { LOCAL_PROJECT_ID } from "./local/config.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : null;
};

const project = arg("--project");
if (project) {
  if (!process.argv.includes("--confirm")) {
    console.error(`This writes to the real project "${project}". Add --confirm to go ahead.`);
    process.exit(1);
  }
  delete process.env.FIRESTORE_EMULATOR_HOST;
} else {
  process.env.FIRESTORE_EMULATOR_HOST ||= "127.0.0.1:8080";
}

spawnSync("node", ["scripts/build-functions-engine.mjs"], { cwd: root, stdio: "inherit" });
const summaries = createRequire(import.meta.url)("../functions/summaries.js");

initializeApp({ projectId: project || LOCAL_PROJECT_ID });
const db = getFirestore();

console.log(`Rebuilding summaries in ${project || `local emulators (${process.env.FIRESTORE_EMULATOR_HOST})`}`);
const started = Date.now();
for (const company of await db.collection("companies").listDocuments()) {
  const built = await summaries.rebuildCompany(db, company.id);
  for (const [branchId, months] of Object.entries(built)) {
    console.log(`  ${company.id}/${branchId}: ${months.length ? `${months[0]} … ${months.at(-1)} (${months.length})` : "no records"}`);
  }
}
console.log(`Done in ${((Date.now() - started) / 1000).toFixed(1)}s`);
process.exit(0);
