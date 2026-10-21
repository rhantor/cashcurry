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
 * Photos from a phone are often 5–10 MB: shrink them (longest side 1600 px,
 * JPEG) before sending, as chat apps do, so they go and open quickly. GIFs
 * (may move), small photos and anything that can't be read are sent as they are.
 */
export async function shrinkPhoto(file, max = 1600, quality = 0.82) {
  if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type) || file.size < 400 * 1024 || typeof createImageBitmap !== "function") return file;
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d").drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close?.();
    const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", quality));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

/**
 * Send a message: files go up first (up to 32 MB each), then the message
 * and the chat's last-message line in one write.
 */
export async function sendMessage(companyId, chatId, me, { text = "", files = [], voice = null, replyTo = null, forwarded = null, onProgress }) {
  const { ok: picked, tooBig } = checkFiles(files);
  if (tooBig.length) throw new Error(`${tooBig.map((f) => f.name).join(", ")} ${tooBig.length === 1 ? "is" : "are"} over 32 MB`);
  const body = text.trim();
  if (!body && !picked.length && !voice) return null;
  const ok = await Promise.all(picked.map((f) => shrinkPhoto(f)));
  const progress = ok.map(() => 0);
  const uploaded = await Promise.all(
    ok.map((f, i) =>
      upload(companyId, chatId, me.uid, f, (p) => {
        progress[i] = p;
        onProgress?.(progress.reduce((a, b) => a + b, 0) / ok.length);
      })
    )
  );
  // a voice message: one audio file that knows how long it is
  if (voice?.file) uploaded.push({ ...(await upload(companyId, chatId, me.uid, voice.file)), voice: true, duration: voice.duration || 0 });
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

/** Management removes a message for everyone: it shows "Removed by …". */
export async function removeMessage(companyId, chatId, msg, me) {
  await updateDoc(doc(messagesCol(companyId, chatId), msg.id), {
    deleted: true, text: "", files: [], editedAt: serverTimestamp(),
    removedBy: { uid: me.uid, name: personName(me) || me.username || "" },
  });
  await Promise.all((msg.files || []).map((f) => (f.path ? deleteObject(ref(storage, f.path)).catch(() => {}) : null)));
}

/** "Delete for me": the message disappears for this person only (kept on their read mark). */
export const hideMessage = (companyId, chatId, uid, msgId) =>
  setDoc(doc(readsCol(companyId, chatId), uid), { hidden: arrayUnion(msgId) }, { merge: true });

/** "I've seen everything up to now." Also clears this chat's line in the bell. */
export async function markRead(companyId, chatId, uid) {
  // merge: keeps the messages this person deleted for themselves (hidden)
  await setDoc(doc(readsCol(companyId, chatId), uid), { at: serverTimestamp() }, { merge: true });
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

/**
 * Save a chat file or photo to the device under its own name. A plain link
 * with "download" doesn't work here — the file lives at another address
 * (storage), so the browser would only open it — so it is fetched first.
 * (On a real project the bucket's CORS must allow the app — release checklist.)
 */
export async function downloadFile(f) {
  let blob;
  try {
    blob = f.path ? await getBlob(ref(storage, f.path)) : await (await fetch(f.url)).blob();
  } catch {
    // can't read it here: at least open it, where it can be saved by hand
    window.open(f.url, "_blank", "noopener");
    return false;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = f.name || "download";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return true;
}

/**
 * Share a message outside Cash Curry — WhatsApp and the rest. On phones the
 * system share sheet opens (WhatsApp is in it), with photos and files
 * attached; on a computer WhatsApp opens with the words filled in.
 * Returns "shared" | "whatsapp" | "cancelled".
 */
export async function shareMessage(msg) {
  // as written: WhatsApp reads *bold*, _italic_, ~strike~ and lists the same way
  const text = String(msg.text || "").trim();
  const files = [];
  for (const f of msg.files || []) {
    try {
      const blob = f.path ? await getBlob(ref(storage, f.path)) : await (await fetch(f.url)).blob();
      files.push(new File([blob], f.name, { type: f.type || blob.type }));
    } catch {
      // can't read it here: share the link instead
    }
  }
  const links = (msg.files || []).filter((f) => !files.some((x) => x.name === f.name)).map((f) => f.url);
  const words = [text, ...links].filter(Boolean).join("\n");
  const data = { text: words || undefined, ...(files.length ? { files } : {}) };
  if (navigator.share && (!files.length || navigator.canShare?.(data))) {
    try {
      await navigator.share(data);
      return "shared";
    } catch (e) {
      if (e?.name === "AbortError") return "cancelled";
    }
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(words || (msg.files || []).map((f) => f.url).join("\n"))}`, "_blank", "noopener");
  return "whatsapp";
}
