// Sample warranties, a supplier, items and order guides for Demo Branch KL.
// Run by demoExtras.mjs. Made up. Dates are relative to `today`, so something
// is always ending soon and an order is always due.
import { Timestamp } from "firebase-admin/firestore";

const addDays = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const weekday = (d) => new Date(`${d}T00:00:00Z`).getUTCDay();

export async function addPurchaseSamples(db, { companyId, branchId, today }) {
  const company = db.doc(`companies/${companyId}`);
  const branch = company.collection("branches").doc(branchId);
  const made = { createdBy: { uid: "demo", name: "Demo Manager" }, createdAt: Timestamp.now() };

  const warranties = [
    { id: "demo-warranty-chiller", itemName: "Walk-in chiller", soldBy: "Cold Tech Sdn Bhd", soldByEmail: "sales@coldtech.example", soldByPhone: "03-5555 0101", serial: "CT-88213", startDate: addDays(today, -353), endsOn: addDays(today, 12), status: "active" },
    { id: "demo-warranty-oven", itemName: "Combi oven", soldBy: "Kitchen Pro Supplies", soldByEmail: "service@kitchenpro.example", startDate: addDays(today, -724), endsOn: addDays(today, 6), status: "active" },
    { id: "demo-warranty-printer", itemName: "Receipt printer", soldBy: "Mega IT", startDate: addDays(today, -368), endsOn: addDays(today, -3), status: "active" },
    { id: "demo-warranty-fryer", itemName: "Double fryer", soldBy: "Kitchen Pro Supplies", startDate: addDays(today, -60), endsOn: addDays(today, 305), status: "active" },
    { id: "demo-warranty-mixer", itemName: "Stand mixer", soldBy: "Mega IT", startDate: addDays(today, -700), endsOn: addDays(today, 20), status: "notRenewing", stoppedBy: "Demo Manager" },
  ];
  for (const { id, ...w } of warranties) {
    await branch.collection("warranties").doc(id).set({ vendorId: "", serial: "", soldByEmail: "", soldByPhone: "", note: "", paperURL: null, history: [], ...w, ...made });
  }

  const vendors = [
    { id: "demo-vendor-farm", name: "Fresh Farm Produce", phone: "012-555 0101", email: "orders@freshfarm.example", leadDays: 1, termsDays: 7 },
    { id: "demo-vendor-drinks", name: "Cool Drinks Trading", phone: "012-555 0202", email: "orders@cooldrinks.example", leadDays: 2, termsDays: 14 },
  ];
  for (const { id, ...v } of vendors) await company.collection("vendors").doc(id).set({ ...v, active: true, createdAt: Timestamp.now() });

  const items = [
    { id: "demo-item-onion", name: "Onion", category: "Vegetables", unit: "Kg", defaultPrice: 4.5, vendorIds: ["demo-vendor-farm"] },
    { id: "demo-item-tomato", name: "Tomato", category: "Vegetables", unit: "Kg", defaultPrice: 6, vendorIds: ["demo-vendor-farm"] },
    { id: "demo-item-cabbage", name: "Cabbage", category: "Vegetables", unit: "Kg", defaultPrice: 3.2, vendorIds: ["demo-vendor-farm"] },
    { id: "demo-item-cola", name: "Cola 330ml", category: "Drinks", unit: "Ctn", defaultPrice: 32, vendorIds: ["demo-vendor-drinks"] },
    { id: "demo-item-water", name: "Mineral water 500ml", category: "Drinks", unit: "Ctn", defaultPrice: 14, vendorIds: ["demo-vendor-drinks"] },
  ];
  for (const { id, ...i } of items) await company.collection("items").doc(id).set({ ...i, branchIds: [], isActive: true, createdAt: Timestamp.now(), updatedAt: Timestamp.now() });

  const guide = (id, name, vendor, rows, reminder) =>
    branch.collection("orderGuides").doc(id).set({
      name,
      vendorId: vendor.id,
      vendorName: vendor.name,
      guideItems: rows,
      itemIds: rows.map((r) => r.itemId),
      ...(reminder ? { reminder: { enabled: true, since: today, ...reminder }, reminderState: {} } : {}),
      createdBy: "demo",
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  // Drinks: ordered today, so due now. Vegetables: ordered tomorrow, told today at 6 PM.
  await guide("demo-guide-drinks", "Drinks", vendors[1], [{ itemId: "demo-item-cola", parQty: 5 }, { itemId: "demo-item-water", parQty: 10 }], { days: [weekday(today)], before: 0, at: "00:00" });
  await guide("demo-guide-veg", "Vegetables", vendors[0], [{ itemId: "demo-item-onion", parQty: 20 }, { itemId: "demo-item-tomato", parQty: 15 }, { itemId: "demo-item-cabbage", parQty: 10 }], { days: [weekday(addDays(today, 1))], before: 1, at: "18:00" });
}
