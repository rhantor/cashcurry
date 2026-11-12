import { describe, expect, it } from "vitest";
import buildPurchaseOrderPdf from "@/lib/purchases/purchaseOrderPdf";

// jsPDF writes text uncompressed, so the words on the page are in the file as written
const pdfText = async (order, opts = {}) => {
  const file = buildPurchaseOrderPdf({ order, vendor: { name: "Best Food" }, company: { name: "Co" }, branch: { name: "Branch" }, save: false, ...opts });
  return new Promise((done) => {
    const r = new FileReader();
    r.onload = () => done(r.result);
    r.readAsBinaryString(file);
  });
};
const items = [{ itemId: "a", name: "Lamb Fat", unit: "Kg", requestedQty: 4, estPrice: 12.5 }];

describe("the purchase order PDF (6 Nov)", () => {
  it("before the goods come: item and quantity only — no price, no total", async () => {
    const t = await pdfText({ poNo: "PO-X-2611-0001", status: "Approved", items, totalEst: 50 });
    expect(t).toContain("Lamb Fat");
    expect(t).not.toContain("Unit Price");
    expect(t).not.toContain("12.50");
    expect(t).not.toContain("ESTIMATED TOTAL");
  });
  it("once received: what was paid, for the branch's own record", async () => {
    const t = await pdfText({
      poNo: "PO-X-2611-0001", status: "Received", items, finalTotal: 52,
      receivedItems: [{ ...items[0], receivedQty: 4, finalPrice: 13 }],
    });
    expect(t).toContain("Unit Price");
    expect(t).toContain("INVOICE TOTAL");
    expect(t).toContain("13.00");
  });
  it("with prices, for management to approve (13 Nov): expected prices and an estimated total, marked not for the supplier", async () => {
    const two = [...items, { itemId: "b", name: "Onion", unit: "Kg", requestedQty: 10, estPrice: 0 }];
    const order = { poNo: "PO-X-2611-0002", status: "Pending", items: two, createdByName: "Kumar", approvedByName: "" };
    const t = await pdfText(order, { withPrices: true });
    expect(t).toContain("FOR APPROVAL, NOT FOR THE SUPPLIER");
    expect(t).toContain("Est. Price");
    expect(t).toContain("12.50");
    expect(t).toContain("50.00");
    expect(t).toContain("ESTIMATED TOTAL");
    expect(t).toContain("1 item with no price yet");
    // the same order for the supplier: still no prices
    const plain = await pdfText(order);
    expect(plain).not.toContain("12.50");
    expect(plain).not.toContain("FOR APPROVAL");
  });
  it("names who approved it and when, on the copy with prices", async () => {
    const t = await pdfText({ poNo: "PO-X-2611-0003", status: "Approved", items, approvedByName: "Siti", approvedAt: "2026-11-12T08:00:00.000Z" }, { withPrices: true });
    expect(t).toContain("Siti");
    expect(t).toMatch(/12 Nov 2026|Nov 12, 2026/);
  });
  it("a received order is the same either way: what was paid", async () => {
    const order = { poNo: "PO-X-2611-0004", status: "Received", items, finalTotal: 52, receivedItems: [{ ...items[0], receivedQty: 4, finalPrice: 13 }] };
    const t = await pdfText(order, { withPrices: true });
    expect(t).toContain("INVOICE TOTAL");
    expect(t).not.toContain("FOR APPROVAL");
  });
});
