// Sample data for what came after the money demo (demoCompany.mjs, whose
// figures the finance tests check — left as it is): people who clock in and
// have shifts and days off, today's punches, daily tasks with a rota and a
// day off to cover, issues, leave and an advance to decide, and new hires at
// each step (one filled in, with sample documents and a signed letter; one
// with a link to try). Run by `npm run local:seed` inside the emulators,
// after seed.mjs. Made up — no client data. Dates are relative to today.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import zlib from "node:zlib";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { LOCAL_PROJECT_ID, LOCAL_DIR } from "../config.mjs";
import { TEMPLATES } from "../../../app/tools/appointment-letter/templates.js";

for (const v of ["FIRESTORE_EMULATOR_HOST", "FIREBASE_AUTH_EMULATOR_HOST", "FIREBASE_STORAGE_EMULATOR_HOST"]) {
  if (!process.env[v]) {
    console.error(`${v} is not set — refusing to run outside the emulators. Use \`npm run local:seed\`.`);
    process.exit(1);
  }
}
initializeApp({ projectId: LOCAL_PROJECT_ID });
const db = getFirestore();
const auth = getAuth();
const CO = "demo-company";
const KL = "demo-kl";
const kl = db.doc(`companies/${CO}/branches/${KL}`);
const BUCKET = `${LOCAL_PROJECT_ID}.appspot.com`;
const password = fs.readFileSync(path.join(LOCAL_DIR, "dev-password.txt"), "utf8").trim();

// ── days, on the KL branch's clock (Malaysia) ────────────────────────────────
// "Today" is the calendar day in KL: seeded late at night (before the
// branch's 05:00 day end) it is still the day you will test on.
const KL_OFFSET = 8 * 3600e3;
const ymd = (ms) => new Date(ms).toISOString().slice(0, 10);
const TODAY = ymd(Date.now() + KL_OFFSET);
const addDays = (d, n) => ymd(Date.parse(`${d}T00:00:00Z`) + n * 864e5);
const weekday = (d) => new Date(`${d}T00:00:00Z`).getUTCDay();
const at = (d, hhmm) => Timestamp.fromMillis(Date.parse(`${d}T${hhmm}:00+08:00`));
const iso = (d, hhmm = "10:00") => new Date(Date.parse(`${d}T${hhmm}:00+08:00`)).toISOString();
const WEEK_AGO = addDays(TODAY, -7);

// ── people ──────────────────────────────────────────────────────────────────
const uid = (u) => `demo-${u.replace(/_/g, "-")}`;
const SUP = { uid: uid("kl_supervisor"), name: "KL Supervisor", role: "supervisor" };
const MGR = { uid: uid("kl_manager"), name: "KL Manager", role: "manager" };
const ALI = { uid: uid("ali"), name: "Ali Hassan", role: "staff" };
// new staff app logins (username, staff record)
const NEW_LOGINS = [
  { username: "sam", id: "staff-sam", firstName: "Sam", lastName: "Lee", phone: "012-000 0105", ic: "950505-14-0105", department: "kitchen", basicPerHour: "9", shift: ["08:00", "17:00"] },
  { username: "nora", id: "staff-nora", firstName: "Nora", lastName: "Ismail", phone: "012-000 0106", ic: "970606-14-0106", department: "front", basicPerHour: "8.5", shift: ["14:00", "22:00"] },
];
const SAM = { uid: uid("sam"), name: "Sam Lee", role: "staff" };
const NORA = { uid: uid("nora"), name: "Nora Ismail", role: "staff" };

for (const p of NEW_LOGINS) {
  const email = `${p.username}@demo.test`;
  const name = `${p.firstName} ${p.lastName}`;
  await auth.createUser({ uid: uid(p.username), email, emailVerified: true, password, displayName: name });
  await db.doc(`users/${uid(p.username)}`).set({ companyId: CO, role: "staff", userName: p.username, name, fullName: name, email, branchId: KL, staffId: p.id, createdAt: iso(WEEK_AGO) });
  await db.doc(`usernames/${p.username}`).set({ uid: uid(p.username), userName: p.username, email, companyId: CO, branchId: KL });
  await db.doc(`companies/${CO}/chatPeople/${uid(p.username)}`).set({ name, role: "staff", branchId: KL });
  await kl.collection("staff").doc(p.id).set({
    firstName: p.firstName, lastName: p.lastName, role: "staff", department: p.department, employmentType: "part-time",
    fixedSalaryNoAttendance: false, startDate: addDays(TODAY, -60), nationality: "malaysian", country: "Malaysia", phone: p.phone,
    uid: uid(p.username), loginEmail: email, supervisorUid: SUP.uid, supervisorName: SUP.name,
    shiftStart: p.shift[0], shiftEnd: p.shift[1], shiftBreakMinutes: 60, daysOff: [], daysOffSince: "",
    companyId: CO, branchId: KL, createdAt: iso(WEEK_AGO), pinCode: String(4000 + NEW_LOGINS.indexOf(p)),
  });
  await kl.collection("staffPrivate").doc(p.id).set({ staffId: p.id, basicPerHour: p.basicPerHour, OTPerHour: "12", icNumber: p.ic });
}

// Ali: clocks in, 09:00–18:00, today is his weekly day off (from a week ago), led by the supervisor.
// Kumar and Siti: clock in too (Siti is on leave tomorrow).
await kl.collection("staff").doc("staff-ali").update({ fixedSalaryNoAttendance: false, shiftStart: "09:00", shiftEnd: "18:00", shiftBreakMinutes: 60, daysOff: [weekday(TODAY)], daysOffSince: WEEK_AGO, supervisorUid: SUP.uid, supervisorName: SUP.name, pinCode: "4100" });
await kl.collection("staff").doc("staff-kumar").update({ fixedSalaryNoAttendance: false, shiftStart: "09:00", shiftEnd: "18:00", shiftBreakMinutes: 60, supervisorUid: SUP.uid, supervisorName: SUP.name, pinCode: "4101" });
await kl.collection("staff").doc("staff-siti").update({ fixedSalaryNoAttendance: false, shiftStart: "10:00", shiftEnd: "19:00", shiftBreakMinutes: 60, pinCode: "4102" });
await kl.collection("settings").doc("settings").set({ attendance: { shiftsEnabled: true } }, { merge: true });

// ── today's punches: Sam in on time, Siti in a little late, Kumar not in yet (late), Nora later today, Ali off ──
const punch = (staffId, staffName, type, d, hhmm) => kl.collection("attendance").add({ staffId, staffName, type, date: d, timestamp: at(d, hhmm), method: "pin", companyId: CO, branchId: KL });
await punch("staff-sam", "Sam Lee", "in", TODAY, "07:56");
await punch("staff-siti", "Siti Aminah", "in", TODAY, "10:12");
for (let i = 1; i <= 5; i++) {
  const d = addDays(TODAY, -i);
  await punch("staff-sam", "Sam Lee", "in", d, "07:58");
  await punch("staff-sam", "Sam Lee", "out", d, "17:03");
}

// ── tasks ───────────────────────────────────────────────────────────────────
const tasks = kl.collection("tasks");
const task = (id, t) => tasks.doc(id).set({
  details: "", priority: "normal", needsPhoto: false, status: "open", active: true, done: null, items: [],
  createdBy: { uid: MGR.uid, name: MGR.name, role: MGR.role }, creatorUid: MGR.uid, companyId: CO, branchId: KL,
  createdAt: Timestamp.fromMillis(Date.parse(`${WEEK_AGO}T09:00:00+08:00`)), updatedAt: Timestamp.now(), ...t,
});
const dutyOf = (p) => ({ uid: p.uid, name: p.name, role: p.role });
// the supervisor's opening check, done by Ali every day on a rota — today Ali is off, so it waits for someone
const rota = Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((d) => [d, dutyOf(ALI)]));
await task("demo-opening", {
  title: "Opening check", repeat: { every: "day" }, startDate: WEEK_AGO, assignee: dutyOf(SUP), assigneeUid: SUP.uid, teamLeadUid: SUP.uid,
  rota, rotaSince: WEEK_AGO, covers: {}, doers: [SUP.uid, ALI.uid],
  items: ["Lights and AC on", "Fridge and freezer temperatures noted", "Cash float counted", "Floor and tables clean"],
});
await task("demo-fryer", { title: "Clean the fryer", repeat: { every: "day" }, startDate: WEEK_AGO, assignee: dutyOf(SAM), assigneeUid: SAM.uid, teamLeadUid: SUP.uid, doers: [SAM.uid], needsPhoto: true });
await task("demo-stock", { title: "Count the drinks stock", repeat: { every: "week", days: [weekday(TODAY), weekday(addDays(TODAY, 3))] }, startDate: WEEK_AGO, assignee: dutyOf(NORA), assigneeUid: NORA.uid, teamLeadUid: SUP.uid, doers: [NORA.uid] });
await task("demo-tap", { title: "Get the kitchen tap fixed", details: "It drips all night. Call the plumber.", repeat: null, dueDate: addDays(TODAY, 1), priority: "urgent", assignee: dutyOf(SUP), assigneeUid: SUP.uid, teamLeadUid: null, doers: [SUP.uid] });
// ticks: Ali did the opening check on the past days, Sam the fryer
const tick = (taskId, d, who, lead) => kl.collection("taskChecks").doc(`${taskId}_${d}`).set({ taskId, date: d, doneOn: d, assigneeUid: who.uid, doerUid: who.uid, teamLeadUid: lead, by: { uid: who.uid, name: who.name }, photos: [], note: "", items: [], createdAt: Timestamp.now() });
for (let i = 1; i <= 5; i++) {
  const d = addDays(TODAY, -i);
  if (weekday(d) !== weekday(TODAY)) await tick("demo-opening", d, ALI, SUP.uid);
  await tick("demo-fryer", d, SAM, SUP.uid);
}
await tick("demo-fryer", TODAY, SAM, SUP.uid);

// ── issues ──────────────────────────────────────────────────────────────────
const issue = (id, x) => kl.collection("issues").doc(id).set({
  details: "", category: "equipment", priority: "normal", status: "open", photos: [], dueDate: null, taskId: null,
  reportedBy: { uid: SAM.uid, name: SAM.name, role: "staff" }, reporterUid: SAM.uid, assignedTo: null, assigneeUid: null,
  watchers: [SAM.uid], companyId: CO, branchId: KL, createdAt: Timestamp.now(), updatedAt: Timestamp.now(), lastActivityAt: Timestamp.now(), ...x,
});
await issue("demo-freezer", { title: "Freezer not cold enough", details: "Shows -8°C this morning, should be -18°C.", priority: "urgent" });
await issue("demo-card", { title: "Card machine is slow", category: "other", status: "in_progress", reportedBy: { uid: uid("kl_cashier"), name: "KL Cashier", role: "cashier" }, reporterUid: uid("kl_cashier"), assignedTo: dutyOf(SUP), assigneeUid: SUP.uid, watchers: [uid("kl_cashier"), SUP.uid] });
await issue("demo-soap", { title: "Hand soap ran out in the toilet", category: "cleaning", status: "resolved", resolution: "Refilled, and two bottles kept in the store.", assignedTo: dutyOf(NORA), assigneeUid: NORA.uid, watchers: [SAM.uid, NORA.uid] });

// ── leave and an advance to decide ──────────────────────────────────────────
const leave = (id, x) => kl.collection("leaves").doc(id).set({ halfDay: false, approvals: [], reason: "", leaveKind: "annual", companyId: CO, branchId: KL, createdAt: Timestamp.now(), ...x });
const nextOff = addDays(TODAY, 7); // next week's same day: Ali's day off again
await leave("demo-leave-sam", { staffId: "staff-sam", staffName: "Sam Lee", from: nextOff, to: addDays(nextOff, 1), days: 2, reason: "Sister's wedding", status: "pending", createdBy: dutyOf(SAM) });
await leave("demo-leave-siti", {
  staffId: "staff-siti", staffName: "Siti Aminah", from: addDays(TODAY, 1), to: addDays(TODAY, 1), days: 1, leaveKind: "medical", reason: "Clinic appointment",
  status: "approved", createdBy: dutyOf(SUP), approvals: [{ uid: MGR.uid, name: MGR.name, role: MGR.role, at: iso(TODAY, "09:00") }],
  approvedBy: { id: MGR.uid, name: MGR.name, role: MGR.role, timestamp: iso(TODAY, "09:00") },
});
await kl.collection("advances").doc("demo-adv-ali").set({
  staffId: "staff-ali", staffName: "Ali Hassan", amount: 200, advanceType: "salary", reason: "School fees", date: TODAY, paidFromOffice: "front",
  deductionMonth: TODAY.slice(0, 7), repaymentInstallments: 1, repaymentPerInstallment: 200,
  installments: [{ index: 1, month: TODAY.slice(0, 7), amount: 200, status: "pending", paidAt: null }], totalPaid: 0, remainingAmount: 200,
  status: "pending", approvals: [], paidOut: null, companyId: CO, branchId: KL, createdBy: dutyOf(SUP), createdAt: Timestamp.now(),
});

// ── new hires ───────────────────────────────────────────────────────────────
// sample pictures: labelled cards, a face, a signature — clearly not real documents
const card = (label, color) => `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><rect width="640" height="400" rx="24" fill="${color}"/><text x="40" y="80" font-family="Arial" font-size="34" fill="#fff" font-weight="bold">${label}</text><text x="40" y="140" font-family="Arial" font-size="24" fill="#fff">SAMPLE — NOT A REAL DOCUMENT</text><text x="40" y="340" font-family="Arial" font-size="28" fill="#fff">FAIZ RAHMAN · 960812-14-5567</text></svg>`;
const face = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#e3f6ef"/><circle cx="200" cy="160" r="80" fill="#22a082"/><rect x="90" y="260" width="220" height="140" rx="110" fill="#22a082"/></svg>`;
const put = async (p, body, type) => {
  const res = await fetch(`http://${process.env.FIREBASE_STORAGE_EMULATOR_HOST}/v0/b/${BUCKET}/o?name=${encodeURIComponent(p)}`, { method: "POST", headers: { Authorization: "Bearer owner", "Content-Type": type }, body });
  if (!res.ok) throw new Error(`storage ${res.status} for ${p}`);
  return { path: p, name: path.basename(p), contentType: type, size: Buffer.byteLength(body), at: iso(TODAY, "11:00") };
};

/** A signature as a PNG: a few pen strokes, drawn into pixels here (no canvas in node). */
function signaturePng(w = 360, h = 120) {
  const px = Buffer.alloc(w * h * 4, 0);
  const dot = (x, y) => {
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      const xi = Math.round(x + dx), yi = Math.round(y + dy);
      if (xi < 0 || yi < 0 || xi >= w || yi >= h) continue;
      const i = (yi * w + xi) * 4;
      px[i] = 29; px[i + 1] = 58; px[i + 2] = 138; px[i + 3] = 255;
    }
  };
  for (let t = 0; t <= 1; t += 0.0008) dot(20 + t * 320, 60 + Math.sin(t * 18) * 28 * (1 - t * 0.5) + Math.cos(t * 7) * 8);
  for (let t = 0; t <= 1; t += 0.002) dot(60 + t * 240, 100 - t * 6);
  const raw = Buffer.concat(Array.from({ length: h }, (_, y) => Buffer.concat([Buffer.from([0]), px.subarray(y * w * 4, (y + 1) * w * 4)])));
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

const hires = kl.collection("newHires");
const letterFor = (name, title, salary, start) => ({
  templateType: "fullTime", logo: null, stamp: null,
  companyDetails: { name: "DEMO CURRY HOUSE SDN BHD", registrationNo: "202601000001 (DEMO-X)", addressLine1: "1 Jalan Demo", addressLine2: "50000 Kuala Lumpur", phoneEmail: "Tel: 03-0000 0000 | Email: hr@demo.test" },
  letterMeta: { refNo: `DEMO/HR/${TODAY.slice(0, 4)}/001`, date: TODAY, watermarkText: "CONFIDENTIAL" },
  employeeDetails: { name, icPassport: "", addressLine1: "", addressLine2: "" },
  jobTerms: { ...TEMPLATES.fullTime.jobTerms, title, department: "Kitchen — Demo Branch KL", commencementDate: start, basicSalary: salary },
  allowances: [{ name: "Meal allowance", amount: "150.00" }],
  signatory: { name: "KL Manager", title: "Branch Manager" }, clauses: TEMPLATES.fullTime.clauses, signatorySignature: null,
  stylingOptions: { fontFamily: "serif", fontSize: "13px", marginSize: "20mm", lineHeight: "1.6", accentColor: "#059669", showWatermark: true, showLetterheadBorder: true },
});
const created = { createdBy: { uid: MGR.uid, name: MGR.name, role: MGR.role }, createdAt: Timestamp.fromMillis(Date.parse(`${addDays(TODAY, -2)}T10:00:00+08:00`)) };

// 1. Faiz — filled in and signed: check and accept
const F = "demo-hire-faiz";
const fFiles = {
  idFront: await put(`newHires/${CO}/${KL}/${F}/idFront-1.svg`, card("MyKad — FRONT", "#1d4ed8"), "image/svg+xml"),
  idBack: await put(`newHires/${CO}/${KL}/${F}/idBack-1.svg`, card("MyKad — BACK", "#1e40af"), "image/svg+xml"),
  photo: await put(`newHires/${CO}/${KL}/${F}/photo-1.svg`, face, "image/svg+xml"),
  bank: await put(`newHires/${CO}/${KL}/${F}/bank-1.svg`, card("MAYBANK — 1234 5678 90", "#b45309"), "image/svg+xml"),
  health: [await put(`newHires/${CO}/${KL}/${F}/health-1.svg`, card("TYPHOID VACCINE — 2026", "#15803d"), "image/svg+xml")],
};
await hires.doc(F).set({
  firstName: "Faiz", lastName: "Rahman", phone: "012-345 6789", role: "cook", department: "Kitchen", startDate: addDays(TODAY, 3), basicSalary: 2200,
  status: "submitted", letterReady: true, linkHash: null, link: { expiresAt: iso(addDays(TODAY, 5)), sentAt: iso(addDays(TODAY, -2)), by: { uid: MGR.uid, name: MGR.name } },
  details: {
    firstName: "Muhammad Faiz", lastName: "Rahman", gender: "male", dob: "1996-08-12", nationality: "malaysian", icNumber: "960812-14-5567", passportNumber: "",
    phone: "012-345 6789", email: "faiz@demo.test", addressLine1: "No. 45, Jalan Setia Bakti 3", addressLine2: "Bukit Damansara", city: "Kuala Lumpur", state: "Kuala Lumpur", postalCode: "50490", country: "Malaysia",
    emergencyContactName: "Aminah (mother)", emergencyContactPhone: "013-222 3333", bankName: "Maybank", bankAccountNumber: "1234567890", bankAccountHolderName: "Muhammad Faiz Rahman",
  },
  files: fFiles,
  signed: { at: iso(TODAY, "09:30"), name: "Muhammad Faiz Rahman", signature: `data:image/png;base64,${signaturePng().toString("base64")}`, userAgent: "sample" },
  submittedAt: iso(TODAY, "09:30"), ...created,
});
await hires.doc(F).collection("letter").doc("current").set({ ...letterFor("Faiz Rahman", "Cook", "2200.00", addDays(TODAY, 3)), savedAt: Timestamp.now() });

// 2. Hana — letter ready and a link sent: open it on a phone and fill it in
const H = "demo-hire-hana";
const token = crypto.randomBytes(24).toString("base64url");
const hash = crypto.createHash("sha256").update(token).digest("hex");
await hires.doc(H).set({
  firstName: "Hana", lastName: "Lim", phone: "012-777 8888", role: "waiter", department: "Front", startDate: addDays(TODAY, 5), basicSalary: 1800,
  status: "sent", letterReady: true, linkHash: hash, link: { expiresAt: iso(addDays(TODAY, 7)), sentAt: iso(TODAY, "08:00"), by: { uid: MGR.uid, name: MGR.name } }, ...created,
});
await hires.doc(H).collection("letter").doc("current").set({ ...letterFor("Hana Lim", "Waiter / Server", "1800.00", addDays(TODAY, 5)), savedAt: Timestamp.now() });
await db.doc(`joinLinks/${hash}`).set({ companyId: CO, branchId: KL, hireId: H, expiresAt: iso(addDays(TODAY, 7)), usedAt: null, createdAt: iso(TODAY, "08:00") });

// 3. Arif — just added: prepare the letter, make the link
await hires.doc("demo-hire-arif").set({ firstName: "Arif", lastName: "Hakim", phone: "012-999 1111", role: "kitchenHelper", department: "Kitchen", startDate: addDays(TODAY, 10), basicSalary: 1500, status: "draft", letterReady: false, ...created });

// ── the guide and the login buttons ─────────────────────────────────────────
const accountsFile = path.join(LOCAL_DIR, "DEV_ACCOUNTS.md");
fs.writeFileSync(accountsFile, fs.readFileSync(accountsFile, "utf8").trimEnd() + "\n" + NEW_LOGINS.map((p) => `| staff | ${p.username} | ${p.firstName} ${p.lastName} | Demo Branch KL |`).join("\n") + "\n");
const guideFile = path.join(LOCAL_DIR, "DEMO_GUIDE.md");
fs.appendFileSync(guideFile, `
## Today at Demo Branch KL (${TODAY}) — Ops, tasks, new hires

- **Ali** has today off (weekly day off): his opening check waits for someone (kl_supervisor → Ops → Give).
- **On shift:** Sam in 07:56 (on time), Siti in 10:12 (12 min late), Kumar not in (due 09:00 — late), Nora starts 14:00, Ali off. Siti is on leave tomorrow.
- **Tasks:** Opening check (rota: Ali every day), Clean the fryer (Sam, done today), Count the drinks stock (Nora), Get the kitchen tap fixed (supervisor, urgent, due tomorrow).
- **Issues:** Freezer not cold enough (urgent, no one yet), Card machine is slow (supervisor), Hand soap (resolved).
- **To decide:** Ali's RM 200 advance (he already owes RM 100), Sam's leave on ${nextOff} (Ali is off that day), Kumar's RM 150 advance.
- **New hires:** Faiz Rahman — filled in and signed (check, then Accept); Hana Lim — link sent; Arif Hakim — just added.
- **Hana's join link:** \`/join/${token}\` — open \`http://<this computer's Wi-Fi address>:3000/join/${token}\` on a phone.
- New staff app logins: **sam**, **nora** (same password as the rest).
`);
fs.writeFileSync(path.join(LOCAL_DIR, "JOIN_LINK.txt"), `/join/${token}\n`);
console.log(`Extras: 2 staff logins, shifts and days off, today's punches, 4 tasks, 3 issues, leave and an advance, 3 new hires — Hana's link: /join/${token}`);
