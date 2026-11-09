import { describe, expect, it, vi } from "vitest";
import { exportSalaryMonthToExcel, exportSalaryMonthToPDF } from "@/app/export/exportAdvanceData/salaryMonth";
import { salaryMonthReport } from "@/lib/payroll/advanceMonth";

const written = vi.hoisted(() => ({ book: null, name: "" }));
vi.mock("xlsx", async (real) => {
  const x = await real();
  return { ...x, writeFile: (book, name) => { written.book = book; written.name = name; } };
});

const paidOut = { date: "2026-11-03", from: "front", by: { uid: "m" } };
const report = salaryMonthReport(
  [
    { id: "a", staffName: "Ali", date: "2026-10-20", amount: 100, status: "approved", paidOut, reason: "Rent", installments: [{ month: "2026-10", amount: 100, status: "pending" }] },
    { id: "b", staffName: "Ali", date: "2026-11-03", amount: 200, status: "approved", paidOut, installments: [{ month: "2026-10", amount: 200, status: "pending" }] },
  ],
  "2026-10",
);

describe("the salary month report's files", () => {
  it("makes a PDF with the month, the lines and the total", () => {
    const text = exportSalaryMonthToPDF(report, { name: "Lazeez Bistro" }, "October 2026", { save: false }).output();
    expect(text).toContain("Advances from October 2026 salary");
    expect(text).toContain("Ali: total");
    expect(text).toContain("300.00");
  });
  it("makes an Excel file with the same figures", () => {
    exportSalaryMonthToExcel(report, { name: "Lazeez Bistro" }, "October 2026");
    expect(written.name).toBe("Advances-October-2026-salary-Lazeez-Bistro.xlsx");
    const cells = Object.values(written.book.Sheets["Salary month"]).map((c) => c?.v);
    expect(cells).toEqual(expect.arrayContaining(["Advances from October 2026 salary", "Ali: total", 300, 200, 100]));
  });
});
