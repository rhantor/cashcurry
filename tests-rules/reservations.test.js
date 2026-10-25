// Reservation deposit receipts in the database rules: everyone at the branch
// makes one (in their own name, held, with an amount) and draws its number;
// only the status changes afterwards — by those who manage receipts or by
// whoever made it; nothing is ever deleted.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import fs from "node:fs";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";

const CO = "co";
const B = `companies/${CO}/branches/kl`;
const R = `${B}/reservationDeposits`;
let env;
const PEOPLE = {
  klManager: { role: "manager", branchId: "kl" },
  klCashier: { role: "cashier", branchId: "kl" },
  klCashier2: { role: "cashier", branchId: "kl" },
  klStaff: { role: "staff", branchId: "kl", staffId: "st1" },
  pjCashier: { role: "cashier", branchId: "pj" },
};
const db = (uid) => env.authenticatedContext(uid).firestore();
const ok = (p) => p.then(() => true, () => false);
const receipt = (uid, extra = {}) => ({ receiptNo: "RSV-KL-2610-0001", customerName: "Aisha", amount: 200, status: "held", createdBy: { uid }, ...extra });

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-rules-test",
    firestore: { rules: fs.readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: Number(process.env.FIRESTORE_EMULATOR_PORT || 8080) },
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
    await d.doc(`${R}/r1`).set(receipt("klCashier"));
  });
});

describe("making a receipt", () => {
  it("a cashier makes one in their own name and draws its number", async () => {
    expect(await ok(db("klCashier").doc(`${R}/n1`).set(receipt("klCashier")))).toBe(true);
    expect(await ok(db("klCashier").doc(`${B}/counters/reservationDeposits`).set({ 2610: 1 }, { merge: true }))).toBe(true);
    expect(await ok(db("klCashier").collection(R).get())).toBe(true);
  });
  it("a cashier can't touch the other counters", async () => {
    expect(await ok(db("klCashier").doc(`${B}/counters/purchaseOrders`).set({ 2610: 9 }))).toBe(false);
  });
  it("not in someone else's name, not already used, not without an amount", async () => {
    expect(await ok(db("klCashier").doc(`${R}/n2`).set(receipt("klManager")))).toBe(false);
    expect(await ok(db("klCashier").doc(`${R}/n3`).set(receipt("klCashier", { status: "used" })))).toBe(false);
    expect(await ok(db("klCashier").doc(`${R}/n4`).set(receipt("klCashier", { amount: 0 })))).toBe(false);
  });
  it("not staff, not another branch", async () => {
    expect(await ok(db("klStaff").doc(`${R}/n5`).set(receipt("klStaff")))).toBe(false);
    expect(await ok(db("pjCashier").doc(`${R}/n6`).set(receipt("pjCashier")))).toBe(false);
    expect(await ok(db("pjCashier").doc(`${R}/r1`).get())).toBe(false);
  });
});

describe("after it is made", () => {
  it("whoever made it, or a manager, changes its status — only that", async () => {
    expect(await ok(db("klCashier").doc(`${R}/r1`).update({ status: "used", statusNote: "", updatedAt: 1 }))).toBe(true);
    expect(await ok(db("klManager").doc(`${R}/r1`).update({ status: "refunded", statusNote: "asked", updatedAt: 2 }))).toBe(true);
    expect(await ok(db("klManager").doc(`${R}/r1`).update({ amount: 1, updatedAt: 3 }))).toBe(false);
    expect(await ok(db("klManager").doc(`${R}/r1`).update({ status: "paid", updatedAt: 4 }))).toBe(false);
  });
  it("another cashier can't change it; nobody deletes it", async () => {
    expect(await ok(db("klCashier2").doc(`${R}/r1`).update({ status: "cancelled", updatedAt: 5 }))).toBe(false);
    expect(await ok(db("klManager").doc(`${R}/r1`).delete())).toBe(false);
  });
});
