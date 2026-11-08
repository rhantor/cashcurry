import { describe, expect, it } from "vitest";
import { billItemLines, countGroups, countToSave, latestUsage, stockNow, usagePeriods, wasteProblems, weekday } from "@/lib/inventory/model";

// The owner's example (8 Nov): 40 kg of meat bought, counted on Saturday,
// the next order received on Sunday.
const items = [
  { id: "meat", name: "Chicken", unit: "kg", vendorIds: ["v-meat"] },
  { id: "onion", name: "Onion", unit: "kg", vendorIds: ["v-veg"] },
];
const at = (iso) => ({ toMillis: () => Date.parse(iso) });
const bill = (id, date, created, lines, vendorId = "v-meat") => ({ id, invoiceDate: date, createdAt: at(created), vendorId, vendorName: vendorId, items: lines });
const count = (id, date, counted, lines, vendorId = "v-meat") => ({ id, date, countedAt: at(counted), vendorId, lines, by: { name: "Sup" } });

const bills = [
  bill("b1", "2026-11-09", "2026-11-09T10:00:00Z", [{ itemId: "meat", name: "Chicken", unit: "kg", receivedQty: 40, finalPrice: 12 }]),
  bill("b2", "2026-11-15", "2026-11-15T09:00:00Z", [{ itemId: "meat", name: "Chicken", unit: "kg", receivedQty: 30, finalPrice: 12.5 }]),
];
const counts = [count("c1", "2026-11-14", "2026-11-14T22:00:00Z", [{ itemId: "meat", qty: 12 }])];

describe("stock now", () => {
  it("adds what came in from the day inventory started", () => {
    const s = stockNow({ bills: bills.slice(0, 1), items, startDate: "2026-11-09" });
    expect(s.meat.onHand).toBe(40);
    expect(s.meat.counted).toBeNull();
  });
  it("an earlier start brings in the bills from then, for what is not counted yet", () => {
    const early = bill("b0", "2026-11-02", "2026-11-02T10:00:00Z", [{ itemId: "meat", name: "Chicken", unit: "kg", receivedQty: 5 }]);
    const later = [early, ...bills.slice(0, 1)];
    expect(stockNow({ bills: later, items, startDate: "2026-11-06" }).meat.onHand).toBe(40);
    expect(stockNow({ bills: later, items, startDate: "2026-11-01" }).meat.onHand).toBe(45);
  });
  it("moving the start doesn't touch what was counted", () => {
    expect(stockNow({ bills, counts, items, startDate: "2026-11-01" }).meat.onHand).toBe(42);
  });
  it("a count replaces the figure, and the next order adds on top", () => {
    const s = stockNow({ bills, counts, items, startDate: "2026-11-09" });
    expect(s.meat.onHand).toBe(42); // 12 counted + 30 on Sunday
    expect(s.meat.counted).toMatchObject({ qty: 12, date: "2026-11-14" });
    expect(s.meat.inSince).toBe(30);
  });
  it("waste after the count comes off", () => {
    const waste = [{ itemId: "meat", qty: 2.5, date: "2026-11-15", createdAt: at("2026-11-15T12:00:00Z"), reason: "Spoiled" }];
    expect(stockNow({ bills, counts, waste, items, startDate: "2026-11-09" }).meat.onHand).toBe(39.5);
  });
  it("a bill entered late for a day before the count is already inside the count", () => {
    const late = bill("b3", "2026-11-13", "2026-11-16T08:00:00Z", [{ itemId: "meat", receivedQty: 5 }]);
    expect(stockNow({ bills: [...bills, late], counts, items, startDate: "2026-11-09" }).meat.onHand).toBe(42);
  });
  it("on the count's own day, goes by which was written first", () => {
    const before = bill("b4", "2026-11-14", "2026-11-14T08:00:00Z", [{ itemId: "meat", receivedQty: 5 }]);
    const afterIt = bill("b5", "2026-11-14", "2026-11-14T23:00:00Z", [{ itemId: "meat", receivedQty: 5 }]);
    expect(stockNow({ bills: [...bills, before], counts, items }).meat.onHand).toBe(42);
    expect(stockNow({ bills: [...bills, afterIt], counts, items }).meat.onHand).toBe(47);
  });
  it("a line with only a name finds its catalog item", () => {
    const named = bill("b6", "2026-11-15", "2026-11-15T10:00:00Z", [{ name: " chicken ", receivedQty: 3 }]);
    expect(stockNow({ bills: [...bills, named], counts, items }).meat.onHand).toBe(45);
  });
  it("is low under its minimum", () => {
    const s = stockNow({ bills, counts, items, min: { meat: 50, onion: 5 } });
    expect(s.meat.low).toBe(true);
    expect(s.onion).toMatchObject({ onHand: 0, low: true });
  });
  it("more out than in since the count says to count again", () => {
    const waste = [{ itemId: "meat", qty: 50, date: "2026-11-15", createdAt: at("2026-11-15T12:00:00Z"), reason: "Other" }];
    expect(stockNow({ bills, counts, waste, items }).meat.short).toBe(true);
  });
});

describe("what was used", () => {
  const counts2 = [...counts, count("c2", "2026-11-21", "2026-11-21T22:00:00Z", [{ itemId: "meat", qty: 10 }])];
  it("between two counts: count + in − waste − next count", () => {
    const waste = [{ itemId: "meat", qty: 2, date: "2026-11-18", createdAt: at("2026-11-18T12:00:00Z"), reason: "Spoiled" }];
    const [p] = usagePeriods({ bills, counts: counts2, waste, items });
    expect(p).toMatchObject({ key: "meat", from: "2026-11-14", to: "2026-11-21", opening: 12, in: 30, waste: 2, closing: 10, used: 30 });
    expect(p.cost).toBe(375); // 30 kg at the last price, 12.50
  });
  it("two counts the same day: the later one stands", () => {
    const again = [...counts2, count("c3", "2026-11-21", "2026-11-21T23:00:00Z", [{ itemId: "meat", qty: 8 }])];
    expect(usagePeriods({ bills, counts: again, items })[0].used).toBe(34);
  });
  it("compares with the week before, per day", () => {
    const three = [count("a", "2026-11-01", "2026-11-01T22:00:00Z", [{ itemId: "meat", qty: 20 }]), count("b", "2026-11-08", "2026-11-08T22:00:00Z", [{ itemId: "meat", qty: 10 }]), count("c", "2026-11-15", "2026-11-15T22:00:00Z", [{ itemId: "meat", qty: 5 }])];
    const [latest] = latestUsage(usagePeriods({ counts: three, items }));
    expect(latest.used).toBe(5);
    expect(latest.before.used).toBe(10);
    expect(latest.change).toBe(-50);
  });
});

describe("the count sheet", () => {
  it("groups items under the supplier they came from, Other last", () => {
    const s = stockNow({ bills, counts, items, min: { onion: 5 } });
    s.loose = { ...s.onion, key: "loose", name: "Napkins", vendorIds: [], lastIn: null, counted: null, min: 1 };
    const g = countGroups(s, [{ id: "v-meat", name: "Meat Co" }, { id: "v-veg", name: "Veg Co" }], "2026-11-14", counts);
    expect(g.map((x) => x.vendorName)).toEqual(["Meat Co", "Veg Co", "Other"]);
    expect(g[0].countedToday).toBe(true);
    expect(g[1].countedToday).toBe(false);
  });
  it("leaves out what wasn't bought or counted in 60 days", () => {
    const s = stockNow({ bills, counts, items });
    expect(countGroups(s, [], "2027-03-01")).toEqual([]);
  });
  it("saves only what was filled in; a 0 is a count, a blank isn't", () => {
    const rows = [{ key: "meat", itemId: "meat", name: "Chicken", unit: "kg", onHand: 42 }, { key: "onion", itemId: "onion", name: "Onion", unit: "kg", onHand: 3 }];
    expect(countToSave(rows, { meat: "0", onion: "" })).toEqual([{ itemId: "meat", name: "Chicken", unit: "kg", qty: 0, was: 42 }]);
  });
});

describe("entries", () => {
  it("waste needs an item, an amount, a reason and a day", () => {
    expect(Object.keys(wasteProblems({}))).toEqual(["item", "qty", "reason", "date"]);
    expect(wasteProblems({ key: "meat", qty: 1, reason: "Spoiled", date: "2026-11-15" })).toEqual({});
  });
  it("bill lines drop empty rows and keep a price only when given", () => {
    expect(billItemLines([{ itemId: "meat", name: "Chicken", unit: "kg", qty: "5" }, { name: "", qty: 2 }, { itemId: "onion", name: "Onion", qty: 0 }, { name: "Ice", unit: "bag", qty: 2, price: 3 }])).toEqual([
      { itemId: "meat", name: "Chicken", unit: "kg", qty: 5, receivedQty: 5 },
      { itemId: "", name: "Ice", unit: "bag", qty: 2, receivedQty: 2, finalPrice: 3 },
    ]);
  });
  it("knows Saturday", () => {
    expect(weekday("2026-11-14")).toBe(6);
  });
});
