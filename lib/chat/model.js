// lib/chat/model.js
// Chat (roadmap 4.4, decided 18 Oct 2026). Pure — no Firebase; the screens,
// the Cloud Function that sends chat pushes and the rules tests read it, and
// firestore.rules / storage.rules enforce the same lines.
//
// companies/{c}/chats/{chatId}
//   kind: "company" | "branch" | "group" | "direct"
//   name, branchId (branch), members [uids] (group, direct), createdBy,
//   lastMessage { text, byUid, byName, at }, updatedAt
//   /messages/{id}  { byUid, byName, text, files [{ url, path, name, type, size }],
//                     replyTo { id, text, byName }, createdAt, editedAt, deleted }
//   /reads/{uid}    { at } — the last time this person saw the chat
// companies/{c}/chatPeople/{uid}  { name, role, branchId } — who you can message
//
// - Everyone in the company is in the company chat; everyone at a branch
//   (and the company roles) in that branch's chat.
// - Anyone may message anyone in the company personally (staff included).
// - Only management makes groups: owner, super admin, gm, branch admin, manager.
// - Your own message can be changed or deleted for 15 minutes; a deleted one
//   shows "message deleted".
// - Files up to 32 MB.

import { can, isCompanyRole } from "../authz/permissions";

export const EDIT_WINDOW_MS = 15 * 60 * 1000;
export const MAX_FILE_BYTES = 32 * 1024 * 1024;
export const PAGE_SIZE = 50;

/** Fixed ids, so the company and each branch have one chat, and two people one conversation. */
export const COMPANY_CHAT = "company";
export const branchChatId = (branchId) => `branch_${branchId}`;
export const directChatId = (a, b) => `dm_${[a, b].sort().join("_")}`;

/** Who may make (and manage) groups. */
export const canMakeGroups = (role) => can(role, "chat.groups");

/** Can this person see this chat? user: { uid, role, branchId } */
export function canSeeChat(chat, user) {
  if (!chat || !user?.uid) return false;
  if (chat.kind === "company") return true;
  if (chat.kind === "branch") return isCompanyRole(user.role) || user.branchId === chat.branchId;
  return (chat.members || []).includes(user.uid);
}

const ms = (t) => (t?.toMillis ? t.toMillis() : t?.seconds ? t.seconds * 1000 : t instanceof Date ? t.getTime() : typeof t === "number" ? t : t ? Date.parse(t) : 0);
export const timeOf = ms;

/** May `uid` still change or delete this message? (their own, not deleted, within 15 minutes) */
export function canChangeMessage(msg, uid, now = Date.now()) {
  return !!msg && msg.byUid === uid && !msg.deleted && now - ms(msg.createdAt) <= EDIT_WINDOW_MS;
}

/** The chat's name as this person sees it (a personal chat is named after the other person). */
export function chatTitle(chat, me, peopleById = {}, branchNames = {}) {
  if (!chat) return "";
  if (chat.kind === "company") return chat.name || "Everyone";
  if (chat.kind === "branch") return branchNames[chat.branchId] || (chat.name !== "Branch" && chat.name) || "Branch";
  if (chat.kind === "direct") {
    const other = (chat.members || []).find((u) => u !== me) || me;
    return peopleById[other]?.name || chat.names?.[other] || "Someone";
  }
  return chat.name || "Group";
}

/** Has something new arrived since this person last looked? */
export function isUnread(chat, myRead, me) {
  const last = chat?.lastMessage;
  if (!last || last.byUid === me) return false;
  return ms(last.at) > ms(myRead?.at);
}

/** Who (other than its author) has seen a message: reads { uid: { at } }. */
export function seenBy(msg, reads = {}) {
  const at = ms(msg?.createdAt);
  return Object.entries(reads)
    .filter(([uid, r]) => uid !== msg?.byUid && ms(r?.at) >= at)
    .map(([uid]) => uid);
}

/** The one-line preview of a message for the chat list and pushes. */
export function previewOf(msg) {
  if (!msg) return "";
  if (msg.deleted) return "Message deleted";
  const text = String(msg.text || "").trim();
  if (text) return text.length > 120 ? `${text.slice(0, 117)}…` : text;
  const files = msg.files || [];
  if (!files.length) return "";
  const photos = files.filter((f) => String(f.type).startsWith("image/")).length;
  if (photos === files.length) return photos === 1 ? "📷 Photo" : `📷 ${photos} photos`;
  return files.length === 1 ? `📎 ${files[0].name}` : `📎 ${files.length} files`;
}

/** Files a person picked: the ones that can be sent, and the ones too big. */
export function checkFiles(files = []) {
  const ok = [];
  const tooBig = [];
  for (const f of files) (f.size > MAX_FILE_BYTES ? tooBig : ok).push(f);
  return { ok, tooBig };
}

/** Whose phones a new message goes to: everyone who can see the chat, except who sent it. */
export function chatAudience(chat, people = [], senderUid) {
  return people
    .filter((p) => p.uid !== senderUid)
    .filter((p) => {
      if (chat.kind === "company") return true;
      // a branch chat is the branch's people; company roles read it but aren't pushed every message
      if (chat.kind === "branch") return p.branchId === chat.branchId && !isCompanyRole(p.role);
      return (chat.members || []).includes(p.uid);
    })
    .map((p) => p.uid);
}

/** "Today", "Yesterday", or "Mon, 12 Oct" — for the day lines between messages. */
export function dayLabel(t, now = new Date()) {
  const d = new Date(ms(t));
  const key = (x) => `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  if (key(d) === key(now)) return "Today";
  if (key(d) === key(y)) return "Yesterday";
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}) });
}

// ── reactions and forwarding ─────────────────────────────────────────────────

/** The quick reactions; each person has at most one per message (reactions: { uid: emoji }). */
export const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

/** [{ emoji, count, mine, who: [uids] }] in REACTIONS order, then any others. */
export function reactionSummary(reactions = {}, me) {
  const by = new Map();
  for (const [uid, emoji] of Object.entries(reactions || {})) {
    if (!emoji) continue;
    if (!by.has(emoji)) by.set(emoji, []);
    by.get(emoji).push(uid);
  }
  const order = (e) => (REACTIONS.includes(e) ? REACTIONS.indexOf(e) : 99);
  return [...by.entries()].sort((a, b) => order(a[0]) - order(b[0])).map(([emoji, who]) => ({ emoji, count: who.length, mine: who.includes(me), who }));
}

/** Can this message be forwarded? (not deleted, has something in it) */
export const canForward = (msg) => !!msg && !msg.deleted && (!!String(msg.text || "").trim() || (msg.files || []).length > 0);
