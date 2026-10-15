// lib/authz/roles.js
// Single source of truth for all role names used across the app,
// middleware, and Firestore rules.
export const ROLES = {
  owner: "owner",
  branchAdmin: "branchAdmin",
  manager: "manager",
  accountant: "accountant",
  supervisor: "supervisor",
  cashier: "cashier",
  gm: "gm",
  superAdmin: "superAdmin",
  staff: "staff",
};

export const ALLOWED_EDIT_ROLES = [
  ROLES.manager,
  ROLES.branchAdmin,
  ROLES.accountant,
  ROLES.supervisor,
];

export const ALLOWED_DELETE_ROLES = [
  ROLES.manager,
  ROLES.branchAdmin,
];

// The signed-in user: getSessionUser() from "@/lib/session". (Not imported
// here — middleware.js uses this file and must not load Firebase.)

export function hasRole(user, allowed = ALLOWED_EDIT_ROLES) {
  const role = user?.role;
  return !!role && allowed.includes(role);
}
