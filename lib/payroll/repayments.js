// Advance and loan repayments taken through payroll. A slip takes only what
// the pay can cover (calcPayroll caps advanceAmt / loanAmt); these helpers
// share that amount out over the instalments due and, when a run is
// finalized, mark exactly that much repaid — any shortfall becomes a new
// instalment the month after the last one (decided 18 Oct 2026).

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Share `taken` over the instalments due, in order. Returns the items with
 * `amount` = what is taken from each and `due` = what was scheduled; items
 * nothing is taken from are left out, so finalize never touches them.
 */
export function allocateTaken(items = [], taken = 0) {
  let left = r2(taken);
  const out = [];
  for (const it of items) {
    const due = r2(it.amount);
    const amount = r2(Math.min(due, left));
    left = r2(left - amount);
    if (amount > 0) out.push({ ...it, due, amount });
  }
  // a manager typed more than is due (paying extra): the extra goes on the last one
  if (left > 0 && out.length) out[out.length - 1].amount = r2(out[out.length - 1].amount + left);
  return out;
}

const nextMonth = (key) => {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

/**
 * Mark instalment `index` repaid with `paid`. If that is less than scheduled,
 * the instalment shrinks to `paid` and the rest is added as a new pending
 * instalment after the last one; if more, the extra comes off the last
 * pending instalments, so the loan ends sooner. Returns the new list plus totals.
 */
export function applyRepayment(installments = [], index, paid, { amount: principal = 0, now = new Date().toISOString() } = {}) {
  let list = installments.map((i) => ({ ...i, _t: i.index === index }));
  const target = list.find((i) => i._t);
  if (!target || target.status === "paid") return null;
  const taken = r2(paid);
  const scheduled = r2(target.amount);
  const month = target.month;

  if (taken < scheduled) {
    const carry = r2(scheduled - taken);
    const last = [...list.map((i) => i.month)].sort().pop();
    list = list.map((i) => (i._t ? { ...i, amount: taken } : i));
    list.push({
      index: list.length + 1,
      month: nextMonth(last),
      amount: carry,
      status: "pending",
      paidAt: null,
      note: `Carried over from ${month} (partial payment)`,
    });
    list.sort((a, b) => a.month.localeCompare(b.month));
    list = list.map((i, n) => ({ ...i, index: n + 1 }));
  } else if (taken > scheduled) {
    let extra = r2(taken - scheduled);
    list = list.map((i) => (i._t ? { ...i, amount: taken } : i));
    for (let n = list.length - 1; n >= 0 && extra > 0; n--) {
      const i = list[n];
      if (i._t || i.status === "paid") continue;
      const cut = r2(Math.min(extra, i.amount));
      list[n] = { ...i, amount: r2(i.amount - cut) };
      extra = r2(extra - cut);
    }
    list = list.filter((i) => i._t || i.status === "paid" || i.amount > 0).map((i, n) => ({ ...i, index: n + 1 }));
  }

  list = list.map(({ _t, ...i }) => (_t ? { ...i, status: "paid", paidAt: now } : i));
  const totalPaid = r2(list.filter((i) => i.status === "paid").reduce((s, i) => s + (Number(i.amount) || 0), 0));
  return {
    installments: list,
    totalPaid,
    remainingAmount: r2(principal - totalPaid),
    allPaid: list.every((i) => i.status === "paid"),
  };
}

const paidOutside = (list, months) =>
  list
    .filter((i) => i.status === "paid" && !months.has(i.month))
    .map((i) => `${i.month}|${r2(i.amount)}`)
    .sort()
    .join();

/**
 * Take one run's repayments back off an advance or loan, leaving anything paid
 * since (a later month's run, a manual payment) as it is. `items` are the
 * run's deductionMeta for it; `before` is its repaymentUndo snapshot.
 *
 * Where the run took exactly what was due, just those instalments go back to
 * pending. Where it took more or less, the schedule changed too (carry-over,
 * shortened end), so only the snapshot can undo it, and that is safe only if
 * nothing else was paid since. Returns the fields to save, or null if not safe.
 */
export function reverseRepayment(current, items = [], before = {}) {
  const was = before.installments || [];
  const now = current.installments || [];
  const taken = items.map((it) => ({ it, inst: was.find((i) => i.index === it.index) }));
  if (taken.some((t) => !t.inst)) return null;
  const months = new Set(taken.map((t) => t.inst.month));
  const asDue = taken.every((t) => r2(t.it.amount) === r2(t.it.due ?? t.inst.amount));

  if (!asDue) {
    if (paidOutside(now, months) !== paidOutside(was, months)) return null;
    return {
      installments: was,
      totalPaid: before.totalPaid ?? 0,
      remainingAmount: before.remainingAmount ?? current.amount ?? 0,
      status: before.status || "approved",
    };
  }

  if (!taken.every((t) => now.some((i) => i.month === t.inst.month && i.status === "paid"))) return null;
  const installments = now.map((i) => (months.has(i.month) && i.status === "paid" ? { ...i, status: "pending", paidAt: null } : i));
  const totalPaid = r2(installments.filter((i) => i.status === "paid").reduce((s, i) => s + (Number(i.amount) || 0), 0));
  return {
    installments,
    totalPaid,
    remainingAmount: r2((Number(current.amount) || 0) - totalPaid),
    status: before.status && before.status !== "closed" ? before.status : "approved",
  };
}
