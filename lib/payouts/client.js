// lib/payouts/client.js — reading and writing pay-outs and their bills
// (roadmap 4.10, lib/payouts/model.js). Each step is one atomic write, so the
// till never shows half a change.
"use client";
import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, orderBy, query, serverTimestamp, where, writeBatch, deleteDoc, limit } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { shrinkPhoto } from "@/lib/chat/client";
import { approveBill, newPayout, newSettle, rejectBill } from "./model";

const col = (companyId, branchId) => collection(db, "companies", companyId, "branches", branchId, "payouts");

/**
 * Live: open pay-outs, bills waiting, bills sent back, and the latest few
 * approved — everything the pay-outs page and the approvers need.
 */
export function useLivePayouts(companyId, branchId) {
  const [state, setState] = useState({ open: [], waiting: [], sentBack: [], loading: true });
  useEffect(() => {
    if (!companyId || !branchId) return;
    const c = col(companyId, branchId);
    const parts = {};
    const push = () => setState({ open: parts.open || [], waiting: parts.waiting || [], sentBack: parts.sentBack || [], loading: !("open" in parts && "waiting" in parts && "sentBack" in parts) });
    const listen = (key, q) =>
      onSnapshot(
        q,
        (snap) => {
          parts[key] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          push();
        },
        () => {
          parts[key] = [];
          push();
        }
      );
    const subs = [
      listen("open", query(c, where("kind", "==", "out"), where("status", "==", "open"))),
      listen("waiting", query(c, where("kind", "==", "settle"), where("status", "==", "pending"))),
      listen("sentBack", query(c, where("kind", "==", "settle"), where("status", "==", "rejected"))),
    ];
    return () => subs.forEach((u) => u());
  }, [companyId, branchId]);
  return state;
}

/** The latest settled bills (approved), newest first — for "done lately". */
export function useRecentBills(companyId, branchId, count = 10) {
  const [list, setList] = useState([]);
  useEffect(() => {
    if (!companyId || !branchId) return;
    const q = query(col(companyId, branchId), where("kind", "==", "settle"), where("status", "==", "approved"), orderBy("date", "desc"), limit(count));
    return onSnapshot(q, (s) => setList(s.docs.map((d) => ({ id: d.id, ...d.data() }))), () => setList([]));
  }, [companyId, branchId, count]);
  return list;
}

/** Hand money out of the till. */
export async function handOut(companyId, branchId, user, { date, amount, to, purpose }) {
  const data = newPayout({ date, amount, to, purpose }, user);
  const r = doc(col(companyId, branchId));
  const b = writeBatch(db);
  b.set(r, { ...data, createdAt: serverTimestamp() });
  await b.commit();
  return r.id;
}

/** Take back a pay-out made by mistake (still open, no bill). */
export const cancelPayout = (companyId, branchId, id) => deleteDoc(doc(col(companyId, branchId), id));

/** Bill photos, made smaller first, into the person's own folder. */
export async function uploadBillFiles(companyId, branchId, uid, files, onProgress) {
  const urls = [];
  let i = 0;
  for (const f of files) {
    const small = f.type?.startsWith("image/") ? await shrinkPhoto(f, 1600, 0.8) : f;
    const ext = small.type === "application/pdf" ? "pdf" : "jpg";
    const r = ref(storage, `payouts/${companyId}/${branchId}/${uid}/${Date.now()}-${i}.${ext}`);
    await uploadBytes(r, small, { contentType: small.type || "image/jpeg" });
    urls.push(await getDownloadURL(r));
    onProgress?.(++i / files.length);
  }
  return urls;
}

/** The bill came back: record it and mark the pay-out billed, together. */
export async function bringBill(companyId, branchId, user, payout, bill) {
  const sRef = doc(col(companyId, branchId));
  const data = newSettle(payout, bill, user);
  const b = writeBatch(db);
  b.set(sRef, { ...data, createdAt: serverTimestamp() });
  b.update(doc(col(companyId, branchId), payout.id), { status: "billed", settleId: sRef.id, updatedAt: serverTimestamp() });
  await b.commit();
  return sRef.id;
}

/** A bill sent back, tried again (new amount, files, category or reason). */
export async function resubmitBill(companyId, branchId, user, settle, changes) {
  const fresh = newSettle({ id: settle.payoutId, amount: settle.floatAmount, to: settle.to, purpose: settle.purpose, by: settle.payoutBy }, { date: settle.date, ...changes }, user);
  const b = writeBatch(db);
  b.update(doc(col(companyId, branchId), settle.id), {
    billAmount: fresh.billAmount,
    change: fresh.change,
    attachments: fresh.attachments,
    receipts: fresh.receipts,
    ...(changes.fields || {}),
    ...(fresh.voucherReason ? { voucherReason: fresh.voucherReason } : {}),
    note: fresh.note,
    status: "pending",
    by: fresh.by,
    updatedAt: serverTimestamp(),
  });
  await b.commit();
}

/**
 * Approve a bill (maybe corrected): the bill is marked approved and its cost
 * is written in the same go — the cost now carries the money (model.js).
 */
export async function approveBillNow(companyId, branchId, user, settle, correction = {}) {
  const { settle: patch, cost } = approveBill(settle, correction, user, new Date());
  const costRef = doc(collection(db, "companies", companyId, "branches", branchId, "costs"));
  const b = writeBatch(db);
  b.update(doc(col(companyId, branchId), settle.id), { ...patch, costId: costRef.id, updatedAt: serverTimestamp() });
  b.set(costRef, { ...cost, createdAt: serverTimestamp() });
  await b.commit();
  return costRef.id;
}

export const sendBillBack = (companyId, branchId, user, settle, note) => {
  const b = writeBatch(db);
  b.update(doc(col(companyId, branchId), settle.id), { ...rejectBill(note, user), updatedAt: serverTimestamp() });
  return b.commit();
};
