// Notifications (roadmap 4.3) in the database rules: each person's inbox is
// theirs and written only by the server; who gets what at a branch is chosen
// by owner, super admin, gm or that branch's admin — not a manager.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import fs from "node:fs";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";

const CO = "co";
const B = `companies/${CO}/branches/kl`;
let env;
const PEOPLE = {
  owner: { role: "owner" },
  gm: { role: "gm" },
  klAdmin: { role: "branchAdmin", branchId: "kl" },
  pjAdmin: { role: "branchAdmin", branchId: "pj" },
  klManager: { role: "manager", branchId: "kl" },
  klCashier: { role: "cashier", branchId: "kl" },
};
const as = (uid) => env.authenticatedContext(uid).firestore();
const ok = (p) => p.then(() => true, () => false);
const inbox = (uid, id = "n1") => `companies/${CO}/users/${uid}/inbox/${id}`;

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
    await d.doc(`${B}/settings/settings`).set({ basic: { phone: "1" } });
    await d.doc(`${B}/settings/notifications`).set({ recipients: {}, dailyAt: "09:00" });
    await d.doc(inbox("klCashier")).set({ title: "To pay out", body: "…", readAt: null });
  });
});

describe("each person's inbox", () => {
  it("is read only by its owner", async () => {
    expect(await ok(as("klCashier").doc(inbox("klCashier")).get())).toBe(true);
    expect(await ok(as("klManager").doc(inbox("klCashier")).get())).toBe(false);
    expect(await ok(as("owner").doc(inbox("klCashier")).get())).toBe(false);
  });
  it("can be marked read or cleared by its owner — nothing else changes", async () => {
    expect(await ok(as("klCashier").doc(inbox("klCashier")).update({ readAt: new Date() }))).toBe(true);
    expect(await ok(as("klCashier").doc(inbox("klCashier")).update({ title: "fake" }))).toBe(false);
    expect(await ok(as("klCashier").doc(inbox("klCashier")).delete())).toBe(true);
  });
  it("is written only by the server — no one can post into anyone's inbox, their own included", async () => {
    expect(await ok(as("klManager").doc(inbox("klCashier", "x")).set({ title: "fake" }))).toBe(false);
    expect(await ok(as("klCashier").doc(inbox("klCashier", "x")).set({ title: "fake" }))).toBe(false);
  });
  it("the old shared feed takes no new posts", async () => {
    expect(await ok(as("owner").collection(`companies/${CO}/notifications`).add({ title: "x" }))).toBe(false);
  });
  it("muting is each person's own", async () => {
    expect(await ok(as("klCashier").doc(`companies/${CO}/users/klCashier/prefs/notifications`).set({ muted: ["requests.payout"] }))).toBe(true);
    expect(await ok(as("klManager").doc(`companies/${CO}/users/klCashier/prefs/notifications`).set({ muted: [] }))).toBe(false);
  });
});

describe("who gets which notifications at a branch", () => {
  const choose = { recipients: { "daily.sales": ["owner"] }, dailyAt: "21:00" };
  it("chosen by owner, gm or this branch's admin", async () => {
    expect(await ok(as("owner").doc(`${B}/settings/notifications`).set(choose))).toBe(true);
    expect(await ok(as("gm").doc(`${B}/settings/notifications`).set(choose))).toBe(true);
    expect(await ok(as("klAdmin").doc(`${B}/settings/notifications`).set(choose))).toBe(true);
  });
  it("not by a manager, a cashier or another branch's admin", async () => {
    expect(await ok(as("klManager").doc(`${B}/settings/notifications`).set(choose))).toBe(false);
    expect(await ok(as("klCashier").doc(`${B}/settings/notifications`).set(choose))).toBe(false);
    expect(await ok(as("pjAdmin").doc(`${B}/settings/notifications`).set(choose))).toBe(false);
  });
  it("a manager still saves the rest of the branch settings", async () => {
    expect(await ok(as("klManager").doc(`${B}/settings/settings`).update({ "basic.phone": "2" }))).toBe(true);
  });
});
