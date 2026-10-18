// Security tests for firestore.rules — run against the Firestore emulator
// (`npm run test:rules`). Each test is one statement about who may do what.
// The database rules are the real security boundary: screens and middleware
// only hide buttons; anyone can talk to Firestore directly from a browser.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import fs from "node:fs";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";

const CO = "co";
const EVIL = "evil";
let env;

// uid → profile in /users/{uid}
const PEOPLE = {
  owner: { companyId: CO, role: "owner" },
  gm: { companyId: CO, role: "gm" },
  superAdmin: { companyId: CO, role: "superAdmin" },
  klAdmin: { companyId: CO, branchId: "kl", role: "branchAdmin" },
  klManager: { companyId: CO, branchId: "kl", role: "manager" },
  klAccountant: { companyId: CO, branchId: "kl", role: "accountant" },
  klSupervisor: { companyId: CO, branchId: "kl", role: "supervisor" },
  klCashier: { companyId: CO, branchId: "kl", role: "cashier" },
  klStaff: { companyId: CO, branchId: "kl", role: "staff", staffId: "st-me" },
  klStaffNoLink: { companyId: CO, branchId: "kl", role: "staff" },
  pjAdmin: { companyId: CO, branchId: "pj", role: "branchAdmin" },
  noBranchManager: { companyId: CO, role: "manager" },
  outsider: { companyId: EVIL, branchId: "x", role: "owner" },
};

const B = (branch = "kl") => `companies/${CO}/branches/${branch}`;
const db = (uid) => (uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore());
const as = db;

const request = (over = {}) => ({
  staffId: "st1", staffName: "Ali", amount: 100, date: "2026-10-10", reason: "test",
  status: "pending", paidOut: null, paidFromOffice: "front", ...over,
});
const paidOut = { date: "2026-10-11", from: "front", by: { uid: "klCashier", name: "c", role: "cashier" } };

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-rules-test",
    firestore: {
      rules: fs.readFileSync("firestore.rules", "utf8"),
      host: "127.0.0.1",
      port: Number(process.env.FIRESTORE_EMULATOR_PORT || 8080),
    },
    storage: {
      rules: fs.readFileSync("storage.rules", "utf8"),
      host: "127.0.0.1",
      port: Number(process.env.STORAGE_EMULATOR_PORT || 9199),
    },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    for (const [uid, p] of Object.entries(PEOPLE)) await d.doc(`users/${uid}`).set({ ...p, email: `${uid}@t.test`, userName: uid });
    await d.doc(`companies/${CO}`).set({ name: "Co", ownerUid: "owner" });
    await d.doc(`companies/${EVIL}`).set({ name: "Evil", ownerUid: "outsider" });
    for (const b of ["kl", "pj"]) {
      await d.doc(B(b)).set({ name: b });
      await d.doc(`${B(b)}/sales/s1`).set({ date: "2026-10-10", cash: "100", total: 100 });
      await d.doc(`${B(b)}/summaries/2026-09`).set({ period: "2026-09", engineVersion: 1, cashChange: 100, bankChange: 0 });
      await d.doc(`${B(b)}/staff/st1`).set({ firstName: "Ali", basicSalary: "1800", passportNumber: "A123", bankAccountNumber: "999" });
    }
    for (const [id, staffId] of [["mine", "st-me"], ["other", "st1"]]) {
      await d.doc(`${B()}/attendance/${id}`).set({ staffId, date: "2026-10-10", type: "in" });
      await d.doc(`${B()}/otRequests/${id}`).set({ staffId, date: "2026-10-10", status: "pending" });
    }
    // Entered by a manager for klStaff, and for a colleague.
    for (const col of ["advances", "loans"]) {
      await d.doc(`${B()}/${col}/forMe`).set(request({ staffId: "st-me", status: "approved", createdBy: { uid: "klManager" } }));
      await d.doc(`${B()}/${col}/forOther`).set(request({ staffId: "st1", status: "approved", createdBy: { uid: "klManager" } }));
    }
    await d.doc(`${B()}/settings/settings`).set({
      basic: { phone: "1", timeZone: "Asia/Kuala_Lumpur" },
      attendance: { dayCutoffTime: "05:00" },
      financeSales: { currency: "MYR", openingBalance: 1000, openingBankBalance: 0, tenders: [{ key: "cash" }] },
    });
    await d.doc(`${B()}/advances/pending`).set(request());
    await d.doc(`${B()}/advances/approved`).set(request({ status: "approved", approvedBy: { name: "m" } }));
    await d.doc(`${B()}/advances/paid`).set(request({ status: "approved", paidOut }));
    await d.doc(`${B()}/loans/pending`).set(request({ durationMonths: 6 }));
    await d.doc(`${B()}/loans/approved`).set(request({ durationMonths: 6, status: "approved" }));
    await d.doc(`signupInvites/CODE1`).set({ used: false, createdAt: 1 });
    await d.doc(`usernames/klcashier`).set({ uid: "klCashier", email: "klCashier@t.test", companyId: CO });
    await d.doc(`${B()}/pos/main/menu/m1`).set({ name: "Nasi" });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("who you are cannot be forged", () => {
  it("a new owner can sign up: company, both user records and the invite, in one transaction", async () => {
    const d = as("newbie");
    await assertSucceeds(
      d.runTransaction(async (tx) => {
        const inv = d.doc("signupInvites/CODE1");
        await tx.get(inv);
        tx.set(d.doc("companies/newco"), { name: "New", ownerUid: "newbie", ownerEmail: "n@t.test", inviteCode: "CODE1" });
        tx.set(d.doc("companies/newco/users/newbie"), { role: "owner", email: "n@t.test" });
        tx.set(d.doc("users/newbie"), { role: "owner", companyId: "newco", email: "n@t.test" });
        tx.update(inv, { used: true, usedBy: "newbie" });
      })
    );
  });

  it("a stranger cannot make themselves owner of an existing company", async () => {
    await assertFails(as("newbie").doc("users/newbie").set({ role: "owner", companyId: CO, email: "n@t.test" }));
  });

  it("a stranger cannot join an existing company with any other role either", async () => {
    await assertFails(as("newbie").doc("users/newbie").set({ role: "manager", companyId: CO, branchId: "kl" }));
  });

  it("a stranger cannot start a company without an invite, or with a used one", async () => {
    const d = as("newbie");
    await assertFails(
      d.runTransaction(async (tx) => {
        tx.set(d.doc("companies/newco"), { name: "New", ownerUid: "newbie" });
        tx.set(d.doc("users/newbie"), { role: "owner", companyId: "newco" });
      })
    );
    await env.withSecurityRulesDisabled((ctx) => ctx.firestore().doc("signupInvites/USED").set({ used: true, createdAt: 1 }));
    await assertFails(
      d.runTransaction(async (tx) => {
        tx.set(d.doc("companies/newco"), { name: "New", ownerUid: "newbie", inviteCode: "USED" });
        tx.set(d.doc("users/newbie"), { role: "owner", companyId: "newco" });
      })
    );
  });

  it("an existing member cannot use an invite to become owner of a second company", async () => {
    const d = as("klCashier");
    await assertFails(
      d.runTransaction(async (tx) => {
        tx.set(d.doc("companies/side"), { name: "Side", ownerUid: "klCashier", inviteCode: "CODE1" });
        tx.update(d.doc("signupInvites/CODE1"), { used: true, usedBy: "klCashier" });
      })
    );
  });

  it("users cannot change their own role, company, branch or platform-admin flag", async () => {
    const d = as("klCashier");
    await assertFails(d.doc("users/klCashier").update({ role: "owner" }));
    await assertFails(d.doc("users/klCashier").update({ companyId: EVIL }));
    await assertFails(d.doc("users/klCashier").update({ branchId: "pj" }));
    await assertFails(d.doc("users/klCashier").update({ platformAdmin: true }));
    await assertSucceeds(d.doc("users/klCashier").update({ userName: "new name" }));
  });

  it("a company admin can create users for their own company, not for another", async () => {
    await assertSucceeds(as("owner").doc("users/hire1").set({ role: "cashier", companyId: CO, branchId: "kl" }));
    await assertFails(as("owner").doc("users/hire2").set({ role: "cashier", companyId: EVIL }));
    await assertFails(as("klManager").doc("users/hire3").set({ role: "cashier", companyId: CO, branchId: "kl" }));
  });

  it("nobody can claim a username for someone else's account", async () => {
    await assertFails(as("outsider").doc("usernames/boss").set({ uid: "owner", email: "owner@t.test", companyId: CO }));
    await assertSucceeds(as("owner").doc("usernames/hire1").set({ uid: "hire1", email: "h@t.test", companyId: CO }));
  });

  it("only members can join a company's user list", async () => {
    await assertFails(as("outsider").doc(`companies/${CO}/users/outsider`).set({ role: "owner" }));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("who can see what", () => {
  it("branch finance roles read their own branch", async () => {
    for (const u of ["klAdmin", "klManager", "klAccountant", "klSupervisor"]) {
      await assertSucceeds(as(u).doc(`${B()}/sales/s1`).get());
    }
  });

  it("company roles read every branch", async () => {
    for (const u of ["owner", "gm", "superAdmin"]) await assertSucceeds(as(u).doc(`${B("pj")}/sales/s1`).get());
  });

  it("nobody reads another branch's finances", async () => {
    await assertFails(as("klManager").doc(`${B("pj")}/sales/s1`).get());
    await assertFails(as("pjAdmin").doc(`${B()}/sales/s1`).get());
  });

  it("monthly summaries: read by those who see the reports, written only by the server", async () => {
    await assertSucceeds(as("klAccountant").doc(`${B()}/summaries/2026-09`).get());
    await assertFails(as("klCashier").doc(`${B()}/summaries/2026-09`).get()); // the cashier doesn't see the books (4.1)
    await assertSucceeds(as("owner").doc(`${B("pj")}/summaries/2026-09`).get());
    await assertFails(as("klStaff").doc(`${B()}/summaries/2026-09`).get());
    await assertFails(as("klManager").doc(`${B("pj")}/summaries/2026-09`).get());
    await assertFails(as("owner").doc(`${B()}/summaries/2026-09`).set({ period: "2026-09", cashChange: 999999 }));
    await assertFails(as("klAdmin").doc(`${B()}/summaries/2026-09`).delete());
  });

  it("a branch user with no branch assigned reads no branch", async () => {
    await assertFails(as("noBranchManager").doc(`${B()}/sales/s1`).get());
  });

  it("another company reads nothing", async () => {
    await assertFails(as("outsider").doc(`${B()}/sales/s1`).get());
    await assertFails(as("outsider").doc(`${B()}/staff/st1`).get());
  });

  it("staff cannot read sales, salaries or colleagues' personal details", async () => {
    await assertFails(as("klStaff").doc(`${B()}/sales/s1`).get());
    await assertFails(as("klStaff").doc(`${B()}/staff/st1`).get());
  });

  it("staff see their own advances and loans — asked by them or entered for them — and no one else's", async () => {
    const d = as("klStaff");
    for (const col of ["advances", "loans"]) {
      const mine = await assertSucceeds(d.collection(`${B()}/${col}`).where("staffId", "==", "st-me").get());
      expect(mine.docs.map((x) => x.id)).toEqual(["forMe"]);
      await assertSucceeds(d.collection(`${B()}/${col}`).where("createdBy.uid", "==", "klStaff").get());
      await assertFails(d.collection(`${B()}/${col}`).where("staffId", "==", "st1").get());
      await assertFails(d.collection(`${B()}/${col}`).get());
      await assertFails(d.doc(`${B()}/${col}/forOther`).get());
    }
  });

  it("staff see their own punches and OT requests, not colleagues'", async () => {
    const d = as("klStaff");
    for (const col of ["attendance", "otRequests"]) {
      const mine = await assertSucceeds(
        d.collection(`${B()}/${col}`).where("staffId", "==", "st-me").where("date", ">=", "2026-10-01").where("date", "<=", "2026-10-31").get()
      );
      expect(mine.docs.map((x) => x.id)).toEqual(["mine"]);
      await assertFails(d.collection(`${B()}/${col}`).where("date", ">=", "2026-10-01").get());
      await assertFails(d.doc(`${B()}/${col}/other`).get());
    }
    // A login not linked to a staff record sees none.
    await assertFails(as("klStaffNoLink").collection(`${B()}/attendance`).where("staffId", "==", "").get());
  });

  it("staff cannot re-link their login to a colleague's staff record", async () => {
    await assertFails(as("klStaff").doc("users/klStaff").update({ staffId: "st1" }));
    await assertFails(as("klCashier").doc("users/klCashier").update({ staffId: "st-me" }));
  });

  it("signed-out visitors read nothing", async () => {
    await assertFails(as(null).doc(`${B()}/sales/s1`).get());
    await assertFails(as(null).doc(`users/owner`).get());
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("advances and staff loans: requested → approved → paid", () => {
  for (const col of ["advances", "loans"]) {
    const doc = (id) => `${B()}/${col}/${id}`;

    it(`${col}: cashier, supervisor and staff can only ask (pending, unpaid)`, async () => {
      for (const u of ["klCashier", "klSupervisor", "klStaff"]) {
        await assertSucceeds(as(u).doc(doc(`req-${u}`)).set(request()));
        await assertFails(as(u).doc(doc(`ok-${u}`)).set(request({ status: "approved" })));
        await assertFails(as(u).doc(doc(`pay-${u}`)).set(request({ status: "approved", paidOut })));
      }
    });

    it(`${col}: a manager or branch admin can record one handed over on the spot`, async () => {
      for (const u of ["klManager", "klAdmin"]) {
        await assertSucceeds(as(u).doc(doc(`direct-${u}`)).set(request({ status: "approved", paidOut })));
      }
    });

    it(`${col}: only a manager or branch admin approves or rejects`, async () => {
      for (const u of ["klCashier", "klSupervisor", "klAccountant", "klStaff"]) {
        await assertFails(as(u).doc(doc("pending")).update({ status: "approved" }));
      }
      await assertSucceeds(as("klManager").doc(doc("pending")).update({ status: "approved", approvedBy: { name: "m" } }));
    });

    it(`${col}: cashier, accountant or supervisor marks an approved one paid — once`, async () => {
      await assertSucceeds(as("klCashier").doc(doc("approved")).update({ paidOut, paidFromOffice: "front" }));
      await assertFails(as("klCashier").doc(doc("approved")).update({ paidOut: { ...paidOut, date: "2026-10-12" } }));
    });

    it(`${col}: nothing pending can be paid out`, async () => {
      await assertFails(as("klCashier").doc(doc("pending")).update({ paidOut }));
    });

    it(`${col}: paying out cannot change the amount or who it is for`, async () => {
      await assertFails(as("klCashier").doc(doc("approved")).update({ paidOut, amount: 5000 }));
      await assertFails(as("klCashier").doc(doc("approved")).update({ paidOut, staffId: "someone-else" }));
    });

    it(`${col}: staff cannot pay out or edit requests`, async () => {
      await assertFails(as("klStaff").doc(doc("approved")).update({ paidOut }));
      await assertFails(as("klStaff").doc(doc("pending")).update({ amount: 5 }));
    });

    it(`${col}: another branch cannot touch them`, async () => {
      await assertFails(as("pjAdmin").doc(doc("approved")).update({ paidOut }));
    });

    it(`${col}: only a manager or branch admin deletes`, async () => {
      await assertFails(as("klCashier").doc(doc("pending")).delete());
      await assertSucceeds(as("klManager").doc(doc("pending")).delete());
    });
  }

  it("payroll marks installments paid and closes a fully repaid advance (accountant)", async () => {
    await assertSucceeds(
      as("klAccountant").doc(`${B()}/advances/paid`).update({ status: "closed", totalPaid: 100, remainingAmount: 0 })
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("audit log", () => {
  const log = (uid, over = {}) => ({ userId: uid, branchId: "kl", action: "PAY_OUT_ADVANCE", details: "x", ...over });
  it("records actions in the signed-in user's own name", async () => {
    await assertSucceeds(as("klCashier").collection(`companies/${CO}/auditLog`).add(log("klCashier")));
    await assertSucceeds(as("owner").collection(`companies/${CO}/auditLog`).add(log("owner", { branchId: "pj" })));
  });
  it("cannot be written in someone else's name, for another branch, or by outsiders", async () => {
    await assertFails(as("klCashier").collection(`companies/${CO}/auditLog`).add(log("owner")));
    await assertFails(as("klCashier").collection(`companies/${CO}/auditLog`).add(log("klCashier", { branchId: "pj" })));
    await assertFails(as("outsider").collection(`companies/${CO}/auditLog`).add(log("outsider")));
  });
  it("cannot be edited or deleted", async () => {
    await env.withSecurityRulesDisabled((ctx) => ctx.firestore().doc(`companies/${CO}/auditLog/a1`).set(log("klAdmin")));
    await assertFails(as("klAdmin").doc(`companies/${CO}/auditLog/a1`).update({ details: "changed" }));
    await assertFails(as("owner").doc(`companies/${CO}/auditLog/a1`).delete());
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("branch settings", () => {
  const s = `${B()}/settings/settings`;
  it("a manager can change contact details and payment-type labels", async () => {
    await assertSucceeds(as("klManager").doc(s).update({ "basic.phone": "2", "financeSales.tenders": [{ key: "cash", label: "Tunai" }] }));
  });

  it("a manager cannot change opening balances, currency, time zone or day cut-off", async () => {
    const m = as("klManager").doc(s);
    await assertFails(m.update({ "financeSales.openingBalance": 99999 }));
    await assertFails(m.update({ "financeSales.openingBankBalance": 99999 }));
    await assertFails(m.update({ "financeSales.currency": "BDT" }));
    await assertFails(m.update({ "basic.timeZone": "Asia/Dhaka" }));
    await assertFails(m.update({ "attendance.dayCutoffTime": "00:00" }));
  });

  it("a branch admin can change all of them", async () => {
    await assertSucceeds(as("klAdmin").doc(s).update({ "financeSales.currency": "BDT", "attendance.dayCutoffTime": "04:00" }));
  });

  it("cashiers cannot change settings", async () => {
    await assertFails(as("klCashier").doc(s).update({ "basic.phone": "3" }));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("files (storage)", () => {
  const file = (folder) => `${folder}/${CO}/kl/f1`;
  const store = (uid) => (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).storage();
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      for (const f of ["salarySheets", "costs", "staffPhotos"]) {
        await ctx.storage().ref(file(f)).put(new Uint8Array([1, 2, 3]), { contentType: "image/png" });
      }
    });
  });

  it("branch management opens salary sheets and receipts; staff and other branches cannot", async () => {
    await assertSucceeds(store("klAccountant").ref(file("salarySheets")).getMetadata());
    await assertSucceeds(store("owner").ref(file("costs")).getMetadata());
    await assertFails(store("klStaff").ref(file("salarySheets")).getMetadata());
    await assertFails(store("klStaff").ref(file("costs")).getMetadata());
    await assertFails(store("pjAdmin").ref(file("salarySheets")).getMetadata());
  });

  it("staff can see staff photos", async () => {
    await assertSucceeds(store("klStaff").ref(file("staffPhotos")).getMetadata());
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("everyday work keeps working", () => {
  it("supervisors and accountants enter sales; cashiers and staff cannot", async () => {
    await assertSucceeds(as("klSupervisor").doc(`${B()}/sales/s2`).set({ date: "2026-10-11", cash: "5" }));
    await assertSucceeds(as("klAccountant").doc(`${B()}/sales/s3`).set({ date: "2026-10-11", cash: "5" }));
    await assertFails(as("klStaff").doc(`${B()}/sales/s4`).set({ date: "2026-10-11", cash: "5" }));
  });

  it("the POS: cashiers ring up orders but cannot edit the menu", async () => {
    await assertSucceeds(as("klCashier").doc(`${B()}/pos/main/orders/o1`).set({ total: 10 }));
    await assertFails(as("klCashier").doc(`${B()}/pos/main/menu/m1`).update({ name: "Free" }));
    await assertSucceeds(as("klAdmin").doc(`${B()}/pos/main/menu/m1`).update({ name: "Nasi Lemak" }));
  });
});
