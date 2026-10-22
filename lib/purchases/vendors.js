// lib/purchases/vendors.js
// Vendors (22 Oct 2026): what a supplier is owed at this branch and when —
// overdue (past the bill's due date) and due within the week — from the
// branch's open bills, so the vendor list says who to pay first; and which
// vendors are still in use (an inactive one keeps its history but is no
// longer offered for new bills, orders or pay-outs). Pure — no Firebase.

import { daysBetween, lateDays } from "./orders";

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

// ── orders: how a supplier delivers (22 Oct 2026) ───────────────────────────

/** A stored date as "YYYY-MM-DD" (a Firestore timestamp, a Date, an ISO string) — "" if none. */
export function dayOf(v) {
  if (!v) return "";
  const ms = typeof v === "string" ? (/^\d{4}-\d{2}-\d{2}$/.test(v) ? null : Date.parse(v)) : v?.seconds != null ? v.seconds * 1000 : v instanceof Date ? v.getTime() : typeof v?.toDate === "function" ? v.toDate().getTime() : null;
  if (ms == null) return typeof v === "string" ? v : "";
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const OPEN = ["Pending", "Approved", "Sent"];
const pct = (a, b) => (b ? Math.round((a / b) * 100) : null);

/**
 * A supplier's orders at this branch → how they deliver:
 * { open, late, received, onTime, onTimeOf, onTimePct, short, shortPct, avgDays, avgOf }
 * on time: received on or before its deliver-by day (orders with one);
 * short: something came less than ordered; avgDays: sent → received.
 */
export function scorecard(orders = [], today) {
  const open = orders.filter((o) => OPEN.includes(o.status || "Pending"));
  const late = open.filter((o) => lateDays(o, today) > 0).length;
  const got = orders.filter((o) => o.status === "Received");
  const dated = got.filter((o) => o.deliverBy && dayOf(o.receivedAt));
  const onTime = dated.filter((o) => dayOf(o.receivedAt) <= o.deliverBy).length;
  const short = got.filter((o) => (o.receivedItems || []).some((l) => Number(l.receivedQty) < Number(l.requestedQty))).length;
  const spans = got.filter((o) => o.sentAt && dayOf(o.receivedAt)).map((o) => Math.max(0, daysBetween(dayOf(o.sentAt), dayOf(o.receivedAt))));
  return {
    open: open.length,
    late,
    received: got.length,
    onTime,
    onTimeOf: dated.length,
    onTimePct: pct(onTime, dated.length),
    short,
    shortPct: pct(short, got.length),
    avgDays: spans.length ? Math.round((spans.reduce((s, d) => s + d, 0) / spans.length) * 10) / 10 : null,
    avgOf: spans.length,
  };
}

// ── items: what we buy from them and at what price ──────────────────────────

/**
 * A supplier's bills (with item lines) → per item, newest first:
 * { key, name, unit, times, qty, last: { price, date }, prev: { price, date } | null, change: pct | null }
 * change: the last price against the one before (+ dearer, − cheaper).
 */
export function itemPrices(bills = []) {
  const by = new Map();
  const sorted = [...bills].sort((a, b) => String(a.invoiceDate || "").localeCompare(String(b.invoiceDate || "")));
  for (const b of sorted) {
    for (const l of b.items || []) {
      const price = Number(l.finalPrice ?? l.price ?? l.unitPrice) || 0;
      const qty = Number(l.receivedQty ?? l.qty ?? l.quantity) || 0;
      if (!(price > 0) || !(qty > 0)) continue;
      const key = l.itemId || String(l.name || "").toLowerCase();
      const it = by.get(key) || { key, name: l.name || "Item", unit: l.unit || "", times: 0, qty: 0, last: null, prev: null };
      it.times += 1;
      it.qty = r2(it.qty + qty);
      if (!it.last || price !== it.last.price) it.prev = it.last;
      it.last = { price, date: b.invoiceDate || "" };
      by.set(key, it);
    }
  }
  return [...by.values()]
    .map((it) => ({ ...it, change: it.prev ? Math.round(((it.last.price - it.prev.price) / it.prev.price) * 1000) / 10 : null }))
    .sort((a, b) => String(b.last.date).localeCompare(String(a.last.date)) || a.name.localeCompare(b.name));
}

// ── statement: bills and payments with a running balance ───────────────────

const paidDay = (p) => p?.paymentDate || dayOf(p?.paidAt) || String(p?.paidAtClient || "").slice(0, 10);

/**
 * A supplier's statement at this branch, from → to (inclusive):
 * { opening, rows: [{ date, kind: "bill"|"payment", ref, debit, credit, balance }], billed, paid, closing }
 * Bills add to what is owed (on their invoice date), payments take off (on
 * their payment date); on one day bills come first. opening: what was owed
 * before `from`.
 */
export function statement(bills = [], from, to) {
  const lines = [];
  for (const b of bills) {
    const total = r2(b.total ?? (Number(b.paid) || 0) + (Number(b.balance) || 0));
    if (total > 0) lines.push({ date: b.invoiceDate || "", kind: "bill", ref: b.invoiceNo || "Bill", debit: total, credit: 0 });
    for (const p of b.paymentHistory || []) {
      const amount = r2(p.amount);
      if (amount > 0) lines.push({ date: paidDay(p), kind: "payment", ref: `Paid · ${b.invoiceNo || "bill"}${p.paidMethod ? ` · ${String(p.paidMethod).replace(/_/g, " ")}` : ""}`, debit: 0, credit: amount });
    }
  }
  lines.sort((a, b) => a.date.localeCompare(b.date) || (a.kind === b.kind ? 0 : a.kind === "bill" ? -1 : 1));
  const before = lines.filter((l) => from && l.date < from);
  let balance = r2(before.reduce((s, l) => s + l.debit - l.credit, 0));
  const opening = balance;
  const rows = lines
    .filter((l) => (!from || l.date >= from) && (!to || l.date <= to))
    .map((l) => {
      balance = r2(balance + l.debit - l.credit);
      return { ...l, balance };
    });
  return {
    opening,
    rows,
    billed: r2(rows.reduce((s, l) => s + l.debit, 0)),
    paid: r2(rows.reduce((s, l) => s + l.credit, 0)),
    closing: balance,
  };
}
