// The roles matrix, checked against the database rules: for every capability
// in lib/authz/permissions.js that has a database side, each role tries the
// matching read or write, and it must succeed exactly when the matrix says
// the role can. Change a row in permissions.js without changing
// firestore.rules (or the other way round) and this fails.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import fs from "node:fs";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { can } from "../lib/authz/permissions.js";

const CO = "co";
const B = `companies/${CO}/branches/kl`;
let env;

// test user → the role the matrix knows it by
const PEOPLE = {
  owner: { role: "owner" },
  superAdmin: { role: "superAdmin" },
  gm: { role: "gm" },
  klAdmin: { role: "branchAdmin", branchId: "kl" },
  klManager: { role: "manager", branchId: "kl" },
  klInCharge: { role: "inCharge", branchId: "kl" },
  klAccountant: { role: "accountant", branchId: "kl" },
  klSupervisor: { role: "supervisor", branchId: "kl" },
  klCashier: { role: "cashier", branchId: "kl" },
  klStaff: { role: "staff", branchId: "kl", staffId: "st-me" },
};
const USERS = Object.keys(PEOPLE);
const as = (uid) => env.authenticatedContext(uid).firestore();
const tries = async (p) => p.then(() => true, () => false);

// capability → what doing it looks like in the database (u = the user's id,
// for records of their own so one try can't change what the next one sees)
const PROBES = {
  "reports.view": (u) => as(u).doc(`${B}/summaries/2026-09`).get(),
  "sales.enter": (u) => as(u).doc(`${B}/sales/s-${u}`).set({ date: "2026-10-10", total: 1 }),
  "records.delete": (u) => as(u).doc(`${B}/sales/old-${u}`).delete(),
  "costs.enter": (u) => as(u).doc(`${B}/costs/c-${u}`).set({ date: "2026-10-10", amount: 1 }),
  "cashBank.enter": (u) => as(u).doc(`${B}/deposits/d-${u}`).set({ date: "2026-10-10", amount: 1 }),
  "salaries.enter": (u) => as(u).doc(`${B}/salaries/p-${u}`).set({ paymentDate: "2026-10-10", amount: 1 }),
  "advances.approve": (u) => as(u).doc(`${B}/advances/pending-${u}`).update({ status: "approved" }),
  "advances.payOut": (u) => as(u).doc(`${B}/advances/approved-${u}`).update({ paidOut: { date: "2026-10-11", by: { uid: u } }, paidFromOffice: "front" }),
  "payroll.view": (u) => as(u).doc(`${B}/payrollRuns/r1/slips/s1`).get(),
  "payroll.manage": (u) => as(u).doc(`${B}/payrollRuns/r-${u}`).set({ period: "2026-11", status: "draft" }),
  "staff.view": (u) => as(u).doc(`${B}/staff/st1`).get(),
  "staff.pay": (u) => as(u).doc(`${B}/staffPrivate/st1`).get(),
  "staff.manage": (u) => as(u).doc(`${B}/staff/new-${u}`).set({ firstName: "N" }),
  "attendance.view": (u) => as(u).doc(`${B}/attendance/other`).get(),
  "kiosk.open": (u) => as(u).doc(`${B}/attendance/punch-${u}`).set({ staffId: "st1", date: "2026-10-10", type: "in" }),
  "purchases.order": (u) => as(u).doc(`${B}/requisitions/po-${u}`).set({ status: "Pending", vendorId: "v1" }),
  "purchases.approve": (u) => as(u).doc(`${B}/requisitions/pending-${u}`).update({ status: "Approved", approvedBy: u }),
  "purchases.bills": (u) => as(u).doc(`${B}/vendorPayments/vp-${u}`).set({ vendorId: "v1", total: 1 }),
  "catalog.view": (u) => as(u).doc(`companies/${CO}/vendors/v1`).get(),
  "catalog.manage": (u) => as(u).doc(`companies/${CO}/vendors/v-${u}`).set({ name: "V" }),
  "branchSettings.manage": (u) => as(u).doc(`${B}/settings/settings`).update({ "basic.phone": `p-${u}` }),
  "moneySettings.manage": (u) => as(u).doc(`${B}/settings/settings`).update({ "financeSales.openingBalance": USERS.indexOf(u) + 1000 }),
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
    await d.doc(`${B}/summaries/2026-09`).set({ period: "2026-09" });
    await d.doc(`${B}/payrollRuns/r1`).set({ period: "2026-10" });
    await d.doc(`${B}/payrollRuns/r1/slips/s1`).set({ staffId: "st1", netPay: 1800 });
    await d.doc(`${B}/staff/st1`).set({ firstName: "Ali", basicSalary: "1800", bankAccountNumber: "999" });
    await d.doc(`${B}/staffPrivate/st1`).set({ staffId: "st1", basicSalary: "1800", bankAccountNumber: "999" });
    await d.doc(`${B}/staffPrivate/st-me`).set({ staffId: "st-me", basicSalary: "1500" });
    await d.doc(`${B}/attendance/other`).set({ staffId: "st1", date: "2026-10-10", type: "in" });
    await d.doc(`companies/${CO}/vendors/v1`).set({ name: "V" });
    await d.doc(`${B}/settings/settings`).set({ basic: { phone: "1" }, financeSales: { openingBalance: 1, currency: "MYR" } });
    for (const u of USERS) {
      const req = { staffId: "st1", amount: 100, date: "2026-10-10", paidOut: null, paidFromOffice: "front" };
      await d.doc(`${B}/advances/pending-${u}`).set({ ...req, status: "pending" });
      await d.doc(`${B}/advances/approved-${u}`).set({ ...req, status: "approved" });
      await d.doc(`${B}/sales/old-${u}`).set({ date: "2026-10-01", total: 5 });
      await d.doc(`${B}/requisitions/pending-${u}`).set({ status: "Pending", vendorId: "v1" });
    }
  });
});

describe("private staff details", () => {
  it("staff read their own private details and no one else's", async () => {
    expect(await tries(as("klStaff").doc(`${B}/staffPrivate/st-me`).get())).toBe(true);
    expect(await tries(as("klStaff").doc(`${B}/staffPrivate/st1`).get())).toBe(false);
  });
});

describe("firestore.rules follow lib/authz/permissions.js", () => {
  for (const [capability, probe] of Object.entries(PROBES)) {
    it(capability, async () => {
      const got = {};
      const want = {};
      for (const u of USERS) {
        got[u] = await tries(probe(u));
        want[u] = can(PEOPLE[u].role, capability);
      }
      expect(got).toEqual(want);
    });
  }
});
