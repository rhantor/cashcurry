// lib/reservations/receipt.js
// Reservation deposit receipts: a customer pays part of the bill when they
// book a table or an event; they get a receipt to keep (shared on WhatsApp
// as an image or a PDF). The deposit is not a sale or a cash entry here —
// the day's full bill goes in as usual with the deposit taken off it.
// Pure — no Firebase.

export const METHODS = [
  { id: "cash", label: "Cash" },
  { id: "card", label: "Card" },
  { id: "transfer", label: "Bank transfer" },
  { id: "qr", label: "QR / e-wallet" },
];
export const methodLabel = (id) => METHODS.find((m) => m.id === id)?.label || id || "—";

export const STATUSES = {
  held: { label: "Held", hint: "Paid, reservation still to come" },
  used: { label: "Used", hint: "Taken off the bill on the day" },
  refunded: { label: "Refunded", hint: "Money given back" },
  cancelled: { label: "Cancelled", hint: "Receipt made by mistake" },
};

export const DEFAULT_TERMS =
  "This deposit will be deducted from the final bill on the day of the reservation. " +
  "Please show this receipt on arrival. Cancellations made less than 24 hours before the reservation are not refundable.";

/** "RSV-KLBB-2610-0007" — series per branch and month. */
export const receiptNo = (tag, period, seq) => `RSV-${tag || "BR"}-${period}-${String(seq).padStart(4, "0")}`;

/** "2610" for October 2026 (the month the receipt is made). */
export const periodOf = (d = new Date()) => `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}`;

/** A short tag for the branch: its code, else letters of its name. */
export function branchTag(branch, branchId) {
  const code = String(branch?.code || "").trim();
  if (code) return code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5) || "BR";
  const fromName = String(branch?.name || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
  return fromName || String(branchId || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4) || "BR";
}

// ── amount in words ──────────────────────────────────────────────────────────

const ONES = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function below1000(n) {
  const h = Math.floor(n / 100);
  const r = n % 100;
  const rest = r < 20 ? ONES[r] : `${TENS[Math.floor(r / 10)]}${r % 10 ? `-${ONES[r % 10]}` : ""}`;
  return [h ? `${ONES[h]} hundred` : "", rest].filter(Boolean).join(" ");
}

/** 1234 → "one thousand two hundred thirty-four" (0 → "zero"). */
export function numberWords(n) {
  n = Math.floor(Math.abs(Number(n) || 0));
  if (n === 0) return "zero";
  const parts = [];
  for (const [size, word] of [[1e9, "billion"], [1e6, "million"], [1e3, "thousand"], [1, ""]]) {
    const chunk = Math.floor(n / size) % 1000;
    if (chunk) parts.push(`${below1000(chunk)}${word ? ` ${word}` : ""}`);
  }
  return parts.join(" ");
}

const MONEY_WORDS = {
  MYR: ["ringgit", "sen"],
  RM: ["ringgit", "sen"],
  BDT: ["taka", "poisha"],
  "৳": ["taka", "poisha"],
  TK: ["taka", "poisha"],
  SGD: ["Singapore dollars", "cents"],
  USD: ["US dollars", "cents"],
  AED: ["dirhams", "fils"],
  INR: ["rupees", "paise"],
};

/** 500.5, "RM" → "Ringgit Malaysia five hundred and fifty sen only". */
export function amountInWords(amount, currency = "RM") {
  const v = Math.round((Number(amount) || 0) * 100);
  const whole = Math.floor(v / 100);
  const cents = v % 100;
  const [big, small] = MONEY_WORDS[String(currency).toUpperCase()] || MONEY_WORDS[currency] || [String(currency), "cents"];
  const lead = big === "ringgit" ? "Ringgit Malaysia" : big.charAt(0).toUpperCase() + big.slice(1);
  return `${lead} ${numberWords(whole)}${cents ? ` and ${numberWords(cents)} ${small}` : ""} only`;
}

/** 500 → "RM 500.00" (the branch's currency sign or code). */
export const money = (v, currency = "RM") => `${currency} ${(Number(v) || 0).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ── WhatsApp ─────────────────────────────────────────────────────────────────

/** A phone as WhatsApp wants it: digits with the country code ("012-345 6789" → "60123456789"). */
export function waNumber(phone, countryCode = "60") {
  const raw = String(phone || "").trim();
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (raw.startsWith("+") || raw.startsWith("00")) return digits.replace(/^00/, "");
  if (digits.startsWith(countryCode) && digits.length > 9) return digits;
  return countryCode + digits.replace(/^0+/, "");
}

const dayText = (d) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" }) : "");

/** The message sent with the receipt. */
export function receiptMessage(r, { business, currency }) {
  return [
    `Dear ${r.customerName || "customer"},`,
    "",
    `Thank you for your reservation at ${business}.`,
    `We have received your deposit of ${money(r.amount, currency)} (receipt ${r.receiptNo}).`,
    `Reservation: ${dayText(r.reservationDate)}${r.reservationTime ? `, ${timeText(r.reservationTime)}` : ""}${r.pax ? ` · ${r.pax} pax` : ""}`,
    "",
    "The deposit will be deducted from your final bill. We look forward to welcoming you!",
  ].join("\n");
}

/** "19:30" → "7:30 PM". */
export function timeText(t) {
  const [h, m] = String(t || "").split(":").map(Number);
  if (!Number.isFinite(h)) return "";
  return `${((h + 11) % 12) + 1}:${String(m || 0).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

export { dayText };

// ── the form ─────────────────────────────────────────────────────────────────

/** What's wrong with a new receipt, by field; {} when fine. */
export function checkReceipt(f) {
  const e = {};
  if (!String(f.customerName || "").trim()) e.customerName = "Customer's name";
  if (!String(f.customerPhone || "").replace(/\D/g, "")) e.customerPhone = "Customer's phone (for WhatsApp)";
  if (!f.reservationDate) e.reservationDate = "Day of the reservation";
  if (!(Number(f.amount) > 0)) e.amount = "Deposit amount";
  if (f.pax !== "" && f.pax != null && !(Number(f.pax) > 0)) e.pax = "Number of guests";
  if (["card", "transfer", "qr"].includes(f.method) && !String(f.reference || "").trim()) e.reference = "Reference / approval no.";
  return e;
}
