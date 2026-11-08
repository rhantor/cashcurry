// lib/inventory/client.js — reading and writing stock. What it means:
// lib/inventory/model.js. Who may: firestore.rules. The stock itself comes
// from the server (app/api/inventory/stock), which reads the supplier bills.
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { addDoc, collection, deleteDoc, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { personName } from "@/lib/people";

const branchCol = (companyId, branchId, name) => collection(db, "companies", companyId, "branches", branchId, name);
const branchDoc = (companyId, branchId, name, id) => doc(db, "companies", companyId, "branches", branchId, name, id);
const stamp = (me) => ({ uid: me.uid, name: personName(me) || me?.username || "" });

/** The branch's stock, counts, waste and usage; `reload()` after a change. */
export function useInventory(companyId, branchId, today) {
  const [state, setState] = useState({ loading: true, error: "", data: null });
  const seq = useRef(0);
  const load = useCallback(async () => {
    if (!companyId || !branchId || !today) return;
    const n = ++seq.current;
    setState((s) => ({ ...s, loading: true, error: "" }));
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/inventory/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken || ""}` },
        body: JSON.stringify({ companyId, branchId, today }),
      });
      const body = await res.json().catch(() => ({}));
      if (n !== seq.current) return;
      if (!res.ok) throw new Error(body.error || "Could not load the stock.");
      setState({ loading: false, error: "", data: body });
    } catch (e) {
      if (n !== seq.current) return;
      setState((s) => ({ ...s, loading: false, error: e.message || "Could not load the stock." }));
    }
  }, [companyId, branchId, today]);
  useEffect(() => {
    load();
  }, [load]);
  return { ...state, reload: load };
}

/** One supplier's goods, counted. lines: countToSave(...). */
export const addCount = (companyId, branchId, { date, vendorId, vendorName, lines, note }, me) =>
  addDoc(branchCol(companyId, branchId, "stockTakes"), {
    date,
    vendorId: vendorId || "",
    vendorName: vendorName || "",
    lines,
    note: note || "",
    by: stamp(me),
    countedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  });

export const deleteCount = (companyId, branchId, id) => deleteDoc(branchDoc(companyId, branchId, "stockTakes", id));

/** Thrown away. row: a stock row (itemId, name, unit). */
export const addWaste = (companyId, branchId, { row, qty, reason, note, date }, me) =>
  addDoc(branchCol(companyId, branchId, "stockWaste"), {
    date,
    itemId: row.itemId || "",
    name: row.name || "",
    unit: row.unit || "",
    qty: Math.round(Number(qty) * 1000) / 1000,
    reason,
    note: note || "",
    by: stamp(me),
    createdAt: serverTimestamp(),
  });

export const deleteWaste = (companyId, branchId, id) => deleteDoc(branchDoc(companyId, branchId, "stockWaste", id));

/** When stock starts, the count day and minimums: { startDate?, countDay?, min? } (merged). */
export const saveStockSettings = (companyId, branchId, fields, me) =>
  setDoc(branchDoc(companyId, branchId, "stockSettings", "main"), { ...fields, updatedBy: stamp(me), updatedAt: serverTimestamp() }, { merge: true });
