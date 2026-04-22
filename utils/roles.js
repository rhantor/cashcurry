// utils/roles.js
export const normalizeRole = (r) =>
  String(r || "")
    .trim()
    .toLowerCase();

export const canManageAllBranches = (role) => {
  const r = normalizeRole(role);
  // company-level policy: everyone except cashier can manage
  return ["owner", "superadmin", "gm", "supervisor", "accountant"].includes(r);
};


