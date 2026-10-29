// The roles matrix (docs/ROLES.md, agreed 18 Oct 2026): the owner's answers
// as tests, and the menu checked against the page guard.
import { describe, it, expect } from "vitest";
import { CAN, PAGES, can, canOpen, pageNeeds, normalizeRole } from "@/lib/authz/permissions";
import { navFor, pagesFor, sidebarItems } from "@/app/components/shell/navigation";

const ALL = ["owner", "superAdmin", "gm", "branchAdmin", "manager", "inCharge", "accountant", "supervisor", "cashier", "staff"];
const who = (cap) => ALL.filter((r) => can(r, cap));

describe("the owner's decisions", () => {
  it("in-charge: enters sales and costs, approves purchase orders, sees reports; no payroll, settings or staff pay", () => {
    for (const c of ["sales.enter", "costs.enter", "purchases.approve", "reports.view", "kiosk.open"]) expect(can("inCharge", c)).toBe(true);
    for (const c of ["payroll.view", "payroll.manage", "branchSettings.manage", "staff.pay", "staff.manage", "advances.approve"]) expect(can("inCharge", c)).toBe(false);
  });

  it("accountant: pays purchase bills, sees payroll but does not run it, asks for advances but does not approve them", () => {
    expect(can("accountant", "purchases.bills")).toBe(true);
    expect(can("accountant", "payroll.view")).toBe(true);
    expect(can("accountant", "payroll.manage")).toBe(false);
    expect(can("accountant", "advances.request")).toBe(true);
    expect(can("accountant", "advances.approve")).toBe(false);
  });

  it("supervisor and cashier enter, they don't see the books", () => {
    for (const r of ["supervisor", "cashier"]) {
      for (const c of ["reports.view", "dashboard.branch", "dashboard.company", "payroll.view", "staff.pay"]) expect(can(r, c)).toBe(false);
      expect(can(r, "sales.enter")).toBe(true);
      expect(can(r, "advances.payOut")).toBe(true);
    }
  });

  it("only owner, superAdmin and branchAdmin change money settings — not the GM", () => {
    expect(who("moneySettings.manage")).toEqual(["owner", "superAdmin", "branchAdmin"]);
  });

  it("the cashier no longer has Salaries entry", () => {
    expect(can("cashier", "salaries.enter")).toBe(false);
    expect(canOpen("cashier", "/entry-data/salary-entry")).toBe(false);
  });

  it("owner, superAdmin and GM run staff, payroll and branch settings for the branch they pick", () => {
    for (const r of ["owner", "superAdmin", "gm"]) {
      for (const p of ["/staff-management", "/payroll", "/payroll/history", "/branch-settings", "/attendance-log"]) expect(canOpen(r, p)).toBe(true);
    }
  });

  it("staff only use the staff app", () => {
    // the staff app — which includes reporting an issue (4.5)
    const STAFF = ["staffApp.use", "issues.raise"];
    for (const cap of Object.keys(CAN)) expect(can("staff", cap), cap).toBe(STAFF.includes(cap));
    expect(canOpen("staff", "/payroll")).toBe(false);
    expect(canOpen("staff", "/purchases/order-guides")).toBe(false);
    expect(canOpen("staff", "/staff-portal")).toBe(true);
  });
});

describe("records", () => {
  it("the old edit / delete lists agree with the matrix", async () => {
    const { ALLOWED_EDIT_ROLES, ALLOWED_DELETE_ROLES } = await import("@/lib/authz/roles");
    expect([...ALLOWED_EDIT_ROLES].sort()).toEqual([...CAN["records.edit"]].sort());
    expect([...ALLOWED_DELETE_ROLES].sort()).toEqual([...CAN["records.delete"]].sort());
  });
});

describe("the page guard", () => {
  it("pages missing from the old guard are now guarded", () => {
    expect(canOpen("cashier", "/payroll")).toBe(false);
    expect(canOpen("cashier", "/staff-management")).toBe(false);
    expect(canOpen("cashier", "/purchases/due-bills")).toBe(false);
    expect(canOpen("cashier", "/branches/branch-management")).toBe(false);
    expect(canOpen("supervisor", "/reports/sales-report")).toBe(false);
  });

  it("the longest page prefix decides (/payroll/history is not /payroll)", () => {
    expect(pageNeeds("/payroll/history")).toBe("payroll.view");
    expect(pageNeeds("/reports/yearly-summary/2026")).toBe("reports.view");
    expect(canOpen("accountant", "/payroll/history")).toBe(true);
    expect(canOpen("accountant", "/payroll")).toBe(false);
  });

  it("an unknown or missing role opens nothing but home", () => {
    expect(canOpen("", "/dashboard")).toBe(false);
    expect(canOpen("hacker", "/support")).toBe(false);
  });

  it("old lowercase spellings still work", () => {
    expect(normalizeRole("branchadmin")).toBe("branchAdmin");
    expect(normalizeRole("superadmin")).toBe("superAdmin");
    expect(canOpen("branchadmin", "/payroll")).toBe(true);
  });

  it("every capability named in the page table exists", () => {
    for (const need of Object.values(PAGES)) for (const c of [].concat(need)) expect(CAN[c], c).toBeTruthy();
  });
});

describe("the menu", () => {
  it("never offers a page the guard refuses, for any role", () => {
    for (const r of ALL) for (const p of pagesFor(r)) expect(canOpen(r, p.path), `${r} ${p.path}`).toBe(true);
  });

  it("every page in the menu is in the page table (so nothing is open by accident)", () => {
    const paths = sidebarItems.flatMap((it) => [it.path, ...(it.children || []).map((c) => c.path)]).filter(Boolean);
    for (const p of paths) expect(pageNeeds(p), p).not.toBeNull();
  });

  it("each role's menu, at a glance", () => {
    const top = (r) => navFor(r).flatMap((s) => s.items.map((i) => i.label));
    expect(top("cashier")).toEqual(["Entries", "Pay-outs", "My Requests", "Issues", "Tasks", "Loans", "My pay & attendance", "Tools", "Support"]); // chat: its own workspace, from the top bar // Loans: the staff loan tracker, to hand out approved ones
    expect(top("staff")).toEqual([]);
    // a cashier's Tools: only the reservation receipt (25 Oct 2026)
    expect(navFor("cashier").flatMap((x) => x.items).find((i) => i.label === "Tools").children.map((c) => c.label)).toEqual(["Reservation Receipt"]);
    expect(top("owner")).toContain("Staff Management");
    expect(top("owner")).toContain("Payroll");
    expect(top("owner")).toContain("Branch Settings");
    expect(top("supervisor")).not.toContain("Reports");
    expect(top("inCharge")).toContain("Reports");
    expect(top("inCharge")).not.toContain("Payroll");
    expect(top("inCharge")).toContain("Requested Panel"); // vouchers and bills (4.9, 4.10)
    expect(top("accountant")).not.toContain("Pay-outs");
  });
});
