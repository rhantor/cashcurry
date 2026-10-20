// Tasks, checklists, ratings and notes (roadmap 4.11) in the database and
// storage rules: management (and in-charge) give tasks and rate; whoever has
// a task sees it and marks it done; notes are their owner's alone.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import fs from "node:fs";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";

const CO = "co";
const B = `companies/${CO}/branches/kl`;
const T = `${B}/tasks`;
const C = `${B}/taskChecks`;
const R = `${B}/ratings`;
let env;
const PEOPLE = {
  owner: { role: "owner" },
  klManager: { role: "manager", branchId: "kl" },
  klInCharge: { role: "inCharge", branchId: "kl" },
  klCashier: { role: "cashier", branchId: "kl" },
  pjManager: { role: "manager", branchId: "pj" },
  ali: { role: "staff", branchId: "kl", staffId: "st-ali" },
  siti: { role: "staff", branchId: "kl", staffId: "st-siti" },
};
const db = (uid) => env.authenticatedContext(uid).firestore();
const files = (uid) => env.authenticatedContext(uid).storage();
const ok = (p) => p.then(() => true, () => false);
const task = (assigneeUid, extra = {}) => ({ title: "Clean the fryer", assigneeUid, assignee: { uid: assigneeUid }, creatorUid: "klManager", createdBy: { uid: "klManager" }, repeat: null, status: "open", active: true, ...extra });
const tick = (uid, taskId, date, extra = {}) => ({ taskId, date, assigneeUid: "ali", by: { uid }, doneOn: date, ...extra });

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
    await d.doc(`${T}/alisOnce`).set(task("ali"));
    await d.doc(`${T}/alisDaily`).set(task("ali", { repeat: { every: "day" } }));
    await d.doc(`${T}/sitis`).set(task("siti"));
    await d.doc(`${C}/alisDaily_2026-10-19`).set(tick("ali", "alisDaily", "2026-10-19"));
    await d.doc(`${R}/2026-10_ali`).set({ uid: "ali", month: "2026-10", stars: 4, by: { uid: "klManager" } });
    await d.doc(`companies/${CO}/users/ali/notes/n1`).set({ title: "Mine" });
  });
});

describe("giving tasks", () => {
  it("management and in-charge give, change and delete them; others don't", async () => {
    expect(await ok(db("klManager").collection(T).add(task("siti")))).toBe(true);
    expect(await ok(db("klInCharge").collection(T).add(task("siti")))).toBe(true);
    expect(await ok(db("owner").doc(`${T}/sitis`).update({ title: "Mop the floor" }))).toBe(true);
    expect(await ok(db("klCashier").collection(T).add(task("ali")))).toBe(false);
    expect(await ok(db("ali").collection(T).add(task("ali")))).toBe(false);
    expect(await ok(db("pjManager").collection(T).add(task("ali")))).toBe(false); // another branch
    expect(await ok(db("klManager").doc(`${T}/sitis`).delete())).toBe(true);
  });
  it("whoever has a task sees it; others only theirs", async () => {
    expect(await ok(db("ali").doc(`${T}/alisOnce`).get())).toBe(true);
    expect(await ok(db("ali").doc(`${T}/sitis`).get())).toBe(false);
    expect(await ok(db("ali").collection(T).where("assigneeUid", "==", "ali").get())).toBe(true);
    expect(await ok(db("ali").collection(T).get())).toBe(false); // not the whole list
    expect(await ok(db("klManager").collection(T).get())).toBe(true);
    expect(await ok(db("klCashier").collection(T).get())).toBe(false);
  });
});

describe("doing them", () => {
  it("the assignee marks a one-off done — and changes nothing else", async () => {
    expect(await ok(db("ali").doc(`${T}/alisOnce`).update({ status: "done", done: { by: { uid: "ali" }, date: "2026-10-20" } }))).toBe(true);
    expect(await ok(db("ali").doc(`${T}/alisOnce`).update({ title: "Easier task" }))).toBe(false);
    expect(await ok(db("ali").doc(`${T}/alisOnce`).update({ status: "done", assigneeUid: "siti" }))).toBe(false);
    expect(await ok(db("siti").doc(`${T}/alisOnce`).update({ status: "done" }))).toBe(false); // not theirs
    expect(await ok(db("ali").doc(`${T}/alisDaily`).update({ status: "done" }))).toBe(false); // repeating: ticks, not status
  });
  it("ticks a day of a repeating task as themselves, under its own id", async () => {
    expect(await ok(db("ali").doc(`${C}/alisDaily_2026-10-20`).set(tick("ali", "alisDaily", "2026-10-20")))).toBe(true);
    expect(await ok(db("ali").doc(`${C}/alisDaily_2026-10-21`).set(tick("ali", "alisDaily", "2026-10-20")))).toBe(false); // id must match
    expect(await ok(db("ali").doc(`${C}/alisDaily_2026-10-20`).set(tick("siti", "alisDaily", "2026-10-20")))).toBe(false); // not as someone else
    expect(await ok(db("siti").doc(`${C}/alisDaily_2026-10-20`).set(tick("siti", "alisDaily", "2026-10-20")))).toBe(false); // not their task
    expect(await ok(db("klManager").doc(`${C}/alisDaily_2026-10-18`).set(tick("klManager", "alisDaily", "2026-10-18")))).toBe(true); // for them
  });
  it("unticks their own; sees their ticks, not others'", async () => {
    expect(await ok(db("ali").doc(`${C}/alisDaily_2026-10-19`).get())).toBe(true);
    expect(await ok(db("siti").doc(`${C}/alisDaily_2026-10-19`).get())).toBe(false);
    expect(await ok(db("siti").doc(`${C}/alisDaily_2026-10-19`).delete())).toBe(false);
    expect(await ok(db("ali").doc(`${C}/alisDaily_2026-10-19`).delete())).toBe(true);
  });
  it("proof photos: their own folder, images only", async () => {
    const img = new Uint8Array([1, 2, 3]);
    expect(await ok(files("ali").ref(`tasks/${CO}/kl/ali/p.jpg`).put(img, { contentType: "image/jpeg" }))).toBe(true);
    expect(await ok(files("ali").ref(`tasks/${CO}/kl/siti/p.jpg`).put(img, { contentType: "image/jpeg" }))).toBe(false);
    expect(await ok(files("ali").ref(`tasks/${CO}/kl/ali/p.exe`).put(img, { contentType: "application/octet-stream" }))).toBe(false);
  });
});

describe("ratings and notes", () => {
  const rate = (by, uid, stars = 5) => ({ uid, month: "2026-10", stars, note: "", by: { uid: by } });
  it("management rates others, never themselves, 1–5 stars, under {month}_{uid}", async () => {
    expect(await ok(db("klManager").doc(`${R}/2026-10_siti`).set(rate("klManager", "siti")))).toBe(true);
    expect(await ok(db("klManager").doc(`${R}/2026-10_klManager`).set(rate("klManager", "klManager")))).toBe(false);
    expect(await ok(db("klManager").doc(`${R}/2026-10_siti`).set(rate("klManager", "siti", 6)))).toBe(false);
    expect(await ok(db("klManager").doc(`${R}/2026-11_siti`).set(rate("klManager", "siti")))).toBe(false); // id must match
    expect(await ok(db("klCashier").doc(`${R}/2026-10_siti`).set(rate("klCashier", "siti")))).toBe(false);
  });
  it("people see their own rating only", async () => {
    expect(await ok(db("ali").doc(`${R}/2026-10_ali`).get())).toBe(true);
    expect(await ok(db("siti").doc(`${R}/2026-10_ali`).get())).toBe(false);
  });
  it("notes are their owner's alone", async () => {
    expect(await ok(db("ali").doc(`companies/${CO}/users/ali/notes/n1`).get())).toBe(true);
    expect(await ok(db("ali").collection(`companies/${CO}/users/ali/notes`).add({ title: "Buy milk" }))).toBe(true);
    expect(await ok(db("owner").doc(`companies/${CO}/users/ali/notes/n1`).get())).toBe(false);
    expect(await ok(db("klManager").collection(`companies/${CO}/users/ali/notes`).add({ title: "x" }))).toBe(false);
  });
});
