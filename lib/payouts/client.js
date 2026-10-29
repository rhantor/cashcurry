// lib/payouts/client.js — reading and writing pay-outs and their bills
// (roadmap 4.10, lib/payouts/model.js). Each step is one atomic write, so the
// till never shows half a change.
"use client";
import { useEffect, useState } from "react";
import { arrayUnion, collection, doc, getDoc, getDocs, increment, onSnapshot, orderBy, query, runTransaction, serverTimestamp, updateDoc, where, writeBatch, deleteDoc, limit } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { shrinkPhoto } from "@/lib/chat/client";
import { approveBill, newPayout, newSettle, rejectBill } from "./model";
import { approveSupplier, canCollect } from "./supplier";

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
export async function handOut(companyId, branchId, user, { date, amount, to, purpose, forVendor = null, forBills = [], forPo = null }) {
  const data = newPayout({ date, amount, to, purpose, forVendor, forBills, forPo }, user);
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
  // goods collected on a purchase order: it waits on this bill (no receiving it twice)
  if (bill.supplier?.mode === "po") b.update(orderRef(companyId, branchId, bill.supplier.poId), { payoutHold: sRef.id, updatedAt: serverTimestamp() });
  await b.commit();
  return sRef.id;
}

const orderRef = (companyId, branchId, id) => doc(db, "companies", companyId, "branches", branchId, "requisitions", id);

/** A bill sent back, tried again (new amount, files, category or reason). */
export async function resubmitBill(companyId, branchId, user, settle, changes) {
  const fresh = newSettle({ id: settle.payoutId, amount: settle.floatAmount, to: settle.to, purpose: settle.purpose, by: settle.payoutBy }, { date: settle.date, ...changes }, user);
  const b = writeBatch(db);
  b.update(doc(col(companyId, branchId), settle.id), {
    billAmount: fresh.billAmount,
    change: fresh.change,
    attachments: fresh.attachments,
    receipts: fresh.receipts,
    delivery: fresh.delivery,
    ...(changes.fields || {}),
    ...(fresh.voucherReason ? { voucherReason: fresh.voucherReason } : {}),
    note: fresh.note,
    ...(changes.supplier !== undefined ? { supplier: changes.supplier || null } : {}),
    status: "pending",
    by: fresh.by,
    updatedAt: serverTimestamp(),
  });
  if (changes.supplier?.mode === "po") b.update(orderRef(companyId, branchId, changes.supplier.poId), { payoutHold: settle.id, updatedAt: serverTimestamp() });
  await b.commit();
}

// ── suppliers (lib/payouts/supplier.js) ─────────────────────────────────────

const branchPath = (companyId, branchId, name) => collection(db, "companies", companyId, "branches", branchId, name);

/** The branch's suppliers (vendors) to pick from: [{ id, name }]. */
export function useSuppliers(companyId) {
  const [list, setList] = useState([]);
  useEffect(() => {
    if (!companyId) return;
    return onSnapshot(
      collection(db, "companies", companyId, "vendors"),
      // only suppliers in use (a vendor put away keeps its bills, isn't offered)
      (s) => setList(s.docs.filter((d) => d.data().active !== false).map((d) => ({ id: d.id, name: d.data().name || d.data().vendorName || "Supplier" })).sort((a, b) => a.name.localeCompare(b.name))),
      () => setList([])
    );
  }, [companyId]);
  return list;
}

/** A supplier's purchase orders that can still be collected at this branch, newest first. */
export async function openOrdersOf(companyId, branchId, vendorId, settleId = null) {
  if (!vendorId) return [];
  const s = await getDocs(query(branchPath(companyId, branchId, "requisitions"), where("vendorId", "==", vendorId)));
  return s.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((po) => canCollect(po, settleId) && po.status !== "Pending")
    .sort((a, b) => String(b.poNo || "").localeCompare(String(a.poNo || "")));
}

/** One purchase order. */
export async function getOrder(companyId, branchId, id) {
  const s = await getDoc(orderRef(companyId, branchId, id));
  return s.exists() ? { id: s.id, ...s.data() } : null;
}

/** A supplier's bills still owed at this branch, oldest first. */
export async function dueBillsOf(companyId, branchId, vendorId) {
  if (!vendorId) return [];
  const s = await getDocs(query(branchPath(companyId, branchId, "vendorBills"), where("vendorId", "==", vendorId)));
  return s.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((b) => (Number(b.balance) || 0) > 0)
    .sort((a, b) => String(a.invoiceDate || "").localeCompare(String(b.invoiceDate || "")));
}

/**
 * Approve a bill spent at a supplier: in one transaction the bills it paid
 * (or the bill it raised), the vendor payment, the one cost, the supplier's
 * balance and the pay-out bill itself — as Purchases → Due Bills would.
 */
export async function approveSupplierNow(companyId, branchId, user, settle) {
  const s = settle.supplier;
  const billsCol = branchPath(companyId, branchId, "vendorBills");
  const paymentRef = doc(branchPath(companyId, branchId, "vendorPayments"));
  const costRef = doc(branchPath(companyId, branchId, "costs"));
  const newBillRef = doc(billsCol);
  const deliveryRef = doc(branchPath(companyId, branchId, "costs")); // a delivery charge's own cost
  const r = await runTransaction(db, async (tx) => {
    const snaps = s.mode === "pays" ? await Promise.all((s.pays || []).map((p) => tx.get(doc(billsCol, p.billId)))) : [];
    const bills = snaps.filter((x) => x.exists()).map((x) => ({ id: x.id, ...x.data() }));
    // collecting a purchase order: the order as it is now, and the supplier's credit days
    let po = null;
    let termsDays = 0;
    if (s.mode === "po") {
      const [poSnap, vSnap] = await Promise.all([tx.get(orderRef(companyId, branchId, s.poId)), tx.get(doc(db, "companies", companyId, "vendors", s.vendorId))]);
      po = poSnap.exists() ? poSnap.data() : null;
      const v = vSnap.exists() ? vSnap.data() : {};
      termsDays = Number(v.termsDays ?? v.creditDays ?? v.paymentTermsDays ?? 0) || 0;
    }
    const r = approveSupplier(settle, bills, user, new Date(), { paymentId: paymentRef.id, newBillId: newBillRef.id }, { po, termsDays });
    const at = serverTimestamp();
    if (r.poPatch) tx.update(orderRef(companyId, branchId, s.poId), { ...r.poPatch, receivedAt: at, updatedAt: at });
    for (const w of r.billWrites) {
      if (w.create) tx.set(doc(billsCol, w.id), { ...w.data, createdAt: at, updatedAt: at });
      else {
        const { history, ...rest } = w.data;
        tx.update(doc(billsCol, w.id), { ...rest, paymentHistory: arrayUnion(history), updatedAt: at });
      }
    }
    tx.set(paymentRef, { ...r.payment, createdAt: at });
    tx.set(costRef, { ...r.cost, createdAt: at });
    if (r.deliveryCost) tx.set(deliveryRef, { ...r.deliveryCost, createdAt: at });
    tx.update(doc(db, "companies", companyId, "vendors", s.vendorId), {
      currentBalance: increment(r.vendorDelta.billed - r.vendorDelta.paid),
      totalBilled: increment(r.vendorDelta.billed),
      totalPaid: increment(r.vendorDelta.paid),
      lastPaymentDate: settle.date,
      updatedAt: at,
      lastPayout: { branchId, settleId: settle.id },
    });
    tx.update(doc(col(companyId, branchId), settle.id), { ...r.settlePatch, costId: costRef.id, ...(r.deliveryCost ? { deliveryCostId: deliveryRef.id } : {}), updatedAt: at });
    return r;
  });
  // what the goods cost, against this branch — as receiving in Purchases records it
  // (bookkeeping only: a failure here must not undo the approval)
  if (s.mode === "po") {
    await Promise.allSettled(
      (s.lines || [])
        .filter((l) => l.itemId && Number(l.finalPrice) > 0)
        .map((l) =>
          updateDoc(doc(db, "companies", companyId, "items", l.itemId), {
            [`lastPurchaseByBranch.${branchId}`]: { price: Number(l.finalPrice), date: s.invoiceDate || settle.date },
            lastPurchasePrice: Number(l.finalPrice),
            lastPurchaseDate: s.invoiceDate || settle.date,
            updatedAt: serverTimestamp(),
          })
        )
    );
  }
  return r;
}

/**
 * Approve a bill (maybe corrected): the bill is marked approved and its cost
 * is written in the same go — the cost now carries the money (model.js).
 */
export async function approveBillNow(companyId, branchId, user, settle, correction = {}) {
  const { settle: patch, cost, deliveryCost } = approveBill(settle, correction, user, new Date());
  const costs = collection(db, "companies", companyId, "branches", branchId, "costs");
  const costRef = doc(costs);
  const deliveryRef = deliveryCost ? doc(costs) : null; // a delivery charge is a cost of its own
  const b = writeBatch(db);
  b.update(doc(col(companyId, branchId), settle.id), { ...patch, costId: costRef.id, ...(deliveryRef ? { deliveryCostId: deliveryRef.id } : {}), updatedAt: serverTimestamp() });
  b.set(costRef, { ...cost, createdAt: serverTimestamp() });
  if (deliveryRef) b.set(deliveryRef, { ...deliveryCost, createdAt: serverTimestamp() });
  await b.commit();
  return costRef.id;
}

export const sendBillBack = (companyId, branchId, user, settle, note) =>
  runTransaction(db, async (tx) => {
    // a purchase order waiting on this bill is open again (it can be received in Purchases)
    const poId = settle.supplier?.mode === "po" ? settle.supplier.poId : null;
    const po = poId ? await tx.get(orderRef(companyId, branchId, poId)) : null;
    tx.update(doc(col(companyId, branchId), settle.id), { ...rejectBill(note, user), updatedAt: serverTimestamp() });
    if (po?.exists() && po.data().payoutHold === settle.id) tx.update(po.ref, { payoutHold: null, updatedAt: serverTimestamp() });
  });
