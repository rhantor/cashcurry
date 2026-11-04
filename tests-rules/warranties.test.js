// Warranties in the database rules: those who run or buy for the branch read
// and write them; the maker's name and the server's reminder mark stay as they
// are; only leads delete; cashiers, staff and other branches don't see them.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import fs from "node:fs";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";

const CO = "co";
const B = `companies/${CO}/branches/kl`;
const W = `${B}/warranties`;
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
const warranty = (uid, extra = {}) => ({ itemName: "Chiller", endsOn: "2027-01-01", status: "active", createdBy: { uid }, ...extra });

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
    await d.doc(`${W}/w1`).set(warranty("klSupervisor"));
  });
});

describe("warranties", () => {
  it("a supervisor adds one in their own name, not someone else's", async () => {
    expect(await ok(db("klSupervisor").doc(`${W}/n1`).set(warranty("klSupervisor")))).toBe(true);
    expect(await ok(db("klSupervisor").doc(`${W}/n2`).set(warranty("klManager")))).toBe(false);
  });
  it("it needs a name and an end date, and can't arrive already reminded", async () => {
    expect(await ok(db("klManager").doc(`${W}/n1`).set({ status: "active", createdBy: { uid: "klManager" } }))).toBe(false);
    expect(await ok(db("klManager").doc(`${W}/n2`).set(warranty("klManager", { reminded: { endsOn: "2027-01-01", step: 7 } })))).toBe(false);
  });
  it("cashiers, staff and another branch can't read or add", async () => {
    for (const u of ["klCashier", "klStaff", "pjManager"]) {
      expect(await ok(db(u).doc(`${W}/w1`).get())).toBe(false);
      expect(await ok(db(u).doc(`${W}/x-${u}`).set(warranty(u)))).toBe(false);
    }
  });
  it("renewing or stopping is open to those who manage them", async () => {
    expect(await ok(db("klSupervisor").doc(`${W}/w1`).update({ endsOn: "2028-01-01" }))).toBe(true);
    expect(await ok(db("klManager").doc(`${W}/w1`).update({ status: "notRenewing" }))).toBe(true);
    expect(await ok(db("klCashier").doc(`${W}/w1`).update({ status: "active" }))).toBe(false);
  });
  it("no one changes who made it or the server's reminder mark", async () => {
    expect(await ok(db("klManager").doc(`${W}/w1`).update({ createdBy: { uid: "klManager" } }))).toBe(false);
    expect(await ok(db("klManager").doc(`${W}/w1`).update({ reminded: { endsOn: "2027-01-01", step: 7 } }))).toBe(false);
  });
  it("only leads delete", async () => {
    expect(await ok(db("klSupervisor").doc(`${W}/w1`).delete())).toBe(false);
    expect(await ok(db("klManager").doc(`${W}/w1`).delete())).toBe(true);
  });
});
