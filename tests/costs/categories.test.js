import { describe, expect, it } from "vitest";
import {
  DEFAULT_GROUPS, LEGACY, categoryFields, checkGroups, classify, findCategory, groupsFrom, isNotCost, missingFor, newId, pickable,
} from "@/lib/costs/categories";
import { approveVoucherPatch, canDecideVoucher, newVoucher, rejectVoucherPatch, voucherHint, voucherText, voucherWaitsFor } from "@/lib/costs/vouchers";
import { voucherLimit } from "@/lib/authz/permissions";

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
  it("a manager's or branch admin's own up to the branch's limit needs no one (1 Nov)", () => {
    const m = { uid: "m1", role: "manager" };
    expect(newVoucher(m, "stall", { amount: 100 })).toMatchObject({ status: "approved", auto: true });
    expect(newVoucher(m, "stall", { amount: 100.5 }).status).toBe("pending");
    expect(newVoucher(m, "stall", { amount: 150, limit: 200 }).status).toBe("approved");
    expect(newVoucher({ uid: "b1", role: "branchAdmin" }, "stall", { amount: 60 }).status).toBe("approved");
    expect(newVoucher({ uid: "i1", role: "inCharge" }, "stall", { amount: 5 }).status).toBe("pending");
    expect(voucherLimit(null)).toBe(100);
    expect(voucherLimit({ financeSales: { voucherLimit: 250 } })).toBe(250);
    expect(voucherLimit({ financeSales: { voucherLimit: "" } })).toBe(100);
    expect(voucherHint("manager", 100, (v) => `RM ${v}`)).toBe("Up to RM 100 it needs no approval; above that, branch admin or above approves it.");
    expect(voucherHint("inCharge")).toBe("It is saved with a voucher; a manager or above approves it.");
  });
  it("only someone senior to whoever made it (owner, 31 Oct)", () => {
    const byManager = { amount: 400, voucher: newVoucher({ uid: "m1", role: "manager" }, "stall", { amount: 400 }) };
    expect(canDecideVoucher({ uid: "i1", role: "inCharge" }, byManager)).toBe(false);
    expect(canDecideVoucher({ uid: "m2", role: "manager" }, byManager)).toBe(false);
    expect(canDecideVoucher({ uid: "b1", role: "branchAdmin" }, byManager)).toBe(true);
    expect(canDecideVoucher({ uid: "g1", role: "gm" }, byManager)).toBe(true);
    expect(voucherWaitsFor({ uid: "i1", role: "inCharge" }, byManager)).toBe("Waits for branch admin or above.");
    const byInCharge = { amount: 40, voucher: newVoucher({ uid: "i1", role: "inCharge" }, "stall") };
    expect(canDecideVoucher({ uid: "m1", role: "manager" }, byInCharge)).toBe(true);
    expect(canDecideVoucher({ uid: "i2", role: "inCharge" }, byInCharge)).toBe(false);
    // an older voucher with no role: looked up
    const old = { amount: 40, voucher: { status: "pending", reason: "x", by: { uid: "m1" } } };
    expect(canDecideVoucher({ uid: "i1", role: "inCharge" }, old, (uid) => (uid === "m1" ? "manager" : ""))).toBe(false);
    expect(canDecideVoucher({ uid: "i1", role: "inCharge" }, { ...old, createdBy: { uid: "m1", role: "manager" } })).toBe(false);
  });
  it("a company role's needs no one: approved as it is saved", () => {
    const v = newVoucher({ uid: "g1", role: "gm", firstName: "Gita" }, "stall");
    expect(v).toMatchObject({ status: "approved", auto: true, decidedBy: { uid: "g1" } });
    expect(voucherText({ voucher: v })).toMatch(/no approval needed/);
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
