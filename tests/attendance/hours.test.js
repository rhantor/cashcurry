import { describe, expect, it } from "vitest";
import { breakMinutes, computeAttendance, formatDuration } from "@/lib/attendance/computeHours";

// a punch at "HH:MM" Malaysia time on 14 Nov 2026 (+1 day when past midnight)
const at = (hm, nextDay = false) => {
  const [h, m] = hm.split(":").map(Number);
  return { seconds: Date.UTC(2026, 10, nextDay ? 15 : 14, h - 8, m) / 1000 };
};
const p = (type, hm, nextDay) => ({ type, timestamp: at(hm, nextDay), date: "2026-11-14", staffId: "s1" });
const staff = { id: "s1", basicHoursPerDay: 8 };
const settings = { dayCutoffTime: "05:00" };

describe("a day's worked time in the Attendance Log (15 Nov)", () => {
  it("reads as hours and minutes", () => {
    expect(formatDuration(12.0334)).toBe("12h 02m");
    expect(formatDuration(0)).toBe("0h 00m");
    expect(formatDuration(0.9)).toBe("0h 54m");
  });
  it("counts the break between an out and the next in", () => {
    expect(breakMinutes([p("in", "13:54"), p("out", "16:11"), p("in", "17:05"), p("out", "02:50", true)])).toBe(54);
    expect(breakMinutes([p("in", "10:00"), p("out", "18:00")])).toBe(0);
  });
  it("works out a split day as payroll does, without the break", () => {
    const punches = [p("in", "13:54"), p("out", "16:11"), p("in", "17:05"), p("out", "02:50", true)];
    const { days } = computeAttendance({ punches, staff, settings });
    expect(days).toHaveLength(1);
    expect(days[0].date).toBe("2026-11-14");
    expect(formatDuration(days[0].worked)).toBe("12h 02m");
    expect(days[0].breakMinutes).toBe(54);
    expect(days[0].stillIn).toBe(false);
    expect(Math.round(days[0].ot * 100) / 100).toBe(4.03);
  });
  it("knows someone is still clocked in", () => {
    const { days } = computeAttendance({ punches: [p("in", "10:22")], staff, settings });
    expect(days[0].stillIn).toBe(true);
    expect(days[0].worked).toBe(0);
  });
});
