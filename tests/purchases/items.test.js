import { describe, expect, it } from "vitest";
import { itemStats, itemsSummary, lastMonths, lookAlikes, missingInfo, nameKey, notBought, purchaseLines } from "@/lib/purchases/items";

const today = "2026-10-22";
const bills = [
  { vendorId: "rice", vendorName: "Rice Co", invoiceNo: "R3", invoiceDate: "2026-10-20", items: [{ itemId: "rice", name: "Rice", unit: "bag", receivedQty: 20, finalPrice: 56 }] },
  { vendorId: "veg", vendorName: "Veg Co", invoiceNo: "V1", invoiceDate: "2026-10-05", items: [{ itemId: "rice", name: "Rice", unit: "bag", receivedQty: 10, finalPrice: 54 }, { itemId: "oil", name: "Oil", receivedQty: 8, finalPrice: 15 }] },
  { vendorId: "rice", vendorName: "Rice Co", invoiceNo: "R1", invoiceDate: "2026-08-10", items: [{ itemId: "rice", name: "Rice", receivedQty: 30, finalPrice: 55 }, { name: "Old thing", receivedQty: 0, finalPrice: 3 }] },
  { vendorId: "rice", invoiceDate: "2026-05-01", items: [{ itemId: "rice", receivedQty: 5, finalPrice: 50 }] },
];

describe("what each item costs here", () => {
  const lines = purchaseLines(bills);
  const s = itemStats(lines, today);
  it("lines with a price and a quantity, newest first", () => {
    expect(lines).toHaveLength(5);
    expect(lines[0]).toMatchObject({ key: "rice", qty: 20, price: 56, amount: 1120, vendorName: "Rice Co", invoiceNo: "R3" });
  });
  it("last price, the one before, and the change", () => {
    expect(s.rice.last).toEqual({ price: 56, date: "2026-10-20", vendorName: "Rice Co" });
    expect(s.rice.prev).toEqual({ price: 54, date: "2026-10-05", vendorName: "Veg Co" });
    expect(s.rice.change).toBe(3.7);
    expect(s.oil.change).toBeNull();
  });
  it("each supplier's last price, cheapest first", () => {
    expect(s.rice.byVendor.map((v) => [v.vendorName, v.price])).toEqual([["Veg Co", 54], ["Rice Co", 56]]);
  });
  it("this month, the last 90 days, and the six months", () => {
    expect(s.rice.month).toEqual({ qty: 30, spend: 1660 });
    expect(s.rice.spend90).toBe(1660 + 1650);
    expect(lastMonths("2026-10")).toEqual(["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]);
    expect(s.rice.months.map((m) => m.spend)).toEqual([250, 0, 0, 1650, 0, 1660]);
  });
  it("all together", () => {
    expect(itemsSummary(s)).toEqual({ spendMonth: 1780, risen: ["rice"], topKeys: ["rice", "oil"] });
  });
});

describe("tidying the catalog", () => {
  it("look-alike names", () => {
    expect(nameKey("Rice 10 KG (bag)")).toBe("rice10kgbag");
    expect(nameKey("Cooking Oil 5 Litre")).toBe("cookingoil5l");
    const items = [{ id: "a", name: "Rice 10kg" }, { id: "b", name: "rice 10 KG" }, { id: "c", name: "Oil" }];
    expect(lookAlikes(items).map((g) => g.map((i) => i.id))).toEqual([["a", "b"]]);
  });
  it("what's missing: supplier, category, a price", () => {
    const items = [
      { id: "a", name: "A", vendorIds: ["v"], category: "Dry", defaultPrice: 5 },
      { id: "b", name: "B", category: "" },
      { id: "c", name: "C", vendorIds: ["v"], category: "Dry" },
    ];
    expect(missingInfo(items, (i) => (i.id === "c" ? 9 : 0)).map((x) => [x.item.id, x.missing])).toEqual([["b", ["supplier", "category", "price"]]]);
  });
  it("not bought in 90 days — or never, and added long ago", () => {
    const items = [
      { id: "old", createdAt: { seconds: Date.parse("2026-01-01") / 1000 } },
      { id: "new", createdAt: { seconds: Date.parse("2026-10-01") / 1000 } },
      { id: "stale" },
      { id: "fresh" },
    ];
    const last = { stale: "2026-06-01", fresh: "2026-10-01" };
    expect(notBought(items, (i) => last[i.id], today).map((x) => x.item.id)).toEqual(["old", "stale"]);
  });
});
