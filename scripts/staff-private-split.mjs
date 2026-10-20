// `npm run staff:private` — move each staff member's private details (pay, IC,
// bank, address…; see lib/staff/private.js) off their staff record into
// companies/{c}/branches/{b}/staffPrivate/{staffId}, where only those who may
// see pay can read them (roadmap 4.1). Values already in staffPrivate win;
// nothing else on the record changes. Safe to run again.
//
//   npm run staff:private                                   local emulators, report only
//   npm run staff:private -- --write                        local emulators, write
//   npm run staff:private -- --project <id>                 a real project, report only
//   npm run staff:private -- --project <id> --write --confirm
//
// A real project needs Google credentials (gcloud auth application-default login).
// Back up first. Deploy the new firestore.rules in the same release.
import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { LOCAL_PROJECT_ID } from "./local/config.mjs";
import { PRIVATE_FIELDS } from "../lib/staff/private.js";

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
console.log(`${write ? "Moving" : "Checking"} private staff details in ${project || `local emulators (${process.env.FIRESTORE_EMULATOR_HOST})`}${write ? "" : " — report only, add --write to save"}`);

let records = 0;
let toMove = 0;
for (const company of await db.collection("companies").listDocuments()) {
  for (const branch of await company.collection("branches").listDocuments()) {
    for (const snap of (await branch.collection("staff").get()).docs) {
      records++;
      const data = snap.data();
      const priv = Object.fromEntries(PRIVATE_FIELDS.filter((k) => k in data).map((k) => [k, data[k]]));
      if (!Object.keys(priv).length) continue;
      toMove++;
      if (!write) continue;
      const privRef = branch.collection("staffPrivate").doc(snap.id);
      await db.runTransaction(async (tx) => {
        const existing = await tx.get(privRef);
        // what is already in staffPrivate is newer — keep it
        tx.set(privRef, { ...priv, ...(existing.exists ? existing.data() : {}), staffId: snap.id }, { merge: true });
        tx.update(snap.ref, Object.fromEntries(Object.keys(priv).map((k) => [k, FieldValue.delete()])));
      });
    }
  }
}
console.log(`${records} staff records · ${toMove} ${write ? "moved" : "would be moved"}`);
