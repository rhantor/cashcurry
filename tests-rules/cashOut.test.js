// "Give cash to buy" (17 Nov 2026): whoever hands out pay-outs marks the order with the cash
// out for it — only pointing at their own pay-out for this very order, made in the same write —
// and clears it when the pay-out is taken back. Nothing else on the order.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import fs from "node:fs";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";

const CO = "co";
const B = `companies/${CO}/branches/kl`;
let env;
const PEOPLE = {
  klCashier: { role: "cashier", branchId: "kl" },
  klSupervisor: { role: "supervisor", branchId: "kl" },
  klKitchen: { role: "kitchenLead", branchId: "kl" },
};
const db = (uid) => env.authenticatedContext(uid).firestore();
const ok = (p) => p.then(() => true, () => false);
const PO = `${B}/requisitions/po1`;
const out = (uid, poId = "po1") => ({ kind: "out", status: "open", date: "2026-11-17", amount: 1500, to: { name: "Ali" }, purpose: "Buy", forPo: { poId, poNo: "PO-1", totalEst: 0 }, by: { uid }, createdBy: { uid } });

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
    await d.doc(PO).set({ vendorId: "v1", status: "Pending", items: [], totalEst: 0, createdByRole: "owner" });
    await d.doc(`${B}/requisitions/done`).set({ vendorId: "v1", status: "Received", items: [] });
  });
});

const handOut = (uid, payout, poPath = PO) => {
  const d = db(uid);
  const b = d.batch();
  const ref = d.collection(`${B}/payouts`).doc();
  b.set(ref, payout(uid));
  b.update(d.doc(poPath), { cashOut: { payoutId: ref.id, amount: 1500, to: "Ali", date: "2026-11-17", by: { uid } } });
  return b.commit().then(() => ref.id);
};

describe("cash out to buy an order", () => {
  it("the cashier marks the order with their own pay-out for it", async () => {
    expect(await ok(handOut("klCashier", (u) => out(u)))).toBe(true);
  });

  it("not with a pay-out for another order, nor on a received order", async () => {
    expect(await ok(handOut("klCashier", (u) => out(u, "other")))).toBe(false);
    expect(await ok(handOut("klCashier", (u) => out(u, "done"), `${B}/requisitions/done`))).toBe(false);
  });

  it("the cashier changes nothing else on the order", async () => {
    expect(await ok(db("klCashier").doc(PO).update({ status: "Sent" }))).toBe(false);
    expect(await ok(db("klCashier").doc(PO).update({ cashOut: { payoutId: "made-up", amount: 1 } }))).toBe(false);
  });

  it("taken back: the mark is cleared", async () => {
    const id = await handOut("klCashier", (u) => out(u));
    const d = db("klCashier");
    const b = d.batch();
    b.delete(d.doc(`${B}/payouts/${id}`));
    b.update(d.doc(PO), { cashOut: null });
    expect(await ok(b.commit())).toBe(true);
  });

  it("the kitchen lead can't hand out money", async () => {
    expect(await ok(handOut("klKitchen", (u) => out(u)))).toBe(false);
  });
});
