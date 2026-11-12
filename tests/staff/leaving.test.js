import { describe, expect, it } from "vitest";
import { cleanLeaving, currentStaff, hereOn, isCurrent, latestLastDay, leftLine, niceDay, paidFor } from "@/lib/staff/leaving";
import { kioskStaff } from "@/lib/attendance/kiosk";

const ali = { id: "ali", firstName: "Ali" };
const gone = { id: "kumar", firstName: "Kumar", active: false, leftOn: "2026-11-12", leftReason: "resigned" };

describe("who still works here", () => {
  it("is everyone not marked as left", () => {
    expect(isCurrent(ali)).toBe(true);
    expect(isCurrent({ ...ali, active: true })).toBe(true);
    expect(isCurrent(gone)).toBe(false);
    expect(isCurrent(null)).toBe(false);
    expect(currentStaff([ali, gone]).map((s) => s.id)).toEqual(["ali"]);
    expect(currentStaff(undefined)).toEqual([]);
  });
  it("counts them up to and on their last day, not after", () => {
    expect(hereOn(gone, "2026-11-01")).toBe(true);
    expect(hereOn(gone, "2026-11-12")).toBe(true);
    expect(hereOn(gone, "2026-11-13")).toBe(false);
    expect(hereOn(ali, "2030-01-01")).toBe(true);
    expect(hereOn({ ...gone, leftOn: "" }, "2026-01-01")).toBe(false);
  });
  it("keeps them on payroll up to the month they left, for the last salary", () => {
    expect(paidFor(gone, "2026-10")).toBe(true);
    expect(paidFor(gone, "2026-11")).toBe(true);
    expect(paidFor(gone, "2026-12")).toBe(false);
    expect(paidFor(ali, "2027-05")).toBe(true);
  });
  it("says when and why", () => {
    expect(niceDay("2026-11-12")).toBe("12 Nov 2026");
    expect(niceDay("nope")).toBe("");
    expect(leftLine(gone)).toBe("Left 12 Nov 2026 · Resigned");
    expect(leftLine(ali)).toBe("");
    expect(leftLine({ active: false })).toBe("Left");
  });
});

describe("marking someone as left", () => {
  const latest = "2026-11-13";
  it("takes a real last day, not one still to come, and a reason", () => {
    expect(cleanLeaving({ leftOn: "2026-11-12", reason: "resigned", note: "  gave notice " }, latest)).toEqual({ value: { leftOn: "2026-11-12", leftReason: "resigned", leftNote: "gave notice" } });
    expect(cleanLeaving({ leftOn: "2026-11-20", reason: "resigned" }, latest).error).toMatch(/still to come/);
    expect(cleanLeaving({ leftOn: "2026-02-30", reason: "resigned" }, latest).error).toBeTruthy();
    expect(cleanLeaving({ leftOn: "", reason: "resigned" }, latest).error).toBeTruthy();
    expect(cleanLeaving({ leftOn: "2026-11-12", reason: "bored" }, latest).error).toMatch(/Why/);
  });
  it("needs a line when the reason is Other", () => {
    expect(cleanLeaving({ leftOn: "2026-11-12", reason: "other" }, latest).error).toBeTruthy();
    expect(cleanLeaving({ leftOn: "2026-11-12", reason: "other", note: "moved city" }, latest).value.leftNote).toBe("moved city");
  });
  it("keeps notes short", () => {
    expect(cleanLeaving({ leftOn: "2026-11-12", reason: "resigned", note: "x".repeat(500) }, latest).value.leftNote).toHaveLength(300);
  });
  it("lets a branch ahead of UTC pick its own today", () => {
    expect(latestLastDay(new Date("2026-11-12T20:00:00Z"))).toBe("2026-11-13");
  });
  it("leaves the kiosk's card for a person unchanged", () => {
    expect(kioskStaff({ ...ali, pinCode: "1234" })).toMatchObject({ id: "ali", hasPin: true });
  });
});
