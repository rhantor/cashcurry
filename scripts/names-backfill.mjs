// `npm run names:backfill` — add people's names to older records that only
// saved who did something by username (createdBy, approvedBy, requestedBy,
// paidOut.by…), so the app shows "Ali Hassan" instead of "ali_kl2". Names
// come from each user's /users/{uid} record. Nothing else on a record is
// touched, and a stamp that already has a name is left alone.
//
//   npm run names:backfill                                   local emulators, report only
//   npm run names:backfill -- --write                        local emulators, write
//   npm run names:backfill -- --project <id>                 a real project, report only
//   npm run names:backfill -- --project <id> --write --confirm
//
// A real project needs Google credentials (gcloud auth application-default login).
// Back up first.
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { LOCAL_PROJECT_ID } from "./local/config.mjs";

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
console.log(`${write ? "Adding" : "Checking"} names in ${project || `local emulators (${process.env.FIRESTORE_EMULATOR_HOST})`}${write ? "" : " — report only, add --write to save"}`);

// The records that keep who did something, per branch.
const COLLECTIONS = ["sales", "costs", "deposits", "withdrawals", "advances", "loans", "salaries", "vendorBills", "vendorPayments", "payrollRuns"];
// Stamps on a record: a top-level field, or one inside an object (paidOut.by).
const STAMPS = ["createdBy", "approvedBy", "rejectedBy", "requestedBy", "updatedBy", "paidBy", "editedBy", "paidOut.by"];

// uid → name, and username → name for stamps without a uid
const byUid = new Map();
const byUsername = new Map();
for (const u of (await db.collection("users").get()).docs) {
  const d = u.data();
  const name = d.name || d.fullName || [d.firstName, d.lastName].filter(Boolean).join(" ");
  if (!name) continue;
  byUid.set(u.id, name);
  const un = (d.userName || d.username || "").toLowerCase();
  if (un) byUsername.set(un, name);
}
console.log(`${byUid.size} people with a name`);

const get = (obj, path) => path.split(".").reduce((o, k) => (o && typeof o === "object" ? o[k] : undefined), obj);
const nameFor = (stamp) => {
  if (!stamp || typeof stamp !== "object" || stamp.name) return null;
  return byUid.get(stamp.uid || stamp.id) || byUsername.get(String(stamp.username || stamp.userName || "").toLowerCase()) || null;
};

let checked = 0;
let toFix = 0;
let batch = db.batch();
let inBatch = 0;
for (const company of await db.collection("companies").listDocuments()) {
  for (const branch of await company.collection("branches").listDocuments()) {
    for (const col of COLLECTIONS) {
      for (const docSnap of (await branch.collection(col).get()).docs) {
        checked++;
        const data = docSnap.data();
        const update = {};
        for (const path of STAMPS) {
          const name = nameFor(get(data, path));
          if (name) update[`${path}.name`] = name;
        }
        if (!Object.keys(update).length) continue;
        toFix++;
        if (!write) continue;
        batch.update(docSnap.ref, update);
        if (++inBatch === 400) {
          await batch.commit();
          batch = db.batch();
          inBatch = 0;
        }
      }
    }
  }
}
if (write && inBatch) await batch.commit();
console.log(`${checked} records checked · ${toFix} ${write ? "given names" : "would be given names"}`);
