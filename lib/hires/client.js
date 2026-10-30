"use client";
// New hires in the app (30 Oct, lib/hires/model.js): the branch's list, made
// and changed by whoever manages staff; the join link and their documents go
// through the server (app/api/hires, app/api/join).
import { useEffect, useState } from "react";
import { addDoc, collection, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { getDownloadURL, ref } from "firebase/storage";
import { auth, db, storage } from "@/lib/firebase";
import { personName } from "@/lib/people";
import { documentsFrom } from "./model";

const hiresCol = (companyId, branchId) => collection(db, "companies", companyId, "branches", branchId, "newHires");
const hireDoc = (companyId, branchId, id) => doc(hiresCol(companyId, branchId), id);
const stamp = (me) => ({ uid: me?.uid || "", name: personName(me) || me?.username || "", role: me?.role || "" });

/** The branch's new hires, newest first, live. */
export function useHires(companyId, branchId, on = true) {
  const [state, setState] = useState({ list: [], loading: true });
  useEffect(() => {
    if (!on || !companyId || !branchId) {
      setState({ list: [], loading: false });
      return;
    }
    return onSnapshot(
      query(hiresCol(companyId, branchId), orderBy("createdAt", "desc")),
      (s) => setState({ list: s.docs.map((d) => ({ id: d.id, ...d.data() })), loading: false }),
      () => setState({ list: [], loading: false })
    );
  }, [companyId, branchId, on]);
  return state;
}

/** Someone joining: name, phone, job, start day and pay — the rest they fill in. */
export async function createHire(companyId, branchId, me, h) {
  const r = await addDoc(hiresCol(companyId, branchId), {
    firstName: h.firstName.trim(),
    lastName: (h.lastName || "").trim(),
    phone: (h.phone || "").trim(),
    role: h.role || "",
    department: (h.department || "").trim(),
    startDate: h.startDate || "",
    basicSalary: h.basicSalary === "" || h.basicSalary == null ? "" : Number(h.basicSalary),
    status: "draft",
    letterReady: false,
    createdBy: stamp(me),
    createdAt: serverTimestamp(),
  });
  return r.id;
}

export const updateHire = (companyId, branchId, id, patch) => updateDoc(hireDoc(companyId, branchId, id), { ...patch, updatedAt: serverTimestamp() });
export const cancelHire = (companyId, branchId, id) => updateHire(companyId, branchId, id, { status: "cancelled" });

/** A (new) join link: { url, expiresAt } — the old one stops working. */
export async function sendLink(companyId, branchId, hireId) {
  const idToken = await auth.currentUser?.getIdToken();
  const res = await fetch("/api/hires/link", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken || ""}` },
    body: JSON.stringify({ companyId, branchId, hireId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Couldn't make the link");
  return data;
}

/** The appointment letter saved for them (the tool's inputs), or null. */
export async function getLetter(companyId, branchId, hireId) {
  const s = await getDoc(doc(hireDoc(companyId, branchId, hireId), "letter", "current"));
  return s.exists() ? s.data() : null;
}

/** Save the letter for them — what they will read and sign on their link. */
export async function saveLetter(companyId, branchId, hireId, letter) {
  await setDoc(doc(hireDoc(companyId, branchId, hireId), "letter", "current"), { ...letter, savedAt: serverTimestamp() });
  await updateHire(companyId, branchId, hireId, { letterReady: true });
}

/** Where to open one of their files (storage.rules let those who manage staff or see pay read it). */
export const fileUrl = (path) => getDownloadURL(ref(storage, path));

/**
 * Accepted: the staff record is saved (the Add staff form, filled in); the
 * new hire points at it, and the record's private half keeps their
 * documents and where their signed letter is.
 */
export async function acceptHire(companyId, branchId, hire, staffId, me) {
  const b = writeBatch(db);
  b.update(hireDoc(companyId, branchId, hire.id), { status: "accepted", staffId, acceptedAt: serverTimestamp(), acceptedBy: stamp(me), updatedAt: serverTimestamp() });
  b.set(doc(db, "companies", companyId, "branches", branchId, "staffPrivate", staffId), { documents: documentsFrom(hire), joinedFrom: hire.id, updatedAt: serverTimestamp() }, { merge: true });
  await b.commit();
}
