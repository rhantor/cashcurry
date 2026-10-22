// lib/purchases/items.js
// Items (22 Oct 2026): what each product really costs at this branch, from
// the item lines on the branch's supplier bills — the price history, which
// supplier is cheaper now, how the price moved, what is spent on it a month —
// and a tidy-up of the catalog: look-alike names, items missing a supplier,
// category or price, items not bought in a while. Pure — no Firebase.

import { addDays } from "./orders";

const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

/** Which catalog item a bill line is: its itemId, else its name. */
export const lineKey = (l) => l?.itemId || String(l?.name || "").trim().toLowerCase();

/** The item lines of bills, flat: { key, itemId, name, unit, qty, price, amount, date, vendorId, vendorName, invoiceNo }. */
export function purchaseLines(bills = []) {
  const out = [];
  for (const b of bills) {
    for (const l of b.items || []) {
      const price = Number(l.finalPrice ?? l.price ?? l.unitPrice) || 0;
      const qty = Number(l.receivedQty ?? l.qty ?? l.quantity) || 0;
      if (!(price > 0) || !(qty > 0)) continue;
      out.push({
        key: lineKey(l),
        itemId: l.itemId || "",
        name: l.name || "Item",
        unit: l.unit || "",
        qty,
        price,
        amount: r2(qty * price),
        date: b.invoiceDate || "",
        vendorId: b.vendorId || "",
        vendorName: b.vendorName || "",
        invoiceNo: b.invoiceNo || "",
      });
    }
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

const monthOf = (d) => String(d || "").slice(0, 7);

/** The last n months ending with `month` ("2026-10"), oldest first. */
export function lastMonths(month, n = 6) {
  const [y, m] = month.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (n - 1 - i), 1));
    return d.toISOString().slice(0, 7);
  });
}

/**
 * Lines → per item key:
 * { last: { price, date, vendorName }, prev, change (% vs the price before), lastBought,
 *   month: { qty, spend } (this month), spend90, byVendor: [{ vendorId, vendorName, price, date }] (cheapest first),
 *   months: [{ month, qty, spend }] (6, oldest first), history: lines (newest first) }
 */
export function itemStats(lines = [], today) {
  const thisMonth = monthOf(today);
  const since90 = addDays(today, -90);
  const months = lastMonths(thisMonth);
  const by = new Map();
  for (const l of lines) (by.get(l.key) || by.set(l.key, []).get(l.key)).push(l);
  const out = {};
  for (const [key, ls] of by) {
    const h = [...ls].sort((a, b) => b.date.localeCompare(a.date));
    const last = h[0];
    const prev = h.find((x) => x.price !== last.price) || null;
    const vendors = new Map();
    for (const l of h) if (!vendors.has(l.vendorId || l.vendorName)) vendors.set(l.vendorId || l.vendorName, { vendorId: l.vendorId, vendorName: l.vendorName, price: l.price, date: l.date });
    const inMonth = h.filter((l) => monthOf(l.date) === thisMonth);
    out[key] = {
      last: { price: last.price, date: last.date, vendorName: last.vendorName },
      prev: prev ? { price: prev.price, date: prev.date, vendorName: prev.vendorName } : null,
      change: prev ? Math.round(((last.price - prev.price) / prev.price) * 1000) / 10 : null,
      lastBought: last.date,
      month: { qty: r2(inMonth.reduce((s, l) => s + l.qty, 0)), spend: r2(inMonth.reduce((s, l) => s + l.amount, 0)) },
      spend90: r2(h.filter((l) => l.date >= since90).reduce((s, l) => s + l.amount, 0)),
      byVendor: [...vendors.values()].sort((a, b) => a.price - b.price),
      months: months.map((m) => {
        const x = h.filter((l) => monthOf(l.date) === m);
        return { month: m, qty: r2(x.reduce((s, l) => s + l.qty, 0)), spend: r2(x.reduce((s, l) => s + l.amount, 0)) };
      }),
      history: h,
    };
  }
  return out;
}

/** All items together: { spendMonth, risen (keys whose last price went up), topKeys (by 90-day spend) }. */
export function itemsSummary(stats = {}) {
  const list = Object.entries(stats);
  return {
    spendMonth: r2(list.reduce((s, [, x]) => s + x.month.spend, 0)),
    risen: list.filter(([, x]) => x.change > 0).map(([k]) => k),
    topKeys: list
      .filter(([, x]) => x.spend90 > 0)
      .sort((a, b) => b[1].spend90 - a[1].spend90)
      .map(([k]) => k),
  };
}

// ── tidy-up ──────────────────────────────────────────────────────────────────

/** A name as compared for look-alikes: "Rice 10 KG (bag)" → "rice10kgbag". */
export const nameKey = (name) =>
  String(name || "")
    .toLowerCase()
    .replace(/kgs?\b|kilo(gram)?s?\b/g, "kg")
    .replace(/ltrs?\b|litres?\b|liters?\b/g, "l")
    .replace(/[^a-z0-9ঀ-৿]/g, "");

/** Items whose names look the same: [[item, item, …], …]. */
export function lookAlikes(items = []) {
  const by = new Map();
  for (const i of items) {
    const k = nameKey(i.name);
    if (k) by.set(k, [...(by.get(k) || []), i]);
  }
  return [...by.values()].filter((g) => g.length > 1);
}

/**
 * What is missing on each item: [{ item, missing: ["supplier", "category", "price"] }].
 * price: neither a usual price nor anything paid (lastPrice(item) > 0).
 */
export function missingInfo(items = [], lastPrice = () => 0) {
  return items
    .map((item) => ({
      item,
      missing: [
        !(item.vendorIds || []).length && "supplier",
        !String(item.category || "").trim() && "category",
        !(Number(item.defaultPrice) > 0) && !(Number(lastPrice(item)) > 0) && "price",
      ].filter(Boolean),
    }))
    .filter((x) => x.missing.length);
}

/**
 * Items not bought here for `days` (or never, and in the catalog at least that
 * long): [{ item, lastBought }] — ones to retire, or to stop stocking here.
 * lastBought(item) → "YYYY-MM-DD" or "".
 */
export function notBought(items = [], lastBought = () => "", today, days = 90) {
  const since = addDays(today, -days);
  const added = (i) => {
    const c = i.createdAt;
    const ms = c?.seconds != null ? c.seconds * 1000 : typeof c === "string" ? Date.parse(c) : null;
    return ms ? new Date(ms).toISOString().slice(0, 10) : "";
  };
  return items
    .map((item) => ({ item, lastBought: lastBought(item) || "" }))
    .filter(({ item, lastBought: d }) => (d ? d < since : added(item) && added(item) < since));
}
