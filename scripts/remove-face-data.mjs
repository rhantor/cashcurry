// `npm run face:remove-data` — delete the face-recognition data kept on staff
// records (faceDescriptors, faceThumb, faceEnrolledAt). Face recognition was
// removed from the app; these are biometric personal data with no further use.
// Attendance history is untouched (old punches keep method "face").
//
//   npm run face:remove-data                                  local emulators
//   npm run face:remove-data -- --project <id> --confirm      a real project
//
// Deleting is permanent: back up first. A real project needs Google
// credentials (gcloud auth application-default login).
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { LOCAL_PROJECT_ID } from "./local/config.mjs";

const FIELDS = ["faceDescriptors", "faceThumb", "faceEnrolledAt"];
const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : null;
};
const project = arg("--project");
if (project) {
  if (!process.argv.includes("--confirm")) {
    console.error(`This permanently deletes face data in the real project "${project}". Add --confirm to go ahead.`);
    process.exit(1);
  }
  delete process.env.FIRESTORE_EMULATOR_HOST;
} else {
  process.env.FIRESTORE_EMULATOR_HOST ||= "127.0.0.1:8080";
}

initializeApp({ projectId: project || LOCAL_PROJECT_ID });
const db = getFirestore();
console.log(`Removing face data in ${project || `local emulators (${process.env.FIRESTORE_EMULATOR_HOST})`}`);

let cleared = 0;
for (const company of await db.collection("companies").listDocuments()) {
  for (const branch of await company.collection("branches").listDocuments()) {
    for (const s of (await branch.collection("staff").get()).docs) {
      const present = FIELDS.filter((f) => s.get(f) !== undefined);
      if (!present.length) continue;
      await s.ref.update(Object.fromEntries(present.map((f) => [f, FieldValue.delete()])));
      console.log(`  ${company.id}/${branch.id}/staff/${s.id}: removed ${present.join(", ")}`);
      cleared++;
    }
  }
}
console.log(`Done: face data removed from ${cleared} staff record(s)`);
process.exit(0);
