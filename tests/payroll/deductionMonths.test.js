import { describe, expect, it } from "vitest";
import { deductionMonths, salaryOpen, shiftMonth } from "@/lib/payroll/deductionMonths";

describe("which salary an advance can come off", () => {
  it("the owner's case: on 8 Nov, October's pay still open", () => {
    expect(deductionMonths("2026-11-08", [], { back: true })).toEqual(["2026-10", "2026-11", "2026-12", "2027-01", "2027-02"]);
  });
  it("a draft doesn't close the month", () => {
    expect(deductionMonths("2026-11-08", [{ period: "2026-10", status: "draft" }], { back: true })[0]).toBe("2026-10");
  });
  it("finalized or paid closes it", () => {
    for (const status of ["finalized", "paid"]) {
      expect(deductionMonths("2026-11-08", [{ period: "2026-10", status }], { back: true })[0]).toBe("2026-11");
    }
  });
  it("another month's run doesn't matter", () => {
    expect(salaryOpen([{ period: "2026-09", status: "paid" }], "2026-10")).toBe(true);
  });
  it("one waiting for approval starts from the month it's dated", () => {
    expect(deductionMonths("2026-11-08", [], { back: false })).toEqual(["2026-11", "2026-12", "2027-01", "2027-02"]);
  });
  it("crosses the year", () => {
    expect(deductionMonths("2027-01-05", [], { back: true })[0]).toBe("2026-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });
  it("no date, nothing to offer", () => {
    expect(deductionMonths("", [])).toEqual([]);
  });
});
