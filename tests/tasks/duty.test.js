import { describe, expect, it } from "vitest";
import { agenda, awayFrom, dayList, doersOf, dutyOn, freshCovers, performance, todayCount, weekdayOf } from "@/lib/tasks/model";

// 2026-10-30 is a Friday (5); 31st Saturday (6); 1 Nov Sunday (0)
const sup = { uid: "sup", name: "Rahim (supervisor)", role: "supervisor" };
const ali = { uid: "ali", name: "Ali", role: "staff" };
const sam = { uid: "sam", name: "Sam", role: "staff" };
const gm = { uid: "gm", name: "GM", role: "gm" };

const opening = (extra = {}) => ({
  id: "open",
  title: "Opening check",
  repeat: { every: "day" },
  startDate: "2026-10-01",
  assignee: sup,
  assigneeUid: sup.uid,
  teamLeadUid: sup.uid,
  creatorUid: gm.uid,
  ...extra,
});

const staff = [
  { id: "s-ali", uid: "ali", daysOff: [5] }, // Fridays off
  { id: "s-sam", uid: "sam", daysOff: [2] },
  { id: "s-sup", officeUid: "sup", daysOff: [] },
];

describe("who is away", () => {
  const away = awayFrom({
    staff,
    leaves: [
      { staffId: "s-sam", from: "2026-11-03", to: "2026-11-04", status: "approved" },
      { staffId: "s-sam", from: "2026-11-06", status: "pending" },
      { staffId: "s-ali", from: "2026-11-02", halfDay: true, status: "approved" },
      { staffId: "s-sup", from: "2026-11-05", to: "2026-11-05", status: "approved" },
    ],
  });
  it("weekly days off and approved leave; a half day or a request still waiting isn't", () => {
    expect(weekdayOf("2026-10-30")).toBe(5);
    expect(away("ali", "2026-10-30")).toBe("Day off");
    expect(away("ali", "2026-10-31")).toBe(null);
    expect(away("ali", "2026-11-02")).toBe(null);
    expect(away("sam", "2026-11-03")).toBe("On leave");
    expect(away("sam", "2026-11-04")).toBe("On leave");
    expect(away("sam", "2026-11-06")).toBe(null);
    expect(away("sup", "2026-11-05")).toBe("On leave"); // an office login linked to the record
    expect(away("nobody", "2026-11-05")).toBe(null);
  });
});

describe("who does the task on a day", () => {
  const away = awayFrom({ staff });
  const rota = { 1: ali, 2: ali, 3: ali, 4: ali, 5: ali, 6: ali, 0: sam };
  it("the rota's person for the weekday; a weekday with no one is the assignee's", () => {
    expect(dutyOn(opening({ rota }), "2026-10-31", away)).toMatchObject({ uid: "ali", via: "rota" });
    expect(dutyOn(opening({ rota: { 6: ali } }), "2026-11-02", away)).toMatchObject({ uid: "sup", via: "assignee" });
  });
  it("someone off: the day sits with the supervisor, saying who is away and why", () => {
    const d = dutyOn(opening({ rota }), "2026-10-30", away); // Friday, Ali's day off
    expect(d).toMatchObject({ uid: "sup", via: "lead", away: { uid: "ali", name: "Ali", reason: "Day off" } });
  });
  it("a cover for the day wins, even over a day off", () => {
    const t = opening({ rota, covers: { "2026-10-30": sam } });
    expect(dutyOn(t, "2026-10-30", away)).toMatchObject({ uid: "sam", via: "cover" });
  });
  it("the supervisor away too: whoever gave it holds the day", () => {
    const t = opening({ teamLeadUid: null });
    const supOff = awayFrom({ staff: [{ id: "s", officeUid: "sup", daysOff: [5] }] });
    expect(dutyOn(t, "2026-10-30", supOff)).toMatchObject({ uid: "gm", via: "lead", away: { uid: "sup" } });
  });
  it("given straight to someone with no supervisor: the day goes back to whoever gave it", () => {
    const t = opening({ assignee: ali, assigneeUid: "ali", teamLeadUid: null });
    expect(dutyOn(t, "2026-10-30", away)).toMatchObject({ uid: "gm", via: "lead" });
  });
  it("doers: everyone it can fall to; old covers drop off after a week", () => {
    const t = opening({ rota, covers: { "2026-10-30": sam } });
    expect(doersOf(t).sort()).toEqual(["ali", "sam", "sup"]);
    expect(Object.keys(freshCovers({ "2026-10-01": sam, "2026-10-29": ali, "2026-11-02": sam }, "2026-10-30"))).toEqual(["2026-10-29", "2026-11-02"]);
  });
});

describe("lists and scores follow the duty", () => {
  const away = awayFrom({ staff });
  const rota = { 0: sam, 1: ali, 2: ali, 3: ali, 4: ali, 5: ali, 6: ali };
  const t = opening({ rota });
  const today = "2026-10-30"; // Friday: Ali off
  it("Ali's list has no Friday; the supervisor's does, marked as needing someone", () => {
    expect(agenda([t], {}, today, { uid: "ali", away }).today).toHaveLength(0);
    expect(agenda([t], {}, today, { uid: "ali", away }).tomorrow).toHaveLength(1);
    const supToday = agenda([t], {}, today, { uid: "sup", away }).today;
    expect(supToday).toHaveLength(1);
    expect(supToday[0].duty).toMatchObject({ via: "lead", away: { uid: "ali" } });
    expect(dayList([t], {}, "2026-11-01", today, { uid: "sam", away })).toHaveLength(1); // Sunday is Sam's
  });
  it("a day already ticked by anyone isn't late for anyone", () => {
    const checks = { "open_2026-10-29": { doerUid: "ali", doneOn: "2026-10-29" } };
    expect(agenda([t], checks, today, { uid: "ali", away }).late.map((x) => x.date)).not.toContain("2026-10-29");
  });
  it("Ali's day off is never missed for him; it counts for the supervisor holding it", () => {
    const from = "2026-10-26"; // Mon … Fri
    const checks = {
      "open_2026-10-26": { doerUid: "ali", doneOn: "2026-10-26" },
      "open_2026-10-27": { doerUid: "ali", doneOn: "2026-10-27" },
      "open_2026-10-28": { doerUid: "ali", doneOn: "2026-10-29" },
    };
    const p = performance([t], checks, "ali", { from, to: today, today, away });
    expect(p).toMatchObject({ onTime: 2, late: 1, missed: 1, open: 0 }); // Thursday missed; Friday not his
    const s = performance([t], checks, "sup", { from, to: today, today, away });
    expect(s).toMatchObject({ given: 1, open: 1, missed: 0 }); // Friday, still open today
  });
  it("older ticks (no doerUid) still count for the assignee, as before", () => {
    const plain = opening({ assignee: ali, assigneeUid: "ali", teamLeadUid: "sup" });
    const p = performance([plain], { "open_2026-10-30": { assigneeUid: "ali", doneOn: "2026-10-30" } }, "ali", { from: today, to: today, today, away });
    expect(p.onTime).toBe(1);
  });
  it("a one-off stays with its assignee only", () => {
    const once = { id: "x", title: "Fix tap", repeat: null, status: "open", assigneeUid: "ali", assignee: ali, teamLeadUid: "sup" };
    expect(agenda([once], {}, today, { uid: "sup", away }).anytime).toHaveLength(0);
    expect(agenda([once], {}, today, { uid: "ali", away }).anytime).toHaveLength(1);
    expect(todayCount([t, once], {}, today, { uid: "sup", away })).toMatchObject({ total: 1 });
  });
  it("without a uid the lists are as before (every task given)", () => {
    expect(agenda([t], {}, today).today).toHaveLength(1);
  });
});

describe("a rota or a day off counts from when it is set, not backwards", () => {
  it("days before rotaSince stay the assignee's", () => {
    const t = opening({ rota: { 4: ali, 5: ali }, rotaSince: "2026-10-30" });
    expect(dutyOn(t, "2026-10-29")).toMatchObject({ uid: "sup", via: "assignee" }); // Thursday, before the rota
    expect(dutyOn(t, "2026-10-30")).toMatchObject({ uid: "ali", via: "rota" });
    const list = agenda([t], {}, "2026-10-30", { uid: "ali" });
    expect(list.late).toHaveLength(0); // last Thursday was never Ali's
  });
  it("a weekly day off set today doesn't move last week's day", () => {
    const away = awayFrom({ staff: [{ id: "s", uid: "ali", daysOff: [5], daysOffSince: "2026-10-30" }] });
    expect(away("ali", "2026-10-23")).toBe(null);
    expect(away("ali", "2026-10-30")).toBe("Day off");
  });
});
