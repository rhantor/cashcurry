// lib/costs/client.js — reading and saving the company's cost categories
// (companies/{c}/settings/costCategories, lib/costs/categories.js), and
// deciding vouchers (lib/costs/vouchers.js).
"use client";
import { useCallback, useEffect, useState } from "react";
import { collection, doc, onSnapshot, query, runTransaction, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { checkGroups, groupsFrom } from "./categories";
import { approveVoucherPatch, invoiceAddedPatch, rejectVoucherPatch, resubmitVoucherPatch, selfDayCount, selfDayId, waitingVoucher } from "./vouchers";
import { isCompanyRole, selfApproves } from "@/lib/authz/permissions";

const settingsDoc = (companyId) => doc(db, "companies", companyId, "settings", "costCategories");

/** { groups, saved, loading } — live; the defaults until the company saves its own. */
export function useCostCategories(companyId) {
  const [state, setState] = useState({ saved: null, loading: true });
  useEffect(() => {
    if (!companyId) return;
    return onSnapshot(
      settingsDoc(companyId),
      (s) => setState({ saved: s.exists() ? s.data() : null, loading: false }),
      () => setState({ saved: null, loading: false })
    );
  }, [companyId]);
  return { groups: groupsFrom(state.saved), saved: state.saved, loading: state.loading };
}

/** Save the groups (owner, super admin, gm). Throws with the first problem found. */
export async function saveCostCategories(companyId, groups, user) {
  const problems = checkGroups(groups);
  if (problems.length) throw new Error(problems[0]);
  const clean = groups.map((g) => ({
    id: g.id,
    name: g.name.trim(),
    kind: g.kind === "notCost" ? "notCost" : "expense",
    ...(g.hidden ? { hidden: true } : {}),
    categories: g.categories.map((c) => ({ id: c.id, name: c.name.trim(), needs: c.needs || [], ...(c.hidden ? { hidden: true } : {}) })),
  }));
  await setDoc(settingsDoc(companyId), { groups: clean, updatedAt: serverTimestamp(), updatedBy: { uid: user?.uid || null, name: user?.firstName || user?.username || "" } });
}

/** uid → role, from the company's people list — for vouchers saved before they carried a role. */
export function useRoleOf(companyId) {
  const [roles, setRoles] = useState({});
  useEffect(() => {
    if (!companyId) return;
    return onSnapshot(
      collection(db, "companies", companyId, "users"),
      (s) => setRoles(Object.fromEntries(s.docs.map((d) => [d.id, d.data().role || ""]))),
      () => setRoles({})
    );
  }, [companyId]);
  return useCallback((uid) => roles[uid] || "", [roles]);
}

// ── a manager's own approved as saved, per day (lib/costs/vouchers.js) ──────
export const selfDayDoc = (companyId, branchId, date, uid) => doc(db, "companies", companyId, "branches", branchId, "selfApproved", selfDayId(date, uid));

/** Live: what of this person's own was approved as saved on `date` (0 when none). */
export function useSelfUsed(companyId, branchId, uid, date) {
  const [used, setUsed] = useState(0);
  useEffect(() => {
    if (!companyId || !branchId || !uid || !date) return;
    return onSnapshot(
      selfDayDoc(companyId, branchId, date, uid),
      (s) => setUsed(s.exists() ? Number(s.data().total) || 0 : 0),
      () => setUsed(0)
    );
  }, [companyId, branchId, uid, date]);
  return used;
}

/**
 * Save a new cost. One approved as saved under a manager's limits is written
 * with the day's total in one go — checked again here, so two saved at once
 * can't both slip under it; if the day's limit is reached, it waits instead.
 * Returns { id, waiting }.
 */
export async function addCost(companyId, branchId, data, user, limits) {
  const ref = doc(collection(db, "companies", companyId, "branches", branchId, "costs"));
  if (!data.voucher?.auto || isCompanyRole(user?.role)) {
    await setDoc(ref, data);
    return { id: ref.id, waiting: data.voucher?.status === "pending" };
  }
  const dayRef = selfDayDoc(companyId, branchId, data.date, user.uid);
  return runTransaction(db, async (tx) => {
    const day = await tx.get(dayRef);
    const used = day.exists() ? Number(day.data().total) || 0 : 0;
    if (!selfApproves(user.role, data.amount, limits, used)) {
      tx.set(ref, { ...data, voucher: waitingVoucher(data.voucher) });
      return { id: ref.id, waiting: true };
    }
    tx.set(ref, data);
    tx.set(dayRef, selfDayCount(day.exists() ? day.data() : null, { uid: user.uid, date: data.date, amount: data.amount, ref: { kind: "cost", id: ref.id } }));
    return { id: ref.id, waiting: false };
  });
}

const costDoc = (companyId, branchId, id) => doc(db, "companies", companyId, "branches", branchId, "costs", id);

export const approveVoucher = (companyId, branchId, id, user) => updateDoc(costDoc(companyId, branchId, id), approveVoucherPatch(user));
export const rejectVoucher = (companyId, branchId, id, user, note) => updateDoc(costDoc(companyId, branchId, id), rejectVoucherPatch(user, note));
export const resubmitVoucher = (companyId, branchId, id, user, reason) => updateDoc(costDoc(companyId, branchId, id), resubmitVoucherPatch(user, reason));
export const addInvoiceToVoucher = (companyId, branchId, cost, user, fileURL) => updateDoc(costDoc(companyId, branchId, cost.id), invoiceAddedPatch(user, fileURL, cost));

/** Live: this person's vouchers that were sent back to them (to fix). */
export function useMySentBackVouchers(companyId, branchId, uid) {
  const [list, setList] = useState([]);
  useEffect(() => {
    if (!companyId || !branchId || !uid) return;
    const q = query(collection(db, "companies", companyId, "branches", branchId, "costs"), where("voucher.status", "==", "rejected"), where("voucher.by.uid", "==", uid));
    return onSnapshot(q, (s) => setList(s.docs.map((d) => ({ id: d.id, ...d.data() }))), () => setList([]));
  }, [companyId, branchId, uid]);
  return list;
}
