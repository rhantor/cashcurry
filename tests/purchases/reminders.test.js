import { describe, expect, it } from "vitest";
import { dayLabel, hourLabel, localDay, orderReminderMessage, ordersForReminders, reminderSlots, reminderStatus, reminderText, savedReminder, skipPatch, snoozePatch } from "@/lib/purchases/reminders";

// 2026-11-09 is a Monday; vegetables are ordered every Monday, told Sunday 6 PM.
const guide = (extra = {}, state = {}) => ({ id: "veg", name: "Vegetables", vendorId: "v1", vendorName: "Fresh Farm", reminder: { enabled: true, days: [1], before: 1, at: "18:00", since: "2026-11-01", ...extra }, reminderState: state });
const SUN_6PM = Date.parse("2026-11-08T18:00:00+08:00");
const at = (today, hour, nowMs = SUN_6PM) => ({ today, hour, nowMs, morningHour: 9 });
const placed = (day, extra = {}) => ({ orderGuideId: "veg", vendorId: "v1", status: "Pending", day, ...extra });
// orders in the week before, so the last Monday isn't "missed"
const lastWeek = placed("2026-11-02");

describe("words", () => {
  it("days and hours", () => {
    expect(dayLabel("2026-11-09")).toBe("Monday 9 Nov");
    expect(hourLabel("18:00")).toBe("6 PM");
    expect(hourLabel("00:00")).toBe("12 AM");
    expect(hourLabel("12:00")).toBe("12 PM");
  });
  it("says the schedule", () => {
    expect(reminderText(guide().reminder)).toBe("Every Monday · told the day before at 6 PM");
    expect(reminderText({ days: [4, 1], before: 0, at: "08:00" })).toBe("Every Monday, Thursday · told the same day at 8 AM");
    expect(reminderText({ days: [1, 3, 5], before: 2, at: "09:00" })).toBe("Every Mon, Wed, Fri · told 2 days before at 9 AM");
  });
  it("the message", () => {
    expect(orderReminderMessage(guide(), { orderDay: "2026-11-09" }, { branchName: "KL" })).toEqual({ title: "Order reminder · KL", body: "Vegetables from Fresh Farm: order for Monday 9 Nov." });
  });
  it("reads a branch's own day", () => {
    expect(localDay(new Date("2026-11-08T17:00:00Z"), "Asia/Kuala_Lumpur")).toBe("2026-11-09");
    expect(ordersForReminders([{ createdAt: { seconds: Date.parse("2026-11-08T17:00:00Z") / 1000 }, status: "Sent" }], "Asia/Kuala_Lumpur")[0]).toMatchObject({ day: "2026-11-09", status: "Sent" });
  });
});

describe("when it is due", () => {
  it("nothing with no reminder, one turned off, or no days", () => {
    expect(reminderStatus({}, [], at("2026-11-08", 18))).toBeNull();
    expect(reminderStatus(guide({ enabled: false }), [], at("2026-11-08", 18))).toBeNull();
    expect(reminderStatus(guide({ days: [] }), [], at("2026-11-08", 18))).toBeNull();
  });
  it("waits until the day and hour", () => {
    expect(reminderStatus(guide(), [lastWeek], at("2026-11-07", 20)).state).toBe("waiting");
    expect(reminderStatus(guide(), [lastWeek], at("2026-11-08", 17)).state).toBe("waiting");
  });
  it("due from then, through the order day", () => {
    expect(reminderStatus(guide(), [lastWeek], at("2026-11-08", 18))).toMatchObject({ state: "due", orderDay: "2026-11-09", remindOn: "2026-11-08" });
    expect(reminderStatus(guide(), [lastWeek], at("2026-11-09", 22)).state).toBe("due");
  });
  it("the day after, it's about next week", () => {
    expect(reminderStatus(guide(), [lastWeek], at("2026-11-10", 9))).toMatchObject({ state: "waiting", orderDay: "2026-11-16" });
  });
  it("the same day, from its hour", () => {
    const g = guide({ before: 0, at: "08:00" });
    expect(reminderStatus(g, [lastWeek], at("2026-11-09", 7)).state).toBe("waiting");
    expect(reminderStatus(g, [lastWeek], at("2026-11-09", 8)).state).toBe("due");
  });
  it("two order days a week: the next one", () => {
    const g = guide({ days: [1, 4] });
    expect(reminderStatus(g, [], at("2026-11-10", 9))).toMatchObject({ orderDay: "2026-11-12", state: "waiting" });
    expect(reminderStatus(g, [], at("2026-11-11", 18))).toMatchObject({ orderDay: "2026-11-12", state: "due" });
  });
});

describe("once an order is placed", () => {
  it("stops", () => {
    const st = reminderStatus(guide(), [placed("2026-11-08")], at("2026-11-08", 18));
    expect(st.state).toBe("placed");
    expect(st.order.day).toBe("2026-11-08");
  });
  it("an order a few days early counts, whatever stage it is at", () => {
    expect(reminderStatus(guide(), [placed("2026-11-06", { status: "Received" })], at("2026-11-08", 18)).state).toBe("placed");
  });
  it("last Tuesday's late order doesn't silence this Monday", () => {
    expect(reminderStatus(guide(), [placed("2026-11-03")], at("2026-11-08", 18)).state).toBe("due");
  });
  it("comes back if the order is cancelled or rejected", () => {
    expect(reminderStatus(guide(), [lastWeek, placed("2026-11-08", { status: "Cancelled" })], at("2026-11-08", 18)).state).toBe("due");
    expect(reminderStatus(guide(), [lastWeek, placed("2026-11-08", { status: "Rejected" })], at("2026-11-08", 18)).state).toBe("due");
  });
  it("another guide's order doesn't count, even to the same supplier", () => {
    expect(reminderStatus(guide(), [lastWeek, placed("2026-11-08", { orderGuideId: "fruit" })], at("2026-11-08", 18)).state).toBe("due");
  });
  it("one raised by hand to its supplier does", () => {
    expect(reminderStatus(guide(), [placed("2026-11-08", { orderGuideId: "" })], at("2026-11-08", 18)).state).toBe("placed");
    expect(reminderStatus(guide(), [lastWeek, placed("2026-11-08", { orderGuideId: "", vendorId: "v2" })], at("2026-11-08", 18)).state).toBe("due");
  });
  it("a long lead still counts from the reminder", () => {
    const g = guide({ before: 3 });
    expect(reminderStatus(g, [placed("2026-11-06")], at("2026-11-06", 18)).state).toBe("placed");
  });
});

describe("putting it off", () => {
  it("snoozed until then, for that order day only", () => {
    const until = SUN_6PM + 3600e3;
    const g = guide({}, { snoozeDay: "2026-11-09", snoozedUntil: until });
    expect(reminderStatus(g, [lastWeek], at("2026-11-08", 18)).state).toBe("snoozed");
    expect(reminderStatus(g, [lastWeek], at("2026-11-08", 19, until)).state).toBe("due");
    expect(reminderStatus(guide({}, { snoozeDay: "2026-11-02", snoozedUntil: until }), [lastWeek], at("2026-11-08", 18)).state).toBe("due");
  });
  it("in an hour or three, from now", () => {
    expect(snoozePatch("2026-11-09", "1h", { nowMs: SUN_6PM + 5 * 60e3, hour: 18, by: "Maya" })).toEqual({ "reminderState.snoozeDay": "2026-11-09", "reminderState.snoozedUntil": SUN_6PM + 5 * 60e3 + 3600e3, "reminderState.by": "Maya" });
    expect(snoozePatch("2026-11-09", "3h", { nowMs: SUN_6PM, hour: 18 })["reminderState.snoozedUntil"]).toBe(SUN_6PM + 3 * 3600e3);
  });
  it("tomorrow morning is 9 AM", () => {
    const until = snoozePatch("2026-11-09", "morning", { nowMs: SUN_6PM + 20 * 60e3, hour: 18 })["reminderState.snoozedUntil"];
    expect(until).toBe(Date.parse("2026-11-09T09:00:00+08:00"));
  });
  it("skipped: none this time, next week as usual", () => {
    const g = guide({}, { skippedDay: "2026-11-09" });
    expect(reminderStatus(g, [lastWeek], at("2026-11-08", 18)).state).toBe("skipped");
    expect(reminderStatus(g, [], at("2026-11-15", 18))).toMatchObject({ state: "due", orderDay: "2026-11-16" });
    expect(skipPatch("2026-11-09", "Maya")).toEqual({ "reminderState.skippedDay": "2026-11-09", "reminderState.by": "Maya" });
  });
});

describe("missed", () => {
  it("says so after the order day, until orders count for the next", () => {
    expect(reminderStatus(guide(), [], at("2026-11-10", 9)).missedDay).toBe("2026-11-09");
    expect(reminderStatus(guide(), [], at("2026-11-12", 9)).missedDay).toBe("2026-11-09");
    expect(reminderStatus(guide(), [], at("2026-11-13", 9)).missedDay).toBeNull();
  });
  it("not if an order came, even late, or it was skipped", () => {
    expect(reminderStatus(guide(), [placed("2026-11-09")], at("2026-11-10", 9)).missedDay).toBeNull();
    expect(reminderStatus(guide(), [placed("2026-11-10")], at("2026-11-11", 9)).missedDay).toBeNull();
    expect(reminderStatus(guide({}, { skippedDay: "2026-11-09" }), [], at("2026-11-10", 9)).missedDay).toBeNull();
  });
  it("not for a day before the reminder was set", () => {
    expect(reminderStatus(guide({ since: "2026-11-10" }), [], at("2026-11-10", 9)).missedDay).toBeNull();
  });
});

describe("what the server sends", () => {
  it("the first reminder when it falls due", () => {
    expect(reminderSlots(guide(), [lastWeek], at("2026-11-08", 18))).toEqual(["first"]);
    expect(reminderSlots(guide(), [lastWeek], at("2026-11-08", 17))).toEqual([]);
  });
  it("again on the order day's morning", () => {
    expect(reminderSlots(guide(), [lastWeek], at("2026-11-09", 8))).toEqual(["first"]);
    expect(reminderSlots(guide(), [lastWeek], at("2026-11-09", 9))).toEqual(["first", "morning"]);
  });
  it("no extra morning one when it is told the same day", () => {
    expect(reminderSlots(guide({ before: 0, at: "08:00" }), [lastWeek], at("2026-11-09", 9))).toEqual(["first"]);
  });
  it("when a snooze runs out", () => {
    const until = SUN_6PM + 3600e3;
    expect(reminderSlots(guide({}, { snoozeDay: "2026-11-09", snoozedUntil: until }), [lastWeek], at("2026-11-08", 19, until))).toEqual(["first", `snooze-${until}`]);
  });
  it("nothing while snoozed, skipped or placed", () => {
    const until = SUN_6PM + 3600e3;
    expect(reminderSlots(guide({}, { snoozeDay: "2026-11-09", snoozedUntil: until }), [lastWeek], at("2026-11-08", 18))).toEqual([]);
    expect(reminderSlots(guide({}, { skippedDay: "2026-11-09" }), [lastWeek], at("2026-11-08", 18))).toEqual([]);
    expect(reminderSlots(guide(), [placed("2026-11-08")], at("2026-11-08", 18))).toEqual([]);
  });
});

describe("saving", () => {
  it("starts clean, from today", () => {
    expect(savedReminder({ enabled: true, days: [4, 1, 1], before: "2", at: "07:00" }, "2026-11-04")).toEqual({
      reminder: { enabled: true, days: [1, 4], before: 2, at: "07:00", since: "2026-11-04" },
      reminderState: {},
    });
  });
});
