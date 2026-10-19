import { describe, expect, it } from "vitest";
import {
  branchPeople, dailyMessage, hourOf, localHour, recipientsFor, requestEvents, requestLink, requestMessage, requesterMessage, withoutMuted,
} from "@/lib/notify/model";

const users = [
  { uid: "owner", role: "owner" },
  { uid: "gm", role: "gm" },
  { uid: "kla", role: "branchAdmin", branchId: "kl" },
  { uid: "klm", role: "manager", branchId: "kl" },
  { uid: "klc", role: "cashier", branchId: "kl" },
  { uid: "kls", role: "supervisor", branchId: "kl" },
  { uid: "ali", role: "staff", branchId: "kl", staffId: "st-ali" },
  { uid: "pja", role: "branchAdmin", branchId: "pj" },
];
const kl = branchPeople(users, "kl");

describe("who is told", () => {
  it("a branch's people: company roles and that branch's office users — not staff, not other branches", () => {
    expect(kl.map((p) => p.uid)).toEqual(["owner", "gm", "kla", "klm", "klc", "kls"]);
  });
  it("defaults: approvers hear of new requests, company roles of decisions and the daily summaries, payers of pay-outs", () => {
    expect(recipientsFor("requests.new", { people: kl })).toEqual(["owner", "gm", "kla", "klm"]);
    expect(recipientsFor("requests.decided", { people: kl })).toEqual(["owner", "gm"]);
    expect(recipientsFor("requests.payout", { people: kl })).toEqual(["klc", "kls"]);
    expect(recipientsFor("daily.sales", { people: kl })).toEqual(["owner", "gm"]);
  });
  it("once chosen in the branch's settings, only those chosen — and only if still at the branch", () => {
    const config = { recipients: { "daily.sales": ["owner", "klm", "pja"], "requests.new": [] } };
    expect(recipientsFor("daily.sales", { config, people: kl })).toEqual(["owner", "klm"]);
    expect(recipientsFor("requests.new", { config, people: kl })).toEqual([]);
    expect(recipientsFor("daily.costs", { config, people: kl })).toEqual(["owner", "gm"]); // not chosen yet: default
  });
  it("anyone may mute a kind for themselves", () => {
    expect(withoutMuted(["owner", "gm"], "daily.sales", { owner: { muted: ["daily.sales"] } })).toEqual(["gm"]);
  });
});

describe("what changed on a request", () => {
  const asked = { status: "pending", paidOut: null };
  it("asked → new", () => expect(requestEvents(null, asked)).toEqual(["new"]));
  it("approved → decision and, for money, waiting to be paid", () => {
    expect(requestEvents(asked, { status: "approved", paidOut: null })).toEqual(["approved", "payout"]);
    expect(requestEvents(asked, { status: "approved" })).toEqual(["approved"]); // leave: no pay-out
  });
  it("rejected, then paid out", () => {
    expect(requestEvents(asked, { status: "rejected" })).toEqual(["rejected"]);
    expect(requestEvents({ status: "approved", paidOut: null }, { status: "approved", paidOut: { date: "2026-10-18" } })).toEqual(["paid"]);
  });
  it("given on the spot (approved and paid at once): only the decision", () => {
    expect(requestEvents(null, { status: "approved", paidOut: { date: "2026-10-18" } })).toEqual(["approved"]);
  });
  it("bookkeeping changes say nothing", () => {
    const paid = { status: "approved", paidOut: { date: "x" }, totalPaid: 0 };
    expect(requestEvents(paid, { ...paid, totalPaid: 100 })).toEqual([]);
  });
});

describe("messages", () => {
  const money = (v) => `RM ${Number(v).toFixed(2)}`;
  const r = { type: "advance", amount: 150, staffName: "Ali Hassan", reason: "rent", approvedBy: { name: "KL Manager" } };
  it("tell the owner who approved", () => {
    expect(requestMessage("approved", r, { money, branchName: "KL" })).toEqual({ title: "Advance approved · KL", body: "KL Manager approved RM 150.00 advance for Ali Hassan" });
  });
  it("tell the person their answer", () => {
    expect(requesterMessage("rejected", { ...r, rejectReason: "too soon" }, { money }).body).toBe("Your RM 150.00 advance was rejected — “too soon”");
    expect(requesterMessage("approved", { type: "leave", days: 2 }, { money }).body).toBe("Your leave was approved");
  });
  it("open the right page", () => {
    expect(requestLink("new")).toBe("/requested-panel");
    expect(requestLink("payout")).toBe("/entry-data/advance-entry");
    expect(requestLink("approved", { forRequester: true, role: "staff" })).toBe("/requests");
    expect(requestLink("approved", { forRequester: true, role: "cashier" })).toBe("/supervisor-panel");
  });
});

describe("the daily summary", () => {
  it("one message with what each person chose", () => {
    const base = { day: "2026-10-17", dayLabel: "Sat, 17 Oct", branchName: "KL", sales: 4200, costs: 900, money: (v) => `RM ${v}` };
    expect(dailyMessage({ ...base, wants: ["daily.sales", "daily.costs"] })).toEqual({ title: "KL — Sat, 17 Oct", body: "Sales RM 4200 · Costs RM 900" });
    expect(dailyMessage({ ...base, wants: ["daily.costs"] }).body).toBe("Costs RM 900");
    expect(dailyMessage({ ...base, wants: [] })).toBeNull();
  });
  it("on the branch's clock", () => {
    expect(hourOf("21:30")).toBe(21);
    expect(hourOf(undefined)).toBe(9);
    expect(localHour(new Date("2026-10-18T01:00:00Z"), "Asia/Kuala_Lumpur")).toBe(9);
    expect(localHour(new Date("2026-10-18T03:00:00Z"), "Asia/Dhaka")).toBe(9);
  });
});

describe("bills & vouchers (4.9, 4.10)", () => {
  it("go by default to everyone who approves them, the GM and super admin too — not the owner unless chosen", async () => {
    const { NOTIFY_TYPES } = await import("@/lib/notify/model");
    const t = NOTIFY_TYPES["costs.approval"];
    for (const r of ["gm", "superAdmin", "branchAdmin", "manager", "inCharge"]) expect(t.defaultFor(r)).toBe(true);
    for (const r of ["owner", "accountant", "cashier", "supervisor", "staff"]) expect(t.defaultFor(r)).toBe(false);
  });
});

describe("who may get each kind (canGet)", () => {
  it("only those who can open what it links to", async () => {
    const { mayGet, recipientsFor } = await import("@/lib/notify/model");
    expect(mayGet("costs.approval", "cashier")).toBe(false);
    expect(mayGet("costs.approval", "inCharge")).toBe(true);
    expect(mayGet("daily.sales", "cashier")).toBe(false);
    expect(mayGet("daily.sales", "accountant")).toBe(true);
    expect(mayGet("requests.payout", "cashier")).toBe(true);
    expect(mayGet("requests.new", "accountant")).toBe(false);
    expect(mayGet("nope", "owner")).toBe(false);
    const people = [{ uid: "c", role: "cashier" }, { uid: "m", role: "manager" }];
    // a branch had chosen the cashier for bills: they stop getting it; the manager still does
    expect(recipientsFor("costs.approval", { config: { recipients: { "costs.approval": ["c", "m"] } }, people })).toEqual(["m"]);
  });
});
