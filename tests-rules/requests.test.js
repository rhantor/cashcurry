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
