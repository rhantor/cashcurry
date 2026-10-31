"use client";
import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useGetBranchSettingsQuery } from "@/lib/redux/api/branchSettingsApiSlice";
import { skipToken } from "@reduxjs/toolkit/query";
import { shiftsEnabled } from "@/lib/attendance/shifts";
import { can } from "@/lib/authz/permissions";
import { canDecideVoucher } from "@/lib/costs/vouchers";
import { canReviewBill } from "@/lib/payouts/model";

/**
 * How many things wait for this person's decision — the same lists the
 * Requested Panel shows:
 *  - advances, staff loans and leave: at this branch, or at every branch for
 *    the company roles (their inbox lists every branch);
 *  - at the branch being viewed: loans asked of it by another branch,
 *    early OT (only when the branch runs shifts), pay-out bills and vouchers
 *    (4.9, 4.10).
 * Bills and vouchers count only when this person may decide them (not their
 * own; only someone senior to whoever made them — lib/authz/permissions.js).
 * Live: the badge changes the moment something arrives or is decided, and
 * only the waiting records are read.
 *
 * `branchIds`: every branch for a company role, else just the branch.
 */
export default function usePendingRequests({ companyId, branchId, role, uid, branchIds }) {
  // a company role may have no branch picked yet: its inbox still lists every branch
  const allBranches = (branchIds?.length ? branchIds : [branchId]).filter(Boolean);
  const key = allBranches.join(",");
  const requestsOn = can(role, "advances.approve") && !!companyId && allBranches.length > 0;
  const here = !!companyId && !!branchId; // the branch being viewed, for its own lists
  const costsOn = can(role, "costs.approve") && here;
  const enabled = requestsOn || costsOn;
  const { data: settings } = useGetBranchSettingsQuery(requestsOn && here ? { companyId, branchId } : skipToken);
  const ot = requestsOn && here && shiftsEnabled(settings?.attendance);
  const [counts, setCounts] = useState({ requests: 0, loans: 0, ot: 0, bills: 0, vouchers: 0 });

  useEffect(() => {
    if (!enabled) {
      setCounts({ requests: 0, loans: 0, ot: 0, bills: 0, vouchers: 0 });
      return;
    }
    const base = (b) => ["companies", companyId, "branches", b];
    const pending = (ref) => query(ref, where("status", "==", "pending"));
    const parts = {};
    const sum = (prefix) => Object.entries(parts).reduce((n, [k, v]) => n + (k.startsWith(prefix) ? v : 0), 0);
    const publish = () => setCounts({ requests: sum("req:"), loans: sum("loans"), ot: sum("ot"), bills: sum("bills"), vouchers: sum("vouchers") });
    const watch = (q, k, keep = () => true) =>
      onSnapshot(
        q,
        (snap) => {
          parts[k] = snap.docs.filter((d) => keep(d.data())).length;
          publish();
        },
        () => {
          parts[k] = 0; // not readable / offline: show nothing rather than a wrong number
          publish();
        }
      );
    const stops = [];
    if (requestsOn) {
      for (const b of key.split(",")) {
        stops.push(
          watch(pending(collection(db, ...base(b), "advances")), `req:${b}:advances`),
          watch(pending(collection(db, ...base(b), "loans")), `req:${b}:staffLoans`),
          watch(pending(collection(db, ...base(b), "leaves")), `req:${b}:leaves`)
        );
      }
      // Company-level loans between branches: only those asked of this branch.
      if (here) stops.push(watch(pending(collection(db, "companies", companyId, "loans")), "loans", (l) => (l.requestedToBranchId ?? l.toBranchId) === branchId));
      if (ot) stops.push(watch(pending(collection(db, ...base(branchId), "otRequests")), "ot"));
    }
    if (costsOn) {
      const payouts = collection(db, ...base(branchId), "payouts");
      const me = { uid, role };
      stops.push(
        watch(query(payouts, where("kind", "==", "settle"), where("status", "==", "pending")), "bills", (b) => canReviewBill(me, b, can)),
        watch(query(collection(db, ...base(branchId), "costs"), where("voucher.status", "==", "pending")), "vouchers", (c) => canDecideVoucher(me, c))
      );
    }
    return () => stops.forEach((stop) => stop());
  }, [enabled, requestsOn, costsOn, here, companyId, branchId, ot, key, uid, role]);

  return { ...counts, total: counts.requests + counts.loans + counts.ot + counts.bills + counts.vouchers };
}
