// `npm run staff:link` — record on each login which staff record it is
// (users/{uid}.staffId), from the uid every staff record already carries
// (create-staff writes both sides now; older logins only have the staff side).
// The security rules let staff read only rows with their own staffId, so a
// staff login without the link sees only what it asked for itself.
//
//   npm run staff:link                                   local emulators
//   npm run staff:link -- --project <id> --confirm       a real project
//
// Prints every change; re-running is harmless. A real project needs Google
// credentials (gcloud auth application-default login).
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { LOCAL_PROJECT_ID } from "./local/config.mjs";

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

initializeApp({ projectId: project || LOCAL_PROJECT_ID });
const db = getFirestore();
console.log(`Linking staff logins in ${project || `local emulators (${process.env.FIRESTORE_EMULATOR_HOST})`}`);

let linked = 0;
let skipped = 0;
for (const company of await db.collection("companies").listDocuments()) {
  for (const branch of await company.collection("branches").listDocuments()) {
    const staff = await branch.collection("staff").where("uid", "!=", null).get();
    for (const s of staff.docs) {
      const uid = s.get("uid");
      const user = await db.doc(`users/${uid}`).get();
      const why = !user.exists
        ? "no user record"
        : user.get("companyId") !== company.id
          ? "user is in another company"
          : user.get("staffId") && user.get("staffId") !== s.id
            ? `already linked to ${user.get("staffId")}`
            : null;
      if (why) {
        console.log(`  skip ${company.id}/${branch.id}/staff/${s.id} → ${uid}: ${why}`);
        skipped++;
        continue;
      }
      if (user.get("staffId") === s.id) continue;
      await user.ref.update({ staffId: s.id });
      console.log(`  link ${uid} → ${company.id}/${branch.id}/staff/${s.id}`);
      linked++;
    }
  }
}
console.log(`Done: ${linked} linked, ${skipped} skipped`);
process.exit(0);
