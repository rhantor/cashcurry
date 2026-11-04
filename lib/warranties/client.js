// lib/warranties/client.js — reading and writing warranties. What they mean:
// lib/warranties/model.js. Who may: firestore.rules.
"use client";
import { useEffect, useState } from "react";
import { addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp, updateDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { personName } from "@/lib/people";
import { renewalPatch } from "./model";

const col = (companyId, branchId) => collection(db, "companies", companyId, "branches", branchId, "warranties");
const one = (companyId, branchId, id) => doc(db, "companies", companyId, "branches", branchId, "warranties", id);
const nameOf = (me) => personName(me) || me?.username || "";

/** The branch's warranties, live. */
export function useWarranties(companyId, branchId) {
  const [state, setState] = useState({ list: [], loading: true });
  useEffect(() => {
    if (!companyId || !branchId) {
      setState({ list: [], loading: false });
      return;
    }
    return onSnapshot(
      col(companyId, branchId),
      (snap) => setState({ list: snap.docs.map((d) => ({ id: d.id, ...d.data() })), loading: false }),
      () => setState({ list: [], loading: false })
    );
  }, [companyId, branchId]);
  return state;
}

/** The warranty paper (a photo or PDF), into the person's own folder; null with no file. */
export async function uploadPaper(companyId, branchId, me, file) {
  if (!file) return null;
  const ext = file.name.split(".").pop() || "jpg";
  const r = ref(storage, `warranties/${companyId}/${branchId}/${me.uid}/${Date.now()}.${ext}`);
  await uploadBytes(r, file, { contentType: file.type || "image/jpeg" });
  return getDownloadURL(r);
}

export async function addWarranty(companyId, branchId, fields, me, extra = {}) {
  const made = await addDoc(col(companyId, branchId), {
    ...fields,
    ...extra,
    status: "active",
    history: [],
    createdBy: { uid: me.uid, name: nameOf(me) },
    createdAt: serverTimestamp(),
  });
  return made.id;
}

export const updateWarranty = (companyId, branchId, id, fields) => updateDoc(one(companyId, branchId, id), { ...fields, updatedAt: serverTimestamp() });

/** It was renewed: a new end date, and a new paper if there is one. */
export const renewWarranty = (companyId, branchId, warranty, { endsOn, paperURL }, me) =>
  updateWarranty(companyId, branchId, warranty.id, renewalPatch(warranty, { endsOn, paperURL, by: nameOf(me) }));

/** Won't be renewed: no more reminders. Can be undone. */
export const setRenewing = (companyId, branchId, id, renewing, me) =>
  updateWarranty(companyId, branchId, id, renewing ? { status: "active", stoppedBy: null } : { status: "notRenewing", stoppedBy: nameOf(me) });

export const deleteWarranty = (companyId, branchId, id) => deleteDoc(one(companyId, branchId, id));
