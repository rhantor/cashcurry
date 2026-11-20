import { describe, expect, it } from "vitest";
import { addSpeed, cleanSpeed, emptySpeed, isSlow, speedSummary, timeToReload } from "@/lib/attendance/kioskSpeed";

describe("kiosk speed tally", () => {
  it("adds up a day's looks, reads and answers, and starts over on a new day", () => {
    let t = emptySpeed("2026-11-20");
    for (const ms of [100, 300]) t = addSpeed(t, "look", ms, "2026-11-20");
    t = addSpeed(t, "read", 800, "2026-11-20");
    t = addSpeed(t, "answer", 400, "2026-11-20");
    t = addSpeed(t, "answer", 1600, "2026-11-20");
    expect(speedSummary(t, { upHours: 49.26 })).toEqual({ date: "2026-11-20", lookMs: 200, readMs: 800, answerMs: 1000, answerMax: 1600, reads: 1, upHours: 49.3 });
    const next = addSpeed(t, "read", 500, "2026-11-21");
    expect(speedSummary(next)).toMatchObject({ date: "2026-11-21", readMs: 500, answerMs: null, reads: 1 });
    expect(addSpeed(t, "nonsense", 5, "2026-11-20")).toBe(t);
  });
  it("keeps only clean numbers from a tablet", () => {
    expect(cleanSpeed({ date: "2026-11-20", lookMs: 120, readMs: "900", answerMs: -1, answerMax: "x", reads: 4, upHours: 50, extra: "no" })).toEqual({ date: "2026-11-20", lookMs: 120, readMs: 900, answerMs: null, answerMax: null, reads: 4, upHours: 50 });
    expect(cleanSpeed({ date: "yesterday" })).toBeNull();
    expect(cleanSpeed(null)).toBeNull();
  });
  it("calls it slow at 1.5 s on average", () => {
    expect(isSlow({ readMs: 1600 })).toBe(true);
    expect(isSlow({ readMs: 300, answerMs: 700 })).toBe(false);
  });
  it("reloads once the business day turns, only when idle, online, nothing waiting, and open a while", () => {
    const base = { openedDay: "2026-11-19", today: "2026-11-20", busy: false, online: true, waiting: 0, openMs: 3 * 3600e3 };
    expect(timeToReload(base)).toBe(true);
    expect(timeToReload({ ...base, today: "2026-11-19" })).toBe(false);
    expect(timeToReload({ ...base, busy: true })).toBe(false);
    expect(timeToReload({ ...base, online: false })).toBe(false);
    expect(timeToReload({ ...base, waiting: 2 })).toBe(false);
    expect(timeToReload({ ...base, openMs: 10 * 60000 })).toBe(false);
  });
});
