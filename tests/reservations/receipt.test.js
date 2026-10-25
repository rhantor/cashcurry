import { describe, expect, it } from "vitest";
import { amountInWords, branchTag, checkReceipt, numberWords, receiptMessage, receiptNo, timeText } from "@/lib/reservations/receipt";

describe("reservation deposit receipts", () => {
  it("numbers per branch and month", () => {
    expect(receiptNo("KLBB", "2610", 7)).toBe("RSV-KLBB-2610-0007");
    expect(branchTag({ name: "Lazeez Arabic" })).toBe("LAZE");
    expect(branchTag({ code: "lz-bb" })).toBe("LZBB");
  });
  it("the amount in words, in the branch's currency", () => {
    expect(amountInWords(500, "RM")).toBe("Ringgit Malaysia five hundred only");
    expect(amountInWords(1250.5, "MYR")).toBe("Ringgit Malaysia one thousand two hundred fifty and fifty sen only");
    expect(amountInWords(21, "BDT")).toBe("Taka twenty-one only");
    expect(numberWords(1000001)).toBe("one million one");
  });
  it("times as people read them", () => {
    expect([timeText("19:30"), timeText("00:05"), timeText("12:00")]).toEqual(["7:30 PM", "12:05 AM", "12:00 PM"]);
  });
  it("what the form needs: a reference for anything but cash", () => {
    expect(Object.keys(checkReceipt({ method: "card" })).sort()).toEqual(["amount", "customerName", "customerPhone", "reference", "reservationDate"]);
    expect(checkReceipt({ customerName: "A", customerPhone: "012", reservationDate: "2026-11-01", amount: 100, method: "cash", pax: "" })).toEqual({});
  });
  it("the WhatsApp message", () => {
    const m = receiptMessage({ customerName: "Aisha", amount: 200, receiptNo: "RSV-X-2610-0001", reservationDate: "2026-11-01", reservationTime: "19:30", pax: 12 }, { business: "Lazeez", currency: "RM" });
    expect(m).toContain("We have received your deposit of RM 200.00 (receipt RSV-X-2610-0001).");
    expect(m).toContain("7:30 PM · 12 pax");
  });
});
