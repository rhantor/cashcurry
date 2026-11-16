import { describe, expect, it } from "vitest";
import { checkLineText, followUpOrder, needsApproval, receiveCheck, repeatOrder } from "@/lib/purchases/orders";
import { receivedBillWaits, waitsForApproval } from "@/lib/purchases/billApproval";
import { can, canOpen, roleLabel, BRANCH_ASSIGNABLE } from "@/lib/authz/permissions";

describe("the kitchen lead (16 Nov 2026)", () => {
  it("orders, takes goods in and counts stock — never sales, cash, costs or pay", () => {
    for (const c of ["purchases.order", "purchases.billAdd", "inventory.count", "inventory.manage", "catalog.view", "warranties.manage", "tasks.team", "issues.raise"]) {
      expect(can("kitchenLead", c), c).toBe(true);
    }
    for (const c of ["sales.enter", "costs.enter", "cashInHand.view", "purchases.approve", "purchases.bills", "payouts.handOut", "reports.view", "dashboard.branch", "payroll.view", "staff.pay", "records.edit", "costs.approve"]) {
      expect(can("kitchenLead", c), c).toBe(false);
    }
    expect(canOpen("kitchenLead", "/purchases/purchase-orders")).toBe(true);
    expect(canOpen("kitchenLead", "/purchases/inventory")).toBe(true);
    expect(canOpen("kitchenLead", "/purchases/due-bills")).toBe(false);
    expect(canOpen("kitchenLead", "/entry-data/sales-entry")).toBe(false);
    expect(canOpen("kitchenLead", "/dashboard")).toBe(false);
    expect(roleLabel("kitchenLead")).toBe("Kitchen lead");
    expect(BRANCH_ASSIGNABLE).toContain("kitchenLead");
  });

  it("their orders always wait for approval; others follow the branch's policy", () => {
    expect(needsApproval({ createdByRole: "kitchenLead" }, false)).toBe(true);
    expect(needsApproval({ createdByRole: "supervisor" }, false)).toBe(false);
    expect(needsApproval({ createdByRole: "supervisor" }, true)).toBe(true);
    expect(needsApproval({}, false)).toBe(false);
  });

  it("orders made again or for what came short stay theirs", () => {
    const user = { uid: "k1", name: "K", role: "kitchenLead" };
    const po = { vendorId: "v1", items: [{ itemId: "i1", requestedQty: 2, estPrice: 3 }], receivedItems: [{ itemId: "i1", requestedQty: 2, receivedQty: 1, finalPrice: 3 }] };
    expect(repeatOrder(po, user).createdByRole).toBe("kitchenLead");
    expect(followUpOrder(po, user).createdByRole).toBe("kitchenLead");
  });
});

describe("goods in against the order", () => {
  const order = { totalEst: 100 };
  const line = (o) => ({ name: "Chicken", unit: "kg", requestedQty: 10, receivedQty: 10, estPrice: 10, finalPrice: 10, ...o });

  it("as ordered, less or cheaper: fine", () => {
    expect(receiveCheck(order, [line()], 100).ok).toBe(true);
    expect(receiveCheck(order, [line({ receivedQty: 8, finalPrice: 9.5 })], 76).ok).toBe(true);
    expect(receiveCheck(order, [line({ receivedQty: 0, finalPrice: 99 })], 0).ok).toBe(true); // didn't come
  });

  it("more, dearer, no price on the order, or a bigger total: it waits", () => {
    const more = receiveCheck(order, [line({ receivedQty: 12 })], 120);
    expect(more.ok).toBe(false);
    expect(more.lines[0]).toMatchObject({ more: true, ordered: 10, came: 12 });
    expect(more.over).toBe(true);
    expect(receiveCheck(order, [line({ finalPrice: 10.2 })], 102).lines[0].dearer).toBe(true);
    expect(receiveCheck(order, [line({ estPrice: 0 })], 100).lines[0].noPrice).toBe(true);
    expect(receiveCheck(order, [line()], 100.5).ok).toBe(false);
  });

  it("in words", () => {
    const l = receiveCheck(order, [line({ receivedQty: 12, finalPrice: 10.2 })], 122.4).lines[0];
    expect(checkLineText(l, (v) => v.toFixed(2))).toBe("Chicken: 12 kg, ordered 10 · 10.20 a kg, ordered at 10.00");
  });

  it("the bill waits only for those who don't keep the books", () => {
    const dear = receiveCheck(order, [line({ finalPrice: 11 })], 110);
    const fine = receiveCheck(order, [line()], 100);
    expect(receivedBillWaits("kitchenLead", dear)).toBe(true);
    expect(receivedBillWaits("supervisor", dear)).toBe(true);
    expect(receivedBillWaits("kitchenLead", fine)).toBe(false);
    expect(receivedBillWaits("accountant", dear)).toBe(false);
    expect(receivedBillWaits("manager", dear)).toBe(false);
    expect(waitsForApproval("kitchenLead")).toBe(true);
  });
});
