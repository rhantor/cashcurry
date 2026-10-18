// lib/chat/client.js — reading and writing chat (roadmap 4.4); who may do
// what is in lib/chat/model.js and firestore.rules / storage.rules.
import {
  arrayRemove, arrayUnion, collection, deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc, writeBatch,
} from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
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
export async function sendMessage(companyId, chatId, me, { text = "", files = [], replyTo = null, onProgress }) {
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

/** "I've seen everything up to now." */
export const markRead = (companyId, chatId, uid) => setDoc(doc(readsCol(companyId, chatId), uid), { at: serverTimestamp() });

/** Mute or unmute a chat's pushes for yourself (companies/{c}/users/{uid}/prefs/notifications.mutedChats). */
export const setChatMuted = (companyId, uid, chatId, muted) =>
  setDoc(doc(db, "companies", companyId, "users", uid, "prefs", "notifications"), { mutedChats: muted ? arrayUnion(chatId) : arrayRemove(chatId) }, { merge: true });
