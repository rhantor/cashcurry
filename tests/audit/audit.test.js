import { describe, expect, it } from "vitest";
import { actorFromChange } from "@/lib/audit/actor";
import { cleanDetails, normalizeLog } from "@/lib/audit/normalize";
import { changeRows, summaryOf, showValue } from "@/lib/audit/describe";

const cashier = { uid: "c1", name: "kl_cashier", role: "cashier" };
const manager = { uid: "m1", name: "kl_manager", role: "manager" };
const gm = { uid: "g1", name: "gm" };

const cost = {
  date: "2026-10-19", amount: 82.5, categoryId: "gas", category: "Cooking gas", costGroupId: "food", costGroup: "Food & stock",
  costKind: "expense", paidFromOffice: "front", paidMethod: "cash", isFrontOffice: true, fileURL: null, attachments: [],
  voucher: { status: "pending", reason: "Street stall", by: cashier, at: "2026-10-19T04:04:13.706Z", decidedBy: null, decidedAt: null },
  meta: { type: "payout", payoutId: "v61Jjhd7", settleId: "XG9hkb4c" },
  createdBy: cashier, createdAt: "2026-10-19T04:04:55.258Z",
};
const approved = { ...cost, voucher: { ...cost.voucher, status: "approved", decidedBy: gm, decidedAt: "2026-10-19T05:00:00.000Z" } };

describe("who made a change", () => {
  it("credits a new record to its creator", () => {
    expect(actorFromChange({ action: "created", after: cost })).toEqual({ uid: "c1", name: "kl_cashier" });
  });
  it("credits a voucher decision to whoever decided, not the creator", () => {
    expect(actorFromChange({ action: "updated", before: cost, after: approved })).toEqual({ uid: "g1", name: "gm" });
  });
  it("credits a resubmitted voucher to whoever sent it again", () => {
    const back = { ...approved, voucher: { ...approved.voucher, status: "rejected" } };
    const again = { ...back, voucher: { ...back.voucher, status: "pending", at: "2026-10-19T06:00:00.000Z", decidedBy: null, decidedAt: null } };
    expect(actorFromChange({ action: "updated", before: back, after: again })?.name).toBe("kl_cashier");
  });
  it("says nothing when the record doesn't tell", () => {
    expect(actorFromChange({ action: "deleted", before: cost })).toBeNull();
    expect(actorFromChange({ action: "updated", before: cost, after: { ...cost, amount: 90 } })).toBeNull();
  });
});

describe("normalizeLog", () => {
  it("fixes old entries that named the creator for someone else's update", () => {
    const log = normalizeLog({ action: "updated", collection: "costs", actorName: "kl_cashier", before: cost, after: approved });
    expect(log.actorName).toBe("gm");
  });
  it("trusts the signed-in account when the trigger recorded it", () => {
    const log = normalizeLog({ action: "deleted", collection: "costs", actorName: "kl_manager", actorFrom: "account", before: cost });
    expect(log.actorName).toBe("kl_manager");
  });
  it("gives app events a type, never an empty one", () => {
    expect(normalizeLog({ action: "APPROVE_REQUEST", details: "Approved salary advance for ali (500)", username: "gm" }).collection).toBe("advances");
    expect(normalizeLog({ action: "ADD_LEAVE", username: "ali" }).collection).toBe("leave");
    expect(normalizeLog({ action: "REJECT_REQUEST", details: "Rejected something" }).collection).toBe("requests");
  });
  it("doesn't show 'System' as a person", () => {
    expect(normalizeLog({ action: "ADD_ADVANCE", username: "System", name: "" }).actorName).toBe("unknown");
    expect(normalizeLog({ action: "ADD_ADVANCE", username: "System", name: "Demo Cashier" }).actorName).toBe("Demo Cashier");
  });
});

describe("what changed, in words", () => {
  it("lists a new record without ids, with names, money and dates", () => {
    const rows = changeRows({ action: "created", after: cost }, { currency: "MYR" });
    const labels = rows.map((r) => r.label);
    expect(labels).not.toContain("Category id");
    expect(labels.some((l) => /id$/i.test(l))).toBe(false);
    expect(labels).toContain("Voucher · Status");
    expect(labels).toContain("Made from");
    const by = Object.fromEntries(rows.map((r) => [r.label, r.after.text]));
    expect(by.Amount).toBe("RM 82.50");
    expect(by.Date).toBe("19 Oct 2026");
    expect(by["Paid from"]).toBe("Front office (till)");
    expect(by["Entered by"]).toBe("kl_cashier");
    expect(by["Voucher · Status"]).toBe("Waiting");
    expect(by["Made from"]).toBe("Pay-out bill");
  });
  it("shows only what an update changed", () => {
    const rows = changeRows({ action: "updated", before: cost, after: approved }, { currency: "MYR" });
    expect(rows.map((r) => r.label)).toEqual(["Voucher · Status", "Voucher · Decided by", "Voucher · Decided at"]);
    expect(rows[0]).toMatchObject({ before: { text: "Waiting" }, after: { text: "Approved" } });
    expect(rows[1].before.empty).toBe(true);
    expect(rows[1].after.text).toBe("gm");
  });
  it("names a sale's money by its tenders", () => {
    const sale = { date: "2026-10-19", cash: "1250.00", card: "830.50", total: 2080.5, notes: { cash: "Torn note", card: "" }, zReportUrl: "http://x/z.png",
      tenderMeta: [{ key: "cash", label: "Cash" }, { key: "card", label: "Card" }] };
    const by = Object.fromEntries(changeRows({ action: "created", after: sale }, { currency: "MYR" }).map((r) => [r.label, r.after]));
    expect(by.Cash.text).toBe("RM 1,250.00");
    expect(by["Notes · Cash"].text).toBe("Torn note");
    expect(by["Z report"].links[0].href).toBe("http://x/z.png");
    expect(by["Tender meta"]).toBeUndefined();
  });
  it("shows empty things plainly", () => {
    expect(showValue("attachments", [])).toMatchObject({ text: "None", empty: true });
    expect(showValue("fileURL", null).empty).toBe(true);
    expect(showValue("isPaid", true).text).toBe("Yes");
  });
});

describe("summaryOf", () => {
  it("names the record in one line", () => {
    expect(summaryOf({ collection: "costs", after: cost }, { currency: "MYR" })).toBe("Cooking gas · RM 82.50 · 19 Oct 2026");
    expect(summaryOf({ collection: "sales", before: { total: 100, date: "2026-10-01" } }, { currency: "MYR" })).toBe("Day's sales · RM 100.00 · 1 Oct 2026");
    expect(summaryOf({ action: "APPROVE_REQUEST", details: "Approved salary advance for ali (500)" })).toBe("Approved salary advance for ali (500)");
  });
  it("credits a creator by name", () => {
    expect(actorFromChange({ action: "created", after: { createdBy: manager } }).name).toBe("kl_manager");
  });
});

describe("event texts", () => {
  it("drops database ids from older texts", () => {
    expect(cleanDetails("Paid out advance SYrvF6Ap6zWealVu8SJi on 2026-10-20 from till")).toBe("Paid out advance on 20 Oct 2026 from till");
    expect(cleanDetails("Rejectd salary advance for Ali (50)")).toBe("Rejected salary advance for Ali (50)");
    expect(cleanDetails("Saved/Updated 4 slips for payroll run period: 2026-10 (Run ID: abc123XYZ)")).toBe("Saved/Updated 4 slips for payroll run period: 2026-10");
    expect(cleanDetails("Updated advance entry ID: SYrvF6Ap6zWealVu8SJi. Status: approved")).toBe("Updated advance entry. Status: approved");
    expect(cleanDetails("Leave for Kumarasamy Rajendran: 2026-10-01")).toBe("Leave for Kumarasamy Rajendran: 1 Oct 2026");
  });
  it("says what was done in the past tense", () => {
    expect(normalizeLog({ action: "APPROVE_REQUEST" }).did).toBe("Approved");
    expect(normalizeLog({ action: "PAY_OUT_ADVANCE" }).did).toBe("Paid out");
  });
});
