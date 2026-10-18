// Chat (roadmap 4.4) in the database and storage rules: who sees which chat,
// only management makes groups, anyone messages anyone in the company,
// your own message can be changed for 15 minutes, files up to 32 MB.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import fs from "node:fs";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { serverTimestamp, Timestamp } from "firebase/firestore";

const CO = "co";
const C = `companies/${CO}/chats`;
let env;
const PEOPLE = {
  owner: { role: "owner" },
  klManager: { role: "manager", branchId: "kl" },
  klCashier: { role: "cashier", branchId: "kl" },
  ali: { role: "staff", branchId: "kl", staffId: "st-ali" },
  kumar: { role: "staff", branchId: "kl", staffId: "st-kumar" },
  rahim: { role: "staff", branchId: "pj", staffId: "st-rahim" },
};
const db = (uid) => env.authenticatedContext(uid).firestore();
const files = (uid) => env.authenticatedContext(uid).storage();
const ok = (p) => p.then(() => true, () => false);
const msg = (uid, extra = {}) => ({ byUid: uid, byName: uid, text: "hi", files: [], createdAt: serverTimestamp(), deleted: false, ...extra });

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
    await d.doc("users/stranger").set({ companyId: "other", role: "owner" });
    await d.doc(`companies/${CO}`).set({ name: "Co", ownerUid: "owner" });
    await d.doc(`${C}/company`).set({ kind: "company", name: "Everyone" });
    await d.doc(`${C}/branch_kl`).set({ kind: "branch", branchId: "kl", name: "KL" });
    await d.doc(`${C}/dm_ali_kumar`).set({ kind: "direct", members: ["ali", "kumar"] });
    await d.doc(`${C}/g1`).set({ kind: "group", name: "Kitchen", members: ["klManager", "ali"], createdBy: "klManager" });
    await d.doc(`${C}/dm_ali_kumar/messages/fresh`).set({ ...msg("ali"), createdAt: Timestamp.now() });
    await d.doc(`${C}/dm_ali_kumar/messages/old`).set({ ...msg("ali"), createdAt: Timestamp.fromMillis(Date.now() - 20 * 60 * 1000) });
  });
});

describe("who sees which chat", () => {
  it("company chat: everyone in the company — not outsiders", async () => {
    expect(await ok(db("rahim").doc(`${C}/company`).get())).toBe(true);
    expect(await ok(db("stranger").doc(`${C}/company`).get())).toBe(false);
  });
  it("branch chat: its people and the owner — not another branch", async () => {
    expect(await ok(db("ali").doc(`${C}/branch_kl/messages/x`).get())).toBe(true);
    expect(await ok(db("owner").doc(`${C}/branch_kl`).get())).toBe(true);
    expect(await ok(db("rahim").doc(`${C}/branch_kl`).get())).toBe(false);
  });
  it("personal chats and groups: their members only — the owner is left out too", async () => {
    expect(await ok(db("kumar").doc(`${C}/dm_ali_kumar/messages/fresh`).get())).toBe(true);
    expect(await ok(db("owner").doc(`${C}/dm_ali_kumar/messages/fresh`).get())).toBe(false);
    expect(await ok(db("klCashier").doc(`${C}/g1`).get())).toBe(false);
  });
  it("each person lists the groups and personal chats they are in", async () => {
    const mine = await db("ali").collection(C).where("members", "array-contains", "ali").get();
    expect(mine.docs.map((d) => d.id).sort()).toEqual(["dm_ali_kumar", "g1"]);
  });
});

describe("starting chats", () => {
  it("anyone messages anyone in the company personally — staff included", async () => {
    expect(await ok(db("ali").doc(`${C}/dm_ali_rahim`).set({ kind: "direct", members: ["ali", "rahim"] }))).toBe(true);
    expect(await ok(db("rahim").doc(`${C}/dm_kumar_rahim`).set({ kind: "direct", members: ["kumar", "rahim"] }))).toBe(true);
  });
  it("not someone outside the company, nor a chat between two others", async () => {
    expect(await ok(db("ali").doc(`${C}/dm_ali_stranger`).set({ kind: "direct", members: ["ali", "stranger"] }))).toBe(false);
    expect(await ok(db("ali").doc(`${C}/dm_kumar_rahim`).set({ kind: "direct", members: ["kumar", "rahim"] }))).toBe(false);
  });
  it("only management makes groups", async () => {
    const group = (uid) => ({ kind: "group", name: "G", members: [uid, "ali"], createdBy: uid });
    expect(await ok(db("klManager").collection(C).add(group("klManager")))).toBe(true);
    expect(await ok(db("owner").collection(C).add(group("owner")))).toBe(true);
    expect(await ok(db("klCashier").collection(C).add(group("klCashier")))).toBe(false);
    expect(await ok(db("ali").collection(C).add(group("ali")))).toBe(false);
  });
  it("management changes who is in a group; a member who isn't management can't", async () => {
    expect(await ok(db("klManager").doc(`${C}/g1`).update({ members: ["klManager", "ali", "kumar"] }))).toBe(true);
    expect(await ok(db("ali").doc(`${C}/g1`).update({ members: ["klManager", "ali", "rahim"] }))).toBe(false);
  });
});

describe("messages", () => {
  it("members write as themselves — never as someone else, never into a chat they're not in", async () => {
    expect(await ok(db("kumar").collection(`${C}/dm_ali_kumar/messages`).add(msg("kumar")))).toBe(true);
    expect(await ok(db("kumar").collection(`${C}/dm_ali_kumar/messages`).add(msg("ali")))).toBe(false);
    expect(await ok(db("rahim").collection(`${C}/dm_ali_kumar/messages`).add(msg("rahim")))).toBe(false);
  });
  it("your own message can be changed or deleted for 15 minutes", async () => {
    expect(await ok(db("ali").doc(`${C}/dm_ali_kumar/messages/fresh`).update({ text: "hello", editedAt: serverTimestamp() }))).toBe(true);
    expect(await ok(db("ali").doc(`${C}/dm_ali_kumar/messages/old`).update({ text: "hello" }))).toBe(false);
    expect(await ok(db("kumar").doc(`${C}/dm_ali_kumar/messages/fresh`).update({ deleted: true, text: "" }))).toBe(false);
    expect(await ok(db("ali").doc(`${C}/dm_ali_kumar/messages/fresh`).update({ deleted: true, text: "", files: [] }))).toBe(true);
  });
  it("a new message may move the chat up the list — nothing else about the chat changes", async () => {
    expect(await ok(db("kumar").doc(`${C}/dm_ali_kumar`).update({ lastMessage: { text: "hi" }, updatedAt: serverTimestamp() }))).toBe(true);
    expect(await ok(db("kumar").doc(`${C}/dm_ali_kumar`).update({ members: ["kumar", "rahim"] }))).toBe(false);
  });
  it("anyone in the chat reacts — only with their own reaction, and only that changes", async () => {
    const m = `${C}/dm_ali_kumar/messages/old`; // reacting has no 15-minute limit
    expect(await ok(db("kumar").doc(m).update({ "reactions.kumar": "👍" }))).toBe(true);
    expect(await ok(db("kumar").doc(m).update({ "reactions.ali": "😂" }))).toBe(false);
    expect(await ok(db("kumar").doc(m).update({ "reactions.kumar": "❤️", text: "changed" }))).toBe(false);
    expect(await ok(db("rahim").doc(m).update({ "reactions.rahim": "👍" }))).toBe(false);
  });
  it("seen is each person's own", async () => {
    expect(await ok(db("kumar").doc(`${C}/dm_ali_kumar/reads/kumar`).set({ at: serverTimestamp() }))).toBe(true);
    expect(await ok(db("kumar").doc(`${C}/dm_ali_kumar/reads/ali`).set({ at: serverTimestamp() }))).toBe(false);
  });
});

describe("chat files", () => {
  const put = (uid, path, bytes) => files(uid).ref(path).put(new Uint8Array(bytes), { contentType: "application/pdf" });
  it("members upload into their own folder; others in the chat open them; outsiders can't", async () => {
    expect(await ok(put("ali", `chat/${CO}/dm_ali_kumar/ali/bill.pdf`, 10))).toBe(true);
    expect(await ok(put("ali", `chat/${CO}/dm_ali_kumar/kumar/bill.pdf`, 10))).toBe(false);
    expect(await ok(put("rahim", `chat/${CO}/dm_ali_kumar/rahim/bill.pdf`, 10))).toBe(false);
    await put("ali", `chat/${CO}/dm_ali_kumar/ali/a.pdf`, 10);
    expect(await ok(files("kumar").ref(`chat/${CO}/dm_ali_kumar/ali/a.pdf`).getDownloadURL())).toBe(true);
    expect(await ok(files("owner").ref(`chat/${CO}/dm_ali_kumar/ali/a.pdf`).getDownloadURL())).toBe(false);
  });
  it("up to 32 MB a file", async () => {
    expect(await ok(put("ali", `chat/${CO}/company/ali/big.pdf`, 32 * 1024 * 1024 + 1))).toBe(false);
  });
});

describe("stickers and labels", () => {
  it("management adds company stickers; everyone in the company sees them", async () => {
    expect(await ok(db("klManager").collection(`companies/${CO}/stickers`).add({ name: "Logo", url: "x", createdBy: "klManager" }))).toBe(true);
    expect(await ok(db("klCashier").collection(`companies/${CO}/stickers`).add({ name: "Mine", url: "x", createdBy: "klCashier" }))).toBe(false);
    expect(await ok(db("ali").collection(`companies/${CO}/stickers`).get())).toBe(true);
    expect(await ok(db("stranger").collection(`companies/${CO}/stickers`).get())).toBe(false);
  });
  it("sticker images: management uploads an image up to 1 MB; the company opens them", async () => {
    const put = (uid, name, bytes, type = "image/png") => files(uid).ref(`stickers/${CO}/${name}`).put(new Uint8Array(bytes), { contentType: type });
    expect(await ok(put("klManager", "logo.png", 100))).toBe(true);
    expect(await ok(put("klManager", "big.png", 1024 * 1024 + 1))).toBe(false);
    expect(await ok(put("klManager", "doc.pdf", 100, "application/pdf"))).toBe(false);
    expect(await ok(put("ali", "mine.png", 100))).toBe(false);
    expect(await ok(files("ali").ref(`stickers/${CO}/logo.png`).getDownloadURL())).toBe(true);
  });
  it("labels are each person's own", async () => {
    const mine = `companies/${CO}/users/ali/prefs/chatLabels`;
    expect(await ok(db("ali").doc(mine).set({ labels: [{ id: "a", name: "Urgent" }], chats: {} }))).toBe(true);
    expect(await ok(db("kumar").doc(mine).get())).toBe(false);
  });
});
