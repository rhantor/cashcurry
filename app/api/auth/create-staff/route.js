import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { adminAuth, adminDb } from "@/lib/server/firebaseAdmin";
import admin from "firebase-admin";
import { can, isCompanyRole } from "@/lib/authz/permissions";

// Creates a staff member's login and links it to their staff record.
//
// Runs with full database access (Admin SDK), so it checks the caller itself:
// whoever the roles matrix lets manage staff ("staff.manage": owner, super
// admin and GM of the company; branch admin and manager of that branch). Before, anyone on the internet could call it and
// create a login inside any company — with the staff member's IC number, or
// "password123", as the password.


/** A temporary password the staff member is asked to change: 10 chars, no look-alikes. */
function temporaryPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  return Array.from(crypto.randomBytes(10), (b) => alphabet[b % alphabet.length]).join("");
}

const fail = (status, error) => NextResponse.json({ error }, { status });

export async function POST(req) {
  try {
    if (!adminAuth || !adminDb) return fail(500, "Server is not configured to create logins.");

    // 1. Who is asking?
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return fail(401, "Sign in first.");
    let caller;
    try {
      caller = await adminAuth.verifyIdToken(token);
    } catch {
      return fail(401, "Your session has expired. Sign in again.");
    }
    const callerDoc = await adminDb.collection("users").doc(caller.uid).get();
    const me = callerDoc.exists ? callerDoc.data() : null;

    const { companyId, branchId, staffId, firstName = "", lastName = "", email } = await req.json();
    if (!companyId || !branchId || !staffId) return fail(400, "Missing required identifiers");

    // 2. May they create logins for this branch?
    const allowed =
      me &&
      me.companyId === companyId &&
      can(me.role, "staff.manage") &&
      (isCompanyRole(me.role) || me.branchId === branchId);
    if (!allowed) return fail(403, "Only the owner, a general manager, or this branch's admin or manager can create staff logins.");

    // 3. The staff record must exist in that branch, without a login yet.
    const staffRef = adminDb.collection("companies").doc(companyId)
      .collection("branches").doc(branchId)
      .collection("staff").doc(staffId);
    const staffSnap = await staffRef.get();
    if (!staffSnap.exists) return fail(404, "Staff record not found in this branch.");
    if (staffSnap.data().uid) return fail(409, "This staff member already has a login.");

    // Firebase Auth needs an email; staff without one get a placeholder.
    const finalEmail = email || `${staffId.toLowerCase()}@cashcurry.local`;
    const password = temporaryPassword();

    let userRecord;
    try {
      userRecord = await adminAuth.createUser({
        email: finalEmail,
        emailVerified: false,
        password,
        displayName: `${firstName} ${lastName}`.trim() || undefined,
        disabled: false,
      });
    } catch (authError) {
      return fail(400, authError.message || "Failed to create the login");
    }
    const { uid } = userRecord;

    await adminAuth.setCustomUserClaims(uid, { role: "staff", companyId, branchId });

    await adminDb.collection("users").doc(uid).set({
      uid,
      email: finalEmail,
      username: email ? email.split("@")[0] : String(firstName).toLowerCase(),
      firstName,
      lastName,
      role: "staff",
      companyId,
      branchId,
      // Which staff record this login is: the rules let staff read only rows
      // with this staffId (their own advances, punches…). Users cannot change it.
      staffId,
      createdBy: caller.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await staffRef.update({
      uid,
      loginEmail: finalEmail,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Shown once to the person who created it, to hand to the staff member.
    return NextResponse.json({ success: true, uid, email: finalEmail, password });
  } catch (error) {
    console.error("Generate login error:", error);
    return fail(500, "Internal Server Error");
  }
}
