import { describe, expect, it } from "vitest";
import {
  EDIT_WINDOW_MS, MAX_FILE_BYTES, branchChatId, canChangeMessage, canMakeGroups, canSeeChat, chatAudience, chatTitle, checkFiles, directChatId, isUnread, previewOf, seenBy,
} from "@/lib/chat/model";

const now = Date.parse("2026-10-18T12:00:00Z");
const ali = { uid: "ali", role: "staff", branchId: "kl" };
const kumar = { uid: "kumar", role: "staff", branchId: "kl" };
const pj = { uid: "rahim", role: "staff", branchId: "pj" };
const owner = { uid: "owner", role: "owner" };
const manager = { uid: "klm", role: "manager", branchId: "kl" };

describe("who sees which chat", () => {
  it("company chat: everyone; branch chat: its people and company roles; groups and personal chats: their members", () => {
    expect(canSeeChat({ kind: "company" }, pj)).toBe(true);
    const kl = { kind: "branch", branchId: "kl" };
    expect([ali, owner, pj].map((u) => canSeeChat(kl, u))).toEqual([true, true, false]);
    const dm = { kind: "direct", members: ["ali", "kumar"] };
    expect([ali, kumar, owner].map((u) => canSeeChat(dm, u))).toEqual([true, true, false]);
  });
  it("only management makes groups", () => {
    expect(["owner", "superAdmin", "gm", "branchAdmin", "manager"].every(canMakeGroups)).toBe(true);
    expect(["inCharge", "accountant", "supervisor", "cashier", "staff"].some(canMakeGroups)).toBe(false);
  });
  it("one personal chat per pair, whoever starts it", () => {
    expect(directChatId("kumar", "ali")).toBe(directChatId("ali", "kumar"));
    expect(branchChatId("kl")).toBe("branch_kl");
  });
});

describe("messages", () => {
  const sent = (minsAgo, extra = {}) => ({ byUid: "ali", createdAt: now - minsAgo * 60000, ...extra });
  it("your own can be changed for 15 minutes, not after, not someone else's, not once deleted", () => {
    expect(canChangeMessage(sent(14), "ali", now)).toBe(true);
    expect(canChangeMessage(sent(16), "ali", now)).toBe(false);
    expect(canChangeMessage(sent(1), "kumar", now)).toBe(false);
    expect(canChangeMessage(sent(1, { deleted: true }), "ali", now)).toBe(false);
    expect(EDIT_WINDOW_MS).toBe(15 * 60000);
  });
  it("files up to 32 MB", () => {
    const { ok, tooBig } = checkFiles([{ name: "a.pdf", size: MAX_FILE_BYTES }, { name: "b.mp4", size: MAX_FILE_BYTES + 1 }]);
    expect(ok.map((f) => f.name)).toEqual(["a.pdf"]);
    expect(tooBig.map((f) => f.name)).toEqual(["b.mp4"]);
  });
  it("a one-line preview", () => {
    expect(previewOf({ text: "  hello  " })).toBe("hello");
    expect(previewOf({ deleted: true, text: "x" })).toBe("Message deleted");
    expect(previewOf({ files: [{ type: "image/jpeg" }, { type: "image/png" }] })).toBe("📷 2 photos");
    expect(previewOf({ files: [{ type: "application/pdf", name: "bill.pdf" }] })).toBe("📎 bill.pdf");
  });
  it("seen by those who looked after it was sent, not its author", () => {
    const m = { byUid: "ali", createdAt: now };
    expect(seenBy(m, { ali: { at: now + 1 }, kumar: { at: now + 5 }, klm: { at: now - 5 } })).toEqual(["kumar"]);
  });
  it("unread when someone else wrote after you last looked", () => {
    const chat = { lastMessage: { byUid: "kumar", at: now } };
    expect(isUnread(chat, { at: now - 1 }, "ali")).toBe(true);
    expect(isUnread(chat, { at: now + 1 }, "ali")).toBe(false);
    expect(isUnread({ lastMessage: { byUid: "ali", at: now } }, null, "ali")).toBe(false);
  });
});

describe("who is pushed a new message", () => {
  const people = [ali, kumar, pj, owner, manager];
  it("branch chat: that branch's people (not company roles, not the sender)", () => {
    expect(chatAudience({ kind: "branch", branchId: "kl" }, people, "ali")).toEqual(["kumar", "klm"]);
  });
  it("company chat: everyone but the sender; group: its members", () => {
    expect(chatAudience({ kind: "company" }, people, "owner")).toEqual(["ali", "kumar", "rahim", "klm"]);
    expect(chatAudience({ kind: "group", members: ["owner", "klm", "rahim"] }, people, "klm")).toEqual(["rahim", "owner"]);
  });
  it("a personal chat is named after the other person", () => {
    expect(chatTitle({ kind: "direct", members: ["ali", "kumar"] }, "ali", { kumar: { name: "Kumar Raj" } })).toBe("Kumar Raj");
  });
});
