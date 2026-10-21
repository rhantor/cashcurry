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
import { plainText } from "./format";

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

/**
 * May this role remove someone else's message for everyone? Management, in
 * the company, branch and group chats (any time) — never in personal chats,
 * which are only the two people's.
 */
export const canRemoveForEveryone = (role, chat) => canMakeGroups(role) && !!chat && chat.kind !== "direct";

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
  if (msg.sticker) return "Sticker";
  const text = plainText(msg.text); // without *bold* / _italic_ marks
  if (text) return text.length > 120 ? `${text.slice(0, 117)}…` : text;
  const files = msg.files || [];
  if (!files.length) return "";
  const voice = files.find((f) => f.voice);
  if (voice) return `🎤 Voice message (${Math.floor((voice.duration || 0) / 60)}:${String(Math.round((voice.duration || 0) % 60)).padStart(2, "0")})`;
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
export const canForward = (msg) => !!msg && !msg.deleted && (!!String(msg.text || "").trim() || (msg.files || []).length > 0 || !!msg.sticker);

// ── stickers ─────────────────────────────────────────────────────────────────
// The Cash Curry pack ships with the app (public/stickers); a company adds its
// own (companies/{c}/stickers, made by management — up to 1 MB, an image).
// A sticker message carries { id, url, name, pack: "cashcurry" | "company" }.

export const STICKER_MAX_BYTES = 1024 * 1024;
export const STICKER_PACK = [
  ["thanks", "Thank you!"], ["ok", "OK, done"], ["on-my-way", "On my way"], ["great-job", "Great job!"],
  ["delivery", "Delivery here"], ["stock-low", "Stock low"], ["cash-counted", "Cash counted"], ["kitchen-ready", "Food ready"],
  ["sorry", "Sorry!"], ["busy", "Rush hour!"], ["break", "On break"], ["welcome", "Welcome!"],
].map(([id, name]) => ({ id, name, url: `/stickers/${id}.svg`, pack: "cashcurry" }));

/** Can this file be a company sticker? */
export const isStickerFile = (f) => !!f && String(f.type).startsWith("image/") && f.size <= STICKER_MAX_BYTES;

// ── labels (each person's own, for sorting their chats) ──────────────────────
// companies/{c}/users/{uid}/prefs/chatLabels { labels: [{ id, name, color }], chats: { chatId: [labelId] } }
// One label per chat (decided 19 Oct 2026). Kept as a list so older data
// with several still reads — only the first counts.

export const LABEL_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6", "#3b82f6", "#8b5cf6", "#ec4899", "#64748b"];

/** The chat's label, or null. */
export function labelOf(chatId, prefs) {
  const id = (prefs?.chats?.[chatId] || []).find((x) => (prefs?.labels || []).some((l) => l.id === x));
  return (prefs?.labels || []).find((l) => l.id === id) || null;
}

/** The labels on a chat as a list (none or one) — for code that lists them. */
export const labelsOf = (chatId, prefs) => {
  const l = labelOf(chatId, prefs);
  return l ? [l] : [];
};

/** Pick a label for a chat (it replaces the one it had); picking the same one again takes it off. The new { chats } map. */
export function toggleLabel(prefs, chatId, labelId) {
  const chats = { ...(prefs?.chats || {}) };
  if (labelOf(chatId, prefs)?.id === labelId) delete chats[chatId];
  else chats[chatId] = [labelId];
  return chats;
}

/** Remove a label everywhere. */
export function removeLabel(prefs, labelId) {
  const chats = {};
  for (const [c, ids] of Object.entries(prefs?.chats || {})) {
    const left = ids.filter((x) => x !== labelId);
    if (left.length) chats[c] = left;
  }
  return { labels: (prefs?.labels || []).filter((l) => l.id !== labelId), chats };
}
