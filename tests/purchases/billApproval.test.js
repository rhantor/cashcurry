import { describe, expect, it } from "vitest";
import { approvalLine, canDecideBill, cleanReason, countedBills, counts, waitsForApproval } from "@/lib/purchases/billApproval";

describe("a new vendor bill from a supervisor waits for approval (13 Nov)", () => {
  it("waits when a supervisor or in-charge adds it, not when the books do", () => {
    for (const r of ["supervisor", "inCharge"]) expect(waitsForApproval(r)).toBe(true);
    for (const r of ["owner", "gm", "superAdmin", "branchAdmin", "manager", "accountant"]) expect(waitsForApproval(r)).toBe(false);
    for (const r of ["cashier", "staff", "kiosk"]) expect(waitsForApproval(r)).toBe(false);
  });
  it("is decided by those who keep the books, never by the one who added it", () => {
    for (const r of ["manager", "accountant", "branchAdmin", "owner"]) expect(canDecideBill(r)).toBe(true);
    for (const r of ["supervisor", "inCharge", "cashier"]) expect(canDecideBill(r)).toBe(false);
  });
  it("counts nowhere until approved, nor when sent back", () => {
    const bills = [{ id: "a", status: "unpaid" }, { id: "b", status: "waiting" }, { id: "c", status: "rejected" }, { id: "d", status: "paid" }, { id: "e", status: "partially_paid" }];
    expect(countedBills(bills).map((b) => b.id)).toEqual(["a", "d", "e"]);
    expect(counts(null)).toBe(false);
    expect(countedBills(undefined)).toEqual([]);
  });
  it("needs a reason to send one back, kept short", () => {
    expect(cleanReason("  ").error).toBeTruthy();
    expect(cleanReason(" wrong amount ").value).toBe("wrong amount");
    expect(cleanReason("x".repeat(400)).value).toHaveLength(300);
  });
  it("says where it stands", () => {
    expect(approvalLine({ status: "waiting", createdBy: { name: "Sam" } })).toBe("Waiting for approval · added by Sam");
    expect(approvalLine({ status: "rejected", approval: { by: { name: "Mia" }, reason: "wrong amount" } })).toBe("Sent back by Mia: wrong amount");
    expect(approvalLine({ status: "unpaid" })).toBe("");
  });
});
