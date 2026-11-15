// Settings → Roles (15 Nov 2026): extra rights a company switches on for a
// branch role. Off by default; on only for that role, in its own branch; only
// the owner or a super admin sets them, and only the five switches there are.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import fs from "node:fs";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";

const CO = "co";
const B = `companies/${CO}/branches/kl`;
const ROLES = `companies/${CO}/settings/roles`;
let env;
const PEOPLE = {
  owner: { role: "owner" },
  superAdmin: { role: "superAdmin" },
  klManager: { role: "manager", branchId: "kl" },
  klSupervisor: { role: "supervisor", branchId: "kl" },
  klAccountant: { role: "accountant", branchId: "kl" },
  klInCharge: { role: "inCharge", branchId: "kl" },
  klCashier: { role: "cashier", branchId: "kl" },
  pjSupervisor: { role: "supervisor", branchId: "pj" },
};
const db = (uid) => env.authenticatedContext(uid).firestore();
const ok = (p) => p.then(() => true, () => false);
const ALL_ON = {
  "cashInHand.view": ["supervisor"],
  "costs.enter": ["supervisor"],
  "payouts.handOut": ["accountant"],
  "advances.payOut": ["inCharge"],
  "attendance.view": ["accountant"],
};

// each right, tried as the role it is for
const tries = {
  cost: (u, id) => db(u).doc(`${B}/costs/${id}`).set({ date: "2026-11-15", amount: 5 }),
  payout: (u, id) => db(u).doc(`${B}/payouts/${id}`).set({ kind: "out", status: "open", date: "2026-11-15", amount: 20, by: { uid: u } }),
  advance: (u) => db(u).doc(`${B}/advances/approved-1`).update({ paidOut: { date: "2026-11-15", by: { uid: u } }, paidFromOffice: "front" }),
  attendance: (u) => db(u).doc(`${B}/attendance/p1`).get(),
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
    await d.doc(`${B}/attendance/p1`).set({ staffId: "st1", date: "2026-11-15", type: "in" });
    await d.doc(`${B}/advances/approved-1`).set({ staffId: "st1", amount: 100, date: "2026-11-15", status: "approved", paidOut: null, paidFromOffice: "front" });
  });
});
const switchOn = (grants) => env.withSecurityRulesDisabled((ctx) => ctx.firestore().doc(ROLES).set({ grants }));

describe("Settings → Roles switches", () => {
  it("are off by default", async () => {
    expect(await ok(tries.cost("klSupervisor", "c1"))).toBe(false);
    expect(await ok(tries.payout("klAccountant", "p1"))).toBe(false);
    expect(await ok(tries.advance("klInCharge"))).toBe(false);
    expect(await ok(tries.attendance("klAccountant"))).toBe(false);
  });

  it("switched on, each works for its role", async () => {
    await switchOn(ALL_ON);
    expect(await ok(tries.cost("klSupervisor", "c1"))).toBe(true);
    expect(await ok(tries.payout("klAccountant", "p1"))).toBe(true);
    expect(await ok(tries.advance("klInCharge"))).toBe(true);
    expect(await ok(tries.attendance("klAccountant"))).toBe(true);
  });

  it("only for that role, and only in their own branch", async () => {
    await switchOn(ALL_ON);
    expect(await ok(tries.cost("klCashier", "c2"))).toBe(false);
    expect(await ok(tries.attendance("klCashier"))).toBe(false);
    expect(await ok(tries.cost("pjSupervisor", "c3"))).toBe(false);
  });

  it("only the owner or a super admin sets them, and only the five there are", async () => {
    expect(await ok(db("klManager").doc(ROLES).set({ grants: { "costs.enter": ["supervisor"] } }))).toBe(false);
    expect(await ok(db("owner").doc(ROLES).set({ grants: { "costs.enter": ["supervisor"] } }))).toBe(true);
    expect(await ok(db("superAdmin").doc(ROLES).set({ grants: ALL_ON, updatedBy: { uid: "superAdmin" } }))).toBe(true);
    // another role for a switch, a right that isn't a switch, an unknown field
    expect(await ok(db("owner").doc(ROLES).set({ grants: { "costs.enter": ["cashier"] } }))).toBe(false);
    expect(await ok(db("owner").doc(ROLES).set({ grants: { "payroll.view": ["supervisor"] } }))).toBe(false);
    expect(await ok(db("owner").doc(ROLES).set({ grants: {}, other: 1 }))).toBe(false);
    // everyone in the company reads them (the screens need them)
    expect(await ok(db("klCashier").doc(ROLES).get())).toBe(true);
  });
});
