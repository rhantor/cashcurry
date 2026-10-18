// lib/chat/client.js — reading and writing chat (roadmap 4.4); who may do
// what is in lib/chat/model.js and firestore.rules / storage.rules.
import {
  arrayRemove, arrayUnion, collection, deleteDoc, deleteField, doc, getDoc, serverTimestamp, setDoc, updateDoc, writeBatch,
} from "firebase/firestore";
import { deleteObject, getBlob, getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { personName } from "@/lib/people";
import { COMPANY_CHAT, branchChatId, checkFiles, directChatId, previewOf } from "./model";

export const chatsCol = (companyId) => collection(db, "companies", companyId, "chats");
export const chatDoc = (companyId, chatId) => doc(db, "companies", companyId, "chats", chatId);
export const messagesCol = (companyId, chatId) => collection(db, "companies", companyId, "chats", chatId, "messages");
export const readsCol = (companyId, chatId) => collection(db, "companies", companyId, "chats", chatId, "reads");

/** The company chat and a branch's chat exist once someone opens them. */
export async function ensureChat(companyId, { kind, branchId, name }) {
  const id = kind === "company" ? COMPANY_CHAT : branchChatId(branchId);
  const r = chatDoc(companyId, id);
  try {
    if ((await getDoc(r)).exists()) return id;
  } catch {
    // not readable yet = doesn't exist yet
  }
  await setDoc(r, kind === "company" ? { kind, name: name || "Everyone", createdAt: serverTimestamp(), updatedAt: serverTimestamp() } : { kind, branchId, name: name || "Branch", createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return id;
}

/** Open (or start) a personal chat with someone. */
export async function openDirect(companyId, me, other) {
  const id = directChatId(me.uid, other.uid);
  const r = chatDoc(companyId, id);
  let exists = false;
  try {
    exists = (await getDoc(r)).exists();
  } catch {
    exists = false;
  }
  if (!exists) {
    const members = [me.uid, other.uid].sort();
    await setDoc(r, {
      kind: "direct",
      members,
      names: { [me.uid]: personName(me) || me.username || "", [other.uid]: other.name || "" },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
  return id;
}

/** Management makes a group. */
export async function createGroup(companyId, me, { name, members }) {
  const r = doc(chatsCol(companyId));
  await setDoc(r, {
    kind: "group",
    name: name.trim(),
    members: [...new Set([me.uid, ...members])],
    createdBy: me.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return r.id;
}
export const updateGroup = (companyId, chatId, { name, members }) =>
  updateDoc(chatDoc(companyId, chatId), { ...(name ? { name: name.trim() } : {}), ...(members ? { members } : {}), updatedAt: serverTimestamp() });
export const leaveGroupMember = (companyId, chatId, uid) => updateDoc(chatDoc(companyId, chatId), { members: arrayRemove(uid), updatedAt: serverTimestamp() });
export const addGroupMembers = (companyId, chatId, uids) => updateDoc(chatDoc(companyId, chatId), { members: arrayUnion(...uids), updatedAt: serverTimestamp() });
export const deleteGroup = (companyId, chatId) => deleteDoc(chatDoc(companyId, chatId));

function upload(companyId, chatId, uid, file, onProgress) {
  const safe = file.name.replace(/[^\w.-]+/g, "_").slice(-80);
  const path = `chat/${companyId}/${chatId}/${uid}/${Date.now()}_${safe}`;
  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(ref(storage, path), file, { contentType: file.type || "application/octet-stream" });
    task.on(
      "state_changed",
      (s) => onProgress?.(s.bytesTransferred / s.totalBytes),
      reject,
      async () => resolve({ url: await getDownloadURL(task.snapshot.ref), path, name: file.name, type: file.type || "", size: file.size })
    );
  });
}

/**
 * Send a message: files go up first (up to 32 MB each), then the message
 * and the chat's last-message line in one write.
 */
export async function sendMessage(companyId, chatId, me, { text = "", files = [], replyTo = null, forwarded = null, onProgress }) {
  const { ok, tooBig } = checkFiles(files);
  if (tooBig.length) throw new Error(`${tooBig.map((f) => f.name).join(", ")} ${tooBig.length === 1 ? "is" : "are"} over 32 MB`);
  const body = text.trim();
  if (!body && !ok.length) return null;
  const progress = ok.map(() => 0);
  const uploaded = await Promise.all(
    ok.map((f, i) =>
      upload(companyId, chatId, me.uid, f, (p) => {
        progress[i] = p;
        onProgress?.(progress.reduce((a, b) => a + b, 0) / ok.length);
      })
    )
  );
  const byName = personName(me) || me.username || "";
  const msgRef = doc(messagesCol(companyId, chatId));
  const message = {
    byUid: me.uid,
    byName,
    text: body,
    files: uploaded,
    replyTo: replyTo ? { id: replyTo.id, text: previewOf(replyTo).slice(0, 140), byName: replyTo.byName || "" } : null,
    ...(forwarded ? { forwarded } : {}),
    createdAt: serverTimestamp(),
    deleted: false,
  };
  const batch = writeBatch(db);
  batch.set(msgRef, message);
  batch.update(chatDoc(companyId, chatId), {
    lastMessage: { text: previewOf({ text: body, files: uploaded }), byUid: me.uid, byName, at: serverTimestamp() },
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
  // the sender has seen their own message
  markRead(companyId, chatId, me.uid).catch(() => {});
  return msgRef.id;
}

/** Change your message's words (within 15 minutes). */
export const editMessage = (companyId, chatId, id, text) =>
  updateDoc(doc(messagesCol(companyId, chatId), id), { text: text.trim(), editedAt: serverTimestamp() });

/** Delete your message (within 15 minutes): it shows as "message deleted"; its files are removed. */
export async function deleteMessage(companyId, chatId, msg) {
  await updateDoc(doc(messagesCol(companyId, chatId), msg.id), { deleted: true, text: "", files: [], editedAt: serverTimestamp() });
  await Promise.all((msg.files || []).map((f) => (f.path ? deleteObject(ref(storage, f.path)).catch(() => {}) : null)));
}

/** "I've seen everything up to now." Also clears this chat's line in the bell. */
export async function markRead(companyId, chatId, uid) {
  await setDoc(doc(readsCol(companyId, chatId), uid), { at: serverTimestamp() });
  await updateDoc(doc(db, "companies", companyId, "users", uid, "inbox", `chat_${chatId}`), { readAt: serverTimestamp() }).catch(() => {}); // none yet: fine
}

/** Mute or unmute a chat's pushes for yourself (companies/{c}/users/{uid}/prefs/notifications.mutedChats). */
export const setChatMuted = (companyId, uid, chatId, muted) =>
  setDoc(doc(db, "companies", companyId, "users", uid, "prefs", "notifications"), { mutedChats: muted ? arrayUnion(chatId) : arrayRemove(chatId) }, { merge: true });

/** React to a message (or take your reaction back with null). */
export const react = (companyId, chatId, msgId, uid, emoji) =>
  updateDoc(doc(messagesCol(companyId, chatId), msgId), { [`reactions.${uid}`]: emoji || deleteField() });

/**
 * Forward a message to other chats. Its files are copied into each chat
 * (a chat's files are only readable by that chat's people).
 */
export async function forwardMessage(companyId, msg, toChatIds, me) {
  // a sticker is readable company-wide: send the same one
  if (msg.sticker) {
    for (const chatId of toChatIds) await sendSticker(companyId, chatId, me, msg.sticker);
    return;
  }
  const files = await Promise.all(
    (msg.files || []).map(async (f) => {
      // reading a file in the browser needs the bucket's CORS set (release checklist, 4.4)
      const blob = f.path ? await getBlob(ref(storage, f.path)) : await (await fetch(f.url)).blob();
      return new File([blob], f.name, { type: f.type || blob.type });
    })
  );
  for (const chatId of toChatIds) {
    // like WhatsApp: marked "Forwarded", without saying who wrote it first
    await sendMessage(companyId, chatId, me, { text: msg.text || "", files, forwarded: true });
  }
}

// ── stickers ─────────────────────────────────────────────────────────────────

/** Send a sticker ({ id, url, name, pack }). */
export async function sendSticker(companyId, chatId, me, sticker) {
  const byName = personName(me) || me.username || "";
  const batch = writeBatch(db);
  batch.set(doc(messagesCol(companyId, chatId)), {
    byUid: me.uid,
    byName,
    text: "",
    files: [],
    sticker: { id: sticker.id, url: sticker.url, name: sticker.name || "", pack: sticker.pack },
    replyTo: null,
    createdAt: serverTimestamp(),
    deleted: false,
  });
  batch.update(chatDoc(companyId, chatId), { lastMessage: { text: "Sticker", byUid: me.uid, byName, at: serverTimestamp() }, updatedAt: serverTimestamp() });
  await batch.commit();
  markRead(companyId, chatId, me.uid).catch(() => {});
}

export const stickersCol = (companyId) => collection(db, "companies", companyId, "stickers");

/** Management adds a company sticker (an image up to 1 MB). */
export async function addCompanySticker(companyId, me, file, name = "") {
  const path = `stickers/${companyId}/${Date.now()}_${file.name.replace(/[^\w.-]+/g, "_").slice(-60)}`;
  const snap = await new Promise((resolve, reject) => {
    const task = uploadBytesResumable(ref(storage, path), file, { contentType: file.type });
    task.on("state_changed", null, reject, () => resolve(task.snapshot));
  });
  const url = await getDownloadURL(snap.ref);
  await setDoc(doc(stickersCol(companyId)), { name: name || file.name.replace(/\.[^.]+$/, ""), url, path, createdBy: me.uid, createdAt: serverTimestamp() });
}

export async function deleteCompanySticker(companyId, sticker) {
  await deleteDoc(doc(stickersCol(companyId), sticker.id));
  if (sticker.path) await deleteObject(ref(storage, sticker.path)).catch(() => {});
}

// ── labels (each person's own) ───────────────────────────────────────────────

export const labelsDoc = (companyId, uid) => doc(db, "companies", companyId, "users", uid, "prefs", "chatLabels");
export const saveLabels = (companyId, uid, prefs) => setDoc(labelsDoc(companyId, uid), { labels: prefs.labels || [], chats: prefs.chats || {} });
