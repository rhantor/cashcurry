// lib/authz/roles.js
// Single source of truth for all role names used across the app,
// middleware, and Firestore rules.
export const ROLES = {
  owner: "owner",
  branchAdmin: "branchAdmin",
  manager: "manager",
  inCharge: "inCharge", // runs the outlet or shift when the manager is away
  accountant: "accountant",
  supervisor: "supervisor",
  cashier: "cashier",
  gm: "gm",
  superAdmin: "superAdmin",
  staff: "staff",
};

// Who may edit / delete saved records: the "records.edit" and "records.delete"
// rows of the roles matrix (lib/authz/permissions.js). Kept here, spelled out,
// because middleware-safe code imports this file; tests/authz checks the two agree.
export const ALLOWED_EDIT_ROLES = [
  ROLES.owner, ROLES.superAdmin, ROLES.gm,
  ROLES.branchAdmin, ROLES.manager, ROLES.inCharge, ROLES.accountant, ROLES.supervisor,
];

export const ALLOWED_DELETE_ROLES = [
  ROLES.owner, ROLES.superAdmin, ROLES.gm,
  ROLES.branchAdmin, ROLES.manager,
];

// The signed-in user: getSessionUser() from "@/lib/session". (Not imported
// here — middleware.js uses this file and must not load Firebase.)

export function hasRole(user, allowed = ALLOWED_EDIT_ROLES) {
  // old spellings (branchadmin, superadmin) count as the new ones
  const raw = user?.role;
  const role = raw === "branchadmin" ? ROLES.branchAdmin : raw === "superadmin" ? ROLES.superAdmin : raw;
  return !!role && allowed.includes(role);
}
