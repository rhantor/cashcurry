// The staff app's settings and payslips (roadmap 4.6, docs/STAFF_APP.md) in
// the database and storage rules: staff change their own contact number,
// photo and emergency contact — nothing they joined with — and read only
// their own payslip copies, which payroll writes.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import fs from "node:fs";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";

const CO = "co";
const B = `companies/${CO}/branches/kl`;
let env;
const PEOPLE = {
  owner: { role: "owner" },
  klManager: { role: "manager", branchId: "kl" },
  klAccountant: { role: "accountant", branchId: "kl" },
  klCashier: { role: "cashier", branchId: "kl" },
  ali: { role: "staff", branchId: "kl", staffId: "st-ali" },
  kumar: { role: "staff", branchId: "kl", staffId: "st-kumar" },
};
const db = (uid) => env.authenticatedContext(uid).firestore();
const files = (uid) => env.authenticatedContext(uid).storage();
const ok = (p) => p.then(() => true, () => false);

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-rules-test",
    firestore: { rules: fs.readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: Number(process.env.FIRESTORE_EMULATOR_PORT || 8080) },
    storage: { rules: fs.readFileSync("storage.rules", "utf8"), host: "127.0.0.1", port: Number(process.env.STORAGE_EMULATOR_PORT || 9199) },
  });
});
afterAll(async () => env?.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    for (const [uid, p] of Object.entries(PEOPLE)) await d.doc(`users/${uid}`).set({ companyId: CO, ...p });
    await d.doc(`companies/${CO}`).set({ name: "Co", ownerUid: "owner" });
    await d.doc(B).set({ name: "kl" });
    await d.doc(`${B}/staff/st-ali`).set({ uid: "ali", firstName: "Ali", lastName: "H", role: "staff", phone: "012-000 0101", pinCode: "1234" });
    await d.doc(`${B}/staff/st-kumar`).set({ uid: "kumar", firstName: "Kumar", phone: "012-000 0202" });
    await d.doc(`${B}/staffPrivate/st-ali`).set({ basicSalary: "1800", icNumber: "900101145678", emergencyContactName: "" });
    await d.doc(`${B}/staffPrivate/st-ali/payslips/run1`).set({ runId: "run1", period: "2026-09", netPay: 1750, status: "paid" });
    await d.doc(`${B}/staffPrivate/st-kumar/payslips/run1`).set({ runId: "run1", period: "2026-09", netPay: 1500, status: "paid" });
  });
});

describe("staff change their own contact details", () => {
  it("their contact number and photo on their staff record", async () => {
    expect(await ok(db("ali").doc(`${B}/staff/st-ali`).update({ phone: "012-999 0000" }))).toBe(true);
    expect(await ok(db("ali").doc(`${B}/staff/st-ali`).update({ photoUrl: "https://x/p.jpg" }))).toBe(true);
    expect(await ok(db("ali").doc(`${B}/staff/st-ali`).update({ photoUrl: null }))).toBe(true);
  });
  it("never their name, job, kiosk PIN or link to the login", async () => {
    expect(await ok(db("ali").doc(`${B}/staff/st-ali`).update({ firstName: "Boss" }))).toBe(false);
    expect(await ok(db("ali").doc(`${B}/staff/st-ali`).update({ role: "manager" }))).toBe(false);
    expect(await ok(db("ali").doc(`${B}/staff/st-ali`).update({ pinCode: "0000" }))).toBe(false);
    expect(await ok(db("ali").doc(`${B}/staff/st-ali`).update({ uid: "kumar" }))).toBe(false);
    expect(await ok(db("ali").doc(`${B}/staff/st-ali`).update({ phone: "1", basicSalary: "9999" }))).toBe(false);
  });
  it("never someone else's record", async () => {
    expect(await ok(db("ali").doc(`${B}/staff/st-kumar`).update({ phone: "012-999 0000" }))).toBe(false);
    expect(await ok(db("ali").doc(`${B}/staffPrivate/st-kumar`).update({ emergencyContactName: "x" }))).toBe(false);
  });
  it("their emergency contact in their private details — not pay, IC or bank", async () => {
    expect(await ok(db("ali").doc(`${B}/staffPrivate/st-ali`).update({ emergencyContactName: "Sister", emergencyContactPhone: "012" }))).toBe(true);
    expect(await ok(db("ali").doc(`${B}/staffPrivate/st-ali`).update({ basicSalary: "9999" }))).toBe(false);
    expect(await ok(db("ali").doc(`${B}/staffPrivate/st-ali`).update({ icNumber: "1" }))).toBe(false);
    expect(await ok(db("ali").doc(`${B}/staffPrivate/st-ali`).update({ bankAccountNumber: "1" }))).toBe(false);
  });
  it("can start their private details with only an emergency contact", async () => {
    await env.withSecurityRulesDisabled((ctx) => ctx.firestore().doc(`${B}/staffPrivate/st-ali`).delete());
    expect(await ok(db("ali").doc(`${B}/staffPrivate/st-ali`).set({ emergencyContactName: "Sister", emergencyContactPhone: "012" }))).toBe(true);
    await env.withSecurityRulesDisabled((ctx) => ctx.firestore().doc(`${B}/staffPrivate/st-ali`).delete());
    expect(await ok(db("ali").doc(`${B}/staffPrivate/st-ali`).set({ emergencyContactName: "x", basicSalary: "9999" }))).toBe(false);
  });
  it("other office roles still can't edit staff records", async () => {
    expect(await ok(db("klCashier").doc(`${B}/staff/st-ali`).update({ phone: "1" }))).toBe(false);
    expect(await ok(db("klManager").doc(`${B}/staff/st-ali`).update({ firstName: "Ali B" }))).toBe(true);
  });
});

describe("payslips", () => {
  it("staff read their own payslips, never a colleague's", async () => {
    expect(await ok(db("ali").collection(`${B}/staffPrivate/st-ali/payslips`).get())).toBe(true);
    expect(await ok(db("ali").doc(`${B}/staffPrivate/st-kumar/payslips/run1`).get())).toBe(false);
    expect(await ok(db("ali").collection(`${B}/staffPrivate/st-kumar/payslips`).get())).toBe(false);
  });
  it("staff can't write payslips; payroll can", async () => {
    expect(await ok(db("ali").doc(`${B}/staffPrivate/st-ali/payslips/run1`).update({ netPay: 9999 }))).toBe(false);
    expect(await ok(db("klManager").doc(`${B}/staffPrivate/st-ali/payslips/run2`).set({ runId: "run2", netPay: 1 }))).toBe(true);
    expect(await ok(db("klManager").doc(`${B}/staffPrivate/st-ali/payslips/run1`).delete())).toBe(true);
  });
  it("the bookkeeper reads them; a cashier doesn't", async () => {
    expect(await ok(db("klAccountant").doc(`${B}/staffPrivate/st-ali/payslips/run1`).get())).toBe(true);
    expect(await ok(db("klCashier").doc(`${B}/staffPrivate/st-ali/payslips/run1`).get())).toBe(false);
  });
});

describe("their own photo", () => {
  const put = (uid, path, bytes, type = "image/jpeg") => files(uid).ref(path).put(new Uint8Array(bytes), { contentType: type });
  it("goes in their own folder, an image up to 5 MB", async () => {
    expect(await ok(put("ali", `staffPhotos/${CO}/kl/self/st-ali/1.jpg`, 100))).toBe(true);
    expect(await ok(put("ali", `staffPhotos/${CO}/kl/self/st-kumar/1.jpg`, 100))).toBe(false);
    expect(await ok(put("ali", `staffPhotos/${CO}/kl/self/st-ali/x.pdf`, 100, "application/pdf"))).toBe(false);
    expect(await ok(put("ali", `staffPhotos/${CO}/kl/self/st-ali/big.jpg`, 5 * 1024 * 1024 + 1))).toBe(false);
  });
  it("staff still can't upload into the managers' staff photos", async () => {
    expect(await ok(put("ali", `staffPhotos/${CO}/kl/st-ali-1.jpg`, 100))).toBe(false);
  });
});
