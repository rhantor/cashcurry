// `npm run requests:leaves` — move leave requests that were saved in the
// advances collection (advanceType medical / annual / leave) into
// companies/{c}/branches/{b}/leaves, the requests engine's home for leave
// (roadmap 4.2). The money engine already ignores them; this only puts them
// where leave lists look. The same id is kept. Safe to run again.
//
//   npm run requests:leaves                                   local emulators, report only
//   npm run requests:leaves -- --write                        local emulators, write
//   npm run requests:leaves -- --project <id>                 a real project, report only
//   npm run requests:leaves -- --project <id> --write --confirm
//
// A real project needs Google credentials (gcloud auth application-default login).
// Back up first. Deploy the new firestore.rules in the same release.
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { LOCAL_PROJECT_ID } from "./local/config.mjs";

// as lib/requests/model.js (which uses app aliases node can't load here)
const isOldLeave = (a) => ["medical", "annual", "leave"].includes(String(a?.advanceType || "").toLowerCase());
const leaveDays = (from) => (/^\d{4}-\d{2}-\d{2}$/.test(from || "") ? 1 : 0);

const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : null;
};
const project = arg("--project");
const write = process.argv.includes("--write");
if (project) {
  if (write && !process.argv.includes("--confirm")) {
    console.error(`This writes to the real project "${project}". Add --confirm to go ahead.`);
    process.exit(1);
  }
  delete process.env.FIRESTORE_EMULATOR_HOST;
} else {
  process.env.FIRESTORE_EMULATOR_HOST ||= "127.0.0.1:8080";
}

initializeApp({ projectId: project || LOCAL_PROJECT_ID });
const db = getFirestore();
console.log(`${write ? "Moving" : "Checking"} leave kept in advances in ${project || `local emulators (${process.env.FIRESTORE_EMULATOR_HOST})`}${write ? "" : " — report only, add --write to save"}`);

let advances = 0;
let found = 0;
for (const company of await db.collection("companies").listDocuments()) {
  for (const branch of await company.collection("branches").listDocuments()) {
    for (const snap of (await branch.collection("advances").get()).docs) {
      advances++;
      const a = snap.data();
      if (!isOldLeave(a)) continue;
      found++;
      if (!write) continue;
      const from = a.date || "";
      const status = ["approved", "closed"].includes(a.status) ? "approved" : a.status || "pending";
      const leave = {
        staffId: a.staffId || null,
        staffName: a.staffName || "",
        leaveKind: String(a.advanceType).toLowerCase() === "leave" ? "other" : String(a.advanceType).toLowerCase(),
        from, to: from, halfDay: false, days: leaveDays(from, from) || 1,
        reason: a.reason || "",
        status,
        approvals: a.approvals || [],
        ...(a.approvedBy ? { approvedBy: a.approvedBy } : {}),
        createdBy: a.createdBy || {},
        createdAt: a.createdAt || null,
        companyId: company.id, branchId: branch.id,
        movedFrom: `advances/${snap.id}`,
      };
      const batch = db.batch();
      batch.set(branch.collection("leaves").doc(snap.id), leave, { merge: true });
      batch.delete(snap.ref);
      await batch.commit();
    }
  }
}
console.log(`${advances} advance records · ${found} leave ${write ? "moved" : "would be moved"}`);
