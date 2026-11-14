// Who deletes a record is written on it just before (14 Nov 2026), so the
// audit log can name them: whoever may delete it may also write that stamp.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import fs from "node:fs";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";

const CO = "co";
const B = `companies/${CO}/branches/kl`;
let env;
const PEOPLE = {
  owner: { role: "owner" },
  klAdmin: { role: "branchAdmin", branchId: "kl" },
  klManager: { role: "manager", branchId: "kl" },
  klAccountant: { role: "accountant", branchId: "kl" },
};
const db = (uid) => env.authenticatedContext(uid).firestore();
const ok = (p) => p.then(() => true, () => false);
const RECORDS = {
  sales: { date: "2026-11-14", total: 10, createdBy: { uid: "x" } },
  costs: { date: "2026-11-14", amount: 5, createdBy: { uid: "x" } },
  salaries: { paymentDate: "2026-11-14", amount: 100, createdBy: { uid: "x" } },
  vendorBills: { vendorId: "v1", total: 20, paid: 0, balance: 20, status: "unpaid", createdBy: { uid: "x" } },
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
    for (const [c, r] of Object.entries(RECORDS)) for (const u of Object.keys(PEOPLE)) await d.doc(`${B}/${c}/${u}`).set(r);
  });
});

describe("the delete stamp", () => {
  it("whoever may delete a record may first write who is deleting it", async () => {
    for (const [c] of Object.entries(RECORDS)) {
      let deleted = 0;
      for (const u of Object.keys(PEOPLE)) {
        const ref = db(u).doc(`${B}/${c}/${u}`);
        const stamp = await ok(ref.update({ deletedBy: { uid: u, name: u }, deletedAt: "2026-11-14T07:00:00.000Z" }));
        const gone = await ok(ref.delete());
        // the stamp may be refused only where the delete is refused too
        if (gone) expect(stamp, `${u} ${c}`).toBe(true);
        if (gone) deleted++;
      }
      expect(deleted, `someone deletes ${c}`).toBeGreaterThan(0);
    }
  });
});
