import { describe, expect, it } from "vitest";
import { byId, deductionLines } from "@/lib/payroll/deductionDetails";

const loan = {
  id: "l1", amount: 1000, date: "2026-02-24", reason: "Took RM 1,000, RM 500 paid in March",
  paidOut: { date: "2026-02-24" }, voucher: { no: 7 },
  installments: [
    { index: 1, month: "2026-03", amount: 500, status: "paid" },
    { index: 2, month: "2026-10", amount: 500, status: "pending" },
  ],
};
const advance = { id: "a1", amount: 900, date: "2026-10-12", reason: "Phone purchase", installments: [
  { index: 1, month: "2026-10", amount: 300, status: "pending" },
  { index: 2, month: "2026-11", amount: 300, status: "pending" },
  { index: 3, month: "2026-12", amount: 300, status: "pending" },
] };
const docs = byId([loan, advance]);
const branch = { code: "LZBB" };

describe("what a payslip lists for its advances and loans", () => {
  it("when given, voucher, what for, this month's instalment and what is left", () => {
    expect(deductionLines({ items: [{ docId: "l1", index: 2, amount: 500, due: 500 }], docs, kind: "loan", period: "2026-10", branch })).toEqual([{
      kind: "loan", docId: "l1", date: "2026-02-24", voucher: "LZBB-L-0007", reason: "Took RM 1,000, RM 500 paid in March",
      amount: 1000, due: 500, taken: 500, instalment: "2 of 2", left: 0, moved: false,
    }]);
  });
  it("the first of three, with no voucher", () => {
    const [a] = deductionLines({ items: [{ docId: "a1", index: 1, amount: 300, due: 300 }], docs, kind: "advance", period: "2026-10", branch });
    expect(a).toMatchObject({ voucher: "", instalment: "1 of 3", taken: 300, left: 600 });
  });
  it("part taken, or none: what is left counts only what was taken", () => {
    expect(deductionLines({ items: [{ docId: "a1", index: 1, amount: 100, due: 300 }], docs, period: "2026-10" })[0]).toMatchObject({ taken: 100, due: 300, left: 800, moved: false });
    expect(deductionLines({ items: [{ docId: "l1", index: 2, amount: 0, due: 500 }], docs, kind: "loan", period: "2026-10" })[0]).toMatchObject({ taken: 0, left: 500, moved: true });
  });
  it("a finalized month: its own paid instalment is not counted twice", () => {
    const paid = { ...loan, installments: loan.installments.map((i) => ({ ...i, status: "paid" })) };
    expect(deductionLines({ items: [{ docId: "l1", index: 2, amount: 500 }], docs: byId([paid]), kind: "loan", period: "2026-10" })[0].left).toBe(0);
  });
  it("a record that can't be found still prints what was taken", () => {
    expect(deductionLines({ items: [{ docId: "x", index: 1, amount: 50 }], docs, period: "2026-10" })[0]).toMatchObject({ taken: 50, amount: 0, left: null, reason: "" });
  });
});
