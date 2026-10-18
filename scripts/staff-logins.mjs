// `npm run staff:logins` — let staff who already have a login sign in with
// their phone or IC number (docs/STAFF_APP.md): writes staffLogins/{hash}
// { uid, email } for each staff record with a login. Their password stays
// as it is until a manager resets their PIN. Safe to run again.
//
//   npm run staff:logins                                   local emulators, report only
//   npm run staff:logins -- --write                        local emulators, write
//   npm run staff:logins -- --project <id>                 a real project, report only
//   npm run staff:logins -- --project <id> --write --confirm
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { LOCAL_PROJECT_ID } from "./local/config.mjs";
import { loginKeys } from "../lib/staffLogin.js";

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
console.log(`${write ? "Writing" : "Checking"} staff phone / IC logins in ${project || "local emulators"}${write ? "" : " — report only, add --write to save"}`);

let logins = 0;
let ways = 0;
for (const company of await db.collection("companies").listDocuments()) {
  for (const branch of await company.collection("branches").listDocuments()) {
    for (const s of (await branch.collection("staff").get()).docs) {
      const staff = s.data();
      if (!staff.uid) continue;
      logins++;
      const p = await branch.collection("staffPrivate").doc(s.id).get();
      const priv = p.exists ? p.data() : {};
      const keys = await loginKeys({ phone: staff.phone, ic: priv.icNumber || priv.passportNumber });
      ways += keys.length;
      if (!write) continue;
      const email = staff.loginEmail || (await db.doc(`users/${staff.uid}`).get()).data()?.email || "";
      const batch = db.batch();
      keys.forEach((k) => batch.set(db.collection("staffLogins").doc(k), { uid: staff.uid, email }));
      await batch.commit();
    }
  }
}
console.log(`${logins} staff with a login · ${ways} phone / IC ways ${write ? "written" : "would be written"}`);
process.exit(0);
