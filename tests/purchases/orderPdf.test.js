import { describe, expect, it } from "vitest";
import buildPurchaseOrderPdf from "@/lib/purchases/purchaseOrderPdf";

// jsPDF writes text uncompressed, so the words on the page are in the file as written
const pdfText = async (order) => {
  const file = buildPurchaseOrderPdf({ order, vendor: { name: "Best Food" }, company: { name: "Co" }, branch: { name: "Branch" }, save: false });
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
});
