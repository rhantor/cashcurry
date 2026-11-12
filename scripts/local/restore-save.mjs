// `npm run local:restore-save -- <folder>` — put a good Firestore copy back
// as the local data, when `npm run dev:local` refuses to start on a broken one.
//
//   <folder> is a Firestore export folder, e.g.
//     .local/emulator-data-kept/firestore_export.prev
//     .local/rescue-20261112-134636/firestore_export
//
// The copy is checked first. The broken current copy is set aside in
// .local/emulator-data-kept as firestore_export.BAD-<time>, never deleted.
// Run it with the emulators stopped.
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { ROOT, LOCAL_DIR, LOCAL_PROJECT_ID, EMULATOR_DATA_DIR } from "./config.mjs";
import { EXPORT_NAME, checkFirestoreExport, findGoodCopies, keptDirFor, restoreCopy } from "./exportSafety.mjs";

const KEEP_DIR = keptDirFor(EMULATOR_DATA_DIR);
const arg = process.argv[2];

if (!arg) {
  const current = checkFirestoreExport(path.join(EMULATOR_DATA_DIR, EXPORT_NAME), LOCAL_PROJECT_ID);
  console.log(`Current local data: ${current.ok ? `good (${current.records} records)` : `BROKEN — ${current.reason}`}`);
  const copies = findGoodCopies({ dataDir: EMULATOR_DATA_DIR, keepDir: KEEP_DIR, localDir: LOCAL_DIR, projectId: LOCAL_PROJECT_ID });
  if (!copies.length) console.log("No good copy found in .local/emulator-data-kept or .local/rescue-*.");
  for (const c of copies) console.log(`  npm run local:restore-save -- "${path.relative(ROOT, c.dir)}"    (${c.label})`);
  process.exit(0);
}

const emulatorRunning = await new Promise((resolve) => {
  const s = net.connect(8080, "127.0.0.1");
  s.once("connect", () => { s.end(); resolve(true); });
  s.once("error", () => resolve(false));
});
if (emulatorRunning) {
  console.error("The Firestore emulator is running (port 8080). Stop it first — on exit it would write its own data over the restored copy.");
  process.exit(1);
}
if (!fs.existsSync(path.join(EMULATOR_DATA_DIR, "firebase-export-metadata.json"))) {
  console.error(`${path.relative(ROOT, EMULATOR_DATA_DIR)} has no firebase-export-metadata.json — this only replaces the Firestore part of a data folder.`);
  process.exit(1);
}

try {
  const r = restoreCopy({ from: path.resolve(ROOT, arg), dataDir: EMULATOR_DATA_DIR, keepDir: KEEP_DIR, projectId: LOCAL_PROJECT_ID });
  console.log(`Restored ${r.records} records from ${arg}, written to disk and checked.`);
  if (r.setAside) console.log(`The copy it replaced is kept at ${path.relative(ROOT, r.setAside)}.`);
} catch (e) {
  console.error(`Not restored: ${e.message}`);
  process.exit(1);
}
