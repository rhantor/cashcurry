import { describe, expect, it } from "vitest";
import {
  DEFAULT_GROUPS, LEGACY, categoryFields, checkGroups, classify, findCategory, groupsFrom, isNotCost, missingFor, newId, pickable,
} from "@/lib/costs/categories";
import { approveVoucherPatch, canDecideVoucher, newVoucher, rejectVoucherPatch, voucherText } from "@/lib/costs/vouchers";

describe("cost categories", () => {
  it("defaults until the company saves its own; hidden ones stay for old records but can't be picked", () => {
    expect(groupsFrom(null)).toHaveLength(DEFAULT_GROUPS.length);
    const own = groupsFrom({ groups: [{ id: "g", name: "G", kind: "weird", categories: [{ id: "a", name: "A" }, { id: "b", name: "B", hidden: true }] }] });
    expect(own[0].kind).toBe("expense");
    expect(own[0].categories[1].needs).toEqual([]);
    expect(pickable(own)[0].categories.map((c) => c.id)).toEqual(["a"]);
    expect(findCategory(own, "b").category.name).toBe("B");
  });

  it("a new cost keeps a snapshot of its group, category and kind", () => {
    const g = groupsFrom(null);
    expect(categoryFields(g, "electricity")).toEqual({ categoryId: "electricity", category: "Electricity", costGroupId: "premises", costGroup: "Premises", costKind: "expense" });
    expect(categoryFields(g, "drawings").costKind).toBe("notCost");
    expect(categoryFields(g, "assets")).toMatchObject({ costGroupId: "running", costKind: "expense" });
    expect(categoryFields(g, "nope")).toBeNull();
  });

  it("not a cost: by the saved kind, or for old records by their old name", () => {
    expect(isNotCost({ costKind: "notCost", category: "Owner drawings" })).toBe(true);
    expect(isNotCost({ costKind: "notCost", category: "Equipment & assets" })).toBe(true); // the snapshot wins
    expect(isNotCost({ category: "New Purchases/Assets" })).toBe(false); // equipment is a cost (19 Oct)
    expect(isNotCost({ category: "Inventory" })).toBe(false);
    expect(isNotCost({ category: "Some typed thing" })).toBe(false);
    expect(isNotCost({})).toBe(false);
  });

  it("every old name has a group; reports group old and new alike", () => {
    const ids = DEFAULT_GROUPS.map((g) => g.id);
    for (const g of Object.values(LEGACY)) expect(ids).toContain(g);
    expect(classify({ category: "Utilities" })).toMatchObject({ groupId: "premises", group: "Premises", kind: "expense" });
    expect(classify({ category: "compund" })).toMatchObject({ groupId: "running", category: "Compounds & fines" });
    expect(classify({ category: "Pest guy (typed)" })).toMatchObject({ groupId: "running", kind: "expense" });
    expect(classify({ category: "Electricity", costGroupId: "premises", costGroup: "Premises", costKind: "expense" })).toMatchObject({ groupId: "premises" });
  });

  it("asks for who was paid, or the bill's month, when the category needs it", () => {
    const food = findCategory(DEFAULT_GROUPS, "ingredients").category;
    const power = findCategory(DEFAULT_GROUPS, "electricity").category;
    expect(missingFor(food, {})).toHaveProperty("paidTo");
    expect(missingFor(food, { vendorId: "v1" })).toEqual({});
    expect(missingFor(food, { paidTo: "Pasar Chow Kit" })).toEqual({});
    expect(missingFor(power, { billMonth: "2026-9" })).toHaveProperty("billFor");
    expect(missingFor(power, { billMonth: "2026-09" })).toEqual({});
    expect(missingFor(findCategory(DEFAULT_GROUPS, "office").category, {})).toEqual({});
  });

  it("checks names before saving: none empty, none twice", () => {
    expect(checkGroups(DEFAULT_GROUPS)).toEqual([]);
    expect(checkGroups([{ name: "", categories: [] }])).toContain("Every group needs a name.");
    expect(checkGroups([{ name: "A", categories: [{ name: "X" }, { name: "x" }] }])).toContain('"x" is in "A" twice.');
    expect(checkGroups([{ name: "A", categories: [{ name: "X" }] }, { name: "B", categories: [{ name: "X" }] }])).toContain('"X" is in two groups.');
  });

  it("new ids are tidy and unique", () => {
    expect(newId("Food & Drinks")).toBe("food-and-drinks");
    expect(newId("Rent", ["rent"])).toBe("rent-2");
  });
});

describe("vouchers (costs without an invoice)", () => {
  const maker = { uid: "cashier1", role: "cashier", firstName: "Siti" };
  const cost = { amount: 30, createdBy: { uid: "cashier1" }, voucher: newVoucher(maker, "Market stall") };
  it("in-charge, manager, branch admin (and the company) approve — never the one who made it", () => {
    expect(canDecideVoucher({ uid: "m1", role: "manager" }, cost)).toBe(true);
    expect(canDecideVoucher({ uid: "i1", role: "inCharge" }, cost)).toBe(true);
    expect(canDecideVoucher({ uid: "o1", role: "owner" }, cost)).toBe(true);
    expect(canDecideVoucher({ uid: "c2", role: "cashier" }, cost)).toBe(false);
    expect(canDecideVoucher({ uid: "a1", role: "accountant" }, cost)).toBe(false);
    const own = { ...cost, createdBy: { uid: "m1" }, voucher: newVoucher({ uid: "m1" }, "x") };
    expect(canDecideVoucher({ uid: "m1", role: "manager" }, own)).toBe(false);
  });
  it("only while it waits", () => {
    const done = { ...cost, voucher: { ...cost.voucher, status: "approved" } };
    expect(canDecideVoucher({ uid: "m1", role: "manager" }, done)).toBe(false);
  });
  it("says where it stands", () => {
    const now = new Date("2026-10-19T10:00:00Z");
    expect(approveVoucherPatch({ uid: "m1", firstName: "Mira" }, now)).toMatchObject({ "voucher.status": "approved", "voucher.decidedBy": { uid: "m1", name: "Mira" } });
    expect(rejectVoucherPatch({ uid: "m1" }, " no photo ")["voucher.note"]).toBe("no photo");
    expect(voucherText(cost)).toMatch(/waiting/);
    expect(voucherText({ voucher: { status: "rejected", decidedBy: { name: "Mira" }, note: "Ask the stall" } })).toBe("Voucher sent back by Mira: Ask the stall");
  });
});
