// New hires (30 Oct, lib/hires/model.js) in the database and storage rules:
// whoever manages staff makes, changes and accepts them; those who see pay
// read them; what the person sends from their join link — files, signature —
// and the link itself are the server's to write. A signed letter is fixed.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import fs from "node:fs";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";

const CO = "co";
const B = `companies/${CO}/branches/kl`;
const H = `${B}/newHires`;
let env;
const PEOPLE = {
  owner: { role: "owner" },
  klManager: { role: "manager", branchId: "kl" },
  klAccountant: { role: "accountant", branchId: "kl" },
  klSupervisor: { role: "supervisor", branchId: "kl" },
  klCashier: { role: "cashier", branchId: "kl" },
  pjManager: { role: "manager", branchId: "pj" },
  ali: { role: "staff", branchId: "kl", staffId: "st-ali" },
};
const db = (uid) => env.authenticatedContext(uid).firestore();
const files = (uid) => env.authenticatedContext(uid).storage();
const ok = (p) => p.then(() => true, () => false);
const draft = { firstName: "Faiz", phone: "012-345 6789", role: "cook", status: "draft", letterReady: false, createdBy: { uid: "klManager" } };

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
    await d.doc(`${H}/sent`).set({ ...draft, status: "sent", linkHash: "abc", link: { expiresAt: "2026-11-06T00:00:00Z" } });
    await d.doc(`${H}/signed`).set({ ...draft, status: "submitted", letterReady: true, signed: { at: "2026-10-31", signature: "data:image/png;base64,AA==" } });
    await d.doc(`${H}/signed/letter/current`).set({ jobTerms: { basicSalary: "2200.00" } });
    await d.doc("joinLinks/abc").set({ companyId: CO, branchId: "kl", hireId: "sent", expiresAt: "2026-11-06T00:00:00Z" });
    await ctx.storage().ref(`newHires/${CO}/kl/sent/idFront-1.jpg`).put(new Uint8Array([1, 2, 3]), { contentType: "image/jpeg" });
  });
});

describe("new hires", () => {
  it("whoever manages staff makes a draft — never with a link, files or a signature of its own", async () => {
    expect(await ok(db("klManager").doc(`${H}/n1`).set(draft))).toBe(true);
    expect(await ok(db("owner").doc(`${H}/n2`).set(draft))).toBe(true);
    expect(await ok(db("klManager").doc(`${H}/n3`).set({ ...draft, status: "submitted" }))).toBe(false);
    expect(await ok(db("klManager").doc(`${H}/n4`).set({ ...draft, files: { photo: { path: "x" } } }))).toBe(false);
    expect(await ok(db("klManager").doc(`${H}/n5`).set({ ...draft, signed: { at: "x" } }))).toBe(false);
    for (const who of ["klSupervisor", "klCashier", "klAccountant", "pjManager", "ali"]) expect(await ok(db(who).doc(`${H}/x-${who}`).set(draft))).toBe(false);
  });
  it("read by those who see pay; not the supervisor, cashier, staff or another branch", async () => {
    expect(await ok(db("klManager").doc(`${H}/sent`).get())).toBe(true);
    expect(await ok(db("klAccountant").doc(`${H}/signed`).get())).toBe(true);
    expect(await ok(db("klAccountant").doc(`${H}/signed/letter/current`).get())).toBe(true);
    for (const who of ["klSupervisor", "klCashier", "ali", "pjManager"]) expect(await ok(db(who).doc(`${H}/sent`).get())).toBe(false);
  });
  it("changed, cancelled and accepted by a manager — not its link, files or signature", async () => {
    expect(await ok(db("klManager").doc(`${H}/sent`).update({ details: { firstName: "Faiz" }, status: "cancelled" }))).toBe(true);
    expect(await ok(db("klManager").doc(`${H}/signed`).update({ status: "accepted", staffId: "st-new" }))).toBe(true);
    expect(await ok(db("klManager").doc(`${H}/signed`).update({ signed: { at: "2026-11-01" } }))).toBe(false);
    expect(await ok(db("klManager").doc(`${H}/sent`).update({ linkHash: "mine" }))).toBe(false);
    expect(await ok(db("klManager").doc(`${H}/sent`).update({ files: {} }))).toBe(false);
    expect(await ok(db("klAccountant").doc(`${H}/sent`).update({ status: "cancelled" }))).toBe(false);
  });
  it("the letter can be changed until they sign it", async () => {
    expect(await ok(db("klManager").doc(`${H}/sent/letter/current`).set({ jobTerms: { basicSalary: "2000.00" } }))).toBe(true);
    expect(await ok(db("klManager").doc(`${H}/signed/letter/current`).set({ jobTerms: { basicSalary: "1.00" } }))).toBe(false);
  });
  it("join links are the server's alone", async () => {
    for (const who of ["owner", "klManager", "ali"]) {
      expect(await ok(db(who).doc("joinLinks/abc").get())).toBe(false);
      expect(await ok(db(who).doc("joinLinks/new").set({ hireId: "sent" }))).toBe(false);
    }
    expect(await ok(env.unauthenticatedContext().firestore().doc("joinLinks/abc").get())).toBe(false);
  });
  it("their documents: read by those who see pay at the branch; nobody writes them from the app", async () => {
    const f = `newHires/${CO}/kl/sent/idFront-1.jpg`;
    expect(await ok(files("klManager").ref(f).getMetadata())).toBe(true);
    expect(await ok(files("klAccountant").ref(f).getMetadata())).toBe(true);
    expect(await ok(files("owner").ref(f).getMetadata())).toBe(true);
    for (const who of ["klSupervisor", "klCashier", "ali", "pjManager"]) expect(await ok(files(who).ref(f).getMetadata())).toBe(false);
    expect(await ok(files("klManager").ref(`newHires/${CO}/kl/sent/photo-2.jpg`).put(new Uint8Array([1]), { contentType: "image/jpeg" }))).toBe(false);
  });
});
