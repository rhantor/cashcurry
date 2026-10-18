import { describe, expect, it } from "vitest";
import { actionsFor, approvalPatch, cancelPatch, leaveDays, newRequestFields, rejectPatch, stageOf, toRequest } from "@/lib/requests/model";

const manager = { uid: "m", role: "manager", username: "mgr" };
const owner = { uid: "o", role: "owner", username: "own" };
const gm = { uid: "g", role: "gm" };
const cashier = { uid: "c", role: "cashier" };
const now = "2026-10-18T10:00:00.000Z";
const asked = (type, amount, extra = {}) => ({ type, amount, status: "pending", paidOut: null, approvals: [], createdBy: { uid: "s" }, staffId: "st1", ...extra });

describe("approving — one approval is enough", () => {
  it("approved by whoever approves, still to be paid out, with who did it", () => {
    const p = approvalPatch(asked("staffLoan", 50000), manager, now);
    expect(p).toMatchObject({ status: "approved", paidOut: null, approvedBy: { id: "m", role: "manager" } });
    expect(p.approvals).toEqual([expect.objectContaining({ uid: "m", role: "manager", at: now })]);
  });
  it("branch admin, manager, gm, super admin and owner may decide; cashier can't", () => {
    for (const u of [manager, owner, gm, { role: "superAdmin" }, { role: "branchAdmin" }]) expect(actionsFor(asked("advance", 10), u)).toEqual(["approve", "reject"]);
    expect(() => approvalPatch(asked("advance", 10), cashier, now)).toThrow();
  });
  it("once decided, nobody decides it again — the owner sees who did", () => {
    const done = { ...asked("advance", 10), ...approvalPatch(asked("advance", 10), manager, now) };
    expect(actionsFor(done, owner)).not.toContain("approve");
    expect(() => approvalPatch(done, owner, now)).toThrow(/already/);
  });
  it("rejecting keeps who and why", () => {
    expect(rejectPatch(asked("leave", 0), manager, "busy week", now)).toMatchObject({ status: "rejected", rejectReason: "busy week", rejectedBy: { uid: "m" } });
  });
});

describe("new requests", () => {
  it("asked by someone who can't approve: waits", () => {
    expect(newRequestFields(asked("advance", 100), cashier, now)).toEqual({ status: "pending", approvals: [], paidOut: null });
  });
  it("entered by an approver: approved at once", () => {
    expect(newRequestFields(asked("advance", 3000), manager, now).status).toBe("approved");
    expect(newRequestFields(asked("leave", 0), owner, now)).not.toHaveProperty("paidOut");
  });
});

describe("cancelling and stages", () => {
  it("whoever asked cancels while it waits", () => {
    const r = asked("advance", 100);
    expect(actionsFor(r, { uid: "s", role: "staff" })).toEqual(["cancel"]);
    expect(cancelPatch(r, { uid: "s" }, now).status).toBe("cancelled");
    expect(() => cancelPatch({ ...r, status: "approved" }, { uid: "s" }, now)).toThrow();
  });
  it("stages follow the money", () => {
    expect(stageOf(asked("advance", 1))).toBe("waiting");
    expect(stageOf({ type: "advance", status: "approved", paidOut: null })).toBe("approved");
    expect(stageOf({ type: "advance", status: "approved", paidOut: { date: "x" } })).toBe("paid");
    expect(stageOf({ type: "advance", status: "approved" })).toBe("paid"); // older records
    expect(stageOf({ type: "leave", status: "approved" })).toBe("approved");
  });
  it("approved money can be paid out by a payer", () => {
    expect(actionsFor({ type: "advance", status: "approved", paidOut: null }, cashier)).toEqual(["payOut"]);
  });
});

describe("leave", () => {
  it("counts days both ends included, half a day on one day", () => {
    expect(leaveDays("2026-11-02", "2026-11-04")).toBe(3);
    expect(leaveDays("2026-11-02", "2026-11-02", true)).toBe(0.5);
    expect(leaveDays("2026-11-04", "2026-11-02")).toBe(0);
  });
  it("old leave kept in advances reads as leave, never money", () => {
    const r = toRequest("advance", { id: "x", advanceType: "medical", amount: 0, date: "2026-10-01", status: "pending" });
    expect(r).toMatchObject({ type: "leave", legacyLeave: true, leaveKind: "medical", from: "2026-10-01", days: 1, amount: 0 });
  });
});
