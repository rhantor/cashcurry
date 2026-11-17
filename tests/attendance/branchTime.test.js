// The branch's clock, not the device's (owner, 17 Nov 2026): the owner looks at
// Malaysia's attendance from Bangladesh, two hours behind. Punches must read,
// fall on days and fit shifts on Malaysia's clock.
import { describe, expect, it } from "vitest";
import { clockText, instantAt } from "@/lib/region";
import { computeAttendance, formatClock, getAttendanceDate } from "@/lib/attendance/computeHours";
import { shiftWindow } from "@/lib/attendance/shifts";

const KL = "Asia/Kuala_Lumpur";
const DHAKA = "Asia/Dhaka"; // where the owner looks from — the zone is named, never set on the process (it is shared)
const ts = (iso) => ({ seconds: Date.parse(iso) / 1000 });

describe("seen from Bangladesh, on Malaysia's clock", () => {
  it("a 09:00 punch in Kuala Lumpur reads 09:00, not 07:00", () => {
    const at = new Date("2026-11-17T01:00:00Z");
    expect(clockText(at, KL)).toBe("09:00");
    expect(clockText(at, DHAKA)).toBe("07:00"); // what Bangladesh's clock says
    expect(formatClock(ts("2026-11-17T01:00:00Z"), KL)).toBe("09:00");
  });

  it("a punch typed as 09:00 is saved as 09:00 in Kuala Lumpur", () => {
    expect(instantAt("2026-11-17", 9 * 60, KL).toISOString()).toBe("2026-11-17T01:00:00.000Z");
    expect(instantAt("2026-11-17", 23 * 60 + 30, KL).toISOString()).toBe("2026-11-17T15:30:00.000Z");
  });

  it("the 05:00 day cutoff is Malaysia's", () => {
    // 04:30 in KL on the 18th (02:30 in Dhaka): still the 17th's day
    expect(getAttendanceDate(ts("2026-11-17T20:30:00Z"), "05:00", KL)).toBe("2026-11-17");
    // 05:30 in KL (03:30 in Dhaka): the 18th — the device's clock alone would say the 17th
    expect(getAttendanceDate(ts("2026-11-17T21:30:00Z"), "05:00", KL)).toBe("2026-11-18");
    expect(getAttendanceDate(ts("2026-11-17T21:30:00Z"), "05:00", DHAKA)).toBe("2026-11-17");
  });

  it("a 09:00–18:00 shift is 09:00–18:00 in Kuala Lumpur, an overnight one ends the next day", () => {
    const w = shiftWindow("2026-11-17", { start: "09:00", end: "18:00" }, KL);
    expect(w.start.toISOString()).toBe("2026-11-17T01:00:00.000Z");
    expect(w.end.toISOString()).toBe("2026-11-17T10:00:00.000Z");
    const n = shiftWindow("2026-11-17", { start: "18:00", end: "02:00" }, KL);
    expect(n.end.toISOString()).toBe("2026-11-17T18:00:00.000Z");
  });

  it("an on-time day on a shift is on time, and its pairs read on Malaysia's clock", () => {
    const punches = [
      { staffId: "s", type: "in", timestamp: ts("2026-11-17T01:00:00Z") },
      { staffId: "s", type: "out", timestamp: ts("2026-11-17T10:00:00Z") },
    ];
    const settings = { shiftsEnabled: true, timeZone: KL, dayCutoffTime: "05:00" };
    const staff = { id: "s", shiftStart: "09:00", shiftEnd: "18:00", shiftBreakMinutes: 0 };
    const { days } = computeAttendance({ punches, staff, settings });
    expect(days).toHaveLength(1);
    expect(days[0].date).toBe("2026-11-17");
    expect(days[0].lateMinutes || 0).toBe(0);
    expect(days[0].pairs?.[0]).toMatchObject({ in: "09:00", out: "18:00" });
  });
});
