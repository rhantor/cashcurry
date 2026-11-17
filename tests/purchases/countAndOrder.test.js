import { describe, expect, it } from "vitest";
import { canGiveCash, cashOutOf, isMarket, saveLabel, splitCountOrder } from "@/lib/purchases/countAndOrder";

const row = (o) => ({ itemId: "i", name: "Flour", unit: "kg", category: "Dry", estPrice: 3, have: "", requestedQty: "", onHand: 2, ...o });

describe("count and order on one sheet (17 Nov 2026)", () => {
  it("a filled 'in stock' is counted, a filled 'order' is ordered, empty boxes are skipped", () => {
    const s = splitCountOrder([
      row({ itemId: "a", have: "0", requestedQty: "25" }),
      row({ itemId: "b", have: "7", requestedQty: "" }),
      row({ itemId: "c", have: "", requestedQty: "3" }),
      row({ itemId: "d" }),
      row({ itemId: "e", have: "2.5", requestedQty: "0" }),
    ]);
    expect(s.count.map((l) => [l.itemId, l.qty, l.was])).toEqual([["a", 0, 2], ["b", 7, 2], ["e", 2.5, 2]]);
    expect(s.order.map((l) => [l.itemId, l.requestedQty, l.estPrice])).toEqual([["a", 25, 3], ["c", 3, 3]]);
    expect(s.problems).toEqual({});
  });

  it("nonsense is caught on its line", () => {
    const s = splitCountOrder([row({ itemId: "x", have: "-1" }), row({ itemId: "y", requestedQty: "abc" })]);
    expect(Object.keys(s.problems)).toEqual(["x", "y"]);
    expect(s.count).toEqual([]);
    expect(s.order).toEqual([]);
  });

  it("the save button says what will happen", () => {
    expect(saveLabel({ count: [], order: [] })).toBe("Fill in stock or an order");
    expect(saveLabel({ count: [1, 2], order: [] })).toBe("Save the stock count (2)");
    expect(saveLabel({ count: [1, 2], order: [1] })).toBe("Save · 1 to order, 2 counted");
    expect(saveLabel({ count: [], order: [1, 2, 3] })).toBe("Save · 3 to order");
  });
});

describe("cash to buy an order", () => {
  it("a market vendor is bought with cash", () => {
    expect(isMarket({ buyWith: "cash" })).toBe(true);
    expect(isMarket({ buyWith: "" })).toBe(false);
    expect(isMarket(null)).toBe(false);
  });

  it("only while the order is open, approved if it must be, and no cash already out", () => {
    expect(canGiveCash({ status: "Pending" })).toBe(true);
    expect(canGiveCash({ status: "Pending" }, { needsApproval: true })).toBe(false);
    expect(canGiveCash({ status: "Approved" }, { needsApproval: true })).toBe(true);
    expect(canGiveCash({ status: "Sent" })).toBe(true);
    for (const status of ["Received", "Cancelled", "Rejected"]) expect(canGiveCash({ status })).toBe(false);
    expect(canGiveCash({ status: "Sent", cashOut: { payoutId: "p1" } })).toBe(false);
    expect(canGiveCash({ status: "Sent", payoutHold: "s1" })).toBe(false);
    expect(canGiveCash(null)).toBe(false);
  });

  it("the order keeps who has the money", () => {
    expect(cashOutOf("p1", { amount: "1500", to: { name: " Ali " }, date: "2026-11-17" }, { uid: "u1", name: "Cashier" })).toEqual({
      payoutId: "p1", amount: 1500, to: "Ali", date: "2026-11-17", by: { uid: "u1", name: "Cashier" },
    });
  });
});
