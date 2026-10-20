// Turns an audit entry's before / after records into lines a person can read:
// field names in words, people by name, money with its sign, dates as dates,
// links as links — and no database ids.
import { formatMoney } from "../region/currency.js";
import { personName } from "../people.js";

const HIDDEN = new Set(["companyId", "branchId", "createdAt", "updatedAt", "searchKeywords", "searchArray", "tenderMeta", "isFrontOffice", "isBackOffice"]);
// ids and uids mean nothing to a reader
const isHidden = (k) => HIDDEN.has(k) || /(^id$|Id$|Ids$|^uid$|Uid$)/.test(k);

const LABELS = {
  date: "Date", amount: "Amount", total: "Total", category: "Category", costGroup: "Group", costKind: "Kind",
  description: "Description", details: "Details", paidFromOffice: "Paid from", paidMethod: "Paid by",
  attachments: "Attachments", images: "Photos", fileURL: "Invoice", zReportUrl: "Z report", voucher: "Voucher",
  createdBy: "Entered by", updatedBy: "Changed by", approvedBy: "Approved by", rejectedBy: "Rejected by",
  paidBy: "Paid by", receivedBy: "Received by", editedBy: "Edited by", notes: "Notes", note: "Note",
  reason: "Reason", status: "Status", by: "Asked by", at: "Asked at", decidedBy: "Decided by", decidedAt: "Decided at",
  meta: "From", type: "Type", staffName: "Staff", vendorName: "Vendor", vendor: "Vendor", invoiceNo: "Invoice no.",
  billNo: "Bill no.", dueDate: "Due date", paidAmount: "Paid", balance: "Balance", month: "Month", period: "Period",
  advanceType: "Advance type", installments: "Instalments", remarks: "Remarks", fromBranchName: "From branch",
  toBranchName: "To branch", approvedAt: "Approved at", rejectedAt: "Rejected at", paidAt: "Paid at",
};

// a few lines read better under their own name than "Parent · Child"
const PATH_LABELS = { "meta.type": "Made from" };

const MONEY = new Set(["amount", "total", "paidAmount", "balance", "netPay", "grossPay", "basic", "basicSalary", "deduction", "deductions", "allowance", "allowances", "bonus", "overtime", "price", "unitPrice", "subtotal", "tax", "rounding", "remaining", "principal", "float", "bill", "change"]);

const WORDS = {
  paidFromOffice: { front: "Front office (till)", back: "Back office" },
  costKind: { expense: "Cost", notCost: "Not a cost" },
  paidMethod: { cash: "Cash", card: "Card", bank: "Bank transfer", transfer: "Bank transfer", qr: "QR", online: "Online", cheque: "Cheque" },
  type: { payout: "Pay-out bill" },
  status: { pending: "Waiting", approved: "Approved", rejected: "Sent back", invoiced: "Invoice added", paid: "Paid", open: "Open" },
};

const humanize = (k) => {
  const s = String(k).replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").trim().toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const isPerson = (v) => v && typeof v === "object" && !Array.isArray(v) && ("uid" in v || "username" in v) && !!personName(v);
const isTime = (v) => v && typeof v === "object" && (typeof v.toDate === "function" || (typeof v.seconds === "number" && typeof v.nanoseconds === "number"));
const timeOf = (v) => (typeof v.toDate === "function" ? v.toDate() : new Date(v.seconds * 1000));

const dateText = (d) => d.toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" });
const dateTimeText = (d) => d.toLocaleString("en-MY", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true });

/** The money keys of a sale (cash, card…) and their names, from its tenderMeta. */
function tendersOf(rec) {
  const map = {};
  for (const t of Array.isArray(rec?.tenderMeta) ? rec.tenderMeta : []) if (t?.key) map[t.key] = t.label || humanize(t.key);
  return map;
}

/**
 * The record as flat lines: [{ path: "voucher.status", label: "Voucher · Status", key, value }].
 * Maps inside maps become "Parent · Child"; people stay whole; ids are left out.
 */
export function flatten(rec, tenders = {}, prefix = [], labels = []) {
  const out = [];
  if (!rec || typeof rec !== "object") return out;
  for (const [k, v] of Object.entries(rec)) {
    if (isHidden(k)) continue;
    const label = tenders[k] || LABELS[k] || humanize(k);
    const path = [...prefix, k];
    const lbls = [...labels, label];
    if (v && typeof v === "object" && !Array.isArray(v) && !isPerson(v) && !isTime(v)) {
      // notes: { cash: "…" } → "Notes · Cash"
      out.push(...flatten(v, k === "notes" ? tenders : {}, path, lbls));
    } else {
      out.push({ path: path.join("."), label: PATH_LABELS[path.join(".")] || lbls.join(" · "), key: k, value: v, money: !!tenders[k] && prefix.length === 0 });
    }
  }
  return out;
}

/** One value for the screen: { text, links?, empty? }. */
export function showValue(key, v, { currency, money = false } = {}) {
  if (v === null || v === undefined || v === "") return { text: "—", empty: true };
  if (isPerson(v)) return { text: personName(v) };
  if (isTime(v)) return { text: dateTimeText(timeOf(v)) };
  if (Array.isArray(v)) {
    if (!v.length) return { text: "None", empty: true };
    if (v.every((x) => typeof x === "string" && /^https?:\/\//.test(x))) return { text: "", links: v.map((href, i) => ({ href, label: v.length > 1 ? `File ${i + 1}` : "Open file" })) };
    return { text: v.map((x) => (x && typeof x === "object" ? briefOf(x, currency) : String(x))).join("\n") };
  }
  if (typeof v === "boolean") return { text: v ? "Yes" : "No" };
  if (typeof v === "object") return { text: briefOf(v, currency) };
  const s = String(v);
  if (/^https?:\/\//.test(s)) return { text: "", links: [{ href: s, label: "Open file" }] };
  if ((money || MONEY.has(key)) && s.trim() !== "" && !isNaN(Number(s))) return { text: formatMoney(Number(s), currency) };
  if (/^\d{4}-\d\d-\d\dT\d\d:\d\d/.test(s)) return { text: dateTimeText(new Date(s)) };
  if (/^\d{4}-\d\d-\d\d$/.test(s)) return { text: dateText(new Date(`${s}T00:00:00`)) };
  if (WORDS[key]?.[s]) return { text: WORDS[key][s] };
  return { text: s };
}

// A list item (a bill line, an instalment) in one line: its values, no ids.
function briefOf(obj, currency) {
  return Object.entries(obj)
    .filter(([k, x]) => !isHidden(k) && x !== null && x !== "" && typeof x !== "object")
    .map(([k, x]) => showValue(k, x, { currency }).text)
    .filter(Boolean)
    .join(" · ");
}

const valueKey = (v) => JSON.stringify(v, (_k, x) => (isTime(x) ? timeOf(x).toISOString() : x));

/**
 * The lines to show for an entry. A new record lists what it was saved with,
 * a deleted one what it had, an update only what changed.
 * [{ label, before?, after? }] — each value from showValue.
 */
export function changeRows(log, { currency } = {}) {
  const { action, before, after } = log;
  const tenders = { ...tendersOf(before), ...tendersOf(after) };
  const show = (line) => (line ? showValue(line.key, line.value, { currency, money: line.money }) : { text: "—", empty: true });
  if (action === "created" || !before) return flatten(after, tenders).map((l) => ({ label: l.label, after: show(l) }));
  if (action === "deleted" || !after) return flatten(before, tenders).map((l) => ({ label: l.label, before: show(l) }));
  const b = new Map(flatten(before, tenders).map((l) => [l.path, l]));
  const a = new Map(flatten(after, tenders).map((l) => [l.path, l]));
  const rows = [];
  for (const path of new Set([...b.keys(), ...a.keys()])) {
    const x = b.get(path);
    const y = a.get(path);
    if (valueKey(x?.value ?? null) === valueKey(y?.value ?? null)) continue;
    rows.push({ label: (y || x).label, before: show(x), after: show(y) });
  }
  return rows;
}

/** One line naming the record: "Cooking gas · RM 82.50 · 19 Oct 2026". */
export function summaryOf(log, { currency } = {}) {
  const d = log.after || log.before;
  if (!d) return log.details || "";
  const money = (n) => (n === undefined || n === null || n === "" || isNaN(Number(n)) ? "" : formatMoney(Number(n), currency));
  const day = (s) => (typeof s === "string" && /^\d{4}-\d\d-\d\d$/.test(s) ? dateText(new Date(`${s}T00:00:00`)) : "");
  let parts;
  switch (log.collection) {
    case "sales": parts = ["Day's sales", money(d.total), day(d.date)]; break;
    case "costs": parts = [d.category || d.description, money(d.amount), day(d.date)]; break;
    case "salaries": parts = [d.staffName, money(d.amount ?? d.netPay), d.month || day(d.date)]; break;
    case "loans": parts = [d.fromBranchName && d.toBranchName ? `${d.fromBranchName} → ${d.toBranchName}` : d.description, money(d.amount ?? d.principal), day(d.date)]; break;
    case "vendorBills": parts = [d.vendorName || personName(d.vendor), d.invoiceNo || d.billNo, money(d.total ?? d.amount), day(d.date || d.billDate)]; break;
    default: parts = [d.name || d.title || d.description || d.staffName, money(d.amount ?? d.total), day(d.date)];
  }
  return parts.filter(Boolean).join(" · ");
}
