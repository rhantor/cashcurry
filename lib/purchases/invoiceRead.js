// Reading a supplier's invoice from its photo (owner, 16 Nov 2026): the
// server asks Claude to read it (app/api/purchases/read-invoice) and returns
// what is printed; these pure helpers clean that up and fill the Goods Arrived
// and New Vendor Bill forms with it. Whoever saves still looks it over — what
// couldn't be matched or doesn't add up is listed for them.

const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const r2 = (v) => Math.round(n(v) * 100) / 100;
const r3 = (v) => Math.round(n(v) * 1000) / 1000;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const text = (v, max = 120) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/** The JSON the model must return (structured outputs: every object closed, every field required). */
export const INVOICE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["readable", "problem", "supplierName", "invoiceNo", "invoiceDate", "currency", "lines", "discount", "total"],
  properties: {
    readable: { type: "boolean", description: "false when this is not a supplier invoice or delivery order, or it can't be read" },
    problem: { type: "string", description: "when not readable, why, in a few plain words; else empty" },
    supplierName: { type: "string" },
    invoiceNo: { type: "string", description: "the invoice, bill or delivery order number as printed; empty if none" },
    invoiceDate: { type: "string", description: "YYYY-MM-DD, or empty if not printed" },
    currency: { type: "string", description: "e.g. MYR, BDT; empty if not shown" },
    lines: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["text", "itemId", "qty", "unit", "unitPrice", "amount", "sure"],
        properties: {
          text: { type: "string", description: "the product as printed" },
          itemId: { type: "string", description: "id from the known items list when it is clearly the same product; else empty" },
          qty: { type: "number" },
          unit: { type: "string", description: "unit as printed (kg, ctn, pcs…); empty if none" },
          unitPrice: { type: "number", description: "price for one unit; 0 if not printed" },
          amount: { type: "number", description: "line amount as printed; 0 if not printed" },
          sure: { type: "boolean", description: "false if any figure on this line was hard to read" },
        },
      },
    },
    discount: { type: "number", description: "discount or voucher taken off the whole bill; 0 if none" },
    total: { type: "number", description: "the final amount to pay as printed; 0 if not printed" },
  },
};

/** What the model is told, besides the schema. */
export function invoicePrompt({ vendorName = "", items = [] } = {}) {
  const known = items.slice(0, 250).map((i) => `${i.id} | ${text(i.name, 80)}${i.unit ? ` | ${text(i.unit, 12)}` : ""}`).join("\n");
  return [
    "This is a photo or PDF of a supplier's invoice, bill or delivery order for a restaurant.",
    "Read what is printed or handwritten on it and return it in the JSON format given. Copy numbers exactly as written; never guess a figure you can't see — use 0 and mark the line not sure.",
    "Each product line once, in the order printed. Leave out lines that are only totals, tax summaries or notes.",
    vendorName ? `The supplier should be ${text(vendorName, 80)}.` : "",
    known ? `Known items (id | name | unit). Set itemId only when a line is clearly the same product, even if spelled or abbreviated differently or in Malay or Bangla; otherwise leave it empty:\n${known}` : "There is no list of known items; leave every itemId empty.",
  ].filter(Boolean).join("\n\n");
}

/** The model's answer, tidied: numbers rounded, ids only from the known items. */
export function cleanReading(raw, items = []) {
  const ids = new Set(items.map((i) => i.id));
  const r = raw && typeof raw === "object" ? raw : {};
  const lines = (Array.isArray(r.lines) ? r.lines : [])
    .map((l) => ({
      text: text(l?.text),
      itemId: ids.has(l?.itemId) ? l.itemId : "",
      qty: r3(l?.qty),
      unit: text(l?.unit, 16),
      unitPrice: r2(l?.unitPrice),
      amount: r2(l?.amount),
      sure: l?.sure !== false,
    }))
    .filter((l) => l.text || l.qty || l.amount);
  return {
    readable: r.readable !== false && lines.length > 0,
    problem: text(r.problem, 200),
    supplierName: text(r.supplierName),
    invoiceNo: text(r.invoiceNo, 40),
    invoiceDate: DAY.test(String(r.invoiceDate || "")) ? r.invoiceDate : "",
    currency: text(r.currency, 8),
    lines,
    discount: Math.max(0, r2(r.discount)),
    total: Math.max(0, r2(r.total)),
  };
}

/** A line's price for one unit: as printed, else its amount over its quantity. */
export const priceOf = (l) => (l.unitPrice > 0 ? l.unitPrice : l.qty > 0 && l.amount > 0 ? r2(l.amount / l.qty) : 0);

/** The invoice's lines by item id: quantities added up, the price weighted. */
function byItem(lines) {
  const out = new Map();
  for (const l of lines) {
    if (!l.itemId) continue;
    const was = out.get(l.itemId) || { qty: 0, money: 0, sure: true, units: new Set() };
    const p = priceOf(l);
    was.qty = r3(was.qty + l.qty);
    was.money = r2(was.money + (l.amount > 0 ? l.amount : l.qty * p));
    was.sure = was.sure && l.sure && p > 0;
    if (l.unit) was.units.add(l.unit.toLowerCase());
    out.set(l.itemId, was);
  }
  return out;
}

const sameUnit = (a, b) => !a || !b || a.toLowerCase().replace(/s$/, "") === b.toLowerCase().replace(/s$/, "");

/**
 * Goods Arrived: fill each line of the order from the invoice.
 * rows: [{ itemId, name, unit, requestedQty, receivedQty, finalPrice }]
 * → { items, filled: [itemId], check: [itemId] (hard to read / other unit), missing: [name], extra: [line], invoiceNo, invoiceDate, discount }
 */
export function fillReceive(rows = [], reading) {
  const got = byItem(reading?.lines || []);
  const filled = [];
  const check = [];
  const missing = [];
  const items = rows.map((row) => {
    const g = got.get(row.itemId);
    if (!g) {
      missing.push(row.name || "Item");
      return row;
    }
    filled.push(row.itemId);
    const otherUnit = [...g.units].some((u) => !sameUnit(u, row.unit));
    if (!g.sure || otherUnit) check.push(row.itemId);
    const price = g.qty > 0 ? r2(g.money / g.qty) : 0;
    return { ...row, receivedQty: String(g.qty), ...(price > 0 ? { finalPrice: price.toFixed(2) } : {}) };
  });
  const onOrder = new Set(rows.map((r) => r.itemId));
  const extra = (reading?.lines || []).filter((l) => !l.itemId || !onOrder.has(l.itemId));
  return { items, filled, check, missing, extra, invoiceNo: reading?.invoiceNo || "", invoiceDate: reading?.invoiceDate || "", discount: reading?.discount || 0 };
}

/**
 * New Vendor Bill: the item lines (for stock) and the bill's figures.
 * → { rows: [{ itemId, name, unit, qty, price }], extra: [line], total, invoiceNo, invoiceDate, discount }
 * total is before any discount — the form takes the discount off itself.
 */
export function fillNewBill(reading, items = []) {
  const byId = new Map(items.map((i) => [i.id, i]));
  const got = byItem(reading?.lines || []);
  const rows = [...got.entries()].map(([itemId, g]) => {
    const it = byId.get(itemId) || {};
    return { itemId, name: it.name || "", unit: it.unit || "", qty: String(g.qty), price: g.qty > 0 ? String(r2(g.money / g.qty)) : "" };
  });
  const extra = (reading?.lines || []).filter((l) => !l.itemId);
  const before = reading?.total > 0 ? r2(reading.total + (reading.discount || 0)) : r2((reading?.lines || []).reduce((s, l) => s + (l.amount > 0 ? l.amount : l.qty * priceOf(l)), 0));
  return { rows, extra, total: before, invoiceNo: reading?.invoiceNo || "", invoiceDate: reading?.invoiceDate || "", discount: reading?.discount || 0 };
}

/** Does the invoice's own total agree with what was filled in? → the gap, or 0. */
export function totalGap(reading, filledTotal) {
  if (!(reading?.total > 0)) return 0;
  const gap = r2(n(filledTotal) - reading.total);
  return Math.abs(gap) > 0.05 ? gap : 0;
}

/** A line the form couldn't place, in words. */
export const extraText = (l, money = (v) => String(v)) =>
  `${l.text || "A line"}${l.qty ? ` · ${l.qty}${l.unit ? ` ${l.unit}` : ""}` : ""}${priceOf(l) ? ` · ${money(priceOf(l))} each` : ""}`;

// limits for the server: what one photo may be, and how many a branch reads a day
export const MAX_INVOICE_BYTES = 3.5 * 1024 * 1024; // after the browser shrinks it; Vercel takes 4.5 MB a request
export const DAILY_READS = 150;
export const READ_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
