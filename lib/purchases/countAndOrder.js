// Count and order on one sheet (owner, 17 Nov 2026), the way the kitchen's paper
// order sheet works: each line of an order guide has "in stock" and "order"
// side by side. One save makes the stock count (Inventory) and the purchase
// order. And money handed out to buy an order at the market, from many shops
// ("Give cash to buy"). Pure — no Firebase.

const r3 = (v) => Math.round((Number(v) || 0) * 1000) / 1000;
const blank = (v) => v === "" || v === null || v === undefined;

/**
 * rows: [{ itemId, name, unit, category, estPrice, have, requestedQty, onHand }]
 * have: what's on the shelf now ("" = not counted); requestedQty: what to order.
 * → { count: [{ itemId, name, unit, qty, was }], order: [{ itemId, name, unit, category, requestedQty, estPrice }],
 *     problems: { [itemId]: "…" } }
 */
export function splitCountOrder(rows = []) {
  const count = [];
  const order = [];
  const problems = {};
  for (const r of rows) {
    if (!blank(r.have)) {
      const n = Number(r.have);
      if (!Number.isFinite(n) || n < 0) problems[r.itemId] = "In stock must be 0 or more";
      else count.push({ itemId: r.itemId, name: r.name || "", unit: r.unit || "", qty: r3(n), was: r3(r.onHand) });
    }
    if (!blank(r.requestedQty)) {
      const q = Number(r.requestedQty);
      if (!Number.isFinite(q) || q < 0) problems[r.itemId] = "Order must be 0 or more";
      else if (q > 0) order.push({ itemId: r.itemId, name: r.name || "", unit: r.unit || "", category: r.category || "", requestedQty: r3(q), estPrice: Number(r.estPrice) || 0 });
    }
  }
  return { count, order, problems };
}

/** The save button's words — short, a phone's button is narrow (the counts sit beside it). */
export function saveLabel({ count = [], order = [] } = {}) {
  if (!count.length && !order.length) return "Fill in stock or an order";
  if (!order.length) return "Save the count";
  return count.length ? "Save & order" : "Order";
}

// ── cash to buy an order ────────────────────────────────────────────────────

/** Bought with cash at the market, from many shops — not sent to a supplier. */
export const isMarket = (vendor) => vendor?.buyWith === "cash";

/**
 * Can money be handed out to buy this order now? Not received, cancelled or
 * rejected; approved if it needs approving; no cash already out for it and no
 * bill waiting on it.
 */
export function canGiveCash(po, { needsApproval = false } = {}) {
  if (!po || ["Received", "Cancelled", "Rejected"].includes(po.status || "Pending")) return false;
  if (po.cashOut?.payoutId || po.payoutHold) return false;
  if ((po.status || "Pending") === "Pending" && needsApproval) return false;
  return true;
}

/** What the order keeps about the money out for it. */
export const cashOutOf = (payoutId, { amount, to, date }, by = {}) => ({
  payoutId,
  amount: Math.round((Number(amount) || 0) * 100) / 100,
  to: String(to?.name || "").trim(),
  date: date || "",
  by: { uid: by.uid || "", name: by.name || "" },
});
