import { describe, expect, it } from "vitest";
import { CAN, OPTIONAL_GRANTS, can, canOpen, cleanGrants, grantedTo } from "@/lib/authz/permissions";
import { GUIDE_ROLES, ROLE_GUIDE } from "@/lib/authz/roleGuide";

describe("Settings → Roles switches (15 Nov)", () => {
  it("keep only the five switches, each for its own role", () => {
    expect(cleanGrants({ "costs.enter": ["supervisor", "cashier"], "payroll.view": ["supervisor"], "attendance.view": ["accountant"] })).toEqual({
      "costs.enter": ["supervisor"],
      "attendance.view": ["accountant"],
    });
    expect(cleanGrants(null)).toEqual({});
    expect(cleanGrants("nope")).toEqual({});
  });

  it("add a right on top of the matrix, never take one away", () => {
    const g = cleanGrants({ "costs.enter": ["supervisor"] });
    expect(can("supervisor", "costs.enter")).toBe(false);
    expect(can("supervisor", "costs.enter", g)).toBe(true);
    expect(can("cashier", "costs.enter", g)).toBe(false);
    // a manager keeps costs whatever the switches say
    expect(can("manager", "costs.enter", {})).toBe(true);
    expect(grantedTo("supervisor", g)).toEqual(["costs.enter"]);
  });

  it("open the page that goes with them", () => {
    const g = cleanGrants({ "costs.enter": ["supervisor"], "attendance.view": ["accountant"] });
    expect(canOpen("supervisor", "/entry-data/cost-entry", {})).toBe(false);
    expect(canOpen("supervisor", "/entry-data/cost-entry", g)).toBe(true);
    expect(canOpen("accountant", "/attendance-log", g)).toBe(true);
    expect(canOpen("cashier", "/entry-data/cost-entry", g)).toBe(false);
  });

  it("only switch on what a role doesn't have already", () => {
    for (const s of OPTIONAL_GRANTS) {
      expect(CAN[s.capability], s.capability).toBeTruthy();
      expect(can(s.role, s.capability, {}), `${s.role} ${s.capability}`).toBe(false);
    }
  });

  it("the guide on the screen names real rights and roles", () => {
    for (const g of ROLE_GUIDE) for (const [cap] of g.rows) expect(CAN[cap], cap).toBeTruthy();
    for (const r of GUIDE_ROLES) expect(typeof can(r, "sales.enter", {})).toBe("boolean");
  });
});
