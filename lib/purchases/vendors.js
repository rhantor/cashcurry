// lib/purchases/vendors.js
// Vendors (22 Oct 2026): what a supplier is owed at this branch and when —
// overdue (past the bill's due date) and due within the week — from the
// branch's open bills, so the vendor list says who to pay first; and which
// vendors are still in use (an inactive one keeps its history but is no
// longer offered for new bills, orders or pay-outs). Pure — no Firebase.

import { daysBetween } from "./orders";

const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

/** What a bill still owes: its balance, or total − paid. */
export const billBalance = (b) => r2(b?.balance ?? Math.max(0, (Number(b?.total) || 0) - (Number(b?.paid) || 0)));

/** Days until due ("2026-10-25" from "2026-10-22" = 3; past = negative); null with no due date. */
export const dueIn = (b, today) => (b?.dueDate ? daysBetween(today, b.dueDate) : null);

/**
 * Open bills (unpaid / part paid) → per vendor at this branch:
 * { owed, bills, overdue, overdueBills, dueWeek, dueWeekBills, oldestLate, nextDue }
 * overdue: past the due date; dueWeek: due today to 7 days on; oldestLate:
 * days the most overdue bill is late; nextDue: the soonest due date not yet past.
 */
export function vendorDues(bills = [], today) {
  const out = {};
  for (const b of bills) {
    const owes = billBalance(b);
    if (!b?.vendorId || !(owes > 0) || b.status === "paid") continue;
    const v = (out[b.vendorId] ||= { owed: 0, bills: 0, overdue: 0, overdueBills: 0, dueWeek: 0, dueWeekBills: 0, oldestLate: 0, nextDue: "" });
    v.owed = r2(v.owed + owes);
    v.bills += 1;
    const d = dueIn(b, today);
    if (d == null) continue;
    if (d < 0) {
      v.overdue = r2(v.overdue + owes);
      v.overdueBills += 1;
      v.oldestLate = Math.max(v.oldestLate, -d);
    } else {
      if (d <= 7) {
        v.dueWeek = r2(v.dueWeek + owes);
        v.dueWeekBills += 1;
      }
      if (!v.nextDue || b.dueDate < v.nextDue) v.nextDue = b.dueDate;
    }
  }
  return out;
}

/** All vendors' dues added up: { owed, overdue, overdueVendors, dueWeek, dueWeekVendors }. */
export function duesTotal(dues = {}) {
  const list = Object.values(dues);
  return {
    owed: r2(list.reduce((s, v) => s + v.owed, 0)),
    overdue: r2(list.reduce((s, v) => s + v.overdue, 0)),
    overdueVendors: list.filter((v) => v.overdue > 0).length,
    dueWeek: r2(list.reduce((s, v) => s + v.dueWeek, 0)),
    dueWeekVendors: list.filter((v) => v.dueWeek > 0).length,
  };
}

/** Who to pay first: most overdue money, then due this week, then owed. */
export const payFirst = (dues) => (v) => {
  const d = dues[v.id] || {};
  return (d.overdue || 0) * 1e6 + (d.dueWeek || 0) * 1e3 + (d.owed || 0) / 1e3;
};

/** Still in use? (Vendors made before this have no flag: in use.) */
export const isActive = (v) => v?.active !== false;

/** Vendors to offer when choosing one: those in use — plus the one already chosen, if not. */
export const choosable = (vendors = [], keepId = "") => vendors.filter((v) => isActive(v) || v.id === keepId);
