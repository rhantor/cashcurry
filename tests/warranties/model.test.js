import { describe, expect, it } from "vitest";
import { addMonths, daysLeft, leftText, offersWarranty, reminderDue, renewalPatch, sortWarranties, stateOf, warrantyCounts, warrantyFields, warrantyMessage, warrantyProblems } from "@/lib/warranties/model";

const w = (endsOn, extra = {}) => ({ itemName: "Chiller", endsOn, status: "active", ...extra });
const TODAY = "2026-11-04";

describe("when it ends", () => {
  it("counts the days left, 0 on its last day", () => {
    expect(daysLeft(w("2026-11-19"), TODAY)).toBe(15);
    expect(daysLeft(w(TODAY), TODAY)).toBe(0);
    expect(daysLeft(w("2026-11-01"), TODAY)).toBe(-3);
  });
  it("says it in words", () => {
    expect(leftText(w(TODAY), TODAY)).toBe("Ends today");
    expect(leftText(w("2026-11-05"), TODAY)).toBe("1 day left");
    expect(leftText(w("2026-11-03"), TODAY)).toBe("Ended 1 day ago");
  });
  it("is soon from 15 days, ended after its last day, and stopped when not renewing", () => {
    expect(stateOf(w("2026-11-20"), TODAY)).toBe("active");
    expect(stateOf(w("2026-11-19"), TODAY)).toBe("soon");
    expect(stateOf(w(TODAY), TODAY)).toBe("soon");
    expect(stateOf(w("2026-11-03"), TODAY)).toBe("expired");
    expect(stateOf(w("2026-11-05", { status: "notRenewing" }), TODAY)).toBe("stopped");
  });
});

describe("the warnings", () => {
  it("nothing before 15 days", () => {
    expect(reminderDue(w("2026-11-20"), TODAY)).toBeNull();
  });
  it("15 days first, once", () => {
    expect(reminderDue(w("2026-11-19"), TODAY)).toBe(15);
    expect(reminderDue(w("2026-11-19", { reminded: { endsOn: "2026-11-19", step: 15 } }), TODAY)).toBeNull();
    expect(reminderDue(w("2026-11-15", { reminded: { endsOn: "2026-11-15", step: 15 } }), TODAY)).toBeNull();
  });
  it("then 7 days, once", () => {
    expect(reminderDue(w("2026-11-11", { reminded: { endsOn: "2026-11-11", step: 15 } }), TODAY)).toBe(7);
    expect(reminderDue(w("2026-11-11", { reminded: { endsOn: "2026-11-11", step: 7 } }), TODAY)).toBeNull();
  });
  it("entered with few days left: only the 7-day one", () => {
    expect(reminderDue(w("2026-11-08"), TODAY)).toBe(7);
  });
  it("still warns on its last day if nothing went, but not after", () => {
    expect(reminderDue(w(TODAY), TODAY)).toBe(7);
    expect(reminderDue(w("2026-11-03"), TODAY)).toBeNull();
  });
  it("none for one not being renewed", () => {
    expect(reminderDue(w("2026-11-10", { status: "notRenewing" }), TODAY)).toBeNull();
  });
  it("a renewal starts them again", () => {
    expect(reminderDue(w("2027-11-05", { reminded: { endsOn: "2026-11-11", step: 7 } }), "2027-10-22")).toBe(15);
  });
});

describe("the message", () => {
  it("names one", () => {
    const m = warrantyMessage([w("2026-11-11")], { today: TODAY, branchName: "KL" });
    expect(m.title).toBe("Warranty ending · KL");
    expect(m.body).toContain("Chiller · 7 days left (2026-11-11)");
    expect(m.body).toContain("Renew?");
  });
  it("shortens a long list, soonest first", () => {
    const list = ["2026-11-19", "2026-11-05", "2026-11-11", "2026-11-12"].map((d) => w(d));
    const m = warrantyMessage(list, { today: TODAY, branchName: "KL" });
    expect(m.title).toBe("4 warranties ending · KL");
    expect(m.body.split("\n")[0]).toContain("1 day left");
    expect(m.body).toContain("…and 2 more");
  });
  it("nothing for nothing", () => {
    expect(warrantyMessage([], {})).toBeNull();
  });
});

describe("the form", () => {
  it("needs what and when", () => {
    expect(warrantyProblems({})).toMatchObject({ itemName: expect.any(String), endsOn: expect.any(String) });
    expect(warrantyProblems({ itemName: "Oven", endsOn: "2027-01-01" })).toEqual({});
  });
  it("can't end before it was bought, or have a broken email", () => {
    expect(warrantyProblems({ itemName: "Oven", startDate: "2027-01-01", endsOn: "2027-01-01" }).endsOn).toBeTruthy();
    expect(warrantyProblems({ itemName: "Oven", endsOn: "2027-01-01", soldByEmail: "nope" }).soldByEmail).toBeTruthy();
  });
  it("keeps a listed vendor's name, else the shop typed", () => {
    expect(warrantyFields({ itemName: " Oven ", endsOn: "2027-01-01", soldBy: "typed" }, { id: "v1", name: "Listed" })).toMatchObject({ itemName: "Oven", vendorId: "v1", soldBy: "Listed" });
    expect(warrantyFields({ itemName: "Oven", endsOn: "2027-01-01", soldBy: " Shop " })).toMatchObject({ vendorId: "", soldBy: "Shop" });
  });
  it("adds months, to the month's last day when it must", () => {
    expect(addMonths("2026-11-04", 12)).toBe("2027-11-04");
    expect(addMonths("2026-11-30", 3)).toBe("2027-02-28");
    expect(addMonths("", 3)).toBe("");
  });
  it("offers it on equipment only", () => {
    expect(offersWarranty({ id: "assets" })).toBe(true);
    expect(offersWarranty({ id: "rent" })).toBe(false);
    expect(offersWarranty(null)).toBe(false);
  });
});

describe("the list", () => {
  it("soonest first, then ended, covered, not renewing", () => {
    const list = [w("2027-05-01"), w("2026-11-01"), w("2026-11-10"), w("2026-11-06"), w("2026-11-05", { status: "notRenewing" })];
    expect(sortWarranties(list, TODAY).map((x) => x.endsOn)).toEqual(["2026-11-06", "2026-11-10", "2026-11-01", "2027-05-01", "2026-11-05"]);
    expect(warrantyCounts(list, TODAY)).toEqual({ soon: 2, expired: 1, active: 1, stopped: 1 });
  });
  it("renewing moves the old period into its history", () => {
    const old = w("2026-11-10", { startDate: "2025-11-10", paperURL: "old" });
    const p = renewalPatch(old, { endsOn: "2027-11-10", paperURL: "new", by: "Maya", now: new Date("2026-11-04T00:00:00Z") });
    expect(p).toMatchObject({ endsOn: "2027-11-10", status: "active", paperURL: "new", startDate: "2026-11-11" });
    expect(p.history).toEqual([{ startDate: "2025-11-10", endsOn: "2026-11-10", paperURL: "old", renewedAt: "2026-11-04T00:00:00.000Z", renewedBy: "Maya" }]);
    expect(renewalPatch(old, { endsOn: "2027-11-10" }).paperURL).toBe("old");
  });
});
