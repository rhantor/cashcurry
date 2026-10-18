import { describe, expect, it } from "vitest";
import {
  actionsFor, approvalPatch, cancelPatch, leaveDays, newRequestFields, rejectPatch, stageOf, stepsFor, toRequest, waitingStep,
} from "@/lib/requests/model";

const policy = { ownerApprovalAbove: 1000 };
const manager = { uid: "m", role: "manager", username: "mgr" };
const owner = { uid: "o", role: "owner", username: "own" };
const cashier = { uid: "c", role: "cashier" };
const now = "2026-10-18T10:00:00.000Z";
const asked = (type, amount, extra = {}) => ({ type, amount, status: "pending", paidOut: null, approvals: [], createdBy: { uid: "s" }, staffId: "st1", ...extra });

describe("steps", () => {
  it("money over the limit needs the owner too; leave and small money don't", () => {
    expect(stepsFor(asked("advance", 500), policy)).toEqual(["branch"]);
    expect(stepsFor(asked("staffLoan", 5000), policy)).toEqual(["branch", "owner"]);
    expect(stepsFor(asked("leave", 0), policy)).toEqual(["branch"]);
    expect(stepsFor(asked("advance", 5000), { ownerApprovalAbove: 0 })).toEqual(["branch"]);
  });
});

describe("approving", () => {
  it("one step: approved, still to be paid out", () => {
    const p = approvalPatch(asked("advance", 500), manager, policy, now);
    expect(p).toMatchObject({ status: "approved", awaiting: null, paidOut: null });
    expect(p.approvals).toEqual([expect.objectContaining({ step: "branch", uid: "m" })]);
  });
  it("two steps: the branch's approval waits for the owner, who finishes it", () => {
    const r = asked("staffLoan", 5000);
    const first = approvalPatch(r, manager, policy, now);
    expect(first.status).toBeUndefined();
    expect(first.awaiting).toBe("owner");
    const r2 = { ...r, ...first };
    expect(() => approvalPatch(r2, manager, policy, now)).toThrow(/owner/);
    expect(actionsFor(r2, manager, policy)).toEqual([]);
    expect(actionsFor(r2, owner, policy)).toEqual(["approve", "reject"]);
    expect(approvalPatch(r2, owner, policy, now)).toMatchObject({ status: "approved", awaiting: null });
  });
  it("a cashier can't approve", () => {
    expect(() => approvalPatch(asked("advance", 10), cashier, policy, now)).toThrow();
  });
  it("rejecting records the step it stopped at", () => {
    expect(rejectPatch(asked("leave", 0), manager, policy, "busy week", now)).toMatchObject({ status: "rejected", rejectReason: "busy week", rejectedBy: { step: "branch" } });
  });
});

describe("new requests", () => {
  it("asked by someone who can't approve: waits for the branch", () => {
    expect(newRequestFields(asked("advance", 100), cashier, policy, now)).toMatchObject({ status: "pending", awaiting: "branch", approvals: [] });
  });
  it("entered by an approver: approved at once, or waiting for the owner above the limit", () => {
    expect(newRequestFields(asked("advance", 100), manager, policy, now).status).toBe("approved");
    expect(newRequestFields(asked("advance", 3000), manager, policy, now)).toMatchObject({ status: "pending", awaiting: "owner" });
    expect(newRequestFields(asked("advance", 3000), owner, policy, now).status).toBe("approved");
  });
});

describe("cancelling and stages", () => {
  it("whoever asked cancels while it waits and nobody has approved yet", () => {
    const r = asked("advance", 100);
    expect(actionsFor(r, { uid: "s", role: "staff" }, policy)).toEqual(["cancel"]);
    expect(actionsFor({ ...r, approvals: [{ step: "branch" }] }, { uid: "s", role: "staff" }, policy)).toEqual([]);
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
  it("old pending records with no trail still wait for the branch", () => {
    expect(waitingStep({ type: "advance", status: "pending", amount: 10 }, policy)).toBe("branch");
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
