import { describe, expect, it } from "vitest";
import { salaryLine, salaryMonthReport } from "@/lib/payroll/advanceMonth";

const paidOut = { date: "2026-11-03", from: "front", by: { uid: "m" } };
const adv = (id, staffName, date, installments, extra = {}) => ({ id, staffName, date, amount: installments.reduce((n, i) => n + i.amount, 0), status: "approved", paidOut, installments, ...extra });
const inst = (month, amount, status = "pending") => ({ month, amount, status });

describe("what an advance takes from a salary", () => {
  it("the month it comes off, not the day it was given", () => {
    const a = adv("a", "Ali", "2026-11-03", [inst("2026-10", 200)]);
    expect(salaryLine(a, "2026-10")).toEqual({ amount: 200, taken: false });
    expect(salaryLine(a, "2026-11")).toBeNull();
  });
  it("only that month's part of several instalments", () => {
    const a = adv("a", "Ali", "2026-10-01", [inst("2026-10", 100, "paid"), inst("2026-11", 150)]);
    expect(salaryLine(a, "2026-10")).toEqual({ amount: 100, taken: true });
    expect(salaryLine(a, "2026-11")).toEqual({ amount: 150, taken: false });
  });
  it("an instalment moved away (0) is nothing to take", () => {
    expect(salaryLine(adv("a", "Ali", "2026-10-01", [inst("2026-10", 0)]), "2026-10")).toBeNull();
  });
  it("an old advance without instalments goes by its deduction month, else its date", () => {
    expect(salaryLine({ amount: 50, date: "2026-11-02", deductionMonth: "2026-10", status: "closed" }, "2026-10")).toEqual({ amount: 50, taken: true });
    expect(salaryLine({ amount: 50, date: "2026-10-02", status: "approved" }, "2026-10")).toEqual({ amount: 50, taken: false });
  });
});

describe("the month's report", () => {
  const list = [
    adv("a", "Ali", "2026-10-20", [inst("2026-10", 100, "paid")], { status: "closed" }),
    adv("b", "Ali", "2026-11-03", [inst("2026-10", 200)]),
    adv("c", "Sam", "2026-11-05", [inst("2026-10", 50)]),
    adv("d", "Nora", "2026-11-06", [inst("2026-11", 70)]),
    adv("e", "Kumar", "2026-11-06", [inst("2026-10", 40)], { paidOut: null, status: "approved", approvals: [{ at: "x" }], date: "2026-11-06", requiresPayOut: true }),
    adv("f", "Pending", "2026-10-06", [inst("2026-10", 90)], { status: "pending" }),
  ];
  const report = salaryMonthReport(list.filter((a) => a.id !== "e"), "2026-10");

  it("adds up the salary month, whenever it was given", () => {
    expect(report).toMatchObject({ total: 350, taken: 100, toTake: 250, givenLater: 250 });
  });
  it("leaves out other months and requests not approved", () => {
    expect(report.rows.map((r) => r.id)).toEqual(["a", "b", "c"]);
  });
  it("totals per staff, biggest first", () => {
    expect(report.staff.map((s) => [s.staffName, s.amount, s.rows.length])).toEqual([["Ali", 300, 2], ["Sam", 50, 1]]);
  });
  it("approved but not handed over is set apart, as payroll leaves it", () => {
    const r = salaryMonthReport(list, "2026-10");
    expect(r.total).toBe(350);
    expect(r.waiting.map((x) => x.id)).toEqual(["e"]);
  });
  it("marks those given after the month ended", () => {
    expect(report.rows.find((r) => r.id === "b").givenLater).toBe(true);
    expect(report.rows.find((r) => r.id === "a").givenLater).toBe(false);
  });
});
