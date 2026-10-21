// lib/tasks/client.js — reading and writing tasks, checklist ticks, ratings
// and notes (roadmap 4.11). Who may do what: lib/tasks/model.js and
// firestore.rules.
"use client";
import { useEffect, useState } from "react";
import { collection, deleteDoc, doc, getDocs, increment, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from "firebase/firestore";
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

/** Tasks: the whole branch's (management), those a supervisor leads (`lead`), or only those given to `uid`. */
export function useTasks(companyId, branchId, { uid, lead, all = false } = {}) {
  return useLive(() => {
    if (!companyId || !branchId || !(all || uid || lead)) return null;
    const c = branchCol(companyId, branchId, "tasks");
    return all ? c : lead ? query(c, where("teamLeadUid", "==", lead)) : query(c, where("assigneeUid", "==", uid));
  }, [companyId, branchId, uid, lead, all]);
}

/**
 * Checklist ticks between two days, keyed by id: everyone's (management),
 * a supervisor's team's (`lead`), or one person's (`uid`).
 */
export function useChecks(companyId, branchId, { from, to, uid, lead, all = false }) {
  const { list, loading } = useLive(() => {
    if (!companyId || !branchId || !from || !to || !(all || uid || lead)) return null;
    const c = branchCol(companyId, branchId, "taskChecks");
    if (all) return query(c, where("date", ">=", from), where("date", "<=", to));
    return query(c, where(lead ? "teamLeadUid" : "assigneeUid", "==", lead || uid), where("date", ">=", from), where("date", "<=", to));
  }, [companyId, branchId, from, to, uid, lead, all]);
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

/**
 * Give a task, or change one. `t`: the form (title, details, assignee, repeat,
 * dueDate, startDate, needsPhoto, priority, teamLeadUid — the supervisor
 * leading it: themselves when a supervisor gives it, else the assignee's).
 */
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
    teamLeadUid: t.teamLeadUid || null,
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
    teamLeadUid: task.teamLeadUid || null,
    date,
    doneOn,
    by: stamp(me),
    photos,
    note: note.trim(),
    createdAt: serverTimestamp(),
  });

/**
 * Someone's supervisor changed (Staff management): their unfinished tasks — and
 * those tasks' ticks, so the new supervisor sees how they went — are led by the
 * new one from now on, or by no one. Management only (the rules).
 * Returns how many tasks changed.
 */
export async function moveTasksToLead(companyId, branchId, uid, leadUid) {
  if (!uid) return 0;
  const lead = leadUid || null;
  const snap = await getDocs(query(branchCol(companyId, branchId, "tasks"), where("assigneeUid", "==", uid)));
  const open = snap.docs.filter((d) => d.data().status !== "done" && (d.data().teamLeadUid || null) !== lead);
  if (!open.length) return 0;
  const writes = open.map((d) => [d.ref, { teamLeadUid: lead, updatedAt: serverTimestamp() }]);
  for (const d of open) {
    const ticks = await getDocs(query(branchCol(companyId, branchId, "taskChecks"), where("taskId", "==", d.id)));
    for (const t of ticks.docs) if ((t.data().teamLeadUid || null) !== lead) writes.push([t.ref, { teamLeadUid: lead }]);
  }
  for (let i = 0; i < writes.length; i += 450) {
    const b = writeBatch(db);
    for (const [ref, patch] of writes.slice(i, i + 450)) b.update(ref, patch);
    await b.commit();
  }
  return open.length;
}

/** A supervisor passes a task given to them on to someone in their team, and leads it from then on. */
export const handOver = (companyId, branchId, task, me, person) =>
  updateDoc(doc(branchCol(companyId, branchId, "tasks"), task.id), {
    assignee: { uid: person.uid, name: person.name || "", role: person.role || "" },
    assigneeUid: person.uid,
    teamLeadUid: me.uid,
    via: [...(task.via || []), { uid: me.uid, name: personName(me) || me.username || "" }],
    updatedAt: serverTimestamp(),
  });

// ── a task's questions and answers ──────────────────────────────────────────

export function useTaskComments(companyId, branchId, taskId) {
  return useLive(
    () => (companyId && branchId && taskId ? query(collection(db, "companies", companyId, "branches", branchId, "tasks", taskId, "comments"), orderBy("createdAt", "asc")) : null),
    [companyId, branchId, taskId]
  );
}

/** A voice message up: { url, duration, type }. */
async function uploadVoice(companyId, branchId, me, voice) {
  const type = voice.file.type || "audio/webm";
  const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
  const r = ref(storage, `tasks/${companyId}/${branchId}/${me.uid}/${Date.now()}-voice.${ext}`);
  await uploadBytes(r, voice.file, { contentType: type });
  return { url: await getDownloadURL(r), duration: voice.duration || 0, type };
}

/** Ask or answer — words, photos and/or a voice message; the task counts it (the badge on the task). */
export async function addTaskComment(companyId, branchId, task, me, { text = "", files = [], voice = null }) {
  const photos = files.length ? await uploadProof(companyId, branchId, me, files) : [];
  const spoken = voice?.file ? await uploadVoice(companyId, branchId, me, voice) : null;
  if (!text.trim() && !photos.length && !spoken) return;
  const b = writeBatch(db);
  b.set(doc(collection(db, "companies", companyId, "branches", branchId, "tasks", task.id, "comments")), {
    byUid: me.uid,
    byName: personName(me) || me.username || "",
    text: text.trim(),
    photos,
    voice: spoken,
    createdAt: serverTimestamp(),
  });
  b.update(doc(branchCol(companyId, branchId, "tasks"), task.id), { commentCount: increment(1), lastCommentAt: serverTimestamp(), lastCommentByUid: me.uid });
  await b.commit();
}

// ── which tasks' messages this person has seen ──────────────────────────────
// companies/{c}/users/{uid}/prefs/taskReads { reads: { [taskId]: when opened } }

const readsDoc = (companyId, uid) => doc(db, "companies", companyId, "users", uid, "prefs", "taskReads");

/** { [taskId]: Timestamp } — live. */
export function useTaskReads(companyId, uid) {
  const [reads, setReads] = useState({});
  useEffect(() => {
    if (!companyId || !uid) return;
    return onSnapshot(readsDoc(companyId, uid), (s) => setReads(s.exists() ? s.data().reads || {} : {}), () => setReads({}));
  }, [companyId, uid]);
  return reads;
}

/** Opened a task: its messages are seen, and so are the bell's notes about it. */
export async function markTaskRead(companyId, uid, taskId) {
  await setDoc(readsDoc(companyId, uid), { reads: { [taskId]: serverTimestamp() } }, { merge: true });
  const notes = await getDocs(query(collection(db, "companies", companyId, "users", uid, "inbox"), where("ref", "==", `tasks/${taskId}`)));
  const unread = notes.docs.filter((d) => !d.data().readAt);
  if (!unread.length) return;
  const b = writeBatch(db);
  for (const d of unread) b.update(d.ref, { readAt: serverTimestamp() });
  await b.commit();
}

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
    // `given`: the name of whoever a line was given to as a task (meeting notes → tasks)
    items: (note.items || []).filter((x) => String(x.text || "").trim()).map((x) => ({ text: x.text.trim(), done: !!x.done, given: x.given || null })),
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
