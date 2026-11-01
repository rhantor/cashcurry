import { describe, expect, it } from "vitest";
import { amountInWords, branchCode, numberWords, voucherNo, voucherSheet } from "@/lib/costs/voucherPaper";

describe("the voucher on paper (1 Nov)", () => {
  it("numbers run per branch, with its code", () => {
    expect(voucherNo({ code: "dkl" }, 7)).toBe("DKL-V-0007");
    expect(voucherNo({ name: "Demo Branch KL" }, 12)).toBe("DBK-V-0012");
    expect(branchCode({ name: "Bangsar" })).toBe("BANG");
    expect(voucherNo({ code: "KL" }, undefined)).toBe("—");
  });
  it("writes the amount in words", () => {
    expect(numberWords(0)).toBe("zero");
    expect(numberWords(150)).toBe("one hundred fifty");
    expect(numberWords(1234567)).toBe("one million two hundred thirty-four thousand five hundred sixty-seven");
    expect(amountInWords(150)).toBe("One hundred fifty ringgit only");
    expect(amountInWords(40.5)).toBe("Forty ringgit and 50 sen only");
    expect(amountInWords(1200, "BDT")).toBe("One thousand two hundred taka only");
  });
  it("lays out everything from the cost; the approval box waits empty", () => {
    const at = new Date("2026-11-01T02:42:00Z");
    const cost = { date: "2026-11-01", amount: 150, paidTo: "Pasar Chow Kit", costGroup: "Food & stock", category: "Food & ingredients", paidFromOffice: "front", voucher: { no: 7, reason: "Market stall, no receipt", by: { name: "KL Manager" }, at } };
    const s = voucherSheet(cost, { branch: { name: "Demo Branch KL", code: "DKL" }, money: (v) => `RM ${v.toFixed(2)}` });
    expect(s).toMatchObject({ title: "PAYMENT VOUCHER", branchName: "Demo Branch KL", no: "DKL-V-0007", date: "2026-11-01" });
    expect(s.rows).toEqual([
      { label: "Paid to", value: "Pasar Chow Kit" },
      { label: "For", value: "Food & stock · Food & ingredients" },
      { label: "Paid from", value: "Till (cash)" },
      { label: "Amount", value: "RM 150.00", words: "One hundred fifty ringgit only" },
      { label: "Why no invoice", value: "Market stall, no receipt" },
    ]);
    expect(s.boxes[0]).toMatchObject({ label: "Prepared by", name: "KL Manager", at });
    expect(s.boxes[1]).toEqual({ label: "Approved by", waiting: "Waiting for approval" });
    expect(voucherSheet(cost, { approval: { by: { uid: "a1", name: "KL Admin" }, at } }).boxes[1]).toEqual({ label: "Approved by", uid: "a1", name: "KL Admin", at });
    expect(voucherSheet(cost, { approval: { stamp: "No approval needed", by: { uid: "g1", name: "GM" }, at } }).boxes[1].stamp).toBe("No approval needed");
  });
});
