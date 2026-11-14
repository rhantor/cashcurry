import { describe, expect, it } from "vitest";
import { monthOf, payoutDay, payoutMonth, shiftDay, stateOf } from "@/lib/payouts/history";

const out = (id, date, amount, status = "open", extra = {}) => ({ id, kind: "out", date, amount, status, to: { name: "Ali" }, purpose: "gas", ...extra });
const bill = (id, payoutId, date, floatAmount, billAmount, status = "pending") => ({ id, kind: "settle", payoutId, date, floatAmount, billAmount, status });

const records = [
  out("o1", "2026-11-13", 100, "billed", { settleId: "s1" }),
  bill("s1", "o1", "2026-11-13", 100, 82.5, "approved"),
  out("o2", "2026-11-13", 50, "open"),
  out("o3", "2026-11-13", 30, "billed", { settleId: "s3" }), // its bill came back the next day
  out("o4", "2026-11-12", 72, "billed", { settleId: "s4" }),
  bill("s4", "o4", "2026-11-13", 72, 81, "pending"), // yesterday's money, bill back today: RM 9 more paid
  out("o5", "2026-11-01", 20, "billed", { settleId: "s5" }),
  bill("s5", "o5", "2026-11-01", 20, 25, "rejected"), // sent back: not counted
];

describe("pay-out history (14 Nov)", () => {
  it("moves a day and finds the month", () => {
    expect(shiftDay("2026-11-01", -1)).toBe("2026-10-31");
    expect(shiftDay("2026-12-31", 1)).toBe("2027-01-01");
    expect(monthOf("2026-02-14")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
  });

  it("totals a day: handed out, still out, bills back and change", () => {
    const later = { s3: bill("s3", "o3", "2026-11-14", 30, 30, "pending") };
    const d = payoutDay(records, "2026-11-13", later);
    expect(d.totals.handedOut).toBe(180);
    expect(d.totals.count).toBe(3);
    expect(d.totals.stillOut).toBe(50);
    expect(d.totals.openCount).toBe(1);
    // bills brought back on the 13th: s1 (82.50) and s4 (81, for the 12th's money)
    expect(d.totals.bills).toBe(163.5);
    expect(d.totals.billCount).toBe(2);
    // 17.50 back from s1, 9 more paid on s4
    expect(d.totals.change).toBe(8.5);
    expect(d.outs.map((o) => [o.id, o.state.key])).toEqual([["o1", "approved"], ["o2", "open"], ["o3", "pending"]]);
    expect(d.billsBack.map((b) => b.id)).toEqual(["s4"]);
  });

  it("says where a pay-out stands", () => {
    expect(stateOf({ status: "open" }, null).label).toBe("No bill yet");
    expect(stateOf({ status: "billed" }, { status: "rejected" }).key).toBe("rejected");
    expect(stateOf({ status: "billed" }, { status: "pending" }).key).toBe("pending");
  });

  it("leaves out a bill that was sent back", () => {
    const d = payoutDay(records, "2026-11-01");
    expect(d.totals.handedOut).toBe(20);
    expect(d.totals.bills).toBe(0);
    expect(d.outs[0].state.key).toBe("rejected");
  });

  it("lists each day of the month, newest first, with the month's totals", () => {
    const m = payoutMonth(records, monthOf("2026-11-13"));
    expect(m.days.map((r) => r.date)).toEqual(["2026-11-13", "2026-11-12", "2026-11-01"]);
    expect(m.days[1]).toMatchObject({ handedOut: 72, count: 1, bills: 0 });
    expect(m.totals).toMatchObject({ handedOut: 272, count: 5, bills: 163.5, billCount: 2 });
    expect(payoutMonth([], monthOf("2026-11-13")).days).toEqual([]);
  });
});
