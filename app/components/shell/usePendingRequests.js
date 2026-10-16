"use client";
import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useGetBranchSettingsQuery } from "@/lib/redux/api/branchSettingsApiSlice";
import { skipToken } from "@reduxjs/toolkit/query";
import { shiftsEnabled } from "@/lib/attendance/shifts";

// Who approves requests (the roles that see the Requested Panel).
const APPROVERS = ["manager", "branchAdmin"];

/**
 * How many requests wait for this branch's approval — the same three lists
 * the Requested Panel shows: advances and staff loans, loans asked of this
 * branch by another branch, and early-OT (only when the branch runs shifts).
 * Live: the badge changes the moment a request arrives or is decided, and
 * only the pending records are read.
 */
export default function usePendingRequests({ companyId, branchId, role }) {
  const enabled = APPROVERS.includes(role) && !!companyId && !!branchId;
  const { data: settings } = useGetBranchSettingsQuery(enabled ? { companyId, branchId } : skipToken);
  const ot = enabled && shiftsEnabled(settings?.attendance);
  const [counts, setCounts] = useState({ requests: 0, loans: 0, ot: 0 });

  useEffect(() => {
    if (!enabled) {
      setCounts({ requests: 0, loans: 0, ot: 0 });
      return;
    }
    const base = ["companies", companyId, "branches", branchId];
    const pending = (ref) => query(ref, where("status", "==", "pending"));
    const parts = { advances: 0, staffLoans: 0, loans: 0, ot: 0 };
    const publish = () => setCounts({ requests: parts.advances + parts.staffLoans, loans: parts.loans, ot: parts.ot });
    const watch = (q, key, keep = () => true) =>
      onSnapshot(
        q,
        (snap) => {
          parts[key] = snap.docs.filter((d) => keep(d.data())).length;
          publish();
        },
        () => {
          parts[key] = 0; // not readable / offline: show nothing rather than a wrong number
          publish();
        }
      );
    const stops = [
      watch(pending(collection(db, ...base, "advances")), "advances"),
      watch(pending(collection(db, ...base, "loans")), "staffLoans"),
      // Company-level loans between branches: only those asked of this branch.
      watch(pending(collection(db, "companies", companyId, "loans")), "loans", (l) => (l.requestedToBranchId ?? l.toBranchId) === branchId),
    ];
    if (ot) stops.push(watch(pending(collection(db, ...base, "otRequests")), "ot"));
    return () => stops.forEach((stop) => stop());
  }, [enabled, companyId, branchId, ot]);

  return { ...counts, total: counts.requests + counts.loans + counts.ot };
}
