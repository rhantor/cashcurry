import { describe, expect, it } from "vitest";
import { hasChanges, planAccountEdit } from "@/lib/users/accountEdit";

const owner = { uid: "o", role: "owner", companyId: "co" };
const sa = { uid: "sa", role: "superAdmin", companyId: "co" };
const gm = { uid: "g", role: "gm", companyId: "co" };
const cashier = { uid: "c", role: "cashier", companyId: "co", branchId: "kl", userName: "kl_cashier", email: "c@x.co", fullName: "Cas" };
const admin = { uid: "a", role: "branchAdmin", companyId: "co", branchId: "kl", userName: "kl_admin" };

describe("changing an office login (15 Nov)", () => {
  it("only the owner or a super admin may", () => {
    expect(planAccountEdit({ caller: gm, target: cashier, changes: { role: "supervisor" } }).error).toMatch(/owner or a super admin/);
    expect(planAccountEdit({ caller: sa, target: cashier, changes: { role: "supervisor" } }).value.role).toEqual({ from: "cashier", to: "supervisor" });
    expect(planAccountEdit({ caller: owner, target: { ...cashier, companyId: "other" }, changes: { role: "supervisor" } }).error).toMatch(/another company/);
  });
  it("never the owner's login, a staff login, or one's own role", () => {
    expect(planAccountEdit({ caller: sa, target: { uid: "o", role: "owner", companyId: "co" }, changes: { role: "gm" } }).error).toBeTruthy();
    expect(planAccountEdit({ caller: owner, target: { ...cashier, role: "staff" }, changes: { role: "cashier" } }).error).toMatch(/staff record/);
    expect(planAccountEdit({ caller: sa, target: { ...sa }, changes: { role: "gm" } }).error).toMatch(/own role/);
  });
  it("a super admin's role is the owner's to change", () => {
    const other = { uid: "sa2", role: "superAdmin", companyId: "co" };
    expect(planAccountEdit({ caller: sa, target: other, changes: { role: "gm" } }).error).toMatch(/Only the owner/);
    expect(planAccountEdit({ caller: owner, target: other, changes: { role: "gm" } }).value.role.to).toBe("gm");
  });
  it("keeps company-wide and branch roles apart", () => {
    expect(planAccountEdit({ caller: owner, target: { uid: "g", role: "gm", companyId: "co" }, changes: { role: "cashier" } }).error).toMatch(/company-wide/);
    expect(planAccountEdit({ caller: owner, target: cashier, changes: { role: "gm" } }).error).toMatch(/branch role/);
  });
  it("moves a login between the branch's admins and users, two admins at most", () => {
    expect(planAccountEdit({ caller: owner, target: cashier, changes: { role: "branchAdmin" }, adminsInBranch: 1 }).value.move).toBe("toAdmins");
    expect(planAccountEdit({ caller: owner, target: cashier, changes: { role: "branchAdmin" }, adminsInBranch: 2 }).error).toMatch(/already has 2/);
    expect(planAccountEdit({ caller: owner, target: admin, changes: { role: "manager" } }).value.move).toBe("toUsers");
    expect(planAccountEdit({ caller: owner, target: cashier, changes: { role: "supervisor" } }).value.move).toBeNull();
  });
  it("checks the name, email and username, and only keeps real changes", () => {
    expect(planAccountEdit({ caller: owner, target: cashier, changes: { fullName: "  " } }).error).toBeTruthy();
    expect(planAccountEdit({ caller: owner, target: cashier, changes: { email: "nope" } }).error).toBeTruthy();
    expect(planAccountEdit({ caller: owner, target: cashier, changes: { userName: "a b" } }).error).toBeTruthy();
    const same = planAccountEdit({ caller: owner, target: cashier, changes: { role: "cashier", email: "C@X.co", userName: "KL_Cashier", fullName: "Cas" } }).value;
    expect(hasChanges(same)).toBe(false);
    const v = planAccountEdit({ caller: owner, target: cashier, changes: { userName: "Till_1", email: "t@x.co" } }).value;
    expect(v).toMatchObject({ userName: "till_1", email: "t@x.co" });
  });
});
