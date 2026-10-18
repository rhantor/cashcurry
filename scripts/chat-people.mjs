// `npm run chat:people` — fill companies/{c}/chatPeople (who can be messaged
// in chat, roadmap 4.4: name, role, branch — nothing else) from users/{uid}.
// After this the chatPeople Cloud Function keeps it in step. Safe to run again.
//
//   npm run chat:people                                   local emulators, report only
//   npm run chat:people -- --write                        local emulators, write
//   npm run chat:people -- --project <id>                 a real project, report only
//   npm run chat:people -- --project <id> --write --confirm
import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
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
console.log(`${write ? "Writing" : "Checking"} the chat directory in ${project || "local emulators"}${write ? "" : " — report only, add --write to save"}`);

// as lib/people.js personName
const nameOf = (u) => u.name || u.fullName || u.displayName || [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || u.userName || "—";

let users = 0;
let missing = 0;
for (const snap of (await db.collection("users").get()).docs) {
  const u = snap.data();
  if (!u.companyId) continue;
  users++;
  const ref = db.doc(`companies/${u.companyId}/chatPeople/${snap.id}`);
  if (!(await ref.get()).exists) missing++;
  if (write) await ref.set({ name: nameOf(u), role: u.role || "", branchId: u.branchId || null, updatedAt: FieldValue.serverTimestamp() });
}
console.log(`${users} users · ${missing} not in the directory yet${write ? " — all written" : ""}`);
process.exit(0);
