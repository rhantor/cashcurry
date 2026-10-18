import { describe, expect, it } from "vitest";
import { boardOrder, canManageIssues, canSeeIssue, eventText, isOverdue, issueActions, watchersWith } from "@/lib/issues/model";

const issue = (extra = {}) => ({ id: "i1", branchId: "kl", status: "open", priority: "normal", reportedBy: { uid: "ali" }, assignedTo: null, watchers: ["ali"], ...extra });
const manager = { uid: "m", role: "manager", branchId: "kl" };
const incharge = { uid: "ic", role: "inCharge", branchId: "kl" };
const cashier = { uid: "c", role: "cashier", branchId: "kl" };
const ali = { uid: "ali", role: "staff", branchId: "kl" };
const kumar = { uid: "kumar", role: "staff", branchId: "kl" };

describe("who manages issues", () => {
  it("owner, super admin, gm, branch admin, manager and in-charge — not cashier or staff", () => {
    expect(["owner", "superAdmin", "gm", "branchAdmin", "manager", "inCharge"].every(canManageIssues)).toBe(true);
    expect(["accountant", "supervisor", "cashier", "staff"].some(canManageIssues)).toBe(false);
  });
});

describe("who sees an issue", () => {
  it("office roles see the branch's; staff only theirs; company roles all", () => {
    expect(canSeeIssue(issue(), cashier)).toBe(true);
    expect(canSeeIssue(issue(), { uid: "x", role: "cashier", branchId: "pj" })).toBe(false);
    expect(canSeeIssue(issue(), ali)).toBe(true); // raised it
    expect(canSeeIssue(issue(), kumar)).toBe(false);
    expect(canSeeIssue(issue({ assignedTo: { uid: "kumar" } }), kumar)).toBe(true); // given it
    expect(canSeeIssue(issue(), { uid: "o", role: "owner" })).toBe(true);
  });
});

describe("what each may do", () => {
  it("management assigns, starts, resolves and deletes", () => {
    expect(issueActions(issue(), manager)).toEqual(["assign", "priority", "due", "start", "resolve", "delete"]);
    expect(issueActions(issue(), incharge)).toContain("assign");
  });
  it("whoever has it starts and resolves it — nothing else", () => {
    expect(issueActions(issue({ assignedTo: { uid: "kumar" } }), kumar)).toEqual(["start", "resolve"]);
    expect(issueActions(issue({ status: "in_progress", assignedTo: { uid: "kumar" } }), kumar)).toEqual(["resolve"]);
  });
  it("whoever raised it reopens it once resolved; others can only look", () => {
    expect(issueActions(issue({ status: "resolved" }), ali)).toEqual(["reopen"]);
    expect(issueActions(issue(), ali)).toEqual([]);
    expect(issueActions(issue(), cashier)).toEqual([]);
  });
});

describe("the board", () => {
  it("overdue once the due day has passed, unless resolved", () => {
    expect(isOverdue(issue({ dueDate: "2026-10-18" }), "2026-10-19")).toBe(true);
    expect(isOverdue(issue({ dueDate: "2026-10-19" }), "2026-10-19")).toBe(false);
    expect(isOverdue(issue({ dueDate: "2026-10-18", status: "resolved" }), "2026-10-19")).toBe(false);
  });
  it("urgent first, then overdue, then oldest", () => {
    const list = [
      issue({ id: "old", createdAtISO: "2026-10-01" }),
      issue({ id: "urgent", priority: "urgent", createdAtISO: "2026-10-10" }),
      issue({ id: "late", dueDate: "2026-10-05", createdAtISO: "2026-10-09" }),
    ];
    expect(list.sort((a, b) => boardOrder(a, b, "2026-10-19")).map((i) => i.id)).toEqual(["urgent", "late", "old"]);
  });
  it("the history reads plainly; watchers gather once", () => {
    expect(eventText("assigned", { by: "KL Manager", to: "Kumar" })).toBe("KL Manager gave this to Kumar");
    expect(eventText("resolved", { by: "Kumar", note: "new fuse" })).toBe("Kumar marked it resolved — “new fuse”");
    expect(watchersWith(issue(), "kumar", "ali")).toEqual(["ali", "kumar"]);
  });
});
