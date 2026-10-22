// lib/purchases/orders.js
// Purchase orders after they are raised (22 Oct 2026): sending one to the
// supplier for real (WhatsApp, a PDF, email — and who sent it, how, when),
// the day it should arrive and how late it is, what came short (ordered
// again as a new order), ordering again from an old one, and a price that
// went up since the order. Pure — no Firebase.

const n = (v) => Number(v) || 0;
const r2 = (v) => Math.round(n(v) * 100) / 100;

/** "2026-10-22" + 2 → "2026-10-24" */
export const addDays = (d, days) => {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n(days));
  return t.toISOString().slice(0, 10);
};

/** Whole days from a to b ("2026-10-22" → "2026-10-24" = 2). */
export const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

/** How many days the supplier usually takes (the vendor's "delivers in"), 1 when not set. */
export const leadDays = (vendor) => {
  const d = Number(vendor?.leadDays);
  return Number.isFinite(d) && d >= 0 && vendor?.leadDays !== "" && vendor?.leadDays != null ? d : 1;
};

/** The day it should come, when sent today: the supplier's usual days. */
export const defaultDeliverBy = (today, vendor) => addDays(today, leadDays(vendor));

/** Sent and still not here: days past its day (0 when not late, or nothing to wait for). */
export function lateDays(order, today) {
  if (!order?.deliverBy || order.status !== "Sent" || order.payoutHold) return 0;
  return Math.max(0, daysBetween(order.deliverBy, today));
}

/** "Due today" / "Due tomorrow" / "Due in 3 days" / "2 days late" — for a sent order. */
export function dueText(order, today) {
  if (!order?.deliverBy || order.status !== "Sent") return "";
  const d = daysBetween(today, order.deliverBy);
  if (d < 0) return `${-d} day${d === -1 ? "" : "s"} late`;
  if (d === 0) return "Due today";
  if (d === 1) return "Due tomorrow";
  return `Due in ${d} days`;
}

// ── sending ──────────────────────────────────────────────────────────────────

const DIAL = { "Asia/Kuala_Lumpur": "60", "Asia/Dhaka": "880", "Asia/Singapore": "65", "Asia/Kolkata": "91", "Asia/Dubai": "971", "Asia/Riyadh": "966", "Europe/London": "44" };

/**
 * A phone as WhatsApp wants it: digits with the country code. "012-345 6789"
 * at a Malaysian branch → "60123456789"; "+880 1711…" stays as it is. "" when
 * there is no number.
 */
export function waNumber(phone, timeZone = "Asia/Kuala_Lumpur") {
  const raw = String(phone || "").trim();
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (raw.startsWith("+") || raw.startsWith("00")) return digits.replace(/^00/, "");
  const cc = DIAL[timeZone] || "60";
  if (digits.startsWith(cc) && digits.length > 9) return digits;
  return cc + digits.replace(/^0+/, "");
}

/** A WhatsApp link with the message ready (the person still presses send). */
export const waLink = (phone, text, timeZone) => {
  const to = waNumber(phone, timeZone);
  return `https://wa.me/${to}?text=${encodeURIComponent(text)}`;
};

export const mailLink = (email, subject, body) => `mailto:${encodeURIComponent(email || "")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

/** An address as one line: a string as typed, or { line1, line2, postcode, city, state, country }. */
export function addressText(address) {
  if (!address) return "";
  if (typeof address === "string") return address.replace(/\s*\n\s*/g, ", ").trim();
  const { line1, line2, city, state, postcode, country } = address;
  return [line1, line2, [postcode, city].filter(Boolean).join(" "), state, country]
    .map((x) => String(x || "").trim())
    .filter(Boolean)
    .join(", ");
}

const qty = (v) => (Number.isInteger(n(v)) ? String(n(v)) : String(r2(v)));
const dayLabel = (d) => (d ? new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }) : "");

/**
 * The order as a message to the supplier. ref: the PO number; from: who is
 * ordering (company / branch); address, phone: where to deliver and who to
 * call; deliverBy: the day it is wanted. Prices are left out — the supplier
 * charges what they charge; the invoice is checked when it comes.
 */
export function orderMessage(order, { ref, from, address, phone, deliverBy } = {}) {
  const lines = (order?.items || []).filter((i) => n(i.requestedQty) > 0).map((i, k) => `${k + 1}. ${i.name} — ${qty(i.requestedQty)} ${i.unit || ""}`.trimEnd());
  return [
    `Purchase order ${ref || order?.poNo || ""}`.trim(),
    from ? `From: ${from}` : "",
    "",
    ...lines,
    "",
    deliverBy ? `Please deliver by ${dayLabel(deliverBy)}.` : "",
    addressText(address) ? `Deliver to: ${addressText(address)}` : "",
    phone ? `Call: ${phone}` : "",
    `Please put ${ref || "this order number"} on the invoice. Thank you!`,
  ]
    .filter((l, i, all) => l !== "" || (all[i - 1] !== "" && i > 0))
    .join("\n")
    .trim();
}

export const SENT_VIA = { whatsapp: "WhatsApp", pdf: "PDF", email: "email", copy: "a copied message", other: "phone or in person" };

/** What saving "sent" writes on the order. */
export const sentPatch = ({ via, deliverBy, user, now = new Date() }) => ({
  status: "Sent",
  sentVia: SENT_VIA[via] ? via : "other",
  sentAt: now.toISOString(),
  sentBy: user?.uid || "",
  sentByName: user?.name || "",
  deliverBy: deliverBy || "",
});

// ── what came short ──────────────────────────────────────────────────────────

/** The lines that came short on a received order: what is still missing of each. */
export function missingLines(order) {
  const got = order?.receivedItems || [];
  return got
    .map((l) => ({ ...l, missing: r2(n(l.requestedQty) - n(l.receivedQty)) }))
    .filter((l) => l.missing > 0)
    .map(({ itemId, name, unit, category, missing, finalPrice, estPrice }) => ({ itemId, name: name || "", unit: unit || "", category: category || "", requestedQty: missing, estPrice: n(finalPrice) || n(estPrice) }));
}

/** A new order for what came short (needs approving / sending like any order). */
export function followUpOrder(order, user) {
  const items = missingLines(order);
  return {
    vendorId: order.vendorId,
    vendorName: order.vendorName || "",
    items,
    totalEst: r2(items.reduce((s, i) => s + i.requestedQty * i.estPrice, 0)),
    notes: `Missing from ${order.poNo || "an earlier order"}`,
    followUpOf: order.id || "",
    createdBy: user?.uid || "",
    createdByName: user?.name || "",
    status: "Pending",
  };
}

// ── ordering again ───────────────────────────────────────────────────────────

/**
 * An old order again: the same items and quantities, at what this branch
 * last paid (priceOf(itemId) → price or 0; else the old order's price).
 * Items no longer sold (inCatalog false) are left out.
 */
export function repeatOrder(order, user, { priceOf = () => 0, inCatalog = () => true } = {}) {
  const items = (order?.items || [])
    .filter((i) => n(i.requestedQty) > 0 && inCatalog(i.itemId))
    .map((i) => ({ itemId: i.itemId, name: i.name || "", unit: i.unit || "", category: i.category || "", requestedQty: n(i.requestedQty), estPrice: n(priceOf(i.itemId)) || n(i.estPrice) }));
  return {
    vendorId: order.vendorId,
    vendorName: order.vendorName || "",
    items,
    totalEst: r2(items.reduce((s, i) => s + i.requestedQty * i.estPrice, 0)),
    notes: `Ordered again from ${order.poNo || "an earlier order"}`,
    repeatOf: order.id || "",
    createdBy: user?.uid || "",
    createdByName: user?.name || "",
    status: "Pending",
  };
}

// ── price went up ────────────────────────────────────────────────────────────

/**
 * A price charged against the price expected (what was paid last time, as on
 * the order): { up, pct, was } when it went up by more than `minPct` (and a
 * sen), else null. Cheaper is not flagged.
 */
export function priceRise(charged, expected, minPct = 0) {
  const c = n(charged);
  const e = n(expected);
  if (!(c > 0) || !(e > 0) || c - e < 0.01) return null;
  const pct = Math.round(((c - e) / e) * 1000) / 10;
  return pct > minPct ? { up: r2(c - e), pct, was: e } : null;
}
