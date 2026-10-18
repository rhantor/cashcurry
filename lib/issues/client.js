// lib/issues/client.js — reading and writing issues (roadmap 4.5). Who may
// do what: lib/issues/model.js and firestore.rules. Every change also writes a
// line into the issue's discussion, so it reads as a history.
import { arrayUnion, collection, deleteDoc, doc, serverTimestamp, setDoc, writeBatch } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { personName } from "@/lib/people";
import { shrinkPhoto } from "@/lib/chat/client";
import { MAX_PHOTOS, eventText, watchersWith } from "./model";

export const issuesCol = (companyId, branchId) => collection(db, "companies", companyId, "branches", branchId, "issues");
export const issueDoc = (companyId, branchId, id) => doc(db, "companies", companyId, "branches", branchId, "issues", id);
export const commentsCol = (companyId, branchId, id) => collection(db, "companies", companyId, "branches", branchId, "issues", id, "comments");

const stamp = (u) => ({ uid: u.uid, name: personName(u) || u.username || "", role: u.role || "" });

/** Photos up (shrunk first, like chat): [{ url, path, name, type, size }]. */
async function uploadPhotos(companyId, branchId, me, files = []) {
  const list = files.filter((f) => String(f.type).startsWith("image/")).slice(0, MAX_PHOTOS);
  return Promise.all(
    list.map(async (raw) => {
      const f = await shrinkPhoto(raw);
      const path = `issues/${companyId}/${branchId}/${me.uid}/${Date.now()}_${f.name.replace(/[^\w.-]+/g, "_").slice(-60)}`;
      const snap = await new Promise((resolve, reject) => {
        const task = uploadBytesResumable(ref(storage, path), f, { contentType: f.type });
        task.on("state_changed", null, reject, () => resolve(task.snapshot));
      });
      return { url: await getDownloadURL(snap.ref), path, name: f.name, type: f.type, size: f.size };
    })
  );
}

/** Raise an issue. Management may give it to someone at once. */
export async function createIssue(companyId, branchId, me, { title, details = "", category = "other", priority = "normal", photos = [], assignee = null, dueDate = null }) {
  const uploaded = await uploadPhotos(companyId, branchId, me, photos);
  const r = doc(issuesCol(companyId, branchId));
  const by = stamp(me);
  await setDoc(r, {
    title: title.trim(),
    details: details.trim(),
    category,
    priority,
    status: "open",
    photos: uploaded,
    reportedBy: by,
    reporterUid: me.uid,
    assignedTo: assignee ? { uid: assignee.uid, name: assignee.name, role: assignee.role || "" } : null,
    assigneeUid: assignee?.uid || null,
    dueDate: dueDate || null,
    watchers: [me.uid, ...(assignee ? [assignee.uid] : [])],
    branchId,
    companyId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastActivityAt: serverTimestamp(),
  });
  return r.id;
}

/** A change to the issue, and its line in the discussion, in one write. */
async function change(companyId, branchId, issue, me, patch, kind, args = {}) {
  const batch = writeBatch(db);
  batch.update(issueDoc(companyId, branchId, issue.id), { ...patch, updatedAt: serverTimestamp(), lastActivityAt: serverTimestamp() });
  batch.set(doc(commentsCol(companyId, branchId, issue.id)), {
    kind: "event",
    event: kind,
    byUid: me.uid,
    byName: personName(me) || "",
    text: eventText(kind, { by: personName(me) || "Someone", ...args }),
    createdAt: serverTimestamp(),
  });
  await batch.commit();
}

export const assignIssue = (companyId, branchId, issue, me, person) =>
  person
    ? change(
        companyId,
        branchId,
        issue,
        me,
        { assignedTo: { uid: person.uid, name: person.name, role: person.role || "" }, assigneeUid: person.uid, watchers: watchersWith(issue, person.uid) },
        "assigned",
        { to: person.name }
      )
    : change(companyId, branchId, issue, me, { assignedTo: null, assigneeUid: null }, "unassigned", { to: issue.assignedTo?.name || "them" });

export const setPriority = (companyId, branchId, issue, me, priority) => change(companyId, branchId, issue, me, { priority }, "priority", { priority });
export const setDueDate = (companyId, branchId, issue, me, due) => change(companyId, branchId, issue, me, { dueDate: due || null }, "due", { due });
export const startIssue = (companyId, branchId, issue, me) => change(companyId, branchId, issue, me, { status: "in_progress" }, "started");
export const resolveIssue = (companyId, branchId, issue, me, note = "") =>
  change(companyId, branchId, issue, me, { status: "resolved", resolution: note.trim(), resolvedBy: stamp(me), resolvedAt: serverTimestamp() }, "resolved", { note: note.trim() });
export const reopenIssue = (companyId, branchId, issue, me, note = "") =>
  change(companyId, branchId, issue, me, { status: "open", resolution: "", resolvedBy: null, resolvedAt: null }, "reopened", { note: note.trim() });

/** Add to the discussion (words and/or photos); the commenter is kept told from then on. */
export async function addComment(companyId, branchId, issue, me, { text = "", photos = [] }) {
  const uploaded = await uploadPhotos(companyId, branchId, me, photos);
  if (!text.trim() && !uploaded.length) return;
  const batch = writeBatch(db);
  batch.set(doc(commentsCol(companyId, branchId, issue.id)), {
    kind: "comment",
    byUid: me.uid,
    byName: personName(me) || "",
    text: text.trim(),
    photos: uploaded,
    createdAt: serverTimestamp(),
  });
  batch.update(issueDoc(companyId, branchId, issue.id), { lastActivityAt: serverTimestamp(), watchers: arrayUnion(me.uid), updatedAt: serverTimestamp() });
  await batch.commit();
}

export const deleteIssue = (companyId, branchId, issue) => deleteDoc(issueDoc(companyId, branchId, issue.id));
