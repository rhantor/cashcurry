// lib/costs/client.js — reading and saving the company's cost categories
// (companies/{c}/settings/costCategories, lib/costs/categories.js), and
// deciding vouchers (lib/costs/vouchers.js).
"use client";
import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { checkGroups, groupsFrom } from "./categories";
import { approveVoucherPatch, invoiceAddedPatch, rejectVoucherPatch, resubmitVoucherPatch } from "./vouchers";

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
