// lib/costs/voucherPaper.js — vouchers laid out like the paper ones (owner,
// 1 Nov): the branch, a running number, what was paid and why, then the
// signature boxes ("Prepared by", "Received by", "Approved by"). One shape —
// a "sheet" — for every kind: a cost with no invoice (4.9), an advance, a
// staff loan, a pay-out's bill with no paper. The Requested Panel shows it
// (app/components/costs/VoucherPaper.jsx) with the boxes not yet signed left
// empty; once done it is drawn as a picture onto the record
// (lib/costs/voucherImage.js). Pure: no Firebase, no DOM.
//
//   sheet = { title, subtitle, branchName, no, date,
//             rows: [{ label, value, words? }],      // words: the amount in words
//             boxes: [{ label, uid?, name, at, sig?, stamp?, waiting? }] }

/** The branch's code for voucher numbers: its own code, else letters from its name. */
export function branchCode(branch) {
  const code = String(branch?.code || "").trim().toUpperCase();
  if (code) return code;
  const words = String(branch?.name || "").replace(/[^A-Za-z0-9 ]+/g, " ").trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words.map((w) => w[0]).join("") : words[0] || "V").slice(0, 4).toUpperCase();
}

/**
 * "DKL-V-0007" — the branch's running number, one series per kind (V costs
 * and pay-outs, A advances, L staff loans); "—" before one is given.
 */
export function voucherNo(branch, n, letter = "V") {
  if (!Number.isInteger(n) || n < 1) return "—";
  return `${branchCode(branch)}-${letter}-${String(n).padStart(4, "0")}`;
}

const ONES = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function under1000(n) {
  const h = Math.floor(n / 100);
  const r = n % 100;
  const rest = r < 20 ? ONES[r] : `${TENS[Math.floor(r / 10)]}${r % 10 ? `-${ONES[r % 10]}` : ""}`;
  return [h ? `${ONES[h]} hundred` : "", rest].filter(Boolean).join(" ");
}

/** A whole number in English words: 1250 → "one thousand two hundred fifty". */
export function numberWords(n) {
  n = Math.floor(Math.abs(Number(n) || 0));
  if (n === 0) return "zero";
  const parts = [];
  for (const [size, name] of [[1e9, "billion"], [1e6, "million"], [1e3, "thousand"], [1, ""]]) {
    const chunk = Math.floor(n / size) % 1000;
    if (chunk) parts.push(`${under1000(chunk)}${name ? ` ${name}` : ""}`);
  }
  return parts.join(" ");
}

const UNITS = { MYR: ["ringgit", "sen"], BDT: ["taka", "poisha"], SGD: ["dollars", "cents"], USD: ["dollars", "cents"], INR: ["rupees", "paise"] };

/** The amount as written on a voucher: "One hundred fifty ringgit and 50 sen only". */
export function amountInWords(amount, currency = "MYR") {
  const v = Math.round(Math.abs(Number(amount) || 0) * 100);
  const whole = Math.floor(v / 100);
  const cents = v % 100;
  const [big, small] = UNITS[currency] || [String(currency || "").toLowerCase() || "", "cents"];
  const words = `${numberWords(whole)} ${big}`.trim() + (cents ? ` and ${cents} ${small}` : "") + " only";
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Where the money came from, in words. */
export function paidFromText(cost) {
  if (cost?.paidFromOffice === "back") return `Bank${cost.paidMethod ? ` (${cost.paidMethod})` : ""}`;
  return "Till (cash)";
}

/** A signature box: who, when — empty (`waiting`) until they sign. */
export function signBox(label, person, at, extra = {}) {
  if (!person) return { label, waiting: extra.waiting || "Waiting", ...extra };
  return { label, uid: person.uid || null, name: person.name || "", at: toDate(at), ...extra };
}

/**
 * The cost's voucher. `approval`: null while it waits; { by: { uid, name },
 * at } once approved; or { stamp: "…", by, at } when it needed no one (a
 * company role's own, or a manager's within the branch's limits).
 */
export function voucherSheet(cost, { branch, currency = "MYR", money = (v) => String(v), approval = null } = {}) {
  const v = cost?.voucher || {};
  return {
    title: "PAYMENT VOUCHER",
    subtitle: "Cost with no invoice",
    branchName: branch?.name || "",
    no: voucherNo(branch, v.no),
    date: cost?.date || "",
    rows: [
      { label: "Paid to", value: cost?.paidTo || "—" },
      { label: "For", value: [cost?.costGroup, cost?.category].filter(Boolean).join(" · ") || "—" },
      { label: "Paid from", value: paidFromText(cost) },
      { label: "Amount", value: money(cost?.amount), words: amountInWords(cost?.amount, currency) },
      { label: "Why no invoice", value: v.reason || "—" },
      ...(cost?.description ? [{ label: "Note", value: cost.description }] : []),
    ],
    boxes: [
      signBox("Prepared by", v.by, v.at),
      approval ? signBox("Approved by", approval.by, approval.at, approval.stamp ? { stamp: approval.stamp } : {}) : signBox("Approved by", null, null, { waiting: "Waiting for approval" }),
    ],
  };
}

/** How the approval box reads for a voucher that needed no one. */
export function selfStamp(isCompany) {
  return isCompany ? "No approval needed" : "Within limit — no approval needed";
}

function toDate(x) {
  if (!x) return null;
  if (x instanceof Date) return x;
  if (typeof x.toDate === "function") return x.toDate();
  if (typeof x.seconds === "number") return new Date(x.seconds * 1000);
  const d = new Date(x);
  return Number.isNaN(d.getTime()) ? null : d;
}
