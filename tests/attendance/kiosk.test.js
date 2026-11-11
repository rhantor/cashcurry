import { describe, expect, it } from "vitest";
import {
  OPEN_PUNCH_HOURS, PIN_TRIES, afterWrongPin, cleanPunch, kioskStaff, lastPunchBefore, minutesBeforeShift,
  minutesToWait, nextPunchType, photoFrom, pinLocked, punchDate, punchMoment,
} from "@/lib/attendance/kiosk";

const KL = { timeZone: "Asia/Kuala_Lumpur", cutoff: "00:00" };
const at = (iso) => new Date(iso);
const punch = (type, iso) => ({ type, timestamp: { seconds: Math.floor(at(iso).getTime() / 1000) } });

describe("in or out", () => {
  it("starts with in, then out, then in again", () => {
    expect(nextPunchType(null)).toBe("in");
    const now = at("2026-11-11T05:00:00Z");
    expect(nextPunchType(punch("in", "2026-11-11T01:00:00Z"), now)).toBe("out");
    expect(nextPunchType(punch("out", "2026-11-11T04:00:00Z"), now)).toBe("in");
  });
  it("treats a forgotten clock-out from yesterday as over: the next punch is an in", () => {
    const now = at("2026-11-11T01:00:00Z");
    const old = punch("in", new Date(now.getTime() - (OPEN_PUNCH_HOURS + 1) * 3600000).toISOString());
    expect(nextPunchType(old, now)).toBe("in");
  });
  it("takes the latest punch before the moment, in any order", () => {
    const list = [punch("in", "2026-11-11T01:00:00Z"), punch("out", "2026-11-11T09:00:00Z"), punch("in", "2026-11-11T03:00:00Z")];
    expect(lastPunchBefore(list, at("2026-11-11T05:00:00Z")).timestamp.seconds).toBe(list[2].timestamp.seconds);
    expect(lastPunchBefore(list, at("2026-11-11T10:00:00Z")).type).toBe("out");
    expect(lastPunchBefore([], at("2026-11-11T10:00:00Z"))).toBeNull();
  });
  it("stops a second tap within the branch's duplicate interval", () => {
    const last = punch("in", "2026-11-11T01:00:00Z");
    expect(minutesToWait(last, at("2026-11-11T01:02:00Z"), 5)).toBe(3);
    expect(minutesToWait(last, at("2026-11-11T01:06:00Z"), 5)).toBe(0);
    expect(minutesToWait(last, at("2026-11-11T01:00:30Z"), 0)).toBe(0);
  });
});

describe("the day and the time", () => {
  it("files a punch under the branch's day, not the server's", () => {
    // 07:30 in Kuala Lumpur is 23:30 the day before in UTC
    expect(punchDate(at("2026-11-10T23:30:00Z"), KL)).toBe("2026-11-11");
    // a 02:00 clock-out on a late shift belongs to the day before with a 05:00 cut-off
    expect(punchDate(at("2026-11-11T18:00:00Z"), { ...KL, cutoff: "05:00" })).toBe("2026-11-11");
  });
  it("uses the tablet's time for a punch kept offline, only if believable", () => {
    const now = at("2026-11-11T10:00:00Z");
    expect(punchMoment({ offline: false, clientAt: "2026-11-11T08:00:00Z" }, now)).toEqual({ at: now, offline: false, doubtful: false });
    expect(punchMoment({ offline: true, clientAt: "2026-11-11T08:00:00Z" }, now).at.toISOString()).toBe("2026-11-11T08:00:00.000Z");
    const future = punchMoment({ offline: true, clientAt: "2026-11-12T08:00:00Z" }, now);
    expect(future.doubtful).toBe(true);
    expect(future.at).toBe(now);
    expect(punchMoment({ offline: true, clientAt: "2026-11-05T08:00:00Z" }, now).doubtful).toBe(true);
  });
  it("measures an early clock-in against the shift on the branch's clock", () => {
    // shift 10:00; in at 09:15 KL time (01:15 UTC) → 45 minutes early
    expect(minutesBeforeShift(at("2026-11-11T01:15:00Z"), { start: "10:00" }, KL)).toBe(45);
    expect(minutesBeforeShift(at("2026-11-11T02:10:00Z"), { start: "10:00" }, KL)).toBe(-10);
    // night shift 22:00 with a 05:00 cut-off; in at 21:00 → 60 early; at 00:30 → late, not 21 h early
    const night = { ...KL, cutoff: "05:00" };
    expect(minutesBeforeShift(at("2026-11-11T13:00:00Z"), { start: "22:00" }, night)).toBe(60);
    expect(minutesBeforeShift(at("2026-11-11T16:30:00Z"), { start: "22:00" }, night)).toBe(-150);
    expect(minutesBeforeShift(at("2026-11-11T01:00:00Z"), null, KL)).toBeNull();
  });
});

describe("PINs", () => {
  it("locks a person out on the tablet after too many wrong PINs, for a while", () => {
    let fails = null;
    const now = 1_000_000;
    for (let i = 1; i < PIN_TRIES; i++) {
      const r = afterWrongPin(fails, now);
      fails = r.fails;
      expect(r.left).toBe(PIN_TRIES - i);
      expect(pinLocked(fails, now)).toBe(false);
    }
    const last = afterWrongPin(fails, now);
    expect(last.left).toBe(0);
    expect(pinLocked(last.fails, now + 60000)).toBe(true);
    expect(pinLocked(last.fails, now + 6 * 60000)).toBe(false);
    // after the lock runs out, counting starts again
    expect(afterWrongPin(last.fails, now + 6 * 60000).left).toBe(PIN_TRIES - 1);
  });
  it("never tells the tablet anyone's PIN", () => {
    const s = kioskStaff({ id: "a", firstName: "Ali", pinCode: "1234", biometric: { credentialId: "c1" } }, { last: punch("in", "2026-11-11T01:00:00Z"), now: at("2026-11-11T02:00:00Z") });
    expect(JSON.stringify(s)).not.toContain("1234");
    expect(s).toMatchObject({ hasPin: true, in: true, credentialId: null });
    expect(kioskStaff({ id: "b", pinCode: "" }, { biometrics: true }).hasPin).toBe(false);
  });
});

describe("what the tablet sends", () => {
  it("is checked before anything is done with it", () => {
    expect(cleanPunch({ id: "x", staffId: "a", pin: "1234" }).error).toBeTruthy();
    expect(cleanPunch({ id: "abcdefgh12", staffId: "a/b", pin: "1234" }).error).toBeTruthy();
    expect(cleanPunch({ id: "abcdefgh12", staffId: "a", pin: "12" }).error).toBeTruthy();
    expect(cleanPunch({ id: "abcdefgh12", staffId: "a", method: "biometric" })).toMatchObject({ method: "biometric", pin: "" });
    expect(cleanPunch({ id: "abcdefgh12", staffId: "a", pin: "1234", offline: 1, at: "x" })).toMatchObject({ offline: true, clientAt: "x", check: false });
  });
  it("keeps only a small photo", () => {
    const tiny = `data:image/jpeg;base64,${Buffer.from("jpeg bytes").toString("base64")}`;
    expect(photoFrom(tiny).contentType).toBe("image/jpeg");
    expect(photoFrom("data:text/html;base64,PGI+")).toBeNull();
    expect(photoFrom(`data:image/jpeg;base64,${Buffer.alloc(300 * 1024).toString("base64")}`)).toBeNull();
    expect(photoFrom(null)).toBeNull();
  });
});
