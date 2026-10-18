// Server side of staff logins (docs/STAFF_APP.md): who may make or reset a
// staff member's login, and the phone / IC lookups the login page uses.
// Used by app/api/auth/create-staff and app/api/auth/reset-staff-pin.
import { adminAuth, adminDb } from "@/lib/server/firebaseAdmin";
import { can, isCompanyRole } from "@/lib/authz/permissions";
import { loginKeys } from "@/lib/staffLogin";

/**
 * The caller (from the Authorization header) if they may manage staff at
 * this branch; otherwise { error, status }.
 */
export async function staffManager(req, companyId, branchId) {
  if (!adminAuth || !adminDb) return { status: 500, error: "Server is not configured to manage logins." };
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return { status: 401, error: "Sign in first." };
  let caller;
  try {
    caller = await adminAuth.verifyIdToken(token);
  } catch {
    return { status: 401, error: "Your session has expired. Sign in again." };
  }
  const snap = await adminDb.collection("users").doc(caller.uid).get();
  const me = snap.exists ? snap.data() : null;
  const allowed = me && me.companyId === companyId && can(me.role, "staff.manage") && (isCompanyRole(me.role) || me.branchId === branchId);
  if (!allowed) return { status: 403, error: "Only the owner, a general manager, or this branch's admin or manager can do this." };
  return { caller, me };
}

/** The staff record and its private half (IC lives there). */
export async function staffRecord(companyId, branchId, staffId) {
  const branch = adminDb.collection("companies").doc(companyId).collection("branches").doc(branchId);
  const [s, p] = await Promise.all([branch.collection("staff").doc(staffId).get(), branch.collection("staffPrivate").doc(staffId).get()]);
  return { ref: s.ref, exists: s.exists, data: s.exists ? s.data() : {}, private: p.exists ? p.data() : {} };
}

/**
 * Record (or refresh) the phone and IC lookups for a login:
 * staffLogins/{hash} { uid, email }. Readable by anyone, so it only ever
 * holds the hash, the login's id and its (placeholder) email.
 */
export async function writeStaffLogins({ uid, email, phone, ic }) {
  const keys = await loginKeys({ phone, ic });
  const batch = adminDb.batch();
  for (const k of keys) batch.set(adminDb.collection("staffLogins").doc(k), { uid, email });
  await batch.commit();
  return keys.length;
}
