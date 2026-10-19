// Pay-outs and their bills (roadmap 4.10) in the database rules: till roles
// hand money out and bring bills back; someone in charge approves or sends a
// bill back — never one they handed out or brought back; approved bills are
// final here (they became costs).
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import fs from "node:fs";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";

const CO = "co";
const B = `companies/${CO}/branches/kl`;
const P = `${B}/payouts`;
let env;
const PEOPLE = {
  owner: { role: "owner" },
  klManager: { role: "manager", branchId: "kl" },
  klInCharge: { role: "inCharge", branchId: "kl" },
  klAccountant: { role: "accountant", branchId: "kl" },
  klSupervisor: { role: "supervisor", branchId: "kl" },
  klCashier: { role: "cashier", branchId: "kl" },
  klStaff: { role: "staff", branchId: "kl", staffId: "st1" },
  pjManager: { role: "manager", branchId: "pj" },
};
const db = (uid) => env.authenticatedContext(uid).firestore();
const ok = (p) => p.then(() => true, () => false);
const out = (uid, extra = {}) => ({ kind: "out", date: "2026-10-10", amount: 100, to: { name: "Ali" }, purpose: "Gas", status: "open", by: { uid }, ...extra });
const settle = (uid, extra = {}) => ({ kind: "settle", payoutId: "p1", date: "2026-10-11", floatAmount: 100, billAmount: 80, change: 20, status: "pending", by: { uid }, payoutBy: { uid }, ...extra });

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
    await d.doc(`${P}/p1`).set(out("klCashier"));
    await d.doc(`${P}/s1`).set(settle("klCashier"));
    await d.doc(`${P}/done`).set(settle("klCashier", { status: "approved" }));
    await d.doc(`${P}/back`).set(settle("klCashier", { status: "rejected" }));
  });
});

describe("handing money out", () => {
  it("cashier, supervisor, in-charge and managers hand out; the bookkeeper and staff don't", async () => {
    for (const u of ["klCashier", "klSupervisor", "klInCharge", "klManager", "owner"]) expect(await ok(db(u).doc(`${P}/n-${u}`).set(out(u)))).toBe(true);
    for (const u of ["klAccountant", "klStaff", "pjManager"]) expect(await ok(db(u).doc(`${P}/n-${u}`).set(out(u)))).toBe(false);
  });
  it("only in their own name, and only as open", async () => {
    expect(await ok(db("klCashier").doc(`${P}/x`).set(out("klManager")))).toBe(false);
    expect(await ok(db("klCashier").doc(`${P}/y`).set(out("klCashier", { status: "billed" })))).toBe(false);
  });
  it("a bill is brought back as pending; the pay-out is marked billed", async () => {
    expect(await ok(db("klCashier").doc(`${P}/s2`).set(settle("klCashier")))).toBe(true);
    expect(await ok(db("klCashier").doc(`${P}/s3`).set(settle("klCashier", { status: "approved" })))).toBe(false);
    expect(await ok(db("klCashier").doc(`${P}/p1`).update({ status: "billed", settleId: "s2" }))).toBe(true);
  });
  it("a pay-out's amount can't be changed after the fact", async () => {
    expect(await ok(db("klCashier").doc(`${P}/p1`).update({ amount: 10 }))).toBe(false);
  });
  it("one made by mistake can be taken back by whoever made it while open", async () => {
    expect(await ok(db("klSupervisor").doc(`${P}/p1`).delete())).toBe(false);
    expect(await ok(db("klCashier").doc(`${P}/p1`).delete())).toBe(true);
  });
});

describe("approving bills", () => {
  it("someone in charge approves or sends back", async () => {
    expect(await ok(db("klInCharge").doc(`${P}/s1`).update({ status: "approved", review: { by: { uid: "klInCharge" } } }))).toBe(true);
  });
  it("a manager sends one back with a reason", async () => {
    expect(await ok(db("klManager").doc(`${P}/s1`).update({ status: "rejected", review: { note: "blurry" } }))).toBe(true);
  });
  it("not the cashier or the bookkeeper; not one you handed out or brought back", async () => {
    expect(await ok(db("klCashier").doc(`${P}/s1`).update({ status: "approved" }))).toBe(false);
    expect(await ok(db("klAccountant").doc(`${P}/s1`).update({ status: "approved" }))).toBe(false);
    await env.withSecurityRulesDisabled((ctx) => ctx.firestore().doc(`${P}/own`).set(settle("klCashier", { payoutBy: { uid: "klManager" } })));
    expect(await ok(db("klManager").doc(`${P}/own`).update({ status: "approved" }))).toBe(false);
  });
  it("a correction may change the amount and category, never whose it was or the float", async () => {
    expect(await ok(db("klManager").doc(`${P}/s1`).update({ status: "approved", billAmount: 75, category: "Drinks" }))).toBe(true);
    await env.withSecurityRulesDisabled((ctx) => ctx.firestore().doc(`${P}/s1`).set(settle("klCashier")));
    expect(await ok(db("klManager").doc(`${P}/s1`).update({ status: "approved", floatAmount: 50 }))).toBe(false);
  });
  it("an approved bill is final", async () => {
    expect(await ok(db("klManager").doc(`${P}/done`).update({ billAmount: 1 }))).toBe(false);
    expect(await ok(db("klManager").doc(`${P}/done`).update({ status: "rejected" }))).toBe(false);
  });
  it("one sent back is tried again by the one who brings it", async () => {
    expect(await ok(db("klCashier").doc(`${P}/back`).update({ status: "pending", billAmount: 85, change: 15 }))).toBe(true);
  });
  it("approving makes a cost; its voucher comes already decided only for a pay-out", async () => {
    const cost = { date: "2026-10-11", amount: 80, category: "Cooking gas", paidFromOffice: "front", voucher: { status: "approved", reason: "stall" } };
    expect(await ok(db("klInCharge").doc(`${B}/costs/c1`).set({ ...cost, meta: { type: "payout", payoutId: "p1" } }))).toBe(true);
    expect(await ok(db("klInCharge").doc(`${B}/costs/c2`).set(cost))).toBe(false);
    expect(await ok(db("klAccountant").doc(`${B}/costs/c3`).set({ ...cost, meta: { type: "payout" } }))).toBe(false);
  });
});

describe("who sees them", () => {
  it("till roles, approvers and those who see reports; not staff or another branch", async () => {
    for (const u of ["klCashier", "klInCharge", "klAccountant", "owner"]) expect(await ok(db(u).doc(`${P}/p1`).get())).toBe(true);
    for (const u of ["klStaff", "pjManager"]) expect(await ok(db(u).doc(`${P}/p1`).get())).toBe(false);
  });
});

describe("bill photos (storage)", () => {
  const files = (uid) => env.authenticatedContext(uid).storage();
  const put = (uid, path, bytes = 100, type = "image/jpeg") => files(uid).ref(path).put(new Uint8Array(bytes), { contentType: type });
  it("into their own folder: images or PDF up to 10 MB", async () => {
    expect(await ok(put("klCashier", `payouts/${CO}/kl/klCashier/bill.jpg`))).toBe(true);
    expect(await ok(put("klInCharge", `payouts/${CO}/kl/klInCharge/bill.pdf`, 100, "application/pdf"))).toBe(true);
    expect(await ok(put("klCashier", `payouts/${CO}/kl/klManager/bill.jpg`))).toBe(false);
    expect(await ok(put("klCashier", `payouts/${CO}/kl/klCashier/x.zip`, 100, "application/zip"))).toBe(false);
    expect(await ok(put("klAccountant", `payouts/${CO}/kl/klAccountant/bill.jpg`))).toBe(false);
    expect(await ok(put("pjManager", `payouts/${CO}/kl/pjManager/bill.jpg`))).toBe(false);
  });
});
