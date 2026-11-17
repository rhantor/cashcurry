// A payroll month already paid by hand (17 Nov 2026): marked paid by that
// Salary Entry, so the month's salaries aren't counted twice. Made-up figures.
import { describe, expect, it } from "vitest";
import { byHandEntries, entryMatch, paidByEntryFields, paidByEntryProblem } from "@/lib/payroll/paidByEntry";

const AUG = { id: "e1", month: "2026-08", totalSalary: "12500.40", paymentDate: "2026-09-08", payMethod: "Bank transfer", note: "August salary" };
const RUN = { period: "2026-08", status: "finalized" };

describe("byHandEntries", () => {
  it("only entries made by hand, with amount, date, method and note", () => {
    const list = byHandEntries([AUG, { id: "p1", source: "payroll", totalSalary: 900, month: "2026-08" }]);
    expect(list).toEqual([{ id: "e1", amount: 12500.4, paymentDate: "2026-09-08", method: "Bank transfer", note: "August salary" }]);
  });
  it("older entries: amount or date under other names", () => {
    expect(byHandEntries([{ id: "x", amount: 300, date: "2026-07-10" }])[0]).toMatchObject({ amount: 300, paymentDate: "2026-07-10", method: "", note: "" });
  });
});

describe("entryMatch", () => {
  it("same within 5 sen (a total rounded to the ringgit)", () => {
    expect(entryMatch({ amount: 12500 }, 12499.99)).toEqual({ diff: 0.01, same: true });
  });
  it("says how much less the entry is", () => {
    expect(entryMatch({ amount: 9000 }, 9800.5)).toEqual({ diff: -800.5, same: false });
  });
});

describe("paidByEntryProblem", () => {
  it("a finalized run and a hand entry of the same month: fine", () => {
    expect(paidByEntryProblem({ run: RUN, entry: AUG })).toBe("");
  });
  it("not before it's finalized, and not a paid run", () => {
    expect(paidByEntryProblem({ run: { ...RUN, status: "draft" }, entry: AUG })).toMatch(/Finalize/);
    expect(paidByEntryProblem({ run: { ...RUN, status: "paid" }, entry: AUG })).toMatch(/Finalize/);
  });
  it("not an entry payroll wrote itself, nor another month's", () => {
    expect(paidByEntryProblem({ run: RUN, entry: { ...AUG, source: "payroll" } })).toMatch(/payroll itself/);
    expect(paidByEntryProblem({ run: RUN, entry: { ...AUG, month: "2026-07" } })).toMatch(/another month/);
    expect(paidByEntryProblem({ run: RUN, entry: null })).toMatch(/wasn't found/);
  });
  it("never when the run's slips are already salary (that would count it twice)", () => {
    expect(paidByEntryProblem({ run: RUN, entry: AUG, payrollEntries: [{ id: "payroll_r_s" }] })).toMatch(/already added/);
  });
});

describe("paidByEntryFields", () => {
  it("paid, on the entry's date, pointing at it — no money fields", () => {
    const f = paidByEntryFields(AUG, { uid: "u1", username: "kl_admin", name: "Branch Admin" });
    expect(f).toEqual({
      status: "paid",
      paidBy: { uid: "u1", username: "kl_admin", name: "Branch Admin" },
      paymentMethod: "Bank transfer",
      paymentReference: "Paid by hand: Salary Entry of 2026-09-08",
      paidOn: "2026-09-08",
      paidByEntry: { id: "e1", amount: 12500.4, paymentDate: "2026-09-08" },
      reopened: null,
    });
  });
});
