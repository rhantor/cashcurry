// The requests engine (roadmap 4.2, lib/requests/model.js) in the database
// rules: one approval is enough, leave, and cancelling your own request.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import fs from "node:fs";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";

const CO = "co";
const B = `companies/${CO}/branches/kl`;
let env;
const PEOPLE = {
  owner: { role: "owner" },
  klManager: { role: "manager", branchId: "kl" },
  klAdmin: { role: "branchAdmin", branchId: "kl" },
  klSupervisor: { role: "supervisor", branchId: "kl" },
  klCashier: { role: "cashier", branchId: "kl" },
  klStaff: { role: "staff", branchId: "kl", staffId: "st-me" },
  klStaff2: { role: "staff", branchId: "kl", staffId: "st-other" },
  // a manager whose login is linked to their own staff record (30 Oct)
  klManagerMe: { role: "manager", branchId: "kl", staffId: "st-mgr" },
};
const as = (uid) => env.authenticatedContext(uid).firestore();
const ok = (p) => p.then(() => true, () => false);

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
    const asked = { status: "pending", paidOut: null, approvals: [], createdBy: { uid: "klStaff" }, staffId: "st-me" };
    await d.doc(`${B}/advances/small`).set({ ...asked, amount: 500 });
    await d.doc(`${B}/advances/big`).set({ ...asked, amount: 3000 });
    await d.doc(`${B}/loans/big`).set({ ...asked, amount: 5000 });
    const { paidOut: _p, ...leave } = asked;
    await d.doc(`${B}/leaves/mine`).set({ ...leave, from: "2026-11-02", to: "2026-11-03", days: 2 });
  });
});

const approve = { status: "approved" };

describe("approving", () => {
  it("one approval is enough — from the branch or a company role, any amount", async () => {
    expect(await ok(as("klManager").doc(`${B}/advances/small`).update(approve))).toBe(true);
    expect(await ok(as("klAdmin").doc(`${B}/loans/big`).update(approve))).toBe(true);
    expect(await ok(as("owner").doc(`${B}/advances/big`).update(approve))).toBe(true);
  });
  it("the supervisor and cashier can't approve", async () => {
    expect(await ok(as("klSupervisor").doc(`${B}/advances/small`).update(approve))).toBe(false);
    expect(await ok(as("klCashier").doc(`${B}/advances/small`).update(approve))).toBe(false);
  });
});

describe("never one's own (an approver linked to their staff record, 30 Oct)", () => {
  const forMe = { staffId: "st-mgr", createdBy: { uid: "klManagerMe" }, amount: 300 };
  it("entered for themselves: only as a request — never given or approved on the spot", async () => {
    const db = as("klManagerMe");
    expect(await ok(db.doc(`${B}/advances/m1`).set({ ...forMe, status: "pending", paidOut: null, approvals: [] }))).toBe(true);
    expect(await ok(db.doc(`${B}/advances/m2`).set({ ...forMe, status: "approved", paidOut: { date: "2026-10-30" }, approvals: [{ uid: "klManagerMe" }] }))).toBe(false);
    expect(await ok(db.doc(`${B}/loans/m3`).set({ ...forMe, status: "approved", paidOut: null, approvals: [] }))).toBe(false);
    const { amount: _a, ...leave } = forMe;
    expect(await ok(db.doc(`${B}/leaves/m4`).set({ ...leave, status: "approved", approvals: [], from: "2026-11-02", days: 1 }))).toBe(false);
    // someone else's: given on the spot, as before
    expect(await ok(db.doc(`${B}/advances/m5`).set({ ...forMe, staffId: "st-me", status: "approved", paidOut: { date: "2026-10-30" }, approvals: [{ uid: "klManagerMe" }] }))).toBe(true);
  });
  it("their own waiting request: not approved by them, nor its amount or person changed — another manager approves it", async () => {
    await env.withSecurityRulesDisabled((ctx) => ctx.firestore().doc(`${B}/advances/mine`).set({ ...forMe, status: "pending", paidOut: null, approvals: [] }));
    const db = as("klManagerMe");
    expect(await ok(db.doc(`${B}/advances/mine`).update({ status: "approved", approvals: [{ uid: "klManagerMe" }] }))).toBe(false);
    expect(await ok(db.doc(`${B}/advances/mine`).update({ amount: 3000 }))).toBe(false);
    expect(await ok(db.doc(`${B}/advances/mine`).update({ staffId: "st-me" }))).toBe(false);
    expect(await ok(db.doc(`${B}/advances/mine`).update({ status: "cancelled", cancelledBy: { uid: "klManagerMe" } }))).toBe(true);
    expect(await ok(as("klManager").doc(`${B}/advances/small`).update({ staffId: "st-mgr" }))).toBe(true); // not linked: as before
  });
  it("another approver approves it; once given, they can't delete it themselves", async () => {
    await env.withSecurityRulesDisabled((ctx) => ctx.firestore().doc(`${B}/advances/mine`).set({ ...forMe, status: "pending", paidOut: null, approvals: [] }));
    expect(await ok(as("klAdmin").doc(`${B}/advances/mine`).update({ status: "approved", approvals: [{ uid: "klAdmin" }] }))).toBe(true);
    expect(await ok(as("klManagerMe").doc(`${B}/advances/mine`).delete())).toBe(false);
    expect(await ok(as("klManagerMe").doc(`${B}/advances/small`).delete())).toBe(true); // someone else's
  });
});

describe("asking and cancelling", () => {
  it("anyone at the branch asks, but can't approve while asking", async () => {
    const leave = { status: "pending", staffId: "st-me", createdBy: { uid: "klStaff" }, from: "2026-12-01", to: "2026-12-01", days: 1 };
    expect(await ok(as("klStaff").doc(`${B}/leaves/new`).set(leave))).toBe(true);
    expect(await ok(as("klStaff").doc(`${B}/leaves/new2`).set({ ...leave, status: "approved" }))).toBe(false);
    expect(await ok(as("klStaff").doc(`${B}/leaves/new3`).set({ ...leave, approvals: [{ step: "branch" }] }))).toBe(false);
  });
  it("whoever asked cancels it while it waits — no one else, nothing more", async () => {
    const cancel = { status: "cancelled", cancelledBy: { uid: "klStaff" } };
    expect(await ok(as("klStaff2").doc(`${B}/advances/small`).update(cancel))).toBe(false);
    expect(await ok(as("klStaff").doc(`${B}/advances/small`).update({ ...cancel, amount: 1 }))).toBe(false);
    expect(await ok(as("klStaff").doc(`${B}/advances/small`).update(cancel))).toBe(true);
    expect(await ok(as("klStaff").doc(`${B}/leaves/mine`).update(cancel))).toBe(true);
  });
});

describe("leave", () => {
  it("is read by approvers, those who plan shifts and the person — not other staff or the cashier", async () => {
    expect(await ok(as("klManager").doc(`${B}/leaves/mine`).get())).toBe(true);
    expect(await ok(as("klSupervisor").doc(`${B}/leaves/mine`).get())).toBe(true);
    expect(await ok(as("klStaff").doc(`${B}/leaves/mine`).get())).toBe(true);
    expect(await ok(as("klStaff2").doc(`${B}/leaves/mine`).get())).toBe(false);
    expect(await ok(as("klCashier").doc(`${B}/leaves/mine`).get())).toBe(false);
  });
  it("is approved by an approver, not by the supervisor", async () => {
    expect(await ok(as("klSupervisor").doc(`${B}/leaves/mine`).update(approve))).toBe(false);
    expect(await ok(as("klManager").doc(`${B}/leaves/mine`).update(approve))).toBe(true);
  });
});
