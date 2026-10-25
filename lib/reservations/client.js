// lib/reservations/client.js
// Reservation deposit receipts in Firestore:
// companies/{c}/branches/{b}/reservationDeposits/{id}, numbered from
// companies/{c}/branches/{b}/counters/reservationDeposits (one field per month).
// Saving draws the number and writes the receipt in one transaction, so two
// people saving at once never get the same number. Receipts are never
// deleted: a mistake is marked Cancelled.
"use client";
import { collection, doc, getDoc, limit, onSnapshot, orderBy, query, runTransaction, serverTimestamp, updateDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { branchTag, periodOf, receiptNo } from "./receipt";

const col = (companyId, branchId) => collection(db, "companies", companyId, "branches", branchId, "reservationDeposits");
const counter = (companyId, branchId) => doc(db, "companies", companyId, "branches", branchId, "counters", "reservationDeposits");

/** Who did it, as stored on the receipt. */
export const stampOf = (user) => ({
  uid: user?.uid || "",
  username: user?.username || "",
  name: user?.name || user?.displayName || [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.username || "",
});

/** Save a new receipt → { id, receiptNo }. */
export async function createDeposit(companyId, branchId, user, form) {
  let tag = "BR";
  try {
    const b = await getDoc(doc(db, "companies", companyId, "branches", branchId));
    tag = branchTag(b.exists() ? b.data() : null, branchId);
  } catch {
    tag = branchTag(null, branchId);
  }
  const period = periodOf();
  const ref = doc(col(companyId, branchId));
  const no = await runTransaction(db, async (tx) => {
    const c = await tx.get(counter(companyId, branchId));
    const seq = ((c.exists() ? c.data()[period] : 0) || 0) + 1;
    const number = receiptNo(tag, period, seq);
    tx.set(counter(companyId, branchId), { [period]: seq, updatedAt: serverTimestamp() }, { merge: true });
    tx.set(ref, {
      receiptNo: number,
      customerName: String(form.customerName || "").trim(),
      customerPhone: String(form.customerPhone || "").trim(),
      reservationDate: form.reservationDate || "",
      reservationTime: form.reservationTime || "",
      pax: form.pax === "" || form.pax == null ? null : Number(form.pax),
      occasion: String(form.occasion || "").trim(),
      notes: String(form.notes || "").trim(),
      amount: Math.round((Number(form.amount) || 0) * 100) / 100,
      method: form.method || "cash",
      reference: String(form.reference || "").trim(),
      terms: String(form.terms || "").trim(),
      status: "held",
      branchId,
      companyId,
      createdBy: stampOf(user),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return number;
  });
  return { id: ref.id, receiptNo: no };
}

/** Mark a receipt Used / Refunded / Cancelled (or back to Held), with a note. */
export const setDepositStatus = (companyId, branchId, id, status, user, note = "") =>
  updateDoc(doc(col(companyId, branchId), id), {
    status,
    statusBy: stampOf(user),
    statusAt: serverTimestamp(),
    statusNote: String(note || "").trim(),
    updatedAt: serverTimestamp(),
  });

/** This branch's receipts, newest first, live. → { list, loading, error } */
export function useDeposits(companyId, branchId, max = 300) {
  const [state, setState] = useState({ list: [], loading: true, error: null });
  useEffect(() => {
    if (!companyId || !branchId) return;
    setState((s) => ({ ...s, loading: true }));
    return onSnapshot(
      query(col(companyId, branchId), orderBy("createdAt", "desc"), limit(max)),
      (snap) => setState({ list: snap.docs.map((d) => ({ id: d.id, ...d.data() })), loading: false, error: null }),
      (error) => setState({ list: [], loading: false, error })
    );
  }, [companyId, branchId, max]);
  return state;
}
