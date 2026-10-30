// `npm run requests:leaves` — remove the leave requests that the old staff
// portal saved in the advances collection (advanceType medical / annual /
// leave). The owner decided on 30 Oct 2026 that they are of no use any more:
// they are deleted, not moved. Leave now lives in companies/{c}/branches/{b}/leaves
// (roadmap 4.2).
//
// Money: the new money engine (lib/finance/rules.js isLeaveRequest) already
// leaves these out, so deleting them changes no figure in the new app. The
// OLD app (main) counted every advance's amount as cash out, leave too — the
// old leave form made staff type an amount. Run this with the release (the new
// app live), never before it, or main's cash figures would move by the total
// below. The report lists each one with its amount first.
//
//   npm run requests:leaves                                   local emulators, report only
//   npm run requests:leaves -- --write                        local emulators, delete
//   npm run requests:leaves -- --project <id>                 a real project, report only
//   npm run requests:leaves -- --project <id> --write --confirm
//
// Before deleting, every record found is saved to .local/removed-old-leave/
// (git-ignored: it is client data). A real project needs Google credentials
// (gcloud auth application-default login). Safe to run again.
import fs from "node:fs";
import path from "node:path";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { LOCAL_PROJECT_ID } from "./local/config.mjs";

// as lib/requests/model.js (which uses app aliases node can't load here)
const isOldLeave = (a) => ["medical", "annual", "leave"].includes(String(a?.advanceType || "").toLowerCase());

const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : null;
};
const project = arg("--project");
const write = process.argv.includes("--write");
if (project) {
  if (write && !process.argv.includes("--confirm")) {
    console.error(`This deletes from the real project "${project}". Add --confirm to go ahead.`);
    process.exit(1);
  }
  delete process.env.FIRESTORE_EMULATOR_HOST;
} else {
  process.env.FIRESTORE_EMULATOR_HOST ||= "127.0.0.1:8080";
}

initializeApp({ projectId: project || LOCAL_PROJECT_ID });
const db = getFirestore();
console.log(`${write ? "Deleting" : "Checking"} leave kept in advances in ${project || `local emulators (${process.env.FIRESTORE_EMULATOR_HOST})`}${write ? "" : " — report only, add --write to delete"}`);

let advances = 0;
const found = [];
for (const company of await db.collection("companies").listDocuments()) {
  for (const branch of await company.collection("branches").listDocuments()) {
    for (const snap of (await branch.collection("advances").get()).docs) {
      advances++;
      const a = snap.data();
      if (isOldLeave(a)) found.push({ ref: snap.ref, path: snap.ref.path, data: a });
    }
  }
}

// each one, and what the old app counted for it
let counted = 0;
for (const { path: p, data: a } of found) {
  const amount = Number(a.amount) || 0;
  const back = String(a.paidFromOffice || "front").toLowerCase() === "back";
  if (!back) counted += amount;
  console.log(`  ${a.date || "(no date)"} · ${a.staffName || a.staffId || "?"} · ${a.advanceType} · ${a.status || "(no status)"} · amount ${amount}${amount ? (back ? " (bank)" : " (till)") : ""} · ${p}`);
}
console.log(`${advances} advance records · ${found.length} old leave · amounts the old app counted from the till: ${counted}`);

if (write && found.length) {
  const dir = path.join(".local", "removed-old-leave");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${project || "local"}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(file, JSON.stringify(found.map(({ path: p, data }) => ({ path: p, data })), null, 2));
  console.log(`Saved a copy of each to ${file}`);
  for (let i = 0; i < found.length; i += 400) {
    const batch = db.batch();
    for (const { ref } of found.slice(i, i + 400)) batch.delete(ref);
    await batch.commit();
  }
  console.log(`${found.length} deleted`);
}
