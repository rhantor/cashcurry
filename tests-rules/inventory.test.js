// Inventory in the database rules (8 Nov): those who order count stock and
// write off waste in their own name; only those who approve orders change or
// remove a count and set the start, minimums and count day; cashiers, staff
// and other branches see none of it.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import fs from "node:fs";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";

const CO = "co";
const B = `companies/${CO}/branches/kl`;
let env;
const PEOPLE = {
  klManager: { role: "manager", branchId: "kl" },
  klSupervisor: { role: "supervisor", branchId: "kl" },
  klCashier: { role: "cashier", branchId: "kl" },
  klStaff: { role: "staff", branchId: "kl", staffId: "st1" },
  pjManager: { role: "manager", branchId: "pj" },
};
const db = (uid) => env.authenticatedContext(uid).firestore();
const ok = (p) => p.then(() => true, () => false);
const count = (uid, extra = {}) => ({ date: "2026-11-14", vendorId: "v1", lines: [{ itemId: "meat", qty: 12 }], by: { uid }, ...extra });
const waste = (uid, extra = {}) => ({ date: "2026-11-15", itemId: "meat", qty: 2, reason: "Spoiled", by: { uid }, ...extra });

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
    await d.doc(`${B}/stockTakes/c1`).set(count("klSupervisor"));
    await d.doc(`${B}/stockWaste/w1`).set(waste("klSupervisor"));
    await d.doc(`${B}/stockSettings/main`).set({ startDate: "2026-11-08" });
  });
});

describe("stock counts", () => {
  it("a supervisor counts in their own name, not someone else's", async () => {
    expect(await ok(db("klSupervisor").doc(`${B}/stockTakes/n1`).set(count("klSupervisor")))).toBe(true);
    expect(await ok(db("klSupervisor").doc(`${B}/stockTakes/n2`).set(count("klManager")))).toBe(false);
  });
  it("a count needs its day and lines", async () => {
    expect(await ok(db("klManager").doc(`${B}/stockTakes/n1`).set({ by: { uid: "klManager" }, lines: [] }))).toBe(false);
    expect(await ok(db("klManager").doc(`${B}/stockTakes/n2`).set({ by: { uid: "klManager" }, date: "2026-11-14" }))).toBe(false);
  });
  it("only a manager changes or removes one; a supervisor counts again instead", async () => {
    expect(await ok(db("klSupervisor").doc(`${B}/stockTakes/c1`).update({ lines: [] }))).toBe(false);
    expect(await ok(db("klSupervisor").doc(`${B}/stockTakes/c1`).delete())).toBe(false);
    expect(await ok(db("klManager").doc(`${B}/stockTakes/c1`).delete())).toBe(true);
  });
});

describe("waste", () => {
  it("is written in one's own name, with an amount above 0", async () => {
    expect(await ok(db("klSupervisor").doc(`${B}/stockWaste/n1`).set(waste("klSupervisor")))).toBe(true);
    expect(await ok(db("klSupervisor").doc(`${B}/stockWaste/n2`).set(waste("klManager")))).toBe(false);
    expect(await ok(db("klSupervisor").doc(`${B}/stockWaste/n3`).set(waste("klSupervisor", { qty: 0 })))).toBe(false);
  });
  it("only a manager removes it", async () => {
    expect(await ok(db("klSupervisor").doc(`${B}/stockWaste/w1`).delete())).toBe(false);
    expect(await ok(db("klManager").doc(`${B}/stockWaste/w1`).delete())).toBe(true);
  });
});

describe("settings", () => {
  it("a supervisor reads them; only a manager sets them", async () => {
    expect(await ok(db("klSupervisor").doc(`${B}/stockSettings/main`).get())).toBe(true);
    expect(await ok(db("klSupervisor").doc(`${B}/stockSettings/main`).update({ countDay: 0 }))).toBe(false);
    expect(await ok(db("klManager").doc(`${B}/stockSettings/main`).update({ countDay: 0 }))).toBe(true);
  });
});

describe("outsiders", () => {
  it("cashiers, staff and another branch can't read or write any of it", async () => {
    for (const u of ["klCashier", "klStaff", "pjManager"]) {
      expect(await ok(db(u).doc(`${B}/stockTakes/c1`).get()), u).toBe(false);
      expect(await ok(db(u).doc(`${B}/stockWaste/w1`).get()), u).toBe(false);
      expect(await ok(db(u).doc(`${B}/stockSettings/main`).get()), u).toBe(false);
      expect(await ok(db(u).doc(`${B}/stockTakes/x-${u}`).set(count(u))), u).toBe(false);
      expect(await ok(db(u).doc(`${B}/stockWaste/x-${u}`).set(waste(u))), u).toBe(false);
    }
  });
});
