// `npm run payslips:copy` — give staff their own copy of every payslip from a
// payroll run that is already finalized or paid (lib/payroll/payslipCopy.js):
// staffPrivate/{staffId}/payslips/{runId}. New runs do this themselves when
// they are finalized or paid. Safe to run again.
//
//   npm run payslips:copy                                   local emulators, report only
//   npm run payslips:copy -- --write                        local emulators, write
//   npm run payslips:copy -- --project <id>                 a real project, report only
//   npm run payslips:copy -- --project <id> --write --confirm
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { LOCAL_PROJECT_ID } from "./local/config.mjs";
import { payslipCopy } from "../lib/payroll/payslipCopy.js";

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
console.log(`${write ? "Writing" : "Checking"} staff payslip copies in ${project || "local emulators"}${write ? "" : " — report only, add --write to save"}`);

// "YYYY-MM-DD" of a Firestore timestamp, a Date or a string
const dayOf = (v) => {
  const d = v?.toDate ? v.toDate() : v ? new Date(v) : null;
  return d && !isNaN(d) ? d.toISOString().slice(0, 10) : null;
};

let runs = 0;
let slips = 0;
for (const company of await db.collection("companies").listDocuments()) {
  for (const branch of await company.collection("branches").listDocuments()) {
    const done = await branch.collection("payrollRuns").where("status", "in", ["finalized", "paid"]).get();
    for (const run of done.docs) {
      runs++;
      const r = run.data();
      const list = (await run.ref.collection("slips").get()).docs;
      slips += list.length;
      if (!write) continue;
      const batch = db.batch();
      for (const s of list) {
        const slip = s.data();
        const staffId = slip.staffId || s.id;
        const copy = payslipCopy(slip, { runId: run.id, status: r.status, paidOn: r.status === "paid" ? dayOf(r.paidAt) : null });
        batch.set(branch.collection("staffPrivate").doc(staffId).collection("payslips").doc(run.id), copy);
      }
      await batch.commit();
    }
  }
}
console.log(`${runs} finalized / paid runs · ${slips} payslips ${write ? "copied" : "would be copied"}`);
process.exit(0);
