import { describe, expect, it } from "vitest";
import { calcPayroll } from "@/lib/payroll/calculations";
import { changeSheet, inputsFromSlip, rosterOf, sheetChoicesOf, sheetFields, staffAsPaid } from "@/lib/payroll/sheet";

const ali = { id: "a", firstName: "Ali", basicSalary: "2000", allowance: "100", salaryMode: "hours", standardHours: "208" };
const siti = { id: "s", firstName: "Siti", basicSalary: "1800" };
const raju = { id: "r", firstName: "Raju", basicSalary: "1700" };

describe("who is on the sheet", () => {
  it("is everyone in the base unless taken off", () => {
    const roster = rosterOf([ali, siti], [ali, siti, raju], { removed: ["s"], added: [] });
    expect(roster.map((s) => s.id)).toEqual(["a"]);
  });

  it("adds someone from the staff list, marked as added", () => {
    const roster = rosterOf([ali], [ali, raju], { removed: [], added: ["r"] });
    expect(roster.map((s) => s.id)).toEqual(["a", "r"]);
    expect(roster[1].addedToSheet).toBe(true);
    expect(roster[0].addedToSheet).toBeUndefined();
  });

  it("ignores an added id no longer on the staff list, or already in the base", () => {
    expect(rosterOf([ali], [ali], { added: ["gone", "a"], removed: [] }).map((s) => s.id)).toEqual(["a"]);
  });

  it("offers the base first, then the rest of the staff list", () => {
    const choices = sheetChoicesOf([ali], [ali, siti]);
    expect(choices.map((c) => [c.staff.id, c.inBase])).toEqual([["a", true], ["s", false]]);
  });

  it("taking off and putting back leaves no trace", () => {
    let sheet = { added: [], removed: [] };
    sheet = changeSheet(sheet, "a", false, true);
    expect(sheet).toEqual({ added: [], removed: ["a"] });
    sheet = changeSheet(sheet, "a", true, true);
    expect(sheet).toEqual({ added: [], removed: [] });
    sheet = changeSheet(sheet, "r", true, false);
    expect(sheet).toEqual({ added: ["r"], removed: [] });
    sheet = changeSheet(sheet, "r", false, false);
    expect(sheet).toEqual({ added: [], removed: [] });
  });

  it("keeps only unique, real ids on the run; nothing without a sheet", () => {
    expect(sheetFields({ added: ["a", "a", null], removed: ["b"] })).toEqual({ sheetAdded: ["a"], sheetRemoved: ["b"] });
    expect(sheetFields(undefined)).toEqual({});
  });
});

describe("a month paid before", () => {
  const entry = {
    staffId: "a", staffName: "Ali Old", basicSalary: 1500, allowance: 50, salaryMode: "days",
    standardHours: 200, workingDays: 25, otHours: 10, otPay: 120,
    statutory: [{ key: "epf", employeeRate: 9, employerRate: 12 }],
  };
  const config = [{ key: "epf" }, { key: "socso" }];

  it("uses that month's salary terms, not today's", () => {
    const s = staffAsPaid(entry, ali, config);
    expect(s).toMatchObject({ id: "a", basicSalary: 1500, allowance: 50, salaryMode: "days", standardHours: 200, workingDays: 25, OTPerHour: 12, notOnStaffList: false });
  });

  it("keeps the rates taken then, and off what wasn't taken", () => {
    const s = staffAsPaid(entry, ali, config);
    expect(s.deductionSettings.epf).toMatchObject({ enabled: true, employeeRateOverride: 9, employerRateOverride: 12 });
    expect(s.deductionSettings.socso).toMatchObject({ enabled: false });
  });

  it("still shows staff no longer on the list, by the name on the entry", () => {
    const s = staffAsPaid(entry, undefined, config);
    expect(s).toMatchObject({ id: "a", name: "Ali Old", notOnStaffList: true });
  });

  it("falls back to today's terms for what the entry doesn't have", () => {
    const s = staffAsPaid({ staffId: "a", basicSalary: "" }, ali, config);
    expect(s).toMatchObject({ basicSalary: "2000", allowance: "100", salaryMode: "hours" });
  });

  it("gives back the same net pay when worked out again from the entry", () => {
    const statutory = [{ key: "epf", name: "EPF", enabled: true, employeeRate: 11, employerRate: 13, basis: "basic" }];
    const staff = { basicSalary: 2000, allowance: 100, salaryMode: "hours", standardHours: 208, workingDays: 26, OTPerHour: 15, deductionSettings: {} };
    const paid = calcPayroll(staff, { workedHours: 208, otHours: 4, bonus: 50 }, statutory);
    const asPaid = staffAsPaid({ ...paid, staffId: "a" }, { id: "a", firstName: "Ali", basicSalary: 9999, OTPerHour: 99 }, statutory);
    const inputs = inputsFromSlip(paid);
    const again = calcPayroll(
      {
        basicSalary: parseFloat(asPaid.basicSalary), allowance: parseFloat(asPaid.allowance), salaryMode: asPaid.salaryMode,
        standardHours: parseFloat(asPaid.standardHours), workingDays: parseFloat(asPaid.workingDays), OTPerHour: asPaid.OTPerHour,
        deductionSettings: asPaid.deductionSettings,
      },
      { workedHours: parseFloat(inputs.workedHours), otHours: parseFloat(inputs.otHours), bonus: parseFloat(inputs.bonus) },
      statutory,
    );
    expect(again.netPay).toBe(paid.netPay);
  });
});

describe("inputsFromSlip", () => {
  it("makes text boxes of numbers and keeps an empty override empty", () => {
    const i = inputsFromSlip({ workedHours: 208, bonus: 0, bonusNote: "eid", allowanceOverride: null, loanOverride: null });
    expect(i).toMatchObject({ workedHours: "208", bonus: "0", bonusNote: "eid", allowanceOverride: "", loanOverride: "", otHours: "" });
  });
  it("keeps a loan override of zero", () => {
    expect(inputsFromSlip({ loanOverride: 0 }).loanOverride).toBe("0");
  });
});
