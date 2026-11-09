// lib/payroll/advanceMonth.js — what is taken from one month's salary as advances
// (owner, 9 Nov 2026). Pure. An advance belongs to the salary it comes off, not
// the day it was given: one given on 3 Nov can come off October's pay. Counts
// what payroll counts: approved and handed over.
import { isPaidOut } from "../finance/rules";

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** What this advance takes from `month`'s salary: { amount, taken } or null. */
export function salaryLine(a, month) {
  const list = Array.isArray(a?.installments) ? a.installments : [];
  if (list.length) {
    const due = list.filter((i) => String(i.month || "") === month);
    const amount = r2(due.reduce((n, i) => n + (Number(i.amount) || 0), 0));
    return amount > 0 ? { amount, taken: due.every((i) => i.status === "paid") } : null;
  }
  // from before instalments were kept
  if ((a?.deductionMonth || String(a?.date || "").slice(0, 7)) !== month) return null;
  return { amount: r2(a.amount), taken: a.status === "closed" };
}

/**
 * The report for one salary month. advances: every advance of the branch.
 * → { rows, staff: [{ staffName, amount, rows }], total, taken, toTake, givenLater, waiting }
 * waiting: approved but not handed over yet, so payroll won't take them.
 */
export function salaryMonthReport(advances = [], month) {
  const rows = [];
  const waiting = [];
  for (const a of advances) {
    if (a.status !== "approved" && a.status !== "closed") continue;
    const line = salaryLine(a, month);
    if (!line) continue;
    const row = { id: a.id, a, date: a.date || "", staffName: (a.staffName || "Unknown").trim(), advanceType: a.advanceType || "", reason: a.reason || "", ...line, givenLater: String(a.date || "").slice(0, 7) > month };
    if (a.status === "closed" || isPaidOut(a)) rows.push(row);
    else waiting.push(row);
  }
  rows.sort((x, y) => x.staffName.localeCompare(y.staffName) || x.date.localeCompare(y.date));

  const byName = new Map();
  for (const r of rows) {
    const s = byName.get(r.staffName) || { staffName: r.staffName, amount: 0, rows: [] };
    s.amount = r2(s.amount + r.amount);
    s.rows.push(r);
    byName.set(r.staffName, s);
  }
  const sum = (list) => r2(list.reduce((n, r) => n + r.amount, 0));
  return {
    rows,
    staff: [...byName.values()].sort((x, y) => y.amount - x.amount),
    total: sum(rows),
    taken: sum(rows.filter((r) => r.taken)),
    toTake: sum(rows.filter((r) => !r.taken)),
    givenLater: sum(rows.filter((r) => r.givenLater)),
    waiting,
  };
}
