// Tasks, checklists, ratings and notes (roadmap 4.11) in the database and
// storage rules: management (and in-charge) give tasks and rate; whoever has
// a task sees it and marks it done; notes are their owner's alone.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import fs from "node:fs";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { serverTimestamp } from "firebase/firestore";

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
  kumar: { role: "staff", branchId: "kl", staffId: "st-kumar" },
  rahim: { role: "supervisor", branchId: "kl" }, // leads Ali; Kumar has no supervisor
  nadia: { role: "supervisor", branchId: "kl" }, // leads Siti
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
    // who leads whom (4.11): on the staff records
    await d.doc(`${B}/staff/st-ali`).set({ firstName: "Ali", uid: "ali", supervisorUid: "rahim" });
    await d.doc(`${B}/staff/st-siti`).set({ firstName: "Siti", uid: "siti", supervisorUid: "nadia" });
    await d.doc(`${B}/staff/st-kumar`).set({ firstName: "Kumar", uid: "kumar" });
    await d.doc(`${T}/forRahim`).set(task("rahim"));
    await d.doc(`${T}/ledByRahim`).set(task("ali", { repeat: { every: "day" }, teamLeadUid: "rahim", creatorUid: "rahim", createdBy: { uid: "rahim" } }));
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
    expect(await ok(files("ali").ref(`tasks/${CO}/kl/ali/v.m4a`).put(img, { contentType: "audio/mp4" }))).toBe(true); // a voice question
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

describe("supervisors and their team", () => {
  const mine = (assigneeUid, extra = {}) => task(assigneeUid, { creatorUid: "rahim", createdBy: { uid: "rahim" }, teamLeadUid: "rahim", ...extra });
  it("give tasks to their own team (and to staff with no supervisor), leading them", async () => {
    expect(await ok(db("rahim").collection(T).add(mine("ali")))).toBe(true);
    expect(await ok(db("rahim").collection(T).add(mine("kumar")))).toBe(true);
    expect(await ok(db("rahim").collection(T).add(mine("siti")))).toBe(false); // Nadia's team
    expect(await ok(db("rahim").collection(T).add(mine("klCashier")))).toBe(false); // not staff
    expect(await ok(db("rahim").collection(T).add(mine("ali", { teamLeadUid: null })))).toBe(false); // must lead it
    expect(await ok(db("rahim").collection(T).add(mine("ali", { creatorUid: "klManager" })))).toBe(false); // as themselves
  });
  it("see the tasks they lead or were given — not the whole branch", async () => {
    expect(await ok(db("rahim").collection(T).where("teamLeadUid", "==", "rahim").get())).toBe(true);
    expect(await ok(db("rahim").collection(T).where("assigneeUid", "==", "rahim").get())).toBe(true);
    expect(await ok(db("rahim").doc(`${T}/sitis`).get())).toBe(false);
    expect(await ok(db("rahim").collection(T).get())).toBe(false);
  });
  it("change and delete what they lead, within their team only", async () => {
    expect(await ok(db("rahim").doc(`${T}/ledByRahim`).update({ title: "Clean the fryer well" }))).toBe(true);
    expect(await ok(db("rahim").doc(`${T}/ledByRahim`).update({ assigneeUid: "siti", assignee: { uid: "siti" } }))).toBe(false);
    expect(await ok(db("nadia").doc(`${T}/ledByRahim`).update({ title: "x" }))).toBe(false);
    expect(await ok(db("rahim").doc(`${T}/alisOnce`).delete())).toBe(false); // the manager's
    expect(await ok(db("rahim").doc(`${T}/ledByRahim`).delete())).toBe(true);
  });
  it("hand a task given to them on to their team — nothing else in the same go", async () => {
    const pass = (to, extra = {}) => ({ assigneeUid: to, assignee: { uid: to }, teamLeadUid: "rahim", via: [{ uid: "rahim" }], ...extra });
    expect(await ok(db("rahim").doc(`${T}/forRahim`).update(pass("siti")))).toBe(false); // not their team
    expect(await ok(db("rahim").doc(`${T}/forRahim`).update(pass("ali", { title: "Easier" })))).toBe(false);
    expect(await ok(db("nadia").doc(`${T}/forRahim`).update({ ...pass("siti"), teamLeadUid: "nadia" }))).toBe(false); // not given to her
    expect(await ok(db("rahim").doc(`${T}/forRahim`).update(pass("ali")))).toBe(true);
  });
  it("ticks carry the team lead; the supervisor can tick for their team and sees the ticks", async () => {
    const t = (by, date, lead) => ({ taskId: "ledByRahim", date, assigneeUid: "ali", teamLeadUid: lead, by: { uid: by }, doneOn: date });
    expect(await ok(db("ali").doc(`${C}/ledByRahim_2026-10-20`).set(t("ali", "2026-10-20", "nadia")))).toBe(false); // wrong lead
    expect(await ok(db("ali").doc(`${C}/ledByRahim_2026-10-20`).set(t("ali", "2026-10-20", "rahim")))).toBe(true);
    expect(await ok(db("rahim").doc(`${C}/ledByRahim_2026-10-21`).set(t("rahim", "2026-10-21", "rahim")))).toBe(true);
    expect(await ok(db("nadia").doc(`${C}/ledByRahim_2026-10-22`).set(t("nadia", "2026-10-22", "rahim")))).toBe(false);
    expect(await ok(db("rahim").collection(C).where("teamLeadUid", "==", "rahim").get())).toBe(true);
    expect(await ok(db("nadia").doc(`${C}/ledByRahim_2026-10-20`).get())).toBe(false);
  });
  it("management moves ticks to a new team lead — only that, and only management", async () => {
    expect(await ok(db("klManager").doc(`${C}/alisDaily_2026-10-19`).update({ teamLeadUid: "rahim" }))).toBe(true);
    expect(await ok(db("klManager").doc(`${C}/alisDaily_2026-10-19`).update({ teamLeadUid: "nadia", doneOn: "2026-10-01" }))).toBe(false);
    expect(await ok(db("rahim").doc(`${C}/alisDaily_2026-10-19`).update({ teamLeadUid: "rahim" }))).toBe(false);
  });
  it("don't rate", async () => {
    expect(await ok(db("rahim").doc(`${R}/2026-10_ali`).set({ uid: "ali", month: "2026-10", stars: 5, by: { uid: "rahim" } }))).toBe(false);
  });
});

describe("a task's questions and answers", () => {
  it("each new one counts the task's messages up by one, as whoever wrote it", async () => {
    const bump = (uid, n = 1) => ({ commentCount: n, lastCommentAt: serverTimestamp(), lastCommentByUid: uid });
    expect(await ok(db("ali").doc(`${T}/ledByRahim`).update(bump("ali")))).toBe(true);
    expect(await ok(db("rahim").doc(`${T}/ledByRahim`).update(bump("rahim", 2)))).toBe(true);
    expect(await ok(db("ali").doc(`${T}/ledByRahim`).update(bump("ali", 5)))).toBe(false); // by one only
    expect(await ok(db("ali").doc(`${T}/ledByRahim`).update(bump("rahim", 3)))).toBe(false); // as themselves
    expect(await ok(db("siti").doc(`${T}/ledByRahim`).update(bump("siti", 3)))).toBe(false); // not theirs
    expect(await ok(db("ali").doc(`${T}/ledByRahim`).update({ ...bump("ali", 3), title: "x" }))).toBe(false);
  });
  const say = (uid) => ({ byUid: uid, byName: uid, text: "Which oil?", photos: [], createdAt: serverTimestamp() });
  it("whoever has it, leads it, gave it or manages asks and answers, as themselves", async () => {
    expect(await ok(db("ali").collection(`${T}/ledByRahim/comments`).add(say("ali")))).toBe(true);
    expect(await ok(db("rahim").collection(`${T}/ledByRahim/comments`).add(say("rahim")))).toBe(true);
    expect(await ok(db("klManager").collection(`${T}/ledByRahim/comments`).add(say("klManager")))).toBe(true);
    expect(await ok(db("siti").collection(`${T}/ledByRahim/comments`).add(say("siti")))).toBe(false);
    expect(await ok(db("ali").collection(`${T}/ledByRahim/comments`).add(say("rahim")))).toBe(false); // not as someone else
    expect(await ok(db("rahim").collection(`${T}/ledByRahim/comments`).get())).toBe(true);
    expect(await ok(db("nadia").collection(`${T}/ledByRahim/comments`).get())).toBe(false);
  });
});

describe("who does it each day — rota and covers (31 Oct)", () => {
  const rota = { 5: { uid: "ali" }, 6: { uid: "kumar" } };
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      // the manager gave Rahim the opening check; Rahim puts Ali and Kumar on it
      await ctx.firestore().doc(`${T}/opening`).set(task("rahim", { repeat: { every: "day" }, doers: ["rahim"] }));
      await ctx.firestore().doc(`${T}/rotaed`).set(task("rahim", { repeat: { every: "day" }, teamLeadUid: "rahim", rota, doers: ["rahim", "ali", "kumar"] }));
    });
  });
  it("a supervisor can't write a rota or a cover themselves — the server does, checking the people (30 Oct)", async () => {
    const set = (extra = {}) => ({ rota, covers: {}, doers: ["rahim", "ali", "kumar"], teamLeadUid: "rahim", ...extra });
    expect(await ok(db("rahim").doc(`${T}/opening`).update(set()))).toBe(false);
    expect(await ok(db("rahim").doc(`${T}/rotaed`).update({ covers: { "2026-10-30": { uid: "kumar" } } }))).toBe(false);
    expect(await ok(db("nadia").doc(`${T}/opening`).update({ ...set(), teamLeadUid: "nadia" }))).toBe(false);
    expect(await ok(db("ali").doc(`${T}/opening`).update(set()))).toBe(false);
    expect(await ok(db("klManager").doc(`${T}/opening`).update(set()))).toBe(true); // management writes tasks as before
  });
  it("a supervisor never adds someone new to who a task falls to (doers) — only its new assignee", async () => {
    // leading Ali's task (with Kumar on Saturdays): changing it keeps its people; adding Siti (Nadia's) is refused
    await env.withSecurityRulesDisabled((ctx) =>
      ctx.firestore().doc(`${T}/led`).set(task("ali", { repeat: { every: "day" }, teamLeadUid: "rahim", rota: { 6: { uid: "kumar" } }, doers: ["ali", "kumar"] }))
    );
    expect(await ok(db("rahim").doc(`${T}/led`).update({ title: "Opening check", doers: ["ali", "kumar"] }))).toBe(true);
    expect(await ok(db("rahim").doc(`${T}/led`).update({ doers: ["ali", "kumar", "siti"] }))).toBe(false);
    expect(await ok(db("rahim").doc(`${T}/led`).update({ rota: { 6: { uid: "siti" } } }))).toBe(false);
    expect(await ok(db("rahim").doc(`${T}/led`).update({ doers: ["ali"] }))).toBe(true); // fewer is fine
    // handing over: the new assignee joins, no one else
    const hand = (doers) => ({ assignee: { uid: "ali" }, assigneeUid: "ali", teamLeadUid: "rahim", via: [{ uid: "rahim" }], doers });
    expect(await ok(db("rahim").doc(`${T}/opening`).update(hand(["ali", "siti"])))).toBe(false);
    expect(await ok(db("rahim").doc(`${T}/opening`).update(hand(["ali"])))).toBe(true);
    // a new task: falls to its assignee only, with no rota or covers
    const fresh = (extra) => task("ali", { creatorUid: "rahim", createdBy: { uid: "rahim" }, teamLeadUid: "rahim", repeat: { every: "day" }, doers: ["ali"], ...extra });
    expect(await ok(db("rahim").doc(`${T}/new1`).set(fresh({ doers: ["ali", "siti"] })))).toBe(false);
    expect(await ok(db("rahim").doc(`${T}/new2`).set(fresh({ rota: { 1: { uid: "siti" } } })))).toBe(false);
    expect(await ok(db("rahim").doc(`${T}/new3`).set(fresh()))).toBe(true);
  });
  it("whoever is on the rota sees the task and ticks their own day as themselves", async () => {
    expect(await ok(db("kumar").collection(T).where("doers", "array-contains", "kumar").get())).toBe(true);
    expect(await ok(db("kumar").doc(`${T}/rotaed`).get())).toBe(true);
    expect(await ok(db("siti").doc(`${T}/rotaed`).get())).toBe(false);
    const t = (by, doer) => ({ taskId: "rotaed", date: "2026-10-31", assigneeUid: "rahim", teamLeadUid: "rahim", doerUid: doer, by: { uid: by }, doneOn: "2026-10-31" });
    expect(await ok(db("siti").doc(`${C}/rotaed_2026-10-31`).set(t("siti", "siti")))).toBe(false); // not on it
    expect(await ok(db("kumar").doc(`${C}/rotaed_2026-10-31`).set(t("kumar", "ali")))).toBe(false); // as someone else
    expect(await ok(db("kumar").doc(`${C}/rotaed_2026-10-31`).set(t("kumar", "kumar")))).toBe(true);
    expect(await ok(db("kumar").collection(C).where("doerUid", "==", "kumar").get())).toBe(true);
    expect(await ok(db("kumar").doc(`${C}/rotaed_2026-10-31`).delete())).toBe(true); // their own tick
  });
});
