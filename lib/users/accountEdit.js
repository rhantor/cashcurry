// Changing someone's office login from User Management (owner, 15 Nov 2026):
// their role, name, email or username. The role in /users/{uid} is what every
// screen and database rule reads, and only the server may write it there — the
// old screens wrote it from the browser, the rules refused, and the branch list
// and the real login ended up saying different things. Pure rules here;
// app/api/users/update does the writes.

import { BRANCH_ASSIGNABLE, COMPANY_ASSIGNABLE, can, isCompanyRole, normalizeRole, roleLabel } from "@/lib/authz/permissions";

export const MAX_BRANCH_ADMINS = 2;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME = /^[a-z0-9._-]{3,30}$/;

export const usernameKey = (v) => String(v || "").toLowerCase().trim();

/**
 * What a change does, or why it can't be made.
 *   caller  { uid, role, companyId }
 *   target  { uid, role, companyId, branchId, platformAdmin, email, userName, fullName, name }
 *   changes { role?, fullName?, email?, userName? } — only what the screen sent
 *   adminsInBranch  branch admins the target's branch has now
 * → { value: { role: { from, to } | null, move: "toAdmins" | "toUsers" | null, fullName?, email?, userName? } } or { error }.
 */
export function planAccountEdit({ caller, target, changes = {}, adminsInBranch = 0 }) {
  if (!caller || !can(caller.role, "company.manage")) return { error: "Only the owner or a super admin can change logins." };
  if (!target || target.companyId !== caller.companyId) return { error: "That login belongs to another company." };
  if (target.platformAdmin) return { error: "That login can't be changed here." };
  const from = normalizeRole(target.role);
  if (from === "owner") return { error: "The owner's login can't be changed here." };
  if (from === "staff") return { error: "Staff app logins are changed from the staff record." };
  if (from === "superAdmin" && normalizeRole(caller.role) !== "owner" && caller.uid !== target.uid) {
    return { error: "Only the owner can change a super admin's login." };
  }

  const value = { role: null, move: null };

  if (changes.role != null && normalizeRole(changes.role) !== from) {
    const to = normalizeRole(changes.role);
    if (caller.uid === target.uid) return { error: "You can't change your own role." };
    if (isCompanyRole(from)) {
      if (!COMPANY_ASSIGNABLE.includes(to)) return { error: `A company-wide login can be ${COMPANY_ASSIGNABLE.map(roleLabel).join(" or ")}.` };
    } else {
      if (!target.branchId) return { error: "This login has no branch. Add it again under its branch." };
      if (!BRANCH_ASSIGNABLE.includes(to)) return { error: "Pick a branch role." };
    }
    if (to === "branchAdmin" && from !== "branchAdmin") {
      if (adminsInBranch >= MAX_BRANCH_ADMINS) return { error: `This branch already has ${MAX_BRANCH_ADMINS} branch admins.` };
      value.move = "toAdmins";
    } else if (from === "branchAdmin" && to !== "branchAdmin") {
      value.move = "toUsers";
    }
    value.role = { from, to };
  }

  if (changes.fullName != null) {
    const fullName = String(changes.fullName).trim().slice(0, 80);
    if (!fullName) return { error: "Write their name." };
    if (fullName !== (target.fullName || target.name || "")) value.fullName = fullName;
  }
  if (changes.email != null) {
    const email = String(changes.email).trim().toLowerCase();
    if (!EMAIL.test(email)) return { error: "That email doesn't look right." };
    if (email !== String(target.email || "").toLowerCase()) value.email = email;
  }
  if (changes.userName != null) {
    const key = usernameKey(changes.userName);
    if (!USERNAME.test(key)) return { error: "A username is 3 to 30 letters, numbers, dots, dashes or underscores." };
    if (key !== usernameKey(target.userName)) value.userName = key;
  }
  return { value };
}

/** Anything to do? */
export const hasChanges = (v) => !!(v && (v.role || v.fullName || v.email || v.userName));
