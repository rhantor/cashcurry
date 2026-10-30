// lib/tasks/client.js — reading and writing tasks, checklist ticks, ratings
// and notes (roadmap 4.11). Who may do what: lib/tasks/model.js and
// firestore.rules.
"use client";
import { useEffect, useMemo, useState } from "react";
import { collection, deleteDoc, doc, getDoc, getDocs, increment, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { personName } from "@/lib/people";
import { shrinkPhoto } from "@/lib/chat/client";
import { awayFrom, checkId, cleanItems, doersOf, freshCovers, ratingId } from "./model";
import { can } from "@/lib/authz/permissions";

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

/** Live list from several queries, merged by id; [] on no access. */
function useLiveMany(makeQueries, deps) {
  const [state, setState] = useState({ list: [], loading: true });
  useEffect(() => {
    const qs = makeQueries();
    if (!qs?.length) {
      setState({ list: [], loading: false });
      return;
    }
    const parts = qs.map(() => null);
    const publish = () => {
      if (parts.some((p) => p === null)) return;
      const byId = new Map();
      for (const p of parts) for (const x of p) byId.set(x.id, x);
      setState({ list: [...byId.values()], loading: false });
    };
    setState((s) => ({ ...s, loading: true }));
    const stops = qs.map((q, i) =>
      onSnapshot(
        q,
        (snap) => {
          parts[i] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          publish();
        },
        () => {
          parts[i] = [];
          publish();
        }
      )
    );
    return () => stops.forEach((s) => s());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

/**
 * Tasks: the whole branch's (management), those a supervisor leads (`lead`),
 * or those that can fall to `uid` — given to them, or theirs on a rota or a
 * cover (doers, 31 Oct).
 */
export function useTasks(companyId, branchId, { uid, lead, all = false } = {}) {
  return useLiveMany(() => {
    if (!companyId || !branchId || !(all || uid || lead)) return null;
    const c = branchCol(companyId, branchId, "tasks");
    if (all) return [c];
    if (lead) return [query(c, where("teamLeadUid", "==", lead))];
    return [query(c, where("assigneeUid", "==", uid)), query(c, where("doers", "array-contains", uid))];
  }, [companyId, branchId, uid, lead, all]);
}

/**
 * Checklist ticks between two days, keyed by id: everyone's (management),
 * a supervisor's team's (`lead`), and/or one person's (`uid`: tasks given to
 * them, and days they were on duty for).
 */
export function useChecks(companyId, branchId, { from, to, uid, lead, all = false }) {
  const { list, loading } = useLiveMany(() => {
    if (!companyId || !branchId || !from || !to || !(all || uid || lead)) return null;
    const c = branchCol(companyId, branchId, "taskChecks");
    const span = [where("date", ">=", from), where("date", "<=", to)];
    if (all) return [query(c, ...span)];
    return [
      ...(lead ? [query(c, where("teamLeadUid", "==", lead), ...span)] : []),
      ...(uid ? [query(c, where("assigneeUid", "==", uid), ...span), query(c, where("doerUid", "==", uid), ...span)] : []),
    ];
  }, [companyId, branchId, from, to, uid, lead, all]);
  return { checks: Object.fromEntries(list.map((c) => [c.id, c])), loading };
}

/**
 * Who is away when (31 Oct): weekly days off on the staff records and
 * approved leave. Those who give tasks pass the branch's staff list and see
 * everyone's leave; anyone else knows only their own (their record, by
 * user.staffId, and their own requests). → (uid, date) => reason | null
 */
export function useAway(companyId, branchId, user, staff = null) {
  const everyone = can(user?.role, "attendance.view") || can(user?.role, "advances.approve");
  const staffId = user?.staffId || null;
  const [own, setOwn] = useState(null);
  useEffect(() => {
    if (staff || !companyId || !branchId || !staffId) return;
    let live = true;
    getDoc(doc(branchCol(companyId, branchId, "staff"), user.staffBranchId && user.staffBranchId !== branchId ? "none" : staffId))
      .then((s) => live && setOwn(s.exists() ? [{ id: s.id, ...s.data(), uid: s.data().uid || user.uid }] : []))
      .catch(() => live && setOwn([]));
    return () => {
      live = false;
    };
  }, [companyId, branchId, staffId, staff, user?.uid, user?.staffBranchId]);
  const { list: leaves } = useLiveMany(() => {
    if (!companyId || !branchId || !user?.uid) return null;
    const c = branchCol(companyId, branchId, "leaves");
    if (everyone) return [query(c, where("status", "==", "approved"))];
    return [query(c, where("createdBy.uid", "==", user.uid)), ...(staffId ? [query(c, where("staffId", "==", staffId))] : [])];
  }, [companyId, branchId, user?.uid, everyone, staffId]);
  return useMemo(
    () => awayFrom({ staff: staff || own || [], leaves: leaves.map((l) => (l.staffId ? l : { ...l, uid: l.createdBy?.uid })) }),
    [staff, own, leaves]
  );
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
 * dueDate, startDate, needsPhoto, priority, items — a checklist, teamLeadUid —
 * the supervisor leading it: themselves when a supervisor gives it, else the assignee's).
 */
export async function saveTask(companyId, branchId, me, t, id = null) {
  const data = {
    // a changed task keeps its rota and covers (t.rota, t.covers): who it can fall to
    doers: doersOf({ assigneeUid: t.assignee.uid, rota: t.rota, covers: t.covers }),
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
    items: cleanItems(t.items),
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

/** A one-off done (on business day `date`), with any proof and the checklist's answers. */
export const completeOnce = (companyId, branchId, task, me, { date, photos = [], note = "", items = [] }) =>
  updateDoc(doc(branchCol(companyId, branchId, "tasks"), task.id), { status: "done", done: { by: stamp(me), at: new Date().toISOString(), date, photos, note: note.trim(), items }, updatedAt: serverTimestamp() });

export const reopenOnce = (companyId, branchId, task) =>
  updateDoc(doc(branchCol(companyId, branchId, "tasks"), task.id), { status: "open", done: null, updatedAt: serverTimestamp() });

/**
 * Tick one day of a repeating task. `date` = the day it was for, `doneOn` =
 * today (later = late), `doerUid` = who was on duty that day (dutyOn) — the
 * day counts for them, whoever ticks it.
 */
export const tickDay = (companyId, branchId, task, me, { date, doneOn, doerUid = null, photos = [], note = "", items = [] }) =>
  setDoc(doc(branchCol(companyId, branchId, "taskChecks"), checkId(task.id, date)), {
    taskId: task.id,
    title: task.title,
    assigneeUid: task.assigneeUid,
    teamLeadUid: task.teamLeadUid || null,
    doerUid: doerUid || me.uid,
    date,
    doneOn,
    by: stamp(me),
    photos,
    note: note.trim(),
    items, // the checklist's answers: [{ text, ok, note }]
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
    doers: doersOf({ ...task, assigneeUid: person.uid }),
    updatedAt: serverTimestamp(),
  });

const who = (p) => ({ uid: p.uid, name: p.name || "", role: p.role || "" });

/**
 * Who does a repeating task each weekday (31 Oct): rota { [0–6]: person | null }.
 * Whoever sets it leads it — a supervisor setting the rota of a task given to
 * them leads it from now on (its days off come to them).
 */
export function setRota(companyId, branchId, task, me, rota, today) {
  const clean = Object.fromEntries(Object.entries(rota || {}).filter(([, p]) => p?.uid).map(([d, p]) => [d, who(p)]));
  const covers = freshCovers(task.covers, today);
  const lead = task.assigneeUid === me.uid ? me.uid : task.teamLeadUid || null;
  return updateDoc(doc(branchCol(companyId, branchId, "tasks"), task.id), {
    rota: clean,
    rotaSince: today, // from today on: days already gone stay as they were
    covers,
    doers: doersOf({ ...task, rota: clean, covers }),
    teamLeadUid: lead,
    updatedAt: serverTimestamp(),
  });
}

/** One day of a repeating task given to someone else — or back to the usual person (person null). */
export function setCover(companyId, branchId, task, date, person, today) {
  const covers = freshCovers(task.covers, today);
  if (person?.uid) covers[date] = who(person);
  else delete covers[date];
  return updateDoc(doc(branchCol(companyId, branchId, "tasks"), task.id), {
    covers,
    doers: doersOf({ ...task, covers }),
    updatedAt: serverTimestamp(),
  });
}

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
