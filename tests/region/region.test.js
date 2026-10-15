import { describe, it, expect } from "vitest";
import { businessDateFor, cutoffMinutes, formatMoney, currencyInfo, regionOf, businessToday } from "@/lib/region";

// An instant given as UTC, so the tests don't depend on the machine's zone.
const utc = (y, m, d, h, min = 0) => new Date(Date.UTC(y, m - 1, d, h, min));

describe("businessDateFor", () => {
  it("is the calendar day on the branch's clock when there is no cut-off", () => {
    // 17 Sep 17:30 UTC = 18 Sep 01:30 in Kuala Lumpur, 23:30 on the 17th in Dhaka
    expect(businessDateFor(utc(2026, 9, 17, 17, 30), "00:00", "Asia/Kuala_Lumpur")).toBe("2026-09-18");
    expect(businessDateFor(utc(2026, 9, 17, 17, 30), "00:00", "Asia/Dhaka")).toBe("2026-09-17");
  });

  it("books the hours before the cut-off to the previous day", () => {
    // 01:30 in KL with a 05:00 cut-off is still the 17th's trade
    expect(businessDateFor(utc(2026, 9, 17, 17, 30), "05:00", "Asia/Kuala_Lumpur")).toBe("2026-09-17");
    // 05:00 sharp starts the new day
    expect(businessDateFor(utc(2026, 9, 17, 21, 0), "05:00", "Asia/Kuala_Lumpur")).toBe("2026-09-18");
  });

  it("steps back across a month end", () => {
    // 1 Oct 02:00 in Dhaka, cut-off 04:00 → 30 Sep
    expect(businessDateFor(utc(2026, 9, 30, 20, 0), "04:00", "Asia/Dhaka")).toBe("2026-09-30");
  });

  it("falls back to the device zone for an unknown zone instead of failing", () => {
    expect(businessDateFor(utc(2026, 9, 17, 12), "00:00", "Not/AZone")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("parses cut-off times", () => {
    expect(cutoffMinutes("05:00")).toBe(300);
    expect(cutoffMinutes("")).toBe(0);
    expect(cutoffMinutes("25:00")).toBe(0);
  });
});

describe("currency", () => {
  it("treats MYR and RM as the same currency", () => {
    expect(formatMoney(1234.5, "MYR")).toBe("RM 1,234.50");
    expect(formatMoney(1234.5, "RM")).toBe("RM 1,234.50");
  });

  it("writes taka with the ৳ sign and lakh grouping", () => {
    expect(formatMoney(123456, "BDT")).toBe("৳ 1,23,456.00");
    expect(currencyInfo("৳").code).toBe("BDT");
  });

  it("shows an unknown currency as typed", () => {
    expect(formatMoney(5, "EUR")).toBe("EUR 5.00");
  });
});

describe("regionOf", () => {
  it("reads the branch's settings", () => {
    const r = regionOf({
      basic: { timeZone: "Asia/Dhaka" },
      attendance: { dayCutoffTime: "04:00" },
      financeSales: { currency: "BDT" },
    });
    expect(r).toMatchObject({ timeZone: "Asia/Dhaka", timeZoneIsSet: true, cutoffTime: "04:00" });
    expect(r.currency.symbol).toBe("৳");
  });

  it("defaults: device zone, midnight, ringgit", () => {
    const r = regionOf({});
    expect(r.timeZoneIsSet).toBe(false);
    expect(r.cutoffTime).toBe("00:00");
    expect(r.currency.code).toBe("MYR");
  });

  it("businessToday uses the region given", () => {
    const kl = regionOf({ basic: { timeZone: "Asia/Kuala_Lumpur" }, attendance: { dayCutoffTime: "05:00" } });
    expect(businessToday(utc(2026, 9, 17, 17, 30), kl)).toBe("2026-09-17");
  });
});
