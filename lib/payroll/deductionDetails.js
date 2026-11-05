// What a payslip lists under "Advances and loans deducted" (owner, 6 Nov 2026):
// for each advance or staff loan the slip takes from — when it was given, its
// voucher, what for, how much, what this month took (which instalment) and
// what is left after it — so the printed slip needs no separate advance sheet.
// Pure: the slip's deductionMeta items plus the advance / loan records.
import { voucherNo } from "@/lib/costs/voucherPaper";

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * items: the slip's deductionMeta.advances or .loans — [{ docId, index, amount, due }]
 * docs: Map docId → the advance or staff loan record
 * kind: "advance" | "loan"; period: "YYYY-MM" of the run; branch: for the voucher number
 */
export function deductionLines({ items = [], docs = new Map(), kind = "advance", period = "", branch = null } = {}) {
  return items.map((it) => {
    const d = docs.get(it.docId) || {};
    const list = Array.isArray(d.installments) ? d.installments : [];
    const inst = list.find((i) => i.index === it.index);
    const amount = r2(d.amount);
    const taken = r2(it.amount);
    // repaid in earlier months (also by hand, before the app); this month's own is `taken`
    const paidBefore = r2(list.filter((i) => i.status === "paid" && String(i.month || "") < period).reduce((s, i) => s + (Number(i.amount) || 0), 0));
    return {
      kind,
      docId: it.docId,
      date: d.paidOut?.date || d.date || "",
      voucher: d.voucher?.no ? voucherNo(branch, d.voucher.no, kind === "loan" ? "L" : "A") : "",
      reason: String(d.reason || d.purpose || "").trim(),
      amount,
      due: r2(it.due ?? inst?.amount ?? it.amount),
      taken,
      instalment: inst && list.length ? `${inst.index} of ${list.length}` : "",
      left: amount ? Math.max(0, r2(amount - paidBefore - taken)) : null,
      // nothing taken this month: the instalment moves to a later month
      moved: taken === 0,
    };
  });
}

/** Records by id, from any number of lists. */
export const byId = (...lists) => new Map(lists.flat().filter(Boolean).map((d) => [d.id, d]));
