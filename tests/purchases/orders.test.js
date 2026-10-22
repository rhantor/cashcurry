import { describe, expect, it } from "vitest";
import { addDays, defaultDeliverBy, dueText, followUpOrder, lateDays, mailLink, missingLines, orderMessage, priceRise, repeatOrder, sentPatch, waLink, waNumber } from "@/lib/purchases/orders";

const order = {
  id: "po1",
  poNo: "PO-0042",
  vendorId: "rice",
  vendorName: "Rice Co",
  status: "Sent",
  items: [
    { itemId: "rice", name: "Rice 10kg bag", unit: "bag", category: "Dry", requestedQty: 20, estPrice: 55 },
    { itemId: "oil", name: "Cooking oil 5L", unit: "tin", category: "Dry", requestedQty: 10, estPrice: 15 },
  ],
};

describe("when it should come", () => {
  it("the supplier's usual days from today (1 when not set)", () => {
    expect(defaultDeliverBy("2026-10-22", { leadDays: 3 })).toBe("2026-10-25");
    expect(defaultDeliverBy("2026-10-22", { leadDays: 0 })).toBe("2026-10-22");
    expect(defaultDeliverBy("2026-10-22", {})).toBe("2026-10-23");
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
  });
  it("late only while sent and not arrived", () => {
    const o = { ...order, deliverBy: "2026-10-20" };
    expect(lateDays(o, "2026-10-22")).toBe(2);
    expect(lateDays(o, "2026-10-20")).toBe(0);
    expect(lateDays({ ...o, status: "Received" }, "2026-10-22")).toBe(0);
    expect(lateDays({ ...o, payoutHold: "s1" }, "2026-10-22")).toBe(0);
    expect(lateDays(order, "2026-10-22")).toBe(0);
  });
  it("in words", () => {
    expect(dueText({ ...order, deliverBy: "2026-10-22" }, "2026-10-22")).toBe("Due today");
    expect(dueText({ ...order, deliverBy: "2026-10-23" }, "2026-10-22")).toBe("Due tomorrow");
    expect(dueText({ ...order, deliverBy: "2026-10-25" }, "2026-10-22")).toBe("Due in 3 days");
    expect(dueText({ ...order, deliverBy: "2026-10-21" }, "2026-10-22")).toBe("1 day late");
  });
});

describe("sending", () => {
  it("WhatsApp numbers get the branch's country code", () => {
    expect(waNumber("012-345 6789")).toBe("60123456789");
    expect(waNumber("+880 1711-000000", "Asia/Kuala_Lumpur")).toBe("8801711000000");
    expect(waNumber("01711000000", "Asia/Dhaka")).toBe("8801711000000");
    expect(waNumber("60123456789")).toBe("60123456789");
    expect(waNumber("")).toBe("");
  });
  it("the message: items and quantities, the day, where — no prices", () => {
    const m = orderMessage(order, { ref: "PO-0042", from: "Curry House · KL", address: "1 Jalan Ampang\nKL", phone: "03-1234", deliverBy: "2026-10-24" });
    expect(m).toContain("Purchase order PO-0042");
    expect(m).toContain("1. Rice 10kg bag — 20 bag");
    expect(m).toContain("2. Cooking oil 5L — 10 tin");
    expect(m).toContain("Please deliver by Sat 24 Oct.");
    expect(m).toContain("Deliver to: 1 Jalan Ampang, KL");
    expect(m).not.toMatch(/55|15\.00/);
    expect(m).not.toMatch(/\n\n\n/);
    expect(orderMessage(order, { address: { line1: "1 Jalan Ampang", postcode: "50450", city: "KL", country: "" } })).toContain("Deliver to: 1 Jalan Ampang, 50450 KL");
    expect(waLink("012-345 6789", "hi there")).toBe("https://wa.me/60123456789?text=hi%20there");
    expect(mailLink("a@b.co", "PO", "x y")).toBe("mailto:a%40b.co?subject=PO&body=x%20y");
  });
  it("records who sent it, how and for when", () => {
    const p = sentPatch({ via: "whatsapp", deliverBy: "2026-10-24", user: { uid: "u1", name: "KL Manager" }, now: new Date("2026-10-22T03:00:00Z") });
    expect(p).toEqual({ status: "Sent", sentVia: "whatsapp", sentAt: "2026-10-22T03:00:00.000Z", sentBy: "u1", sentByName: "KL Manager", deliverBy: "2026-10-24" });
    expect(sentPatch({ via: "nonsense" }).sentVia).toBe("other");
  });
});

describe("what came short", () => {
  const received = { ...order, status: "Received", receivedItems: [{ ...order.items[0], receivedQty: 20, finalPrice: 56 }, { ...order.items[1], receivedQty: 8, finalPrice: 15.5 }] };
  it("only the lines that came short, the missing amount at the price just paid", () => {
    expect(missingLines(received)).toEqual([{ itemId: "oil", name: "Cooking oil 5L", unit: "tin", category: "Dry", requestedQty: 2, estPrice: 15.5 }]);
    expect(missingLines(order)).toEqual([]);
  });
  it("a new pending order for them, pointing back", () => {
    expect(followUpOrder(received, { uid: "u1", name: "M" })).toMatchObject({ vendorId: "rice", totalEst: 31, notes: "Missing from PO-0042", followUpOf: "po1", status: "Pending", createdBy: "u1" });
  });
});

describe("ordering again", () => {
  it("same items at what the branch last paid; items no longer sold left out", () => {
    const o = repeatOrder(order, { uid: "u1" }, { priceOf: (id) => (id === "rice" ? 57 : 0), inCatalog: (id) => id !== "gone" });
    expect(o.items.map((i) => [i.itemId, i.requestedQty, i.estPrice])).toEqual([["rice", 20, 57], ["oil", 10, 15]]);
    expect(o).toMatchObject({ totalEst: 1290, repeatOf: "po1", status: "Pending" });
    expect(repeatOrder(order, {}, { inCatalog: (id) => id === "oil" }).items).toHaveLength(1);
  });
});

describe("price went up", () => {
  it("flags dearer than expected, not cheaper", () => {
    expect(priceRise(56, 55)).toEqual({ up: 1, pct: 1.8, was: 55 });
    expect(priceRise(54, 55)).toBeNull();
    expect(priceRise(55, 55)).toBeNull();
    expect(priceRise(56, 0)).toBeNull();
    expect(priceRise(56, 55, 5)).toBeNull();
  });
});
