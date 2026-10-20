// lib/tasks/client.js — reading and writing tasks, checklist ticks, ratings
// and notes (roadmap 4.11). Who may do what: lib/tasks/model.js and
// firestore.rules.
"use client";
import { useEffect, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { personName } from "@/lib/people";
import { shrinkPhoto } from "@/lib/chat/client";
import { checkId, ratingId } from "./model";

const branchCol = (companyId, branchId, name) => collection(db, "companies", companyId, "branches", branchId, name);
const notesCol = (companyId, uid) => collection(db, "companies", companyId, "users", uid, "notes");
const stamp = (u) => ({ uid: u.uid, name: personName(u) || u.username || "", role: u.role || "" });

/** Live list from a query; [] on no access. */
function useLive(makeQuery, deps) {
  const [state, setState] = useState({ list: [], loading: true });
  useEffect(() => {
    const q = makeQuery();
    if (!q) {
      setState({ list: [], loading: false });
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    return onSnapshot(
      q,
      (snap) => setState({ list: snap.docs.map((d) => ({ id: d.id, ...d.data() })), loading: false }),
      () => setState({ list: [], loading: false })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

/** Tasks: the whole branch's (management), or only those given to `uid`. */
export function useTasks(companyId, branchId, { uid, all = false } = {}) {
  return useLive(
    () => (companyId && branchId && (all || uid) ? (all ? branchCol(companyId, branchId, "tasks") : query(branchCol(companyId, branchId, "tasks"), where("assigneeUid", "==", uid))) : null),
    [companyId, branchId, uid, all]
  );
}

/** Checklist ticks between two days, keyed by id: everyone's (management) or one person's. */
export function useChecks(companyId, branchId, { from, to, uid, all = false }) {
  const { list, loading } = useLive(() => {
    if (!companyId || !branchId || !from || !to || !(all || uid)) return null;
    const c = branchCol(companyId, branchId, "taskChecks");
    return all
      ? query(c, where("date", ">=", from), where("date", "<=", to))
      : query(c, where("assigneeUid", "==", uid), where("date", ">=", from), where("date", "<=", to));
  }, [companyId, branchId, from, to, uid, all]);
  return { checks: Object.fromEntries(list.map((c) => [c.id, c])), loading };
}

/** Ratings for a month: everyone's (management) or one person's. */
export function useRatings(companyId, branchId, month, { uid, all = false } = {}) {
  const { list, loading } = useLive(() => {
    if (!companyId || !branchId || !month || !(all || uid)) return null;
    const c = branchCol(companyId, branchId, "ratings");
    return all ? query(c, where("month", "==", month)) : query(c, where("month", "==", month), where("uid", "==", uid));
  }, [companyId, branchId, month, uid, all]);
  return { ratings: Object.fromEntries(list.map((r) => [r.uid, r])), loading };
}

/** Proof photos up (shrunk first): [url]. */
export async function uploadProof(companyId, branchId, me, files = []) {
  const urls = [];
  let i = 0;
  for (const raw of files.filter((f) => String(f.type).startsWith("image/")).slice(0, 4)) {
    const f = await shrinkPhoto(raw, 1600, 0.8);
    const r = ref(storage, `tasks/${companyId}/${branchId}/${me.uid}/${Date.now()}-${i++}.jpg`);
    await uploadBytes(r, f, { contentType: f.type || "image/jpeg" });
    urls.push(await getDownloadURL(r));
  }
  return urls;
}

/** Give a task, or change one. `t`: the form (title, details, assignee, repeat, dueDate, startDate, needsPhoto, priority). */
export async function saveTask(companyId, branchId, me, t, id = null) {
  const data = {
    title: t.title.trim(),
    details: (t.details || "").trim(),
    priority: t.priority || "normal",
    needsPhoto: !!t.needsPhoto,
    assignee: { uid: t.assignee.uid, name: t.assignee.name || "", role: t.assignee.role || "" },
    assigneeUid: t.assignee.uid,
    repeat: t.repeat || null,
    dueDate: t.repeat ? null : t.dueDate || null,
    startDate: t.startDate || null,
    updatedAt: serverTimestamp(),
  };
  if (id) return updateDoc(doc(branchCol(companyId, branchId, "tasks"), id), data);
  const r = doc(branchCol(companyId, branchId, "tasks"));
  await setDoc(r, { ...data, status: "open", active: true, done: null, createdBy: stamp(me), creatorUid: me.uid, branchId, companyId, createdAt: serverTimestamp() });
  return r.id;
}

/** Stop a repeating task from `today` on (its past ticks stay counted), or start it again. */
export const setTaskActive = (companyId, branchId, task, active, today) =>
  updateDoc(doc(branchCol(companyId, branchId, "tasks"), task.id), active ? { active: true, stoppedOn: null, updatedAt: serverTimestamp() } : { active: false, stoppedOn: today, updatedAt: serverTimestamp() });

export const deleteTask = (companyId, branchId, task) => deleteDoc(doc(branchCol(companyId, branchId, "tasks"), task.id));

/** A one-off done (on business day `date`), with any proof. */
export const completeOnce = (companyId, branchId, task, me, { date, photos = [], note = "" }) =>
  updateDoc(doc(branchCol(companyId, branchId, "tasks"), task.id), { status: "done", done: { by: stamp(me), at: new Date().toISOString(), date, photos, note: note.trim() }, updatedAt: serverTimestamp() });

export const reopenOnce = (companyId, branchId, task) =>
  updateDoc(doc(branchCol(companyId, branchId, "tasks"), task.id), { status: "open", done: null, updatedAt: serverTimestamp() });

/** Tick one day of a repeating task. `date` = the day it was for, `doneOn` = today (later = late). */
export const tickDay = (companyId, branchId, task, me, { date, doneOn, photos = [], note = "" }) =>
  setDoc(doc(branchCol(companyId, branchId, "taskChecks"), checkId(task.id, date)), {
    taskId: task.id,
    title: task.title,
    assigneeUid: task.assigneeUid,
    date,
    doneOn,
    by: stamp(me),
    photos,
    note: note.trim(),
    createdAt: serverTimestamp(),
  });

export const untickDay = (companyId, branchId, task, date) => deleteDoc(doc(branchCol(companyId, branchId, "taskChecks"), checkId(task.id, date)));

/** A manager's stars (1–5) and a word for someone's month. */
export const rate = (companyId, branchId, me, person, month, { stars, note = "" }) =>
  setDoc(doc(branchCol(companyId, branchId, "ratings"), ratingId(month, person.uid)), {
    uid: person.uid,
    name: person.name || "",
    month,
    stars: Math.round(Number(stars)),
    note: note.trim(),
    by: stamp(me),
    at: serverTimestamp(),
  });

// ── notes: the person's own ─────────────────────────────────────────────────

export function useNotes(companyId, uid) {
  return useLive(() => (companyId && uid ? notesCol(companyId, uid) : null), [companyId, uid]);
}

export async function saveNote(companyId, uid, note, id = null) {
  const data = {
    title: (note.title || "").trim(),
    body: note.body || "",
    items: (note.items || []).filter((x) => String(x.text || "").trim()).map((x) => ({ text: x.text.trim(), done: !!x.done })),
    pinned: !!note.pinned,
    color: note.color || "plain",
    updatedAt: serverTimestamp(),
  };
  if (id) return updateDoc(doc(notesCol(companyId, uid), id), data);
  const r = doc(notesCol(companyId, uid));
  await setDoc(r, { ...data, createdAt: serverTimestamp() });
  return r.id;
}

export const deleteNote = (companyId, uid, id) => deleteDoc(doc(notesCol(companyId, uid), id));
