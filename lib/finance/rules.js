// The money rules — one place, used by every screen that shows cash or bank.
//
// These follow the Summary report, which the business has checked against its
// real books. Change a rule here and the summary, both dashboards, the cash
// tracker and the yearly statement all change together; the golden tests in
// tests/finance will show exactly which figures moved.
import { format } from "date-fns";

/** Amount from a stored value ("569.05", 569.05, null…). */
export const num = (v) => (v ? Number(v) : 0);

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The local calendar day ("yyyy-MM-dd") a value falls on, or null.
 * A business date string is taken as written — it already names the day.
 * Timestamps (Firestore, ISO strings, Date, ms) go on the local day.
 */
export function dayKey(v) {
  if (!v) return null;
  if (typeof v === "string" && DATE_ONLY.test(v)) return v;
  let d;
  if (typeof v === "number") d = new Date(v);
  else if (typeof v?.seconds === "number") d = new Date(v.seconds * 1000);
  else if (typeof v?.toDate === "function") d = v.toDate();
  else d = new Date(v);
  return Number.isNaN(+d) ? null : format(d, "yyyy-MM-dd");
}

// ── which day a record belongs to ───────────────────────────────────────────
// Exactly one field per kind of record — the one every entry form sets. The
// fast dashboards fetch "this month's records" with a database query on that
// same field, so the engine must date records by it and nothing else (a
// fallback like createdAt could never be queried, and the fast and full
// answers would differ). DATE_FIELD lists them for the queries.
export const DATE_FIELD = {
  sales: "date",
  costs: "date",
  advances: "date",
  staffLoans: "date",
  deposits: "date",
  withdrawals: "date",
  salaries: "paymentDate",
};
export const saleDay = (s) => dayKey(s?.date);
export const costDay = (c) => dayKey(c?.date);
export const advanceDay = (a) => dayKey(a?.date);
export const staffLoanDay = (l) => dayKey(l?.date);
export const depositDay = (d) => dayKey(d?.date);
export const withdrawalDay = (w) => dayKey(w?.date);
export const salaryDay = (s) => dayKey(s?.paymentDate);
export const loanActivityDay = (e) =>
  dayKey(e?.payDate || e?.paymentDate || e?.repayDate || e?.loanDate || e?.date) ||
  dayKey(e?.createdAt) ||
  dayKey(e?.updatedAt);

// ── cash or bank? ───────────────────────────────────────────────────────────
/** A cost paid from the till (front office); anything else came from the bank. */
export const isCashCost = (c) =>
  String(c?.paidFromOffice || "").toLowerCase() === "front" ||
  String(c?.paidMethod || c?.method || "").toLowerCase() === "cash";

/** Payroll entries carry payMethod; older manual entries only paidFromOffice. */
export function isSalaryCash(s) {
  const m = String(s?.payMethod || "").toLowerCase();
  if (m === "bank" || m === "bank_transfer" || m === "cheque") return false;
  return String(s?.paidFromOffice || "front").toLowerCase() !== "back";
}

/** Advances and staff loans are cash unless paid from the back office. */
export const isPaidFromTill = (x) => String(x?.paidFromOffice || "front").toLowerCase() !== "back";

/** A loan repayment method that moves cash (blank counts as cash). */
export function isCashMethod(m) {
  const x = String(m || "").trim().toLowerCase();
  if (!x) return true;
  return /(cash|hand\s*cash|cash-in-hand|voucher|petty)/i.test(x);
}

// ── amounts ─────────────────────────────────────────────────────────────────
export const salaryAmount = (s) => num(s?.totalSalary ?? s?.amount ?? s?.total ?? s?.total_amount ?? 0);

/** Staff loans recorded before the app was adopted never left this till. */
export const isMigratedStaffLoan = (l) => l?.source === "migration";

// ── advances and staff loans: requested → approved → paid ──────────────────
// Money leaves only when a request has been approved AND someone has paid it
// out. Paying records `paidOut: { date, from: "front" | "back", by }`; a new
// request carries `paidOut: null` until then.

/** Leave requests share the advances collection but are never money. */
const LEAVE_TYPES = new Set(["medical", "annual", "leave"]);
export const isLeaveRequest = (x) => LEAVE_TYPES.has(String(x?.advanceType || "").toLowerCase());

/**
 * When and from where an advance or staff loan was paid out:
 * `{ day, fromTill }`, or null while no money has left.
 *
 * Records made before this rule have no `paidOut` field at all. Those were
 * entered by managers as already given, so — as before — they count as paid
 * on their own date when approved, closed or never given a status. Pending
 * and rejected ones do not (they used to, which was wrong).
 *
 * @param {object} x
 * @param {(x: object) => string|null} legacyDay  the record's own day
 */
export function paidOutOf(x, legacyDay) {
  if (!x || isLeaveRequest(x)) return null;
  if (x.paidOut) {
    const day = dayKey(x.paidOut.date);
    return day ? { day, fromTill: String(x.paidOut.from || "front").toLowerCase() !== "back" } : null;
  }
  if (x.paidOut === null) return null; // approved or not, not paid yet
  const status = String(x.status || "").toLowerCase();
  if (status && status !== "approved" && status !== "closed") return null;
  const day = legacyDay(x);
  return day ? { day, fromTill: isPaidFromTill(x) } : null;
}

/** Has this advance or staff loan been paid out? (Payroll deducts only these.) */
export const isPaidOut = (x) => paidOutOf(x, (r) => dayKey(r.date || r.createdAt)) !== null;

// ── payment types (tenders) ─────────────────────────────────────────────────
// Used only when a branch has no payment types configured.
export const DEFAULT_TENDERS = [
  { key: "cash", label: "Cash", order: 1, banked: false, includeInTotal: true },
  { key: "card", label: "Card", order: 2, banked: true, includeInTotal: true },
  { key: "qr", label: "QR", order: 3, banked: true, includeInTotal: true },
  { key: "grab", label: "Grab", order: 4, banked: true, includeInTotal: true },
  { key: "foodpanda", label: "Foodpanda", order: 5, banked: true, includeInTotal: true },
  { key: "online", label: "Online", order: 6, banked: true, includeInTotal: true },
  { key: "cheque", label: "Cheque", order: 7, banked: false, includeInTotal: true },
  { key: "promotion", label: "Promotion", order: 8, banked: false, includeInTotal: false },
];

/**
 * A branch's payment types from its settings: which count toward total
 * sales, which are paid into the bank, which are delivery apps.
 */
export function tenderConfig(settings) {
  const configured = settings?.financeSales?.tenders;
  const list = (Array.isArray(configured) && configured.length ? configured : DEFAULT_TENDERS)
    .filter((t) => t.enabled !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const byKey = new Map(list.map((t) => [t.key, t]));
  const explicitDelivery = list.filter((t) => t.delivery).map((t) => t.key);
  return {
    defs: list,
    keys: list.map((t) => t.key),
    byKey,
    isBanked: (k) => !!byKey.get(k)?.banked,
    countsInTotal: (k) => byKey.has(k) && byKey.get(k).includeInTotal !== false,
    deliveryKeys: explicitDelivery.length ? explicitDelivery : ["grab", "foodpanda"].filter((k) => byKey.has(k)),
  };
}

/** Opening cash and bank balances a branch started using the app with. */
export function openingBalances(settings) {
  return {
    cash: num(settings?.initialCash ?? settings?.financeSales?.openingBalance ?? 0),
    bank: num(settings?.financeSales?.openingBankBalance ?? 0),
  };
}

// ── loans between branches ──────────────────────────────────────────────────
/**
 * Loans and repayments from this branch's point of view.
 * A loan always moves cash (lender −, borrower +). A repayment moves cash or
 * bank depending on how it was paid (lender +, payer −).
 */
export function branchLoanMovements(loanActivities, branchId) {
  const out = [];
  for (const e of loanActivities || []) {
    const type = String(e.type || "").toLowerCase();
    const from = e._fromBranchId ?? e.fromBranchId ?? e.requestFromBranchId;
    const to = e._toBranchId ?? e.toBranchId ?? e.requestedToBranchId;
    const role = to === branchId ? "lender" : from === branchId ? "borrower" : null;
    const day = loanActivityDay(e);
    if (!role || !day) continue;

    const method = String(e.paymentMethod || e.method || "").toLowerCase();
    const amount = num(e.amount);
    let cashDelta = 0;
    let bankDelta = 0;
    if (type === "loan") {
      cashDelta = role === "lender" ? -amount : amount;
    } else if (type === "repayment") {
      const sign = role === "lender" ? 1 : -1;
      if (isCashMethod(method)) cashDelta = sign * amount;
      else bankDelta = sign * amount;
    }
    out.push({
      id: e.id, type, amount, role, day, cashDelta, bankDelta,
      paymentMethod: type === "loan" ? "cash (forced)" : method || "-",
      fromBranchId: from, toBranchId: to,
      requestFrom: e.requestFrom || null, requestedTo: e.requestedTo || null,
      reason: e.reason || null,
    });
  }
  return out;
}
