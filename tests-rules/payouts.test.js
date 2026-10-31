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

describe("who checks whose money (owner, 31 Oct)", () => {
  const voucher = (uid) => ({ date: "2026-10-11", amount: 40, category: "Food", paidFromOffice: "front", createdBy: { uid }, voucher: { status: "pending", reason: "stall", by: { uid } } });
  const seed = (path, data) => env.withSecurityRulesDisabled((ctx) => ctx.firestore().doc(path).set(data));
  it("a manager's voucher: not in-charge — someone above, or a company role", async () => {
    await seed(`${B}/costs/vm`, voucher("klManager"));
    expect(await ok(db("klInCharge").doc(`${B}/costs/vm`).update({ "voucher.status": "approved" }))).toBe(false);
    expect(await ok(db("owner").doc(`${B}/costs/vm`).update({ "voucher.status": "approved" }))).toBe(true);
  });
  it("in-charge's voucher: a manager approves; a cashier's: in-charge does", async () => {
    await seed(`${B}/costs/vi`, voucher("klInCharge"));
    expect(await ok(db("klManager").doc(`${B}/costs/vi`).update({ "voucher.status": "approved" }))).toBe(true);
    await seed(`${B}/costs/vc`, voucher("klCashier"));
    expect(await ok(db("klInCharge").doc(`${B}/costs/vc`).update({ "voucher.status": "rejected", "voucher.note": "ask for a receipt" }))).toBe(true);
  });
  it("a company role's own voucher is approved as it is saved; in-charge may not save one approved", async () => {
    const own = (uid) => ({ ...voucher(uid), voucher: { status: "approved", reason: "stall", by: { uid }, decidedBy: { uid }, auto: true } });
    expect(await ok(db("owner").doc(`${B}/costs/vo`).set(own("owner")))).toBe(true);
    expect(await ok(db("klInCharge").doc(`${B}/costs/vx`).set(own("klInCharge")))).toBe(false);
  });
  it("a bill: senior to whoever handed it out and brought it", async () => {
    await seed(`${P}/bm`, settle("klCashier", { payoutBy: { uid: "klManager" } }));
    expect(await ok(db("klInCharge").doc(`${P}/bm`).update({ status: "approved" }))).toBe(false);
    expect(await ok(db("owner").doc(`${P}/bm`).update({ status: "approved" }))).toBe(true);
    await seed(`${P}/bi`, settle("klInCharge"));
    expect(await ok(db("klManager").doc(`${P}/bi`).update({ status: "approved" }))).toBe(true);
  });
  it("a company role's own bill needs no one: they approve it as they bring it", async () => {
    await seed(`${P}/bo`, settle("owner"));
    expect(await ok(db("owner").doc(`${P}/bo`).update({ status: "approved" }))).toBe(true);
  });
});

describe("a manager's own up to the branch's limit (owner, 1 Nov)", () => {
  const SET = `${B}/settings/settings`;
  const own = (uid, amount) => ({ date: "2026-11-01", amount, category: "Food", paidFromOffice: "front", createdBy: { uid }, voucher: { status: "approved", reason: "stall", by: { uid }, decidedBy: { uid }, auto: true } });
  const seed = (path, data) => env.withSecurityRulesDisabled((ctx) => ctx.firestore().doc(path).set(data));
  it("up to RM 100 when the branch set nothing; not above, and not for in-charge", async () => {
    expect(await ok(db("klManager").doc(`${B}/costs/m80`).set(own("klManager", 80)))).toBe(true);
    expect(await ok(db("klManager").doc(`${B}/costs/m150`).set(own("klManager", 150)))).toBe(false);
    expect(await ok(db("klInCharge").doc(`${B}/costs/i20`).set(own("klInCharge", 20)))).toBe(false);
  });
  it("the branch's own limit counts", async () => {
    await seed(SET, { financeSales: { voucherLimit: 200 } });
    expect(await ok(db("klManager").doc(`${B}/costs/m150`).set(own("klManager", 150)))).toBe(true);
    await seed(SET, { financeSales: { voucherLimit: 50 } });
    expect(await ok(db("klManager").doc(`${B}/costs/m60`).set(own("klManager", 60)))).toBe(false);
  });
  it("one approved as saved can't grow past the limit afterwards", async () => {
    await seed(`${B}/costs/grow`, own("klManager", 80));
    expect(await ok(db("klManager").doc(`${B}/costs/grow`).update({ amount: 500 }))).toBe(false);
    expect(await ok(db("klManager").doc(`${B}/costs/grow`).update({ amount: 90 }))).toBe(true);
  });
  it("the limit is a money setting: not the manager's to change", async () => {
    await seed(SET, { financeSales: { voucherLimit: 100 }, other: { notes: "" } });
    expect(await ok(db("klManager").doc(SET).set({ financeSales: { voucherLimit: 5000 }, other: { notes: "" } }))).toBe(false);
    expect(await ok(db("klManager").doc(SET).update({ "other.notes": "hello" }))).toBe(true);
    expect(await ok(db("owner").doc(SET).update({ "financeSales.voucherLimit": 150 }))).toBe(true);
  });
  it("a manager's own bill up to the limit, handed out by them or someone junior", async () => {
    await seed(`${P}/mb`, settle("klManager"));
    expect(await ok(db("klManager").doc(`${P}/mb`).update({ status: "approved" }))).toBe(true);
    await seed(`${P}/mbBig`, settle("klManager", { billAmount: 150 }));
    expect(await ok(db("klManager").doc(`${P}/mbBig`).update({ status: "approved" }))).toBe(false);
    await seed(`${P}/mbJr`, settle("klManager", { payoutBy: { uid: "klInCharge" } }));
    expect(await ok(db("klManager").doc(`${P}/mbJr`).update({ status: "approved" }))).toBe(true);
    await seed(`${P}/mbUp`, settle("klManager", { payoutBy: { uid: "owner" } }));
    expect(await ok(db("klManager").doc(`${P}/mbUp`).update({ status: "approved" }))).toBe(false);
    await seed(`${P}/mbBack`, settle("klManager"));
    expect(await ok(db("klManager").doc(`${P}/mbBack`).update({ status: "rejected" }))).toBe(false);
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

describe("a pay-out spent at a supplier (Purchases)", () => {
  const V = `companies/${CO}/vendors/rice`;
  const VB = `${B}/vendorBills`;
  const VP = `${B}/vendorPayments`;
  const sup = { vendorId: "rice", vendorName: "Rice Co", mode: "pays", pays: [{ billId: "inv1", amount: 80 }] };
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const d = ctx.firestore();
      await d.doc(V).set({ name: "Rice Co", currentBalance: 500, totalBilled: 500, totalPaid: 0 });
      await d.doc(`${VB}/inv1`).set({ vendorId: "rice", invoiceNo: "INV-1", total: 500, paid: 0, balance: 500, status: "unpaid" });
      await d.doc(`${P}/sup`).set(settle("klCashier", { supplier: sup }));
    });
  });
  // the approver's one transaction, as lib/payouts/client.js approveSupplierNow writes it
  const approveAs = (uid, { settleId = "sup", vendorTweak = {}, billTweak = {} } = {}) => {
    const d = db(uid);
    const b = d.batch();
    b.update(d.doc(`${P}/${settleId}`), { status: "approved", billAmount: 80, change: 20, review: { by: { uid } }, vendorPaymentId: "vp1", costId: "c1" });
    b.update(d.doc(`${VB}/inv1`), { paid: 80, balance: 420, status: "partially_paid", lastPayoutSettleId: settleId, ...billTweak });
    b.set(d.doc(`${VP}/vp1`), { vendorId: "rice", total: 80, payoutSettleId: settleId });
    b.update(d.doc(V), { currentBalance: 420, totalPaid: 80, lastPayout: { branchId: "kl", settleId }, ...vendorTweak });
    return b.commit();
  };
  it("those who hand out see suppliers and what they're owed — to pick a bill", async () => {
    expect(await ok(db("klCashier").doc(V).get())).toBe(true);
    expect(await ok(db("klCashier").doc(`${VB}/inv1`).get())).toBe(true);
    expect(await ok(db("klStaff").doc(`${VB}/inv1`).get())).toBe(false);
    expect(await ok(db("klCashier").doc(`${VB}/inv1`).update({ paid: 500 }))).toBe(false); // seeing, not paying
  });
  it("in-charge approves: the bill, the payment and the supplier's balance move with it", async () => {
    expect(await ok(approveAs("klInCharge"))).toBe(true);
  });
  it("only as part of approving that pay-out bill — never on their own", async () => {
    expect(await ok(db("klInCharge").doc(`${VB}/inv1`).update({ paid: 80, balance: 420, status: "partially_paid", lastPayoutSettleId: "sup" }))).toBe(false);
    expect(await ok(db("klInCharge").doc(`${VP}/x`).set({ vendorId: "rice", total: 80, payoutSettleId: "sup" }))).toBe(false);
    expect(await ok(db("klInCharge").doc(V).update({ currentBalance: 0, lastPayout: { branchId: "kl", settleId: "sup" } }))).toBe(false);
  });
  it("nothing else on the bill or the supplier moves in the same go", async () => {
    expect(await ok(approveAs("klInCharge", { billTweak: { total: 80 } }))).toBe(false);
    expect(await ok(approveAs("klInCharge", { vendorTweak: { name: "Cheaper Rice" } }))).toBe(false);
  });
  it("not whoever brought the bill back", async () => {
    expect(await ok(approveAs("klCashier"))).toBe(false);
  });
  it("collecting a purchase order: the till sees it and marks it as waiting on their own bill — nothing more", async () => {
    const PO = `${B}/requisitions/po1`;
    await env.withSecurityRulesDisabled((ctx) => ctx.firestore().doc(PO).set({ vendorId: "rice", poNo: "PO-1", status: "Sent", items: [] }));
    const poSup = { vendorId: "rice", vendorName: "Rice Co", mode: "po", poId: "po1", lines: [], invoiceNo: "I", paid: 80 };
    expect(await ok(db("klCashier").doc(PO).get())).toBe(true);
    expect(await ok(db("klStaff").doc(PO).get())).toBe(false);
    // the bill and the mark together
    const d = db("klCashier");
    const b = d.batch();
    b.set(d.doc(`${P}/pos1`), settle("klCashier", { supplier: poSup }));
    b.update(d.doc(PO), { payoutHold: "pos1" });
    expect(await ok(b.commit())).toBe(true);
    // not pointing at someone else's bill, another order's, or changing anything else
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(`${P}/byOther`).set(settle("klSupervisor", { supplier: poSup }));
      await ctx.firestore().doc(`${P}/otherPo`).set(settle("klCashier", { supplier: { ...poSup, poId: "po2" } }));
      await ctx.firestore().doc(PO).update({ payoutHold: null });
    });
    expect(await ok(d.doc(PO).update({ payoutHold: "byOther" }))).toBe(false);
    expect(await ok(d.doc(PO).update({ payoutHold: "otherPo" }))).toBe(false);
    expect(await ok(d.doc(PO).update({ payoutHold: "pos1", status: "Received" }))).toBe(false);
  });
  it("a new bill bought and paid on the spot is raised as the pay-out is approved", async () => {
    await env.withSecurityRulesDisabled((ctx) =>
      ctx.firestore().doc(`${P}/nb`).set(settle("klCashier", { supplier: { vendorId: "rice", vendorName: "Rice Co", mode: "newBill", newBill: { total: 120, paid: 80 } } }))
    );
    const bill = { vendorId: "rice", invoiceNo: "INV-9", total: 120, paid: 80, balance: 40, status: "partially_paid", payoutSettleId: "nb", lastPayoutSettleId: "nb" };
    const d = db("klInCharge");
    const b = d.batch();
    b.update(d.doc(`${P}/nb`), { status: "approved", billAmount: 80, change: 20, review: { by: { uid: "klInCharge" } }, vendorPaymentId: "vp2", costId: "c2" });
    b.set(d.doc(`${VB}/new`), bill);
    b.set(d.doc(`${VP}/vp2`), { vendorId: "rice", total: 80, payoutSettleId: "nb" });
    b.update(d.doc(V), { currentBalance: 540, totalBilled: 620, totalPaid: 80, lastPayout: { branchId: "kl", settleId: "nb" } });
    expect(await ok(b.commit())).toBe(true);
  });
});
