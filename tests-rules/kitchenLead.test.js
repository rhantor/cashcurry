// The kitchen lead (16 Nov 2026): orders, takes goods in and counts stock.
// Their orders wait for a manager's approval before they go to the supplier;
// they take goods in only on a sent order; a bill that costs more than the
// order waits for the books. Never sales, costs or pay.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import fs from "node:fs";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";

const CO = "co";
const B = `companies/${CO}/branches/kl`;
let env;
const PEOPLE = {
  klManager: { role: "manager", branchId: "kl" },
  klAccountant: { role: "accountant", branchId: "kl" },
  klSupervisor: { role: "supervisor", branchId: "kl" },
  klKitchen: { role: "kitchenLead", branchId: "kl" },
  pjKitchen: { role: "kitchenLead", branchId: "pj" },
};
const db = (uid) => env.authenticatedContext(uid).firestore();
const ok = (p) => p.then(() => true, () => false);
const PO = (id) => `${B}/requisitions/${id}`;
const order = (over = {}) => ({ vendorId: "v1", vendorName: "V", items: [{ itemId: "i1", requestedQty: 10, estPrice: 5 }], totalEst: 50, status: "Pending", createdBy: "klKitchen", createdByRole: "kitchenLead", approvedBy: "", ...over });

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
    await d.doc(`companies/${CO}/vendors/v1`).set({ name: "V", currentBalance: 0, totalBilled: 0 });
    await d.doc(PO("mine")).set(order());
    await d.doc(PO("approved")).set(order({ status: "Approved", approvedBy: "klManager" }));
    await d.doc(PO("sent")).set(order({ status: "Sent", approvedBy: "klManager" }));
    await d.doc(PO("managers")).set(order({ status: "Sent", createdBy: "klManager", createdByRole: "manager" }));
  });
});

// receive an order and raise its bill in one write, as the app does
// (each time a new bill, as the app does)
const receive = (uid, poId, total, status = "unpaid", billId = `bill-${poId}`) => {
  const d = db(uid);
  const batch = d.batch();
  batch.update(d.doc(PO(poId)), { status: "Received", billId, finalTotal: total, billWaiting: status === "waiting" });
  batch.set(d.doc(`${B}/vendorBills/${billId}`), { vendorId: "v1", total, paid: 0, balance: status === "waiting" ? 0 : total, status, sourcePoId: poId });
  return batch.commit();
};

describe("the kitchen lead's orders", () => {
  it("start as theirs, waiting for approval", async () => {
    expect(await ok(db("klKitchen").doc(PO("n1")).set(order()))).toBe(true);
    expect(await ok(db("klKitchen").doc(PO("n2")).set(order({ createdByRole: "manager" })))).toBe(false);
    expect(await ok(db("klKitchen").doc(PO("n3")).set(order({ status: "Approved", approvedBy: "klKitchen" })))).toBe(false);
    expect(await ok(db("pjKitchen").doc(PO("n4")).set(order()))).toBe(false);
  });

  it("go to the supplier only once a manager approves", async () => {
    expect(await ok(db("klKitchen").doc(PO("mine")).update({ status: "Sent" }))).toBe(false);
    expect(await ok(db("klSupervisor").doc(PO("mine")).update({ status: "Sent" }))).toBe(false);
    expect(await ok(db("klKitchen").doc(PO("mine")).update({ status: "Approved", approvedBy: "klKitchen" }))).toBe(false);
    expect(await ok(db("klManager").doc(PO("mine")).update({ status: "Approved", approvedBy: "klManager" }))).toBe(true);
    expect(await ok(db("klKitchen").doc(PO("mine")).update({ status: "Sent" }))).toBe(true);
  });

  it("changing an approved order clears the approval", async () => {
    expect(await ok(db("klKitchen").doc(PO("approved")).update({ items: [{ itemId: "i1", requestedQty: 40, estPrice: 5 }], totalEst: 200 }))).toBe(false);
    expect(await ok(db("klKitchen").doc(PO("approved")).update({ items: [{ itemId: "i1", requestedQty: 40, estPrice: 5 }], totalEst: 200, status: "Pending", approvedBy: "" }))).toBe(true);
    expect(await ok(db("klKitchen").doc(PO("mine")).update({ createdByRole: "manager" }))).toBe(false);
  });
});

describe("goods in, by the kitchen lead", () => {
  it("only on a sent order", async () => {
    expect(await ok(receive("klKitchen", "approved", 50))).toBe(false);
    expect(await ok(receive("klKitchen", "mine", 50))).toBe(false);
    expect(await ok(receive("klKitchen", "sent", 50))).toBe(true);
  });

  it("the bill counts at once up to the order's total; dearer, it waits", async () => {
    expect(await ok(receive("klKitchen", "sent", 60))).toBe(false);
    expect(await ok(receive("klKitchen", "sent", 60, "waiting"))).toBe(true);
    // a manager's sent order, received by the kitchen
    expect(await ok(receive("klKitchen", "managers", 45))).toBe(true);
  });

  it("a bill of their own waits; they never mark one owed or paid", async () => {
    expect(await ok(db("klKitchen").doc(`${B}/vendorBills/b1`).set({ vendorId: "v1", total: 9, paid: 0, balance: 9, status: "unpaid" }))).toBe(false);
    expect(await ok(db("klKitchen").doc(`${B}/vendorBills/b2`).set({ vendorId: "v1", total: 9, paid: 0, balance: 0, status: "waiting" }))).toBe(true);
    expect(await ok(db("klKitchen").doc(`${B}/vendorBills/b2`).update({ status: "unpaid", balance: 9 }))).toBe(false);
    // the same hole closed for a supervisor
    expect(await ok(db("klSupervisor").doc(`${B}/vendorBills/b3`).set({ vendorId: "v1", total: 9, paid: 0, balance: 9, status: "unpaid" }))).toBe(false);
  });

  it("the accountant sends a dearer bill back and the order opens to receive again", async () => {
    expect(await ok(receive("klKitchen", "sent", 60, "waiting"))).toBe(true);
    const d = db("klAccountant");
    const batch = d.batch();
    batch.update(d.doc(`${B}/vendorBills/bill-sent`), { status: "rejected", approval: { status: "rejected", reason: "check price" } });
    batch.update(d.doc(PO("sent")), { status: "Sent", billId: "", billWaiting: false, receivedItems: [], finalTotal: 0, receiveSentBack: { reason: "check price" } });
    expect(await ok(batch.commit())).toBe(true);
    expect(await ok(receive("klKitchen", "sent", 50, "unpaid", "bill-sent-2"))).toBe(true);
  });
});

describe("what else the kitchen lead does", () => {
  it("counts stock and sets the minimums", async () => {
    expect(await ok(db("klKitchen").doc(`${B}/stockTakes/c1`).set({ date: "2026-11-16", vendorId: "v1", lines: [], by: { uid: "klKitchen" } }))).toBe(true);
    expect(await ok(db("klKitchen").doc(`${B}/stockSettings/main`).set({ startDate: "2026-11-16", min: { i1: 3 } }))).toBe(true);
  });

  it("never sales, costs, cash or the books", async () => {
    expect(await ok(db("klKitchen").doc(`${B}/sales/s1`).set({ date: "2026-11-16", total: 1 }))).toBe(false);
    expect(await ok(db("klKitchen").doc(`${B}/costs/c1`).set({ date: "2026-11-16", amount: 1 }))).toBe(false);
    expect(await ok(db("klKitchen").doc(`${B}/vendorPayments/p1`).set({ vendorId: "v1", total: 1 }))).toBe(false);
    expect(await ok(db("klKitchen").doc(`${B}/vendorBills/any`).get())).toBe(false);
  });
});
