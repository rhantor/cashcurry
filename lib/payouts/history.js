// Pay-out history (owner, 14 Nov 2026): what was handed out of the till on a
// day — yesterday by default — and each day of a month at a glance. Pure: the
// Pay-outs page's History tab reads it. Records are the branch's payouts
// (kind "out" and kind "settle", lib/payouts/model.js); a pay-out taken back
// was deleted, so it is never here.

const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const round2 = (v) => Math.round(v * 100) / 100;

/** "YYYY-MM-DD" one day before or after. */
export function shiftDay(date, days) {
  const [y, m, d] = String(date).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** First and last day of the month a day is in. */
export function monthOf(date) {
  const [y, m] = String(date).split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, "0");
  return { from: `${y}-${mm}-01`, to: `${y}-${mm}-${String(last).padStart(2, "0")}` };
}

/** Where a pay-out stands, from it and its bill (if any). */
export function stateOf(out, settle) {
  if (!settle || out?.status === "open") return { key: "open", label: "No bill yet" };
  if (settle.status === "approved") return { key: "approved", label: "Bill approved" };
  if (settle.status === "rejected") return { key: "rejected", label: "Bill sent back" };
  return { key: "pending", label: "Bill waiting for approval" };
}

/** A bill that counts: brought back and not sent back. */
const billCounts = (s) => s?.kind === "settle" && s.status !== "rejected";

/**
 * One day: what was handed out, the bills that came back, and the totals.
 * `records` may hold other days too; `billsById` adds bills (settle records)
 * that came back on a later day, so a pay-out shows where it stands now.
 */
export function payoutDay(records = [], date, billsById = {}) {
  const all = Array.isArray(records) ? records : [];
  const settles = Object.fromEntries(all.filter((r) => r?.kind === "settle").map((s) => [s.id, s]));
  const bills = { ...billsById, ...settles };
  const billOf = (o) => (o.settleId && bills[o.settleId]) || all.find((s) => s?.kind === "settle" && s.payoutId === o.id) || null;

  const outs = all
    .filter((r) => r?.kind === "out" && r.date === date)
    .map((o) => {
      const bill = billOf(o);
      return { ...o, bill, state: stateOf(o, bill) };
    })
    .sort((a, b) => n(b.amount) - n(a.amount));
  const outIds = new Set(outs.map((o) => o.id));
  // bills brought back this day for money handed out on another day
  const billsBack = all.filter((r) => billCounts(r) && r.date === date && !outIds.has(r.payoutId));

  const handedOut = round2(outs.reduce((s, o) => s + n(o.amount), 0));
  const stillOut = round2(outs.filter((o) => o.state.key === "open").reduce((s, o) => s + n(o.amount), 0));
  const back = all.filter((r) => billCounts(r) && r.date === date);
  return {
    date,
    outs,
    billsBack,
    totals: {
      handedOut,
      count: outs.length,
      stillOut,
      openCount: outs.filter((o) => o.state.key === "open").length,
      // bills brought back on this day (any day's money), and what came back to the till
      bills: round2(back.reduce((s, b) => s + n(b.billAmount), 0)),
      billCount: back.length,
      change: round2(back.reduce((s, b) => s + (n(b.floatAmount) - n(b.billAmount)), 0)),
    },
  };
}

/** Each day of a month that had any pay-out or bill, newest first, with the month's totals. */
export function payoutMonth(records = [], { from, to }) {
  const all = (Array.isArray(records) ? records : []).filter((r) => r?.date >= from && r?.date <= to);
  const days = [...new Set(all.map((r) => r.date))].sort().reverse();
  const rows = days.map((date) => ({ date, ...payoutDay(all, date).totals }));
  const sum = (k) => round2(rows.reduce((s, r) => s + r[k], 0));
  return {
    days: rows,
    totals: { handedOut: sum("handedOut"), count: rows.reduce((s, r) => s + r.count, 0), bills: sum("bills"), billCount: rows.reduce((s, r) => s + r.billCount, 0), change: sum("change") },
  };
}
