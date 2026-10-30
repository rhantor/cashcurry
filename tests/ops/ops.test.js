import { describe, expect, it } from "vitest";
import { alsoAway, onShift, owedBy, shiftSummary, shiftText } from "@/lib/ops/model";
import { awayByStaff, dutyGaps, dutyRows } from "@/lib/tasks/model";

// 2026-10-30 is a Friday (5)
const DATE = "2026-10-30";
const at = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return { seconds: Math.floor(new Date(2026, 9, 30, h, m).getTime() / 1000) };
};
const punch = (staffId, type, hhmm) => ({ staffId, type, timestamp: at(hhmm), date: DATE });

const staff = [
  { id: "ali", firstName: "Ali", lastName: "Hassan", daysOff: [5] }, // Fridays off
  { id: "sam", firstName: "Sam", shiftStart: "09:00", shiftEnd: "17:00" },
  { id: "siti", firstName: "Siti", shiftStart: "14:00", shiftEnd: "22:00" },
  { id: "kumar", firstName: "Kumar", shiftStart: "08:00", shiftEnd: "16:00" },
  { id: "lee", firstName: "Lee" }, // no shift
  { id: "owner", firstName: "Owner", fixedSalaryNoAttendance: true },
  { id: "mei", firstName: "Mei" },
];
const leaves = [{ staffId: "mei", from: "2026-10-29", to: "2026-10-31", status: "approved" }];

describe("who is in today", () => {
  const away = awayByStaff({ staff, leaves });
  const shifts = { shiftsEnabled: true };
  const { rows, counts, expected } = onShift({
    staff,
    punches: [punch("sam", "in", "09:12"), punch("kumar", "in", "07:58"), punch("kumar", "out", "10:00")],
    away,
    date: DATE,
    now: new Date(2026, 9, 30, 10, 30),
    settings: shifts,
  });
  const of = (id) => rows.find((r) => r.id === id);

  it("in (late when after their shift), gone home, off, due later, not in", () => {
    expect(of("sam")).toMatchObject({ state: "in", since: "09:12", lateMin: 12 });
    expect(of("kumar")).toMatchObject({ state: "out", at: "10:00" });
    expect(of("ali")).toMatchObject({ state: "off", reason: "Day off" });
    expect(of("mei")).toMatchObject({ state: "off", reason: "On leave" });
    expect(of("siti")).toMatchObject({ state: "due", shiftStart: "14:00" });
    expect(of("lee").state).toBe("notIn");
    expect(of("owner")).toBeUndefined(); // no attendance
    expect(counts).toEqual({ in: 1, out: 1, off: 2, late: 0, due: 1, notIn: 1 });
    expect(expected).toBe(4);
  });

  it("someone not in after their shift began is late, and comes first", () => {
    const r = onShift({ staff, punches: [], away, date: DATE, now: new Date(2026, 9, 30, 9, 5), settings: shifts });
    expect(r.rows[0].state).toBe("late");
    expect(r.rows.filter((x) => x.state === "late").map((x) => x.id)).toEqual(["kumar", "sam"]);
    expect(shiftText(r.rows[0])).toBe("Not in · due 08:00");
  });

  it("without shifts at the branch, nobody is late — just not in yet", () => {
    const r = onShift({ staff, punches: [], away, date: DATE, now: new Date(2026, 9, 30, 23, 0), settings: {} });
    expect(r.counts.late).toBe(0);
    expect(r.counts.notIn).toBe(4); // Sam, Siti, Kumar, Lee (Ali and Mei are off)
  });

  it("the lines people read", () => {
    expect(shiftText(of("sam"))).toBe("In since 09:12 · 12 min late");
    expect(shiftText(of("kumar"))).toBe("Clocked out 10:00");
    expect(shiftText(of("ali"))).toBe("Day off");
    expect(shiftSummary(counts)).toBe("1 in · 2 not in yet · 1 gone home · 2 off");
  });
});

describe("who else is off when leave is asked for", () => {
  const away = awayByStaff({ staff, leaves });
  it("lists the others away on any of the days, not the person asking", () => {
    const r = alsoAway({ from: "2026-10-30", to: "2026-11-01", staffId: "sam" }, staff, away);
    expect(r).toEqual([
      { name: "Mei", days: ["2026-10-30", "2026-10-31"], reason: "On leave" },
      { name: "Ali Hassan", days: ["2026-10-30"], reason: "Day off" },
    ]);
    expect(alsoAway({ from: "2026-10-30", to: "2026-10-30", staffId: "ali" }, staff, away).map((x) => x.name)).toEqual(["Mei"]);
  });
  it("a staff record with no login still counts (by its id)", () => {
    expect(away("ali", "2026-10-30")).toBe("Day off");
    expect(away("ali", "2026-10-31")).toBe(null);
  });
});

describe("what someone already owes", () => {
  const advances = [
    { staffId: "sam", status: "approved", advanceType: "salary", amount: 300, remainingAmount: 100 },
    { staffId: "sam", status: "approved", advanceType: "personal", amount: 50 }, // older record: no trail
    { staffId: "sam", status: "approved", advanceType: "salary", amount: 80, paidOut: null }, // not handed over yet
    { staffId: "sam", status: "approved", advanceType: "annual", amount: 0 }, // old leave in advances
    { staffId: "sam", status: "closed", advanceType: "salary", amount: 200, remainingAmount: 0 },
    { staffId: "ali", status: "approved", advanceType: "salary", amount: 999 },
  ];
  const loans = [
    { staffId: "sam", status: "approved", amount: 600, remainingAmount: 400, paidOut: { date: "2026-10-01" } },
    { staffId: "sam", status: "closed", amount: 500, remainingAmount: 0 },
    { staffId: "sam", status: "approved", amount: 900, remainingAmount: 900, paidOut: null },
  ];
  it("advances and loans handed over and not paid back", () => {
    expect(owedBy("sam", { advances, loans })).toEqual({ advance: 150, loan: 400, total: 550 });
    expect(owedBy("kumar", { advances, loans }).total).toBe(0);
    expect(owedBy(null, { advances, loans }).total).toBe(0);
  });
});

describe("who does what today (shared by Tasks and Ops)", () => {
  const sup = { uid: "sup", name: "Sup" };
  const t = (id, extra) => ({ id, title: id, repeat: { every: "day" }, startDate: "2026-10-01", assignee: sup, assigneeUid: "sup", teamLeadUid: "sup", creatorUid: "gm", ...extra });
  const tasks = [
    t("fridge", { assignee: { uid: "ali", name: "Ali" }, assigneeUid: "ali" }),
    t("opening"),
    t("stopped", { active: false }),
    { id: "oneoff", title: "One-off", dueDate: DATE, assigneeUid: "sup" },
  ];
  const away = (uid, date) => (uid === "ali" && date === DATE ? "Day off" : null);
  it("repeating tasks only, those waiting for someone first, done last", () => {
    const rows = dutyRows(tasks, {}, DATE, away);
    expect(rows.map((r) => r.task.id)).toEqual(["fridge", "opening"]);
    expect(rows[0].duty).toMatchObject({ via: "lead", uid: "sup" });
    expect(dutyGaps(rows)).toBe(1);
    const done = dutyRows(tasks, { "fridge_2026-10-30": true }, DATE, away);
    expect(done.map((r) => r.task.id)).toEqual(["opening", "fridge"]);
    expect(dutyGaps(done)).toBe(0);
  });
});
