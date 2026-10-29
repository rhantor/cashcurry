// lib/issues/client.js — reading and writing issues (roadmap 4.5). Who may
// do what: lib/issues/model.js and firestore.rules. Every change also writes a
// line into the issue's discussion, so it reads as a history.
//
// An issue given to someone is also a task for them (30 Oct): tasks/issue_{id}
// (lib/tasks/model.js taskFromIssue), written in the same go as the issue —
// moved to whoever it is given to, removed when taken off them or deleted,
// done when the issue is resolved and open again when it is reopened. The
// issue keeps its `taskId`.
import { arrayUnion, collection, deleteDoc, doc, getDocs, limit, query, serverTimestamp, where, writeBatch } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { personName } from "@/lib/people";
import { shrinkPhoto } from "@/lib/chat/client";
import { businessToday } from "@/lib/region";
import { issueTaskId, taskFromIssue } from "../tasks/model";
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

const taskRef = (companyId, branchId, issueId) => doc(db, "companies", companyId, "branches", branchId, "tasks", issueTaskId(issueId));

/** The supervisor leading `uid`'s work (their staff record), so their tasks show to them too. */
async function leadOfUid(companyId, branchId, uid) {
  try {
    const s = await getDocs(query(collection(db, "companies", companyId, "branches", branchId, "staff"), where("uid", "==", uid), limit(1)));
    return s.docs[0]?.data()?.supervisorUid || null;
  } catch {
    return null;
  }
}

/** The issue's task, given to `person` (new, or moved to them), as a batch write. */
async function putTask(batch, companyId, branchId, issue, me, person) {
  const teamLeadUid = await leadOfUid(companyId, branchId, person.uid);
  const resolved = issue.status === "resolved";
  batch.set(
    taskRef(companyId, branchId, issue.id),
    {
      ...taskFromIssue(issue, person, { teamLeadUid }),
      status: resolved ? "done" : "open",
      ...(resolved ? {} : { done: null }),
      active: true,
      createdBy: stamp(me),
      creatorUid: me.uid,
      branchId,
      companyId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
  return issueTaskId(issue.id);
}

/** Raise an issue. Management may give it to someone at once. */
export async function createIssue(companyId, branchId, me, { title, details = "", category = "other", priority = "normal", photos = [], assignee = null, dueDate = null }) {
  const uploaded = await uploadPhotos(companyId, branchId, me, photos);
  const r = doc(issuesCol(companyId, branchId));
  const by = stamp(me);
  const batch = writeBatch(db);
  // given to someone at once: their task too
  const taskId = assignee ? await putTask(batch, companyId, branchId, { id: r.id, title, details, priority, dueDate, status: "open" }, me, assignee) : null;
  batch.set(r, {
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
    taskId,
    watchers: [me.uid, ...(assignee ? [assignee.uid] : [])],
    branchId,
    companyId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastActivityAt: serverTimestamp(),
  });
  await batch.commit();
  return r.id;
}

/**
 * A change to the issue, and its line in the discussion, in one write —
 * with what it does to the issue's task (`withTask(batch)`). If the task part
 * can't be written (a task deleted by hand), the issue still changes.
 */
async function change(companyId, branchId, issue, me, patch, kind, args = {}, withTask = null) {
  const write = async (task) => {
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
    if (task) await task(batch);
    await batch.commit();
  };
  if (!withTask) return write(null);
  try {
    await write(withTask);
  } catch (e) {
    console.warn("The issue's task couldn't be changed with it", e);
    await write(null);
  }
}

/** The issue's task, if it has one: a patch for it in the batch. */
const taskPatch = (companyId, branchId, issue, data) => (issue.taskId ? (batch) => batch.update(taskRef(companyId, branchId, issue.id), { ...data, updatedAt: serverTimestamp() }) : null);

/** Give it to someone (their task moves with it), or take it off them (the task goes). */
export const assignIssue = (companyId, branchId, issue, me, person) =>
  person
    ? change(
        companyId,
        branchId,
        issue,
        me,
        { assignedTo: { uid: person.uid, name: person.name, role: person.role || "" }, assigneeUid: person.uid, watchers: watchersWith(issue, person.uid), taskId: issueTaskId(issue.id) },
        "assigned",
        { to: person.name },
        (batch) => putTask(batch, companyId, branchId, issue, me, person)
      )
    : change(companyId, branchId, issue, me, { assignedTo: null, assigneeUid: null, taskId: null }, "unassigned", { to: issue.assignedTo?.name || "them" }, (batch) => batch.delete(taskRef(companyId, branchId, issue.id)));

export const setPriority = (companyId, branchId, issue, me, priority) =>
  change(companyId, branchId, issue, me, { priority }, "priority", { priority }, taskPatch(companyId, branchId, issue, { priority: priority === "urgent" ? "urgent" : "normal" }));
export const setDueDate = (companyId, branchId, issue, me, due) =>
  change(companyId, branchId, issue, me, { dueDate: due || null }, "due", { due }, taskPatch(companyId, branchId, issue, { dueDate: due || null }));
export const startIssue = (companyId, branchId, issue, me) => change(companyId, branchId, issue, me, { status: "in_progress" }, "started");
/** Resolved: its task is done the same business day, with the note. */
export const resolveIssue = (companyId, branchId, issue, me, note = "") =>
  change(
    companyId,
    branchId,
    issue,
    me,
    { status: "resolved", resolution: note.trim(), resolvedBy: stamp(me), resolvedAt: serverTimestamp() },
    "resolved",
    { note: note.trim() },
    taskPatch(companyId, branchId, issue, { status: "done", done: { by: stamp(me), at: new Date().toISOString(), date: businessToday(), photos: [], note: note.trim(), items: [] } })
  );
export const reopenIssue = (companyId, branchId, issue, me, note = "") =>
  change(companyId, branchId, issue, me, { status: "open", resolution: "", resolvedBy: null, resolvedAt: null }, "reopened", { note: note.trim() }, taskPatch(companyId, branchId, issue, { status: "open", done: null }));

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

/** Deleting an issue deletes its task too. */
export async function deleteIssue(companyId, branchId, issue) {
  if (issue.taskId) await deleteDoc(taskRef(companyId, branchId, issue.id)).catch(() => {});
  await deleteDoc(issueDoc(companyId, branchId, issue.id));
}
