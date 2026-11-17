// The staff app's attendance rules (17 Nov 2026): staff can't read the branch's
// settings document, so the server hands out just the attendance part.
// Without the day cut-off an overnight clock-out landed on the next day.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { attendanceSettingsOf, mayReadAttendanceRules } from "@/lib/attendance/staffSettings";
import { computeAttendance } from "@/lib/attendance/computeHours";
import { isCompanyRole } from "@/lib/authz/permissions";

const state = { users: {}, settings: null };

vi.mock("@/lib/server/firebaseAdmin", () => {
  const node = (path) => ({
    collection: (c) => ({ doc: (d) => node([...path, c, d]) }),
    get: async () => {
      if (path[0] === "users") return { exists: !!state.users[path[1]], data: () => state.users[path[1]] };
      return { exists: !!state.settings, data: () => state.settings };
    },
  });
  return { adminDb: { collection: (c) => ({ doc: (d) => node([c, d]) }) }, adminAuth: { verifyIdToken: async (t) => { if (t === "bad") throw new Error("x"); return { uid: t }; } } };
});

const { GET } = await import("@/app/api/attendance/settings/route.js");
const ask = (uid, companyId = "co", branchId = "kl") =>
  GET(new Request(`http://x/api/attendance/settings?companyId=${companyId}&branchId=${branchId}`, uid ? { headers: { authorization: `Bearer ${uid}` } } : {}));

const SETTINGS = {
  basic: { timeZone: "Asia/Kuala_Lumpur" },
  attendance: { dayCutoffTime: "05:00", shiftsEnabled: true, shifts: [{ id: "s1", name: "Night", start: "14:00", end: "02:00", breakMinutes: 0 }] },
  financeSales: { openingCash: 5000, tenders: ["cash"] },
};

beforeEach(() => {
  state.users = {
    amir: { companyId: "co", branchId: "kl", role: "staff" },
    elsewhere: { companyId: "co", branchId: "pj", role: "staff" },
    gm: { companyId: "co", branchId: "", role: "gm" },
    stranger: { companyId: "other", branchId: "kl", role: "owner" },
    left: { companyId: "co", branchId: "kl", role: "staff", disabled: true },
  };
  state.settings = SETTINGS;
});

describe("attendanceSettingsOf", () => {
  it("keeps only the attendance part and the branch's time zone", () => {
    const out = attendanceSettingsOf(SETTINGS);
    expect(out).toEqual({ ...SETTINGS.attendance, timeZone: "Asia/Kuala_Lumpur" });
    expect(out.financeSales).toBeUndefined();
  });
  it("no zone set, or a broken one: null, so the phone keeps its own clock", () => {
    expect(attendanceSettingsOf({ attendance: { dayCutoffTime: "05:00" } }).timeZone).toBeNull();
    expect(attendanceSettingsOf({ basic: { timeZone: "Mars/Base" } }).timeZone).toBeNull();
    expect(attendanceSettingsOf(undefined)).toEqual({ timeZone: null });
  });
});

describe("who may read the rules", () => {
  it("anyone at the branch, staff included; company-wide roles anywhere", () => {
    expect(mayReadAttendanceRules(state.users.amir, "co", "kl", isCompanyRole)).toBe(true);
    expect(mayReadAttendanceRules(state.users.gm, "co", "kl", isCompanyRole)).toBe(true);
  });
  it("not another branch's staff, another company, or a switched-off login", () => {
    expect(mayReadAttendanceRules(state.users.elsewhere, "co", "kl", isCompanyRole)).toBe(false);
    expect(mayReadAttendanceRules(state.users.stranger, "co", "kl", isCompanyRole)).toBe(false);
    expect(mayReadAttendanceRules(state.users.left, "co", "kl", isCompanyRole)).toBe(false);
    expect(mayReadAttendanceRules(null, "co", "kl", isCompanyRole)).toBe(false);
  });
});

describe("GET /api/attendance/settings", () => {
  it("gives a staff member their branch's rules, without the money settings", async () => {
    const res = await ask("amir");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.dayCutoffTime).toBe("05:00");
    expect(body.timeZone).toBe("Asia/Kuala_Lumpur");
    expect(JSON.stringify(body)).not.toContain("openingCash");
  });
  it("refuses without a sign-in, with a bad one, and for another branch", async () => {
    expect((await ask(null)).status).toBe(401);
    expect((await ask("bad")).status).toBe(401);
    expect((await ask("elsewhere")).status).toBe(403);
    expect((await ask("stranger")).status).toBe(403);
    expect((await ask("amir", "co", "../x")).status).toBe(400);
  });
  it("a branch with no settings yet: empty rules, not an error", async () => {
    state.settings = null;
    expect(await (await ask("amir")).json()).toEqual({ timeZone: null });
  });
});

describe("an overnight shift on the staff app (the bug)", () => {
  const ts = (iso) => ({ seconds: Math.floor(new Date(iso).getTime() / 1000) });
  const punches = [
    { staffId: "s", type: "in", date: "2026-11-16", timestamp: ts("2026-11-16T15:10:00+08:00") },
    { staffId: "s", type: "out", date: "2026-11-16", timestamp: ts("2026-11-17T01:50:00+08:00") },
  ];
  const staff = { id: "s", basicHoursPerDay: "12" };
  it("with the rules from the server, in and out land on the same day", () => {
    const { days } = computeAttendance({ punches, staff, settings: attendanceSettingsOf(SETTINGS), otApprovals: {} });
    expect(days.map((d) => d.date)).toEqual(["2026-11-16"]);
    expect(days[0].pairs).toEqual([{ in: "15:10", out: "01:50" }]);
    expect(days[0].basic + days[0].ot).toBeGreaterThan(10);
  });
  it("without them (what staff got before) the out fell on the next day", () => {
    const { days } = computeAttendance({ punches, staff, settings: { timeZone: "Asia/Kuala_Lumpur" }, otApprovals: {} });
    expect(days.map((d) => d.date)).toEqual(["2026-11-16", "2026-11-17"]);
  });
});
