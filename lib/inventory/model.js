// lib/inventory/model.js — what is in stock at a branch (owner, 8 Nov 2026).
// Pure — no Firebase.
//
// Stock is never typed in as a running figure. It is worked out from three
// things the branch already does:
//   - goods coming in: the item lines on its supplier bills (a purchase order
//     received, a New Vendor Bill, a pay-out bill), dated by the invoice;
//   - a count: someone stands at the fridge and writes what is there, one
//     supplier's goods at a time (stockCounts);
//   - waste: what was thrown away, and why (stockWaste).
// An item's stock is its last count, plus what came in after it, less what
// was thrown away after it. Before its first count it starts at 0 on the
// day inventory started at the branch. Between two counts, what was used is
// the first count + what came in − waste − the second count.
//
// "After" goes by the day, then by when it was written, so a bill dated the
// same day as a count but entered after it is counted on top of it, and a
// bill entered late for an earlier day is already inside the count.

const r3 = (n) => Math.round((Number(n) || 0) * 1000) / 1000;
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** Items bought or counted within this many days show on the count sheet. */
export const RECENT_DAYS = 60;

/** Why something was thrown away. */
export const WASTE_REASONS = ["Spoiled", "Expired", "Dropped / damaged", "Cooked wrong", "Other"];

/** 0 = Sunday … 6 = Saturday. */
export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const DEFAULT_COUNT_DAY = 6;

/** A Firestore time (Timestamp, { seconds }, Date, ms or ISO) → ms; 0 when unknown. */
export function ms(t) {
  if (!t) return 0;
  if (typeof t === "number") return t;
  if (typeof t.toMillis === "function") return t.toMillis();
  if (t instanceof Date) return t.getTime();
  if (typeof t.seconds === "number") return t.seconds * 1000 + Math.floor((t.nanoseconds || 0) / 1e6);
  const p = Date.parse(t);
  return Number.isFinite(p) ? p : 0;
}

/** The catalog name a line or item is matched on when it has no itemId. */
export const nameKey = (name) => String(name || "").trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Which catalog item a line is: its itemId, else the catalog item of the same
 * name, else its own name (an item typed on a bill that isn't in the catalog).
 */
export function keyOf(line, idByName = {}) {
  if (line?.itemId) return line.itemId;
  const n = nameKey(line?.name);
  return idByName[n] || (n ? `name:${n}` : "");
}

/** Catalog → { [name key]: itemId }, for lines that carry only a name. */
export const idsByName = (items = []) => Object.fromEntries(items.filter((i) => i?.name).map((i) => [nameKey(i.name), i.id]));

/** Is event a (day, ms) after event b? */
export const after = (a, b) => (a.date !== b.date ? a.date > b.date : a.at > b.at);

/** Supplier bills → goods in: [{ key, name, unit, qty, date, at, vendorId, vendorName, billId }]. */
export function goodsIn(bills = [], idByName = {}) {
  const out = [];
  for (const b of bills) {
    if (b?.status === "void" || b?.voided) continue;
    for (const l of b.items || []) {
      const qty = Number(l.receivedQty ?? l.qty ?? l.quantity) || 0;
      const key = keyOf(l, idByName);
      if (!(qty > 0) || !key) continue;
      out.push({
        key,
        name: l.name || "Item",
        unit: l.unit || "",
        qty: r3(qty),
        price: Number(l.finalPrice ?? l.price ?? l.unitPrice) || 0,
        date: b.invoiceDate || "",
        at: ms(b.createdAt),
        vendorId: b.vendorId || "",
        vendorName: b.vendorName || "",
        billId: b.id || "",
      });
    }
  }
  return out;
}

/** Count documents → one entry per item counted: [{ key, qty, date, at, vendorId, countId, by }]. */
export function countLines(counts = [], idByName = {}) {
  const out = [];
  for (const c of counts) {
    for (const l of c.lines || []) {
      const key = keyOf(l, idByName);
      if (!key || l.qty === "" || l.qty == null || !Number.isFinite(Number(l.qty))) continue;
      out.push({ key, name: l.name || "", unit: l.unit || "", qty: r3(Math.max(0, Number(l.qty))), date: c.date || "", at: ms(c.countedAt || c.createdAt), vendorId: c.vendorId || "", countId: c.id || "", by: c.by?.name || "" });
    }
  }
  return out;
}

/** Waste documents → [{ key, qty, date, at, reason }]. */
export function wasteLines(waste = [], idByName = {}) {
  return waste
    .map((w) => ({ key: keyOf(w, idByName), name: w.name || "", unit: w.unit || "", qty: r3(Number(w.qty) || 0), date: w.date || "", at: ms(w.createdAt), reason: w.reason || "", id: w.id || "", by: w.by?.name || "" }))
    .filter((w) => w.key && w.qty > 0);
}

const byTime = (a, b) => (a.date !== b.date ? a.date.localeCompare(b.date) : a.at - b.at);
const groupBy = (list) => {
  const m = new Map();
  for (const x of list) {
    if (!m.has(x.key)) m.set(x.key, []);
    m.get(x.key).push(x);
  }
  for (const v of m.values()) v.sort(byTime);
  return m;
};

/**
 * Every item's stock now.
 * { bills, counts, waste, items, startDate, min: { itemId: qty } }
 * → { [key]: { key, name, unit, onHand, counted: { qty, date, by } | null, inSince, wasteSince,
 *     min, low, lastIn: { date, qty, vendorId, vendorName } | null, vendorIds, lastPrice } }
 */
export function stockNow({ bills = [], counts = [], waste = [], items = [], startDate = "", min = {} }) {
  const idByName = idsByName(items);
  const ins = groupBy(goodsIn(bills, idByName));
  const cs = groupBy(countLines(counts, idByName));
  const ws = groupBy(wasteLines(waste, idByName));
  const catalog = new Map(items.map((i) => [i.id, i]));
  const keys = new Set([...ins.keys(), ...cs.keys(), ...ws.keys(), ...Object.keys(min).filter((k) => Number(min[k]) > 0)]);
  const start = { date: startDate || "", at: 0 };

  const out = {};
  for (const key of keys) {
    const cat = catalog.get(key);
    const itemIns = ins.get(key) || [];
    const lastCount = (cs.get(key) || []).at(-1) || null;
    const from = lastCount || start;
    const fresh = (e) => (lastCount ? after(e, lastCount) : !startDate || e.date >= startDate);
    const inSince = r3(itemIns.filter(fresh).reduce((n, e) => n + e.qty, 0));
    const wasteSince = r3((ws.get(key) || []).filter(fresh).reduce((n, e) => n + e.qty, 0));
    const onHand = r3((lastCount ? lastCount.qty : 0) + inSince - wasteSince);
    const lastIn = itemIns.at(-1) || null;
    const any = lastIn || lastCount || (ws.get(key) || [])[0] || {};
    const m = Number(min[key]) || 0;
    out[key] = {
      key,
      itemId: cat ? cat.id : key.startsWith("name:") ? "" : key,
      name: cat?.name || any.name || "Item",
      unit: cat?.unit || any.unit || "",
      onHand,
      short: onHand < 0, // more went out than came in since the last count: count it again
      counted: lastCount ? { qty: lastCount.qty, date: lastCount.date, by: lastCount.by, vendorId: lastCount.vendorId } : null,
      startedAt: from.date || "",
      inSince,
      wasteSince,
      min: m,
      low: m > 0 && onHand < m,
      lastIn: lastIn ? { date: lastIn.date, qty: lastIn.qty, vendorId: lastIn.vendorId, vendorName: lastIn.vendorName } : null,
      lastPrice: [...itemIns].reverse().find((e) => e.price > 0)?.price || Number(cat?.lastPurchasePrice) || 0,
      vendorIds: [...new Set([...(cat?.vendorIds || []), ...itemIns.map((e) => e.vendorId).filter(Boolean)])],
      recent: [lastIn?.date, lastCount?.date].filter(Boolean).sort().at(-1) || "",
    };
  }
  return out;
}

/**
 * What was used between counts, item by item: for each pair of counts in a row,
 * [{ key, name, unit, from, to, opening, in, waste, closing, used, cost }], newest first.
 * `cost` is what was used at the last price paid by then.
 */
export function usagePeriods({ bills = [], counts = [], waste = [], items = [] }) {
  const idByName = idsByName(items);
  const ins = groupBy(goodsIn(bills, idByName));
  const cs = groupBy(countLines(counts, idByName));
  const ws = groupBy(wasteLines(waste, idByName));
  const catalog = new Map(items.map((i) => [i.id, i]));
  const out = [];
  for (const [key, list] of cs) {
    // two counts on the same day: the later one stands
    const days = [];
    for (const c of list) {
      if (days.length && days.at(-1).date === c.date) days[days.length - 1] = c;
      else days.push(c);
    }
    for (let i = 1; i < days.length; i++) {
      const a = days[i - 1];
      const b = days[i];
      const between = (e) => after(e, a) && !after(e, b);
      const inList = (ins.get(key) || []).filter(between);
      const got = r3(inList.reduce((n, e) => n + e.qty, 0));
      const lost = r3((ws.get(key) || []).filter(between).reduce((n, e) => n + e.qty, 0));
      const used = r3(a.qty + got - lost - b.qty);
      const priced = (ins.get(key) || []).filter((e) => !after(e, b) && e.price > 0).at(-1);
      const price = priced?.price || Number(catalog.get(key)?.lastPurchasePrice) || 0;
      const cat = catalog.get(key);
      out.push({ key, name: cat?.name || b.name || a.name || "Item", unit: cat?.unit || b.unit || a.unit || "", from: a.date, to: b.date, opening: a.qty, in: got, waste: lost, closing: b.qty, used, price, cost: r2(Math.max(0, used) * price) });
    }
  }
  return out.sort((x, y) => y.to.localeCompare(x.to) || x.name.localeCompare(y.name));
}

/** The latest period of each item, with the one before it for comparison: [{ ...period, before: period | null, change: % | null }]. */
export function latestUsage(periods = []) {
  const seen = new Map();
  for (const p of periods) {
    if (!seen.has(p.key)) seen.set(p.key, { ...p, before: null });
    else if (!seen.get(p.key).before) seen.get(p.key).before = p;
  }
  return [...seen.values()].map((p) => {
    const perDay = (x) => x.used / Math.max(1, days(x.from, x.to));
    const change = p.before && perDay(p.before) > 0 ? Math.round(((perDay(p) - perDay(p.before)) / perDay(p.before)) * 100) : null;
    return { ...p, change };
  });
}

/** Whole days from a to b ("yyyy-MM-dd"). */
export function days(a, b) {
  const t = (d) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
  return Math.round((t(b) - t(a)) / 86400000);
}

/** 0–6 (Sunday = 0) of a day "yyyy-MM-dd". */
export const weekday = (d) => new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10))).getUTCDay();

/**
 * The count sheet's groups: one per supplier, holding what the branch bought
 * from them or counted under them lately, or has a minimum for; then "Other"
 * for items with no supplier.
 * stock: stockNow(...); vendors: [{ id, name }]; today: "yyyy-MM-dd".
 * → [{ vendorId, vendorName, items: [stock row], countedToday: bool }]
 */
export function countGroups(stock = {}, vendors = [], today = "", counts = []) {
  const cutoff = today ? shift(today, -RECENT_DAYS) : "";
  const rows = Object.values(stock).filter((s) => s.min > 0 || !cutoff || (s.recent && s.recent >= cutoff));
  const names = new Map(vendors.map((v) => [v.id, v.name || v.vendorName || "Supplier"]));
  const groups = new Map();
  const put = (vendorId, row) => {
    if (!groups.has(vendorId)) groups.set(vendorId, []);
    groups.get(vendorId).push(row);
  };
  for (const s of rows) {
    // its own supplier first: the one it was last bought from, else counted under, else in the catalog
    const home = s.lastIn?.vendorId || s.counted?.vendorId || s.vendorIds[0] || "";
    put(home, s);
  }
  const countedToday = new Set(counts.filter((c) => c.date === today).map((c) => c.vendorId || ""));
  return [...groups.entries()]
    .map(([vendorId, list]) => ({
      vendorId,
      vendorName: vendorId ? names.get(vendorId) || list.find((x) => x.lastIn?.vendorId === vendorId)?.lastIn?.vendorName || "Supplier" : "Other",
      items: list.sort((a, b) => a.name.localeCompare(b.name)),
      countedToday: countedToday.has(vendorId),
    }))
    .sort((a, b) => (a.vendorId ? 0 : 1) - (b.vendorId ? 0 : 1) || a.vendorName.localeCompare(b.vendorName));
}

/** A day "yyyy-MM-dd" moved by n days. */
export function shift(d, n) {
  const t = new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10) + n));
  return t.toISOString().slice(0, 10);
}

/** Lines typed on the count sheet → what is saved; blanks are left out (not counted, not zero). */
export function countToSave(rows = [], entered = {}) {
  return rows
    .filter((r) => entered[r.key] !== "" && entered[r.key] != null && Number.isFinite(Number(entered[r.key])) && Number(entered[r.key]) >= 0)
    .map((r) => ({ itemId: r.itemId || "", name: r.name, unit: r.unit, qty: r3(entered[r.key]), was: r.onHand }));
}

/** What's wrong with a waste entry, by field; {} when fine. */
export function wasteProblems(w = {}) {
  const e = {};
  if (!w.key) e.item = "Pick the item";
  if (!(Number(w.qty) > 0)) e.qty = "How much was thrown away?";
  if (!w.reason) e.reason = "Pick a reason";
  if (!w.date) e.date = "Pick the day";
  return e;
}

/** Bill lines typed on New Vendor Bill or a pay-out bill → what the bill keeps; empty rows dropped. */
export function billItemLines(rows = []) {
  return rows
    .filter((r) => (r.itemId || String(r.name || "").trim()) && Number(r.qty) > 0)
    .map((r) => ({ itemId: r.itemId || "", name: String(r.name || "").trim(), unit: r.unit || "", qty: r3(r.qty), receivedQty: r3(r.qty), ...(Number(r.price) > 0 ? { finalPrice: r2(r.price) } : {}) }));
}

/** The stock figure in words: "12.5 kg". */
export const qtyText = (n, unit) => `${Number(r3(n)).toLocaleString("en-MY", { maximumFractionDigits: 3 })}${unit ? ` ${unit}` : ""}`;
