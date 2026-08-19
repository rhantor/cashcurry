/**
 * Item-wise purchase aggregation.
 *
 * The screen, the PDF and the CSV all read from here so the three can never
 * disagree about what was bought. Only received orders count: an order that was
 * raised but never delivered is not a purchase, and the quantities that matter
 * are the ones that actually arrived at the invoiced price.
 */

/** Effective purchase date. Falls back for orders raised before receivedAt existed. */
export function purchaseDate(order) {
  if (order?.receivedAt?.seconds) return new Date(order.receivedAt.seconds * 1000);
  if (order?.invoiceDate) return new Date(order.invoiceDate);
  if (order?.createdAt?.seconds) return new Date(order.createdAt.seconds * 1000);
  return null;
}

/**
 * YYYY-MM-DD in local time.
 *
 * toISOString() converts local midnight to the previous day anywhere east of
 * UTC — in Malaysia (UTC+8) "start of this month" came out as the 31st of last
 * month, which quietly pulled a whole extra day into every report.
 */
export const localDate = (d) => {
  if (!d) return "";
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
};

/** Parse a YYYY-MM-DD as local midnight, matching how localDate writes them. */
export const parseLocal = (value) => {
  if (!value) return null;
  const [y, m, d] = String(value).split("-").map(Number);
  return Number.isFinite(y) ? new Date(y, (m || 1) - 1, d || 1) : new Date(value);
};

const iso = (d) => localDate(d);

/** Lines actually received, with quantities and prices coerced to numbers. */
function receivedLines(order) {
  const rows = order?.receivedItems?.length ? order.receivedItems : order?.items || [];
  return rows.map((i) => {
    const qty = Number(i.receivedQty ?? i.requestedQty ?? 0);
    const price = Number(i.finalPrice ?? i.estPrice ?? 0);
    return {
      itemId: i.itemId,
      name: i.name || "Unknown item",
      category: i.category?.trim() || "Uncategorized",
      unit: i.unit || "",
      qty,
      price,
      value: qty * price,
      orderedQty: Number(i.requestedQty ?? 0),
    };
  });
}

/**
 * Roll received orders up per item.
 *
 * Grouping is by itemId where present, falling back to the name — lines snapshot
 * the name at order time, so an item deleted from the catalog still aggregates
 * instead of vanishing from the report.
 */
export function aggregatePurchases(orders = [], { startDate, endDate } = {}) {
  const from = parseLocal(startDate);
  const to = parseLocal(endDate);
  if (to) to.setHours(23, 59, 59, 999);

  const inWindow = orders.filter((o) => {
    const d = purchaseDate(o);
    if (!d) return false;
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  });

  const byItem = new Map();
  let totalSpend = 0;

  inWindow.forEach((order) => {
    const when = purchaseDate(order);
    receivedLines(order).forEach((line) => {
      if (!(line.qty > 0)) return;
      const key = line.itemId || `name:${line.name.toLowerCase()}`;

      if (!byItem.has(key)) {
        byItem.set(key, {
          key,
          itemId: line.itemId || "",
          name: line.name,
          category: line.category,
          unit: line.unit,
          qty: 0,
          spend: 0,
          orders: 0,
          minPrice: Infinity,
          maxPrice: 0,
          lastDate: null,
          lastPrice: 0,
          vendors: new Set(),
          history: [],
        });
      }

      const row = byItem.get(key);
      row.qty += line.qty;
      row.spend += line.value;
      row.orders += 1;
      if (line.price > 0) {
        row.minPrice = Math.min(row.minPrice, line.price);
        row.maxPrice = Math.max(row.maxPrice, line.price);
      }
      if (!row.lastDate || (when && when > row.lastDate)) {
        row.lastDate = when;
        row.lastPrice = line.price;
      }
      if (order.vendorName) row.vendors.add(order.vendorName);
      row.history.push({
        date: iso(when),
        poNo: order.poNo || "",
        vendor: order.vendorName || "",
        qty: line.qty,
        price: line.price,
        value: line.value,
        orderedQty: line.orderedQty,
      });

      totalSpend += line.value;
    });
  });

  const items = [...byItem.values()]
    .map((r) => ({
      ...r,
      minPrice: r.minPrice === Infinity ? 0 : r.minPrice,
      // Weighted by quantity, not a mean of prices — buying 100 kg at 5 and
      // 1 kg at 50 averages to 5.45, not 27.50.
      avgPrice: r.qty > 0 ? r.spend / r.qty : 0,
      vendors: [...r.vendors],
      history: r.history.sort((a, b) => (a.date < b.date ? 1 : -1)),
    }))
    .sort((a, b) => b.spend - a.spend);

  return {
    items,
    totals: {
      spend: totalSpend,
      itemCount: items.length,
      orderCount: inWindow.length,
      qty: items.reduce((a, r) => a + r.qty, 0),
      avgOrderValue: inWindow.length ? totalSpend / inWindow.length : 0,
    },
    orders: inWindow,
  };
}

/** Named date windows, resolved against "today". */
export function dateRangePresets(today = new Date()) {
  const d = localDate;
  const startOfDay = (dt) => { const x = new Date(dt); x.setHours(0,0,0,0); return x; };

  const now = startOfDay(today);
  const dow = (now.getDay() + 6) % 7; // Monday-first

  const thisWeek = new Date(now); thisWeek.setDate(now.getDate() - dow);
  const lastWeekStart = new Date(thisWeek); lastWeekStart.setDate(thisWeek.getDate() - 7);
  const lastWeekEnd = new Date(thisWeek); lastWeekEnd.setDate(thisWeek.getDate() - 1);

  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  const last30 = new Date(now); last30.setDate(now.getDate() - 29);

  return [
    { id: "thisWeek",  label: "This week",  start: d(thisWeek),       end: d(now) },
    { id: "lastWeek",  label: "Last week",  start: d(lastWeekStart),  end: d(lastWeekEnd) },
    { id: "thisMonth", label: "This month", start: d(thisMonth),      end: d(now) },
    { id: "lastMonth", label: "Last month", start: d(lastMonthStart), end: d(lastMonthEnd) },
    { id: "last30",    label: "Last 30 days", start: d(last30),       end: d(now) },
  ];
}

/** CSV, with the summary on top so the file reads on its own. */
export function purchaseReportCsv({ items, totals, currency, startDate, endDate, branchName }) {
  const esc = (v) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const money = (n) => Number(n || 0).toFixed(2);

  const lines = [];
  lines.push(esc(`Purchase Report${branchName ? ` - ${branchName}` : ""}`));
  lines.push(esc(`Period: ${startDate} to ${endDate}`));
  lines.push(esc(`Generated: ${new Date().toLocaleString()}`));
  lines.push("");
  lines.push(["Total spend", money(totals.spend), currency].map(esc).join(","));
  lines.push(["Distinct items", totals.itemCount].map(esc).join(","));
  lines.push(["Orders received", totals.orderCount].map(esc).join(","));
  lines.push("");
  lines.push(
    ["Item", "Category", "Unit", "Quantity", `Total spend (${currency})`,
     `Avg price (${currency})`, `Lowest (${currency})`, `Highest (${currency})`,
     "Times ordered", "Last bought", "Suppliers"].map(esc).join(",")
  );

  items.forEach((r) => {
    lines.push([
      r.name, r.category, r.unit, r.qty, money(r.spend), money(r.avgPrice),
      money(r.minPrice), money(r.maxPrice), r.orders,
      localDate(r.lastDate),
      r.vendors.join(" / "),
    ].map(esc).join(","));
  });

  lines.push("");
  lines.push(["TOTAL", "", "", totals.qty, money(totals.spend)].map(esc).join(","));

  return lines.join("\n");
}

/** Hand the browser a file. */
export function downloadCsv(filename, csv) {
  // The BOM makes Excel open UTF-8 correctly instead of mangling accents.
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
