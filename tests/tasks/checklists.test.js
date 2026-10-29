import { describe, expect, it } from "vitest";
import { MAX_ITEMS, TEMPLATES, answersFor, checklistState, cleanItems, issueHref, issueTaskId, itemsOf, performance, problemsIn, taskFromIssue } from "@/lib/tasks/model";

describe("a task's checklist", () => {
  it("lines are trimmed, blanks dropped, at most MAX_ITEMS", () => {
    expect(cleanItems([" Tables ", "", null, "Basin"])).toEqual(["Tables", "Basin"]);
    expect(cleanItems(Array.from({ length: 40 }, (_, i) => `L${i}`))).toHaveLength(MAX_ITEMS);
    expect(itemsOf({})).toEqual([]);
  });

  it("finishing needs every line answered, and a problem says what is wrong", () => {
    const items = ["Tables", "Cutlery", "Basin"];
    expect(checklistState(items, [])).toEqual({ ready: false, left: 3, problems: 0, needNote: 0 });
    expect(checklistState(items, [{ ok: true }, { ok: true }, { ok: false, note: "" }])).toEqual({ ready: false, left: 0, problems: 1, needNote: 1 });
    expect(checklistState(items, [{ ok: true }, { ok: true }, { ok: false, note: "No soap" }]).ready).toBe(true);
    expect(checklistState([], []).ready).toBe(true);
  });

  it("the answers saved with the tick, and the problems in them", () => {
    const saved = answersFor(["Tables", "Basin"], [{ ok: true, note: "ignored" }, { ok: false, note: " No soap " }]);
    expect(saved).toEqual([
      { text: "Tables", ok: true, note: "" },
      { text: "Basin", ok: false, note: "No soap" },
    ]);
    expect(problemsIn(saved)).toEqual([{ text: "Basin", ok: false, note: "No soap" }]);
    expect(problemsIn(undefined)).toEqual([]);
  });

  it("ready-made checklists are complete", () => {
    for (const t of TEMPLATES) {
      expect(t.title).toBeTruthy();
      expect(cleanItems(t.items).length).toBe(t.items.length);
      expect(["day", "week"]).toContain(t.repeat.every);
    }
    expect(TEMPLATES.find((t) => t.id === "opening").items.some((x) => /reservation/i.test(x))).toBe(true);
  });
});

describe("a task made from an issue", () => {
  const issue = { id: "i9", title: " Fryer broken ", details: "No heat", priority: "urgent", dueDate: "2026-11-02" };
  const kumar = { uid: "u-kumar", name: "Kumar", role: "staff" };

  it("is a one-off for whoever has the issue, by its due day, urgent if it is", () => {
    expect(issueTaskId("i9")).toBe("issue_i9");
    expect(taskFromIssue(issue, kumar, { teamLeadUid: "u-rahim" })).toEqual({
      title: "Fix: Fryer broken",
      details: "No heat",
      priority: "urgent",
      needsPhoto: false,
      assignee: { uid: "u-kumar", name: "Kumar", role: "staff" },
      assigneeUid: "u-kumar",
      repeat: null,
      dueDate: "2026-11-02",
      startDate: null,
      teamLeadUid: "u-rahim",
      issueId: "i9",
    });
    expect(taskFromIssue({ id: "i1", title: "Leak" }, kumar).priority).toBe("normal");
  });

  it("opens on the board the person uses", () => {
    expect(issueHref({ branchId: "kl", issueId: "i9" }, "staff")).toBe("/my-issues?i=kl/i9");
    expect(issueHref({ branchId: "kl", issueId: "i9" }, "manager")).toBe("/issues?i=kl/i9");
  });

  it("counts in the month's review like any task: on time, late or missed by its due day", () => {
    const base = { ...taskFromIssue(issue, kumar), id: "issue_i9" };
    const period = { from: "2026-11-01", to: "2026-11-30", today: "2026-11-10" };
    expect(performance([{ ...base, status: "done", done: { date: "2026-11-01" } }], {}, "u-kumar", period).items[0].result).toBe("onTime");
    expect(performance([{ ...base, status: "done", done: { date: "2026-11-04" } }], {}, "u-kumar", period).items[0].result).toBe("late");
    expect(performance([{ ...base, status: "open" }], {}, "u-kumar", period).items[0].result).toBe("missed");
  });
});
