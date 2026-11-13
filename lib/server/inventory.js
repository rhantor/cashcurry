// Inventory worked out on the server (8 Nov 2026), for everyone who counts
// stock (inventory.count) — supervisors among them, whose rules keep the
// supplier bills it is made from out of reach. Quantities, the last price
// paid and what was used go back; the bills themselves don't.
// The working-out is lib/inventory/model.js.
import { adminDb } from "@/lib/server/firebaseAdmin";
import { DEFAULT_COUNT_DAY, countGroups, latestUsage, ms, shift, stockNow, usagePeriods } from "@/lib/inventory/model";
import { counts as billCounts } from "@/lib/purchases/billApproval";

const rows = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

/** Bills are read from the day stock started, at most this far back. */
const MAX_DAYS = 400;
/** How far back the lists of counts and waste go. */
const LIST_DAYS = 90;

/** A count or waste entry as the page shows it: plain values, no Firestore types. */
const plain = (x) => ({ ...x, countedAt: ms(x.countedAt) || null, createdAt: ms(x.createdAt) || null });

export async function inventory({ companyId, branchId, today }) {
  const company = adminDb.collection("companies").doc(companyId);
  const branch = company.collection("branches").doc(branchId);
  const settingsSnap = await branch.collection("stockSettings").doc("main").get();
  const settings = settingsSnap.exists ? settingsSnap.data() : {};
  const startDate = settings.startDate || "";
  const countDay = Number.isInteger(settings.countDay) ? settings.countDay : DEFAULT_COUNT_DAY;
  const base = { started: !!startDate, startDate, countDay, min: settings.min || {}, today };
  if (!startDate) return { ...base, stock: {}, groups: [], usage: [], periods: [], counts: [], waste: [], vendors: [], catalog: [] };

  const since = [startDate, shift(today, -MAX_DAYS)].sort().at(-1);
  const [billSnap, takeSnap, wasteSnap, itemSnap, vendorSnap] = await Promise.all([
    branch.collection("vendorBills").where("invoiceDate", ">=", since).get(),
    branch.collection("stockTakes").where("date", ">=", since).get(),
    branch.collection("stockWaste").where("date", ">=", since).get(),
    company.collection("items").get(),
    company.collection("vendors").get(),
  ]);
  const bills = rows(billSnap).filter(billCounts); // not one waiting for approval (13 Nov)
  const counts = rows(takeSnap);
  const waste = rows(wasteSnap);
  const items = rows(itemSnap).filter((i) => !i.branchIds?.length || i.branchIds.includes(branchId));
  const vendors = rows(vendorSnap).map((v) => ({ id: v.id, name: v.name || v.vendorName || "" }));

  const stock = stockNow({ bills, counts, waste, items, startDate, min: base.min });
  const periods = usagePeriods({ bills, counts, waste, items });
  const listFrom = shift(today, -LIST_DAYS);
  const newest = (a, b) => (b.date || "").localeCompare(a.date || "") || ms(b.countedAt || b.createdAt) - ms(a.countedAt || a.createdAt);

  return {
    ...base,
    stock,
    groups: countGroups(stock, vendors, today, counts),
    usage: latestUsage(periods),
    periods: periods.filter((p) => p.to >= listFrom),
    counts: counts.filter((c) => c.date >= listFrom).sort(newest).map(plain),
    waste: waste.filter((w) => w.date >= listFrom).sort(newest).map(plain),
    vendors,
    // to add an item to a count that isn't on it yet (the first count, before anything is bought)
    catalog: items.filter((i) => i.isActive !== false).map((i) => ({ id: i.id, name: i.name || "", unit: i.unit || "", vendorIds: i.vendorIds || [] })),
  };
}
