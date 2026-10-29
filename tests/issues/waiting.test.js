import { describe, expect, it } from "vitest";
import { issuesWaiting } from "@/lib/issues/model";

const today = "2026-10-30";
const manager = { uid: "m1", role: "manager" };
const supervisor = { uid: "s1", role: "supervisor" };
const ali = { uid: "a1", role: "staff" };
const given = (who) => ({ assignedTo: { uid: who }, assigneeUid: who });

const issues = [
  { id: "new", status: "open", assignedTo: null }, // no one has it yet
  { id: "toSup", status: "in_progress", ...given("s1") },
  { id: "toAli", status: "open", ...given("a1") },
  { id: "urgent", status: "in_progress", priority: "urgent", ...given("a1") },
  { id: "late", status: "open", dueDate: "2026-10-28", ...given("s1") },
  { id: "done", status: "resolved", priority: "urgent", assignedTo: null },
  { id: "mine", status: "open", ...given("m1") },
];
const ids = (list) => list.map((i) => i.id).sort();

describe("the Issues count in the menu", () => {
  it("whoever assigns: unassigned, their own, urgent and overdue — never resolved", () => {
    expect(ids(issuesWaiting(issues, manager, today))).toEqual(["late", "mine", "new", "urgent"]);
  });
  it("everyone else: only what was given to them", () => {
    expect(ids(issuesWaiting(issues, supervisor, today))).toEqual(["late", "toSup"]);
    expect(ids(issuesWaiting(issues, ali, today))).toEqual(["toAli", "urgent"]);
  });
  it("nothing without a person", () => {
    expect(issuesWaiting(issues, null, today)).toEqual([]);
  });
});
