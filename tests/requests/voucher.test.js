import { describe, expect, it } from "vitest";
import { receivedStamp, repaymentText, requestSheet } from "@/lib/requests/voucher";
import { payoutSheet } from "@/lib/payouts/voucher";

const money = (v) => `RM ${Number(v).toFixed(2)}`;
const branch = { name: "Demo Branch KL", code: "DKL" };

describe("advance and staff loan vouchers (1 Nov)", () => {
  const adv = { type: "advance", staffName: "Ali Hassan", amount: 200, reason: "Rent", date: "2026-11-01", repaymentInstallments: 2, repaymentPerInstallment: 100, deductionMonth: "2026-12", createdBy: { uid: "u-ali", name: "Ali Hassan" }, askedAt: "2026-11-01T02:00:00Z" };
  it("waits: Approved by and Received by empty, no number yet", () => {
    const s = requestSheet({ ...adv, status: "pending" }, { branch, money });
    expect(s).toMatchObject({ title: "ADVANCE VOUCHER", no: "—", branchName: "Demo Branch KL" });
    expect(s.rows.find((r) => r.label === "Amount")).toEqual({ label: "Amount", value: "RM 200.00", words: "Two hundred ringgit only" });
    expect(s.rows.find((r) => r.label === "Paid back").value).toBe("2 months: RM 100.00 a month from pay, from 2026-12");
    expect(s.boxes.map((b) => b.label)).toEqual(["Requested by", "Approved by", "Received by"]);
    expect(s.boxes[1].waiting).toBe("Waiting for approval");
    expect(s.boxes[2].waiting).toBe("Signs when paid");
  });
  it("paid and signed: its number, who handed it over, Ali's own signature", () => {
    const received = receivedStamp(" Ali Hassan ", "data:image/png;base64,AAA", "2026-11-01T10:00:00Z");
    const s = requestSheet({ ...adv, status: "approved", approvedBy: { id: "m1", name: "KL Manager", timestamp: "2026-11-01T03:00:00Z" }, paidOut: { date: "2026-11-01", from: "front", by: { name: "KL Cashier" } }, voucher: { no: 3, received } }, { branch, money });
    expect(s.no).toBe("DKL-A-0003");
    expect(s.rows.find((r) => r.label === "Paid from").value).toBe("Till (cash)");
    expect(s.rows.find((r) => r.label === "Handed over by").value).toBe("KL Cashier");
    expect(s.boxes[1]).toMatchObject({ uid: "m1", name: "KL Manager" });
    expect(s.boxes[2]).toMatchObject({ name: "Ali Hassan", sig: "data:image/png;base64,AAA" });
  });
  it("a staff loan has its own series and its months", () => {
    const s = requestSheet({ type: "staffLoan", staffName: "Siti", amount: 1200, durationMonths: 6, emi: 200, repaymentStartDate: "2026-12-01", voucher: { no: 1 } }, { branch, money });
    expect(s).toMatchObject({ title: "STAFF LOAN VOUCHER", no: "DKL-L-0001" });
    expect(repaymentText({ durationMonths: 6, emi: 200, repaymentStartDate: "2026-12-01" }, money)).toBe("6 months: RM 200.00 a month from pay, from 2026-12");
  });
});

describe("a pay-out's bill with no paper (1 Nov)", () => {
  const settle = { date: "2026-11-01", to: { name: "Sam" }, purpose: "Gas", category: "Cooking gas", billAmount: 52, floatAmount: 60, voucherReason: "Stall gave none", by: { uid: "c1", name: "KL Cashier" }, createdAt: "2026-11-01T05:00:00Z" };
  it("who brought it, who took the money (signed at the hand-out), who approves", () => {
    const out = { received: { name: "Sam", sig: "data:image/png;base64,BBB", at: "2026-11-01T01:00:00Z" } };
    const s = payoutSheet(settle, { branch, out, no: 12, money });
    expect(s).toMatchObject({ title: "PAY-OUT VOUCHER", no: "DKL-V-0012" });
    expect(s.rows.find((r) => r.label === "Spent")).toEqual({ label: "Spent", value: "RM 52.00", words: "Fifty-two ringgit only" });
    expect(s.rows.find((r) => r.label === "Handed out").value).toBe("RM 60.00 from the till · RM 8.00 change goes back in the till");
    expect(s.boxes[0]).toMatchObject({ label: "Prepared by", uid: "c1", name: "KL Cashier" });
    expect(s.boxes[1]).toMatchObject({ label: "Received by", name: "Sam", sig: "data:image/png;base64,BBB" });
    expect(s.boxes[2].waiting).toBe("Waiting for approval");
  });
  it("handed out before signatures: says so, no made-up signature", () => {
    expect(payoutSheet(settle, { branch, money }).boxes[1]).toEqual({ label: "Received by", waiting: "Sam — not signed" });
  });
});
