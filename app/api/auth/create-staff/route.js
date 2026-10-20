import { NextResponse } from "next/server";
import admin from "firebase-admin";
import { adminAuth, adminDb } from "@/lib/server/firebaseAdmin";
import { staffManager, staffRecord, writeStaffLogins } from "@/lib/server/staffAccess";
import { isPin, randomPin } from "@/lib/staff/login";

// Creates a staff member's login and links it to their staff record
// (docs/STAFF_APP.md). They log in with their phone or IC number and a
// 6-digit PIN; email is optional (without one the login gets a placeholder
// address). Runs with full database access (Admin SDK), so it checks the
// caller itself: whoever the roles matrix lets manage staff at this branch.

const fail = (status, error) => NextResponse.json({ error }, { status });

export async function POST(req) {
  try {
    const { companyId, branchId, staffId, firstName = "", lastName = "", email, pin } = await req.json();
    if (!companyId || !branchId || !staffId) return fail(400, "Missing required identifiers");

    const who = await staffManager(req, companyId, branchId);
    if (who.error) return fail(who.status, who.error);

    // The staff record must exist in that branch, without a login yet.
    const staff = await staffRecord(companyId, branchId, staffId);
    if (!staff.exists) return fail(404, "Staff record not found in this branch.");
    if (staff.data.uid) return fail(409, "This staff member already has a login.");
    if (pin && !isPin(pin)) return fail(400, "The PIN must be 6 digits.");

    const finalEmail = (email || staff.data.email || "").trim() || `${staffId.toLowerCase()}@cashcurry.local`;
    const loginPin = pin || randomPin();

    let userRecord;
    try {
      userRecord = await adminAuth.createUser({
        email: finalEmail,
        emailVerified: false,
        password: loginPin,
        displayName: `${firstName} ${lastName}`.trim() || undefined,
        disabled: false,
      });
    } catch (authError) {
      return fail(400, authError.code === "auth/email-already-exists" ? "That email already has a login." : authError.message || "Failed to create the login");
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
      createdBy: who.caller.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await staff.ref.update({ uid, loginEmail: finalEmail, updatedAt: admin.firestore.FieldValue.serverTimestamp() });

    // So the login page finds them by phone or IC number.
    const ways = await writeStaffLogins({ uid, email: finalEmail, phone: staff.data.phone, ic: staff.private.icNumber || staff.private.passportNumber });

    // Shown once to whoever created it, to hand to the staff member.
    return NextResponse.json({ success: true, uid, email: finalEmail, pin: loginPin, phone: staff.data.phone || "", byIc: ways > 1 });
  } catch (error) {
    console.error("Generate login error:", error);
    return fail(500, "Internal Server Error");
  }
}
