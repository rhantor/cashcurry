import { NextResponse } from "next/server";
import admin from "firebase-admin";
import { adminAuth, adminDb } from "@/lib/server/firebaseAdmin";
import { staffManager, staffRecord, writeStaffLogins } from "@/lib/server/staffAccess";
import { isPin, randomPin } from "@/lib/staff/login";

// A staff member forgot their PIN (docs/STAFF_APP.md): whoever may manage
// staff at the branch sets a new one. Their other phones are signed out, and
// the phone / IC lookups are refreshed (in case either changed).

const fail = (status, error) => NextResponse.json({ error }, { status });

export async function POST(req) {
  try {
    const { companyId, branchId, staffId, pin } = await req.json();
    if (!companyId || !branchId || !staffId) return fail(400, "Missing required identifiers");
    const who = await staffManager(req, companyId, branchId);
    if (who.error) return fail(who.status, who.error);

    const staff = await staffRecord(companyId, branchId, staffId);
    if (!staff.exists) return fail(404, "Staff record not found in this branch.");
    if (!staff.data.uid) return fail(409, "This staff member has no login yet.");
    // only a staff app login: never an office login's password
    const login = await adminDb.collection("users").doc(staff.data.uid).get();
    if (login.exists && login.data().role !== "staff") return fail(409, "That is an office login — its password is changed from its own account.");
    if (pin && !isPin(pin)) return fail(400, "The PIN must be 6 digits.");

    const newPin = pin || randomPin();
    await adminAuth.updateUser(staff.data.uid, { password: newPin });
    await adminAuth.revokeRefreshTokens(staff.data.uid);
    await staff.ref.update({ pinResetAt: admin.firestore.FieldValue.serverTimestamp(), pinResetBy: who.caller.uid });
    await writeStaffLogins({ uid: staff.data.uid, email: staff.data.loginEmail, phone: staff.data.phone, ic: staff.private.icNumber || staff.private.passportNumber });

    return NextResponse.json({ success: true, pin: newPin, phone: staff.data.phone || "" });
  } catch (error) {
    console.error("Reset PIN error:", error);
    return fail(500, "Internal Server Error");
  }
}
