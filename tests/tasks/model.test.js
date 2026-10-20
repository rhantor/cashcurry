import { describe, expect, it } from "vitest";
import { addDays, agenda, canManageTasks, todayCount, checkId, checkTask, dayList, monthOf, occursOn, performance, repeatText } from "@/lib/tasks/model";

const ali = { uid: "ali", name: "Ali" };
const daily = { id: "fryer", title: "Clean the fryer", assigneeUid: "ali", assignee: ali, repeat: { every: "day" }, startDate: "2026-10-01", active: true };
const mondays = { id: "stock", title: "Count stock", assigneeUid: "ali", assignee: ali, repeat: { every: "week", days: [1] }, startDate: "2026-10-01", active: true };
const monthly = { id: "gas", title: "Check gas licence", assigneeUid: "ali", repeat: { every: "month", day: 31 }, startDate: "2026-01-01", active: true };
const once = { id: "o1", title: "Fix the sign", assigneeUid: "ali", repeat: null, dueDate: "2026-10-10", status: "open" };

describe("when a repeating task falls", () => {
  it("every day, from its start, not after it was stopped", () => {
    expect(occursOn(daily, "2026-09-30")).toBe(false);
    expect(occursOn(daily, "2026-10-01")).toBe(true);
    expect(occursOn({ ...daily, stoppedOn: "2026-10-15" }, "2026-10-15")).toBe(false);
    expect(occursOn({ ...daily, active: false }, "2026-10-05")).toBe(false);
  });
  it("on chosen weekdays (Sunday = 0)", () => {
    expect(occursOn(mondays, "2026-10-19")).toBe(true); // a Monday
    expect(occursOn(mondays, "2026-10-20")).toBe(false);
  });
  it("monthly on the 31st falls on the last day of short months", () => {
    expect(occursOn(monthly, "2026-10-31")).toBe(true);
    expect(occursOn(monthly, "2026-11-30")).toBe(true);
    expect(occursOn(monthly, "2026-02-28")).toBe(true);
    expect(occursOn(monthly, "2026-11-29")).toBe(false);
  });
  it("says how often in words", () => {
    expect(repeatText(daily)).toBe("Every day");
    expect(repeatText(mondays)).toBe("Every Mon");
    expect(repeatText({ repeat: { every: "week", days: [1, 2, 3, 4, 5] } })).toBe("Weekdays");
    expect(repeatText({ repeat: { every: "month", day: 1 } })).toBe("Every month on the 1st");
    expect(repeatText({ repeat: { every: "month", day: 22 } })).toBe("Every month on the 22nd");
    expect(repeatText(once)).toBe("By 2026-10-10");
  });
});

describe("a day's list", () => {
  it("today: the day's checklist, open one-offs (overdue first), and what was done", () => {
    const checks = { [checkId("fryer", "2026-10-19")]: { doneOn: "2026-10-19" } };
    const list = dayList([daily, mondays, once], checks, "2026-10-19", "2026-10-19");
    expect(list.map((x) => [x.task.id, x.done, x.overdue])).toEqual([
      ["o1", false, true],
      ["stock", false, false],
      ["fryer", true, false],
    ]);
  });
  it("another day: that day's checklist, and one-offs due that day only", () => {
    const list = dayList([daily, once], {}, "2026-10-10", "2026-10-19");
    expect(list.map((x) => x.task.id)).toEqual(["o1", "fryer"]); // the one-off is overdue by now
    expect(dayList([daily, once], {}, "2026-10-11", "2026-10-19").map((x) => x.task.id)).toEqual(["fryer"]);
  });
});

describe("performance", () => {
  it("counts each day of a checklist: on time, late (half), missed; today still open", () => {
    const checks = {
      [checkId("fryer", "2026-10-01")]: { doneOn: "2026-10-01" },
      [checkId("fryer", "2026-10-02")]: { doneOn: "2026-10-03" }, // ticked the day after
    };
    const p = performance([daily], checks, "ali", { from: "2026-10-01", to: "2026-10-31", today: "2026-10-04" });
    expect(p).toMatchObject({ given: 4, onTime: 1, late: 1, missed: 1, open: 1, score: 50 });
    // and which ones: the day, the result, when it was done
    expect(p.items.map((x) => [x.date, x.result, x.doneOn])).toEqual([
      ["2026-10-01", "onTime", "2026-10-01"],
      ["2026-10-02", "late", "2026-10-03"],
      ["2026-10-03", "missed", null],
      ["2026-10-04", "open", null],
    ]);
  });
  it("one-offs: on time by the due date, late after, missed when overdue", () => {
    const tasks = [
      { ...once, id: "a", status: "done", done: { date: "2026-10-09" } },
      { ...once, id: "b", status: "done", done: { date: "2026-10-12" } },
      { ...once, id: "c" },
      { ...once, id: "d", dueDate: "2026-10-25" },
    ];
    expect(performance(tasks, {}, "ali", { from: "2026-10-01", to: "2026-10-31", today: "2026-10-20" })).toMatchObject({ given: 4, onTime: 1, late: 1, missed: 1, open: 1, score: 50 });
  });
  it("only that person's, and nothing due yet means no score", () => {
    expect(performance([daily], {}, "siti", { from: "2026-10-01", to: "2026-10-31", today: "2026-10-20" }).given).toBe(0);
    expect(performance([daily], {}, "ali", { from: "2026-11-01", to: "2026-11-30", today: "2026-10-20" }).score).toBeNull();
  });
});

describe("the rest", () => {
  it("who gives tasks", () => {
    for (const r of ["owner", "gm", "branchAdmin", "manager", "inCharge"]) expect(canManageTasks(r)).toBe(true);
    for (const r of ["accountant", "supervisor", "cashier", "staff"]) expect(canManageTasks(r)).toBe(false);
  });
  it("dates and months", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(monthOf("2026-02-14")).toEqual({ month: "2026-02", from: "2026-02-01", to: "2026-02-28" });
  });
  it("what a task needs before saving", () => {
    expect(checkTask({ title: " ", repeat: { every: "week", days: [] } })).toEqual({ title: "What needs doing?", assignee: "Who does it?", repeat: "Pick at least one day" });
    expect(checkTask({ title: "Mop", assignee: ali, repeat: null })).toEqual({});
  });
});

describe("the to-do list", () => {
  const today = "2026-10-20"; // a Tuesday
  const tasks = [
    { ...daily, startDate: "2026-10-15" },
    { ...mondays, startDate: "2026-10-01" },
    { ...once, id: "late1", dueDate: "2026-10-18" },
    { ...once, id: "now", title: "Today's one", dueDate: today },
    { ...once, id: "tmr", title: "Tomorrow's one", dueDate: "2026-10-21" },
    { ...once, id: "wk", title: "This week", dueDate: "2026-10-24" },
    { ...once, id: "far", title: "Far off", dueDate: "2026-11-30" },
    { ...once, id: "any", title: "Whenever", dueDate: null },
  ];
  const checks = { [checkId("fryer", "2026-10-15")]: { doneOn: "2026-10-15" }, [checkId("fryer", today)]: { doneOn: today } };
  const a = agenda(tasks, checks, today);
  it("late: missed days of the last week and overdue one-offs, oldest first", () => {
    expect(a.late.map((x) => [x.task.id, x.date])).toEqual([
      ["fryer", "2026-10-16"],
      ["fryer", "2026-10-17"],
      ["fryer", "2026-10-18"],
      ["late1", "2026-10-18"],
      ["fryer", "2026-10-19"],
      ["stock", "2026-10-19"],
    ]);
    expect(a.late.every((x) => x.canTick)).toBe(true);
  });
  it("today: the checklist (done last) and what is due today", () => {
    expect(a.today.map((x) => [x.task.id, x.done])).toEqual([["now", false], ["fryer", true]]);
  });
  it("tomorrow, this week (the next Monday), later and anytime", () => {
    expect(a.tomorrow.map((x) => x.task.id)).toEqual(["fryer", "tmr"]);
    expect(a.tomorrow.find((x) => x.task.id === "fryer").canTick).toBe(false); // not yet
    expect(a.tomorrow.find((x) => x.task.id === "tmr").canTick).toBe(true); // a one-off can be done early
    expect(a.week.map((x) => [x.task.id, x.date])).toEqual([["wk", "2026-10-24"], ["stock", "2026-10-26"]]);
    expect(a.later.map((x) => x.task.id)).toEqual(["far"]);
    expect(a.anytime.map((x) => x.task.id)).toEqual(["any"]);
  });
  it("today at a glance", () => {
    expect(todayCount(tasks, checks, today)).toEqual({ total: 2, done: 1, late: 6 });
  });
});
