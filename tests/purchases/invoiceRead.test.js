import { describe, expect, it } from "vitest";
import { INVOICE_SCHEMA, cleanReading, extraText, fillNewBill, fillReceive, invoicePrompt, priceOf, totalGap } from "@/lib/purchases/invoiceRead";

const ITEMS = [
  { id: "onion", name: "Bawang Besar", unit: "kg" },
  { id: "chicken", name: "Chicken whole", unit: "kg" },
  { id: "oil", name: "Cooking oil 5L", unit: "btl" },
];
const raw = (over = {}) => ({
  readable: true, problem: "", supplierName: "Fresh Farm Produce Sdn Bhd", invoiceNo: " INV-778 ", invoiceDate: "2026-11-16", currency: "MYR",
  lines: [
    { text: "B. BESAR", itemId: "onion", qty: 10, unit: "kg", unitPrice: 4.5, amount: 45, sure: true },
    { text: "AYAM", itemId: "chicken", qty: 12, unit: "kg", unitPrice: 0, amount: 120, sure: true },
    { text: "Plastic bag", itemId: "", qty: 2, unit: "pkt", unitPrice: 3, amount: 6, sure: true },
  ],
  discount: 0, total: 171, ...over,
});

describe("reading an invoice (16 Nov 2026)", () => {
  it("the schema is closed and every field required (structured outputs)", () => {
    const closed = (s) => s.type !== "object" || (s.additionalProperties === false && Object.keys(s.properties).every((k) => s.required.includes(k)) && Object.values(s.properties).every((p) => closed(p.type === "array" ? p.items : p)));
    expect(closed(INVOICE_SCHEMA)).toBe(true);
  });

  it("the prompt names the supplier and the known items", () => {
    const p = invoicePrompt({ vendorName: "Fresh Farm", items: ITEMS });
    expect(p).toContain("Fresh Farm");
    expect(p).toContain("onion | Bawang Besar | kg");
    expect(invoicePrompt({})).toContain("no list of known items");
  });

  it("is tidied: ids only from the known items, a bad date dropped", () => {
    const r = cleanReading(raw({ invoiceDate: "16/11/2026", lines: [{ text: "X", itemId: "made-up", qty: 1, unit: "", unitPrice: 2, amount: 2, sure: true }] }), ITEMS);
    expect(r.invoiceNo).toBe("INV-778");
    expect(r.invoiceDate).toBe("");
    expect(r.lines[0].itemId).toBe("");
    expect(cleanReading({ readable: false, problem: "a menu", lines: [] }).readable).toBe(false);
    expect(cleanReading(null).readable).toBe(false);
  });

  it("a price from the amount when no unit price is printed", () => {
    expect(priceOf({ qty: 12, unitPrice: 0, amount: 120 })).toBe(10);
    expect(priceOf({ qty: 0, unitPrice: 0, amount: 5 })).toBe(0);
  });
});

describe("filling Goods Arrived", () => {
  const rows = [
    { itemId: "onion", name: "Bawang Besar", unit: "kg", requestedQty: 10, receivedQty: "10", finalPrice: "4.00" },
    { itemId: "chicken", name: "Chicken whole", unit: "kg", requestedQty: 10, receivedQty: "10", finalPrice: "9.00" },
    { itemId: "oil", name: "Cooking oil 5L", unit: "btl", requestedQty: 2, receivedQty: "2", finalPrice: "30.00" },
  ];

  it("fills what it found, leaves the rest as ordered and lists it", () => {
    const f = fillReceive(rows, cleanReading(raw(), ITEMS));
    expect(f.items[0]).toMatchObject({ receivedQty: "10", finalPrice: "4.50" });
    expect(f.items[1]).toMatchObject({ receivedQty: "12", finalPrice: "10.00" });
    expect(f.items[2]).toMatchObject({ receivedQty: "2", finalPrice: "30.00" });
    expect(f.filled).toEqual(["onion", "chicken"]);
    expect(f.missing).toEqual(["Cooking oil 5L"]);
    expect(f.extra.map((l) => l.text)).toEqual(["Plastic bag"]);
    expect(f.invoiceNo).toBe("INV-778");
  });

  it("asks to check a line that was hard to read or in another unit", () => {
    const r = cleanReading(raw({ lines: [
      { text: "B. BESAR", itemId: "onion", qty: 1, unit: "sack", unitPrice: 40, amount: 40, sure: true },
      { text: "AYAM", itemId: "chicken", qty: 12, unit: "kg", unitPrice: 10, amount: 120, sure: false },
    ] }), ITEMS);
    expect(fillReceive(rows, r).check).toEqual(["onion", "chicken"]);
  });

  it("the same item twice on the invoice is added up", () => {
    const r = cleanReading(raw({ lines: [
      { text: "AYAM", itemId: "chicken", qty: 5, unit: "kg", unitPrice: 10, amount: 50, sure: true },
      { text: "AYAM", itemId: "chicken", qty: 5, unit: "kg", unitPrice: 12, amount: 60, sure: true },
    ] }), ITEMS);
    expect(fillReceive(rows, r).items[1]).toMatchObject({ receivedQty: "10", finalPrice: "11.00" });
  });

  it("says when the invoice's total doesn't match", () => {
    expect(totalGap({ total: 171 }, 171.03)).toBe(0);
    expect(totalGap({ total: 171 }, 165)).toBe(-6);
    expect(totalGap({ total: 0 }, 165)).toBe(0);
  });
});

describe("filling New Vendor Bill", () => {
  it("items for stock, the total before the discount", () => {
    const f = fillNewBill(cleanReading(raw({ discount: 6, total: 165 }), ITEMS), ITEMS);
    expect(f.rows).toEqual([
      { itemId: "onion", name: "Bawang Besar", unit: "kg", qty: "10", price: "4.5" },
      { itemId: "chicken", name: "Chicken whole", unit: "kg", qty: "12", price: "10" },
    ]);
    expect(f.total).toBe(171);
    expect(f.discount).toBe(6);
    expect(f.extra).toHaveLength(1);
  });

  it("no printed total: the lines added up", () => {
    expect(fillNewBill(cleanReading(raw({ total: 0 }), ITEMS), ITEMS).total).toBe(171);
  });

  it("a line it couldn't place, in words", () => {
    expect(extraText({ text: "Plastic bag", qty: 2, unit: "pkt", unitPrice: 3, amount: 6 }, (v) => v.toFixed(2))).toBe("Plastic bag · 2 pkt · 3.00 each");
  });
});
