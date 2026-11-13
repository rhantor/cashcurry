// A new vendor bill from a supervisor waits for approval (13 Nov 2026): the
// supervisor may add it, but only someone who keeps the books approves it and
// raises what the vendor is owed. Another branch sees none of it.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import fs from "node:fs";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { increment } from "firebase/firestore";

const CO = "co";
const B = `companies/${CO}/branches/kl`;
const V = `companies/${CO}/vendors/v1`;
let env;
const PEOPLE = {
  klManager: { role: "manager", branchId: "kl" },
  klAccountant: { role: "accountant", branchId: "kl" },
  klSupervisor: { role: "supervisor", branchId: "kl" },
  klInCharge: { role: "inCharge", branchId: "kl" },
  klCashier: { role: "cashier", branchId: "kl" },
  pjManager: { role: "manager", branchId: "pj" },
};
const db = (uid) => env.authenticatedContext(uid).firestore();
const ok = (p) => p.then(() => true, () => false);
const waiting = (uid) => ({ vendorId: "v1", total: 120, paid: 0, balance: 0, status: "waiting", approval: { status: "waiting" }, createdBy: { uid } });
// approving: the bill becomes owed and the vendor's totals rise, together
const approve = (uid, id = "w1") => {
  const d = db(uid);
  const b = d.batch();
  b.update(d.doc(`${B}/vendorBills/${id}`), { status: "unpaid", balance: 120, approval: { status: "approved", by: { uid } } });
  b.update(d.doc(V), { currentBalance: increment(120), totalBilled: increment(120), updatedAt: 1 });
  return b.commit();
};

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
    await d.doc(V).set({ name: "V", currentBalance: 0, totalBilled: 0 });
    await d.doc(`${B}/vendorBills/w1`).set(waiting("klSupervisor"));
  });
});

describe("a supervisor's new vendor bill", () => {
  it("a supervisor or in-charge adds one, waiting; a cashier and another branch can't", async () => {
    expect(await ok(db("klSupervisor").doc(`${B}/vendorBills/n1`).set(waiting("klSupervisor")))).toBe(true);
    expect(await ok(db("klInCharge").doc(`${B}/vendorBills/n2`).set(waiting("klInCharge")))).toBe(true);
    expect(await ok(db("klCashier").doc(`${B}/vendorBills/n3`).set(waiting("klCashier")))).toBe(false);
    expect(await ok(db("pjManager").doc(`${B}/vendorBills/n4`).set(waiting("pjManager")))).toBe(false);
  });
  it("the supervisor sees it but can't approve it themselves", async () => {
    expect(await ok(db("klSupervisor").doc(`${B}/vendorBills/w1`).get())).toBe(true);
    expect(await ok(approve("klSupervisor"))).toBe(false);
    expect(await ok(db("klInCharge").doc(`${B}/vendorBills/w1`).update({ status: "unpaid", balance: 120 }))).toBe(false);
  });
  it("the manager or accountant approves it, raising what the vendor is owed", async () => {
    expect(await ok(approve("klManager"))).toBe(true);
    await env.withSecurityRulesDisabled(async (ctx) => {
      expect((await ctx.firestore().doc(V).get()).data().currentBalance).toBe(120);
    });
  });
  it("the accountant sends it back", async () => {
    expect(await ok(db("klAccountant").doc(`${B}/vendorBills/w1`).update({ status: "rejected", approval: { status: "rejected", reason: "wrong" } }))).toBe(true);
  });
});
