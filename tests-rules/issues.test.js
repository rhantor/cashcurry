// Issues (roadmap 4.5) in the database and storage rules: everyone raises
// them; office roles see the branch's, staff only theirs; management (and
// in-charge) assign and close; the assignee starts and resolves; the
// reporter reopens; the discussion is for those who can see the issue.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import fs from "node:fs";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { serverTimestamp } from "firebase/firestore";

const CO = "co";
const B = `companies/${CO}/branches/kl`;
const I = `${B}/issues`;
let env;
const PEOPLE = {
  owner: { role: "owner" },
  klManager: { role: "manager", branchId: "kl" },
  klInCharge: { role: "inCharge", branchId: "kl" },
  klCashier: { role: "cashier", branchId: "kl" },
  pjManager: { role: "manager", branchId: "pj" },
  ali: { role: "staff", branchId: "kl", staffId: "st-ali" },
  kumar: { role: "staff", branchId: "kl", staffId: "st-kumar" },
  siti: { role: "staff", branchId: "kl", staffId: "st-siti" },
};
const db = (uid) => env.authenticatedContext(uid).firestore();
const files = (uid) => env.authenticatedContext(uid).storage();
const ok = (p) => p.then(() => true, () => false);
const raised = (uid, extra = {}) => ({ title: "Fryer broken", category: "equipment", priority: "normal", status: "open", reporterUid: uid, reportedBy: { uid }, assigneeUid: null, assignedTo: null, watchers: [uid], ...extra });

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
    await d.doc(`${I}/byAli`).set(raised("ali", { assigneeUid: "kumar", assignedTo: { uid: "kumar" } }));
    await d.doc(`${I}/done`).set(raised("ali", { status: "resolved", assigneeUid: "kumar" }));
    await d.doc(`${I}/byCashier`).set(raised("klCashier"));
  });
});

describe("raising issues", () => {
  it("anyone at the branch raises one, as themselves, open and unassigned", async () => {
    expect(await ok(db("siti").collection(I).add(raised("siti")))).toBe(true);
    expect(await ok(db("klCashier").collection(I).add(raised("klCashier")))).toBe(true);
    expect(await ok(db("siti").collection(I).add(raised("ali")))).toBe(false); // not as someone else
    expect(await ok(db("siti").collection(I).add(raised("siti", { assigneeUid: "kumar" })))).toBe(false); // can't assign
    expect(await ok(db("pjManager").collection(I).add(raised("pjManager")))).toBe(false); // another branch
  });
  it("management raises one already given to someone", async () => {
    expect(await ok(db("klManager").collection(I).add(raised("klManager", { assigneeUid: "kumar", status: "in_progress" })))).toBe(true);
  });
});

describe("seeing issues", () => {
  it("office roles see the branch's; staff only the ones they raised or were given", async () => {
    expect(await ok(db("klCashier").doc(`${I}/byAli`).get())).toBe(true);
    expect(await ok(db("owner").doc(`${I}/byAli`).get())).toBe(true);
    expect(await ok(db("pjManager").doc(`${I}/byAli`).get())).toBe(false);
    expect(await ok(db("ali").doc(`${I}/byAli`).get())).toBe(true);
    expect(await ok(db("kumar").doc(`${I}/byAli`).get())).toBe(true);
    expect(await ok(db("siti").doc(`${I}/byAli`).get())).toBe(false);
  });
  it("staff list only theirs", async () => {
    const mine = await db("ali").collection(I).where("reporterUid", "==", "ali").get();
    expect(mine.size).toBe(2);
    expect(await ok(db("ali").collection(I).get())).toBe(false); // not the whole branch
  });
});

describe("working on issues", () => {
  it("management and in-charge assign, re-prioritise and delete; the cashier can't", async () => {
    expect(await ok(db("klInCharge").doc(`${I}/byCashier`).update({ assigneeUid: "kumar", assignedTo: { uid: "kumar" }, priority: "urgent" }))).toBe(true);
    expect(await ok(db("klCashier").doc(`${I}/byCashier`).update({ priority: "normal" }))).toBe(false); // a real change (it is urgent now)
    expect(await ok(db("klManager").doc(`${I}/byCashier`).delete())).toBe(true);
  });
  it("whoever has it starts and resolves it — and changes nothing else", async () => {
    expect(await ok(db("kumar").doc(`${I}/byAli`).update({ status: "in_progress", updatedAt: serverTimestamp() }))).toBe(true);
    expect(await ok(db("kumar").doc(`${I}/byAli`).update({ status: "resolved", resolution: "new fuse", resolvedBy: { uid: "kumar" } }))).toBe(true);
    expect(await ok(db("kumar").doc(`${I}/byAli`).update({ title: "something else" }))).toBe(false);
    expect(await ok(db("siti").doc(`${I}/byAli`).update({ status: "resolved" }))).toBe(false);
  });
  it("whoever raised it reopens it once resolved — not before, and nothing else", async () => {
    expect(await ok(db("ali").doc(`${I}/done`).update({ status: "open", resolution: "" }))).toBe(true);
    expect(await ok(db("ali").doc(`${I}/byAli`).update({ status: "resolved" }))).toBe(false);
  });
});

describe("the discussion", () => {
  const comment = (uid) => ({ kind: "comment", byUid: uid, byName: uid, text: "on it", createdAt: serverTimestamp() });
  it("those who can see the issue write, as themselves; others can't read or write", async () => {
    expect(await ok(db("kumar").collection(`${I}/byAli/comments`).add(comment("kumar")))).toBe(true);
    expect(await ok(db("klCashier").collection(`${I}/byAli/comments`).add(comment("klCashier")))).toBe(true);
    expect(await ok(db("kumar").collection(`${I}/byAli/comments`).add(comment("ali")))).toBe(false);
    expect(await ok(db("siti").collection(`${I}/byAli/comments`).add(comment("siti")))).toBe(false);
    expect(await ok(db("siti").collection(`${I}/byAli/comments`).get())).toBe(false);
  });
  it("commenting may bump the issue's activity, nothing more", async () => {
    expect(await ok(db("klCashier").doc(`${I}/byAli`).update({ lastActivityAt: serverTimestamp(), watchers: ["ali", "klCashier"] }))).toBe(true);
    expect(await ok(db("klCashier").doc(`${I}/byAli`).update({ lastActivityAt: serverTimestamp(), status: "resolved" }))).toBe(false);
  });
});

describe("issue photos", () => {
  const put = (uid, path, bytes, type = "image/jpeg") => files(uid).ref(path).put(new Uint8Array(bytes), { contentType: type });
  it("people at the branch add photos (up to 10 MB, images) into their own folder", async () => {
    expect(await ok(put("ali", `issues/${CO}/kl/ali/fryer.jpg`, 100))).toBe(true);
    expect(await ok(put("ali", `issues/${CO}/kl/kumar/fryer.jpg`, 100))).toBe(false);
    expect(await ok(put("ali", `issues/${CO}/kl/ali/doc.pdf`, 100, "application/pdf"))).toBe(false);
    expect(await ok(put("pjManager", `issues/${CO}/kl/pjManager/x.jpg`, 100))).toBe(false);
    expect(await ok(put("ali", `issues/${CO}/kl/ali/big.jpg`, 10 * 1024 * 1024 + 1))).toBe(false);
  });
});
