import { describe, expect, it } from "vitest";
import { loanSplit } from "@/lib/payroll/loanSplit";

const sum = (a) => a.reduce((s, v) => s + v, 0);

describe("loanSplit — a staff loan over n months", () => {
  it("equal months rounded up, the last takes the rest (as before)", () => {
    expect(loanSplit(1000, 6)).toEqual([167, 167, 167, 167, 167, 165]);
    expect(loanSplit(1200, 3)).toEqual([400, 400, 400]);
  });

  it("any typed-in number of months adds up and never leaves a month below zero", () => {
    for (const total of [1, 10, 99, 500, 1000, 1000.5, 2500, 12345]) {
      for (let n = 1; n <= 60; n++) {
        const s = loanSplit(total, n);
        expect(s).toHaveLength(n);
        expect(sum(s)).toBeCloseTo(total, 6);
        for (const v of s) expect(v).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("rounds down when rounding up would leave the last month nothing or less", () => {
    // 17 × 59 = 1,003 > 1,000
    const s = loanSplit(1000, 60);
    expect(s[0]).toBe(16);
    expect(s[59]).toBe(1000 - 16 * 59);
    expect(loanSplit(10, 6)).toEqual([1, 1, 1, 1, 1, 5]);
  });

  it("one month takes it all", () => {
    expect(loanSplit(750, 1)).toEqual([750]);
  });
});
