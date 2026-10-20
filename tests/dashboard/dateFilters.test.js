import { describe, it, expect } from "vitest";
import { presetFilter, filterFromInput, filterToInput, dayKeyOfFilter } from "@/app/hooks/dashboard/dateFilters";
import { dayKey } from "@/app/hooks/dashboard/utils";

// Tests run in Asia/Kuala_Lumpur (UTC+8) — see vitest.config.mjs.
const at = (y, m, d, h = 0, min = 0, s = 0) => new Date(y, m - 1, d, h, min, s);

describe("presetFilter", () => {
  const now = at(2026, 9, 18, 15, 0); // 18 Sep 2026, 3pm

  it("Last 7 Days covers 7 whole days ending today", () => {
    const f = presetFilter("week", now);
    expect(f.from).toEqual(at(2026, 9, 12));
    expect(f.to).toEqual(new Date(2026, 8, 18, 23, 59, 59, 999));
    expect(f.preset).toBe("week");
  });

  it("Last 30 Days covers 30 whole days ending today", () => {
    expect(presetFilter("days30", now).from).toEqual(at(2026, 8, 20));
  });

  it("This Month starts on the 1st at midnight", () => {
    expect(presetFilter("month", now).from).toEqual(at(2026, 9, 1));
  });

  it("ends on the business day it is given (before the day cut-off)", () => {
    // 1:30am on 1 Oct, but the branch's day runs until 05:00 → still 30 Sep
    const f = presetFilter("month", at(2026, 10, 1, 1, 30), "2026-09-30");
    expect(dayKeyOfFilter(f)).toEqual({ from: "2026-09-01", to: "2026-09-30" });
  });

  it("works early in the morning, before 8am (UTC is still yesterday)", () => {
    const early = at(2026, 10, 1, 1, 30);
    expect(dayKeyOfFilter(presetFilter("month", early))).toEqual({ from: "2026-10-01", to: "2026-10-01" });
  });
});

describe("date inputs", () => {
  it("a picked 'from' date is that local day at midnight", () => {
    expect(filterFromInput("2026-10-01")).toEqual(at(2026, 10, 1));
  });
  it("a picked 'to' date runs to the end of that local day", () => {
    expect(filterToInput("2026-10-15")).toEqual(new Date(2026, 9, 15, 23, 59, 59, 999));
  });
  it("the label shows local days (was one day early under UTC)", () => {
    expect(dayKeyOfFilter(presetFilter("month", at(2026, 10, 15, 12)))).toEqual({ from: "2026-10-01", to: "2026-10-15" });
  });
});

describe("dayKey", () => {
  it("keeps a business date string exactly", () => {
    expect(dayKey("2026-09-12")).toBe("2026-09-12");
  });
  // The device's day by design; checked from Malaysia.
  it.skipIf(process.env.TZ !== "Asia/Kuala_Lumpur")("puts a timestamp on the local calendar day", () => {
    expect(dayKey("2026-09-11T17:30:00.000Z")).toBe("2026-09-12"); // 1:30am in KL
    expect(dayKey({ seconds: Date.UTC(2026, 8, 11, 17, 30) / 1000 })).toBe("2026-09-12");
    expect(dayKey(at(2026, 9, 12, 23, 59))).toBe("2026-09-12");
  });
  it("returns null for missing or invalid values", () => {
    expect(dayKey(undefined)).toBeNull();
    expect(dayKey("not a date")).toBeNull();
  });
});
