import { NextResponse } from "next/server";
import admin from "firebase-admin";
import { adminDb } from "@/lib/server/firebaseAdmin";
import { staffManager, staffRecord } from "@/lib/server/staffAccess";
import { isCompanyRole } from "@/lib/authz/permissions";

// Links an office login (gm, branch admin, manager, cashier, supervisor…) to
// the staff record that pays them (30 Oct), so they see their own pay,
// payslips and attendance under Me — as staff do in the staff app. Both
// sides are written: users/{uid}.staffId and .staffBranchId (which only an
// admin may set; the rules let a person read only rows with their own
// staffId) and the staff record's officeUid / officeName. Not the record's
// `uid`: that marks a staff app login (Reset PIN, teams, chat use it).
// `unlink: true` takes the link off again. Whoever may manage staff at the
// branch does this.

const fail = (status, error) => NextResponse.json({ error }, { status });

export async function POST(req) {
  try {
    const { companyId, branchId, staffId, uid, unlink = false } = await req.json();
    if (!companyId || !branchId || !staffId) return fail(400, "Missing required identifiers");

    const who = await staffManager(req, companyId, branchId);
    if (who.error) return fail(who.status, who.error);

    const staff = await staffRecord(companyId, branchId, staffId);
    if (!staff.exists) return fail(404, "Staff record not found in this branch.");
    const stamp = admin.firestore.FieldValue.serverTimestamp();

    const del = admin.firestore.FieldValue.delete();
    if (unlink) {
      const linked = staff.data.officeUid;
      if (!linked) return fail(409, "This staff record has no office login linked.");
      const batch = adminDb.batch();
      const userRef = adminDb.collection("users").doc(linked);
      const user = await userRef.get();
      if (user.exists && user.data().staffId === staffId) batch.update(userRef, { staffId: del, staffBranchId: del });
      batch.update(staff.ref, { officeUid: del, officeName: del, updatedAt: stamp });
      await batch.commit();
      return NextResponse.json({ success: true });
    }

    if (!uid) return fail(400, "Which login?");
    if (staff.data.uid) return fail(409, "This staff member already has a staff app login.");
    if (staff.data.officeUid) return fail(409, "This staff record is already linked to an office login.");
    const userRef = adminDb.collection("users").doc(uid);
    const user = await userRef.get();
    if (!user.exists) return fail(404, "That login was not found.");
    const u = user.data();
    if (u.companyId !== companyId) return fail(403, "That login belongs to another company.");
    if (u.role === "staff") return fail(409, "Staff logins are made from the staff record itself.");
    if (!isCompanyRole(u.role) && u.branchId !== branchId) return fail(409, "That login works at another branch.");
    if (u.staffId) return fail(409, "That login is already linked to a staff record.");

    const batch = adminDb.batch();
    const name = [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || u.email || "";
    batch.update(userRef, { staffId, staffBranchId: branchId });
    batch.update(staff.ref, { officeUid: uid, officeName: name, updatedAt: stamp });
    await batch.commit();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Link office login error:", error);
    return fail(500, "Internal Server Error");
  }
}
