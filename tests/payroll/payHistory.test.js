import { describe, expect, it } from "vitest";
import { changesList, payFor, ratesFor, salaryChange } from "@/lib/payroll/payHistory";

// Ali, as on the June 2026 sheet: basic 1,900, allowance 200, 312 hours, OT at the hourly rate
const ali = { id: "ali", firstName: "Ali", lastName: "Ahmadi", standardHours: 312, basicSalary: 1900, allowance: 200, basicPerHour: 6.08, OTPerHour: 6.08 };
const by = { uid: "u1", name: "Owner" };

describe("a salary change works out the rates", () => {
  it("RM 200 more: 2,100 ÷ 312 an hour, and OT stays at the hourly rate", () => {
    const { entry, patch } = salaryChange(ali, { from: "2026-10", basicSalary: 2100, note: "GM approved", by, at: "2026-11-06T10:00:00Z" }, 312);
    expect(patch).toMatchObject({ basicSalary: 2100, allowance: 200, basicPerHour: 6.73, OTPerHour: 6.73 });
    expect(entry).toMatchObject({ from: "2026-10", hours: 312, note: "GM approved", by,
      was: { basicSalary: 1900, allowance: 200, basicPerHour: 6.08, OTPerHour: 6.08 },
      now: { basicSalary: 2100, allowance: 200, basicPerHour: 6.73, OTPerHour: 6.73 } });
  });
  it("an OT rate that differed keeps its ratio; none set stays none", () => {
    expect(ratesFor(2100, 312, { basicPerHour: 6, OTPerHour: 9 })).toEqual({ basicPerHour: 6.73, OTPerHour: 10.1 });
    expect(ratesFor(2100, 312, {})).toEqual({ basicPerHour: 6.73, OTPerHour: null });
  });
  it("the allowance and the rates can be given by hand", () => {
    const { patch } = salaryChange(ali, { from: "2026-11", basicSalary: 2000, allowance: 250, basicPerHour: 6.5, by }, 312);
    expect(patch).toMatchObject({ basicSalary: 2000, allowance: 250, basicPerHour: 6.5, OTPerHour: 6.41 });
  });
  it("needs a month and a basic", () => {
    expect(() => salaryChange(ali, { basicSalary: 2000 })).toThrow(/month/);
    expect(() => salaryChange(ali, { from: "2026-11" })).toThrow(/basic/);
  });
});

describe("payroll pays each month at the rate in force then", () => {
  const raised = { ...ali, ...salaryChange(ali, { from: "2026-11", basicSalary: 2100, by, at: "2026-11-06T10:00:00Z" }, 312).patch };
  it("before the change: the old pay, though the record shows the new", () => {
    expect(raised.basicSalary).toBe(2100);
    expect(payFor(raised, "2026-10")).toMatchObject({ basicSalary: 1900, basicPerHour: 6.08, OTPerHour: 6.08, allowance: 200 });
  });
  it("from the change on: the new pay", () => {
    expect(payFor(raised, "2026-11")).toMatchObject({ basicSalary: 2100, basicPerHour: 6.73 });
    expect(payFor(raised, "2027-01").basicSalary).toBe(2100);
  });
  it("two changes: each from its own month", () => {
    const twice = { ...raised, ...salaryChange(raised, { from: "2027-03", basicSalary: 2300, by, at: "2027-03-01T00:00:00Z" }, 312).patch };
    expect(["2026-10", "2026-12", "2027-03"].map((m) => payFor(twice, m).basicSalary)).toEqual([1900, 2100, 2300]);
    expect(twice.basicSalary).toBe(2300);
  });
  it("no history: as the record is", () => {
    expect(payFor(ali, "2026-10")).toBe(ali);
  });
  it("a rate never set before the first change is not made up", () => {
    const noRates = { id: "k", standardHours: 312, basicSalary: 2200 };
    const r = { ...noRates, ...salaryChange(noRates, { from: "2026-11", basicSalary: 2400, by }, 312).patch };
    expect(payFor(r, "2026-10")).not.toHaveProperty("basicPerHour");
    expect(payFor(r, "2026-11").basicPerHour).toBe(7.69);
  });
});

describe("whose salary went up, and when", () => {
  it("every change, newest first, with the rise", () => {
    const a = { ...ali, ...salaryChange(ali, { from: "2026-10", basicSalary: 2100, by, at: "2026-11-06T10:00:00Z" }, 312).patch };
    const list = changesList([a]);
    expect(list[0]).toMatchObject({ staffId: "ali", name: "Ali Ahmadi", from: "2026-10", rise: 200 });
  });
});
