import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/server/firebaseAdmin";
import { inventory } from "@/lib/server/inventory";
import { can, isCompanyRole } from "@/lib/authz/permissions";

// The branch's stock (8 Nov), for whoever counts it (inventory.count). It is
// worked out from the supplier bills, which supervisors may not read, so it
// is done here (lib/server/inventory.js) and only the quantities go back.

const fail = (status, error) => NextResponse.json({ error }, { status });
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(req) {
  try {
    if (!adminAuth || !adminDb) return fail(500, "Server is not configured.");
    const { companyId, branchId, today } = await req.json();
    if (!companyId || !branchId || !DAY.test(today || "")) return fail(400, "Missing required identifiers");

    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return fail(401, "Sign in first.");
    let caller;
    try {
      caller = await adminAuth.verifyIdToken(token);
    } catch {
      return fail(401, "Your session has expired. Sign in again.");
    }
    const snap = await adminDb.collection("users").doc(caller.uid).get();
    const me = snap.exists ? snap.data() : null;
    const allowed = me && me.companyId === companyId && can(me.role, "inventory.count") && (isCompanyRole(me.role) || me.branchId === branchId);
    if (!allowed) return fail(403, "You can't see this branch's stock.");

    return NextResponse.json(await inventory({ companyId, branchId, today }));
  } catch (error) {
    console.error("Inventory error:", error);
    return fail(500, "Internal Server Error");
  }
}
