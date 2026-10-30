import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/server/firebaseAdmin";
import { cashInHand } from "@/lib/server/cashInHand";
import { can, isCompanyRole } from "@/lib/authz/permissions";

// The till's cash for the Requested panel (30 Oct), for whoever may see it
// there (cashInHand.view) — the cashier among them, whose rules keep the
// costs, banking and salaries it is made from out of reach. Only the figure
// is sent back.

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
    const allowed = me && me.companyId === companyId && can(me.role, "cashInHand.view") && (isCompanyRole(me.role) || me.branchId === branchId);
    if (!allowed) return fail(403, "You can't see this branch's cash.");

    return NextResponse.json(await cashInHand({ companyId, branchId, today }));
  } catch (error) {
    console.error("Cash in hand error:", error);
    return fail(500, "Internal Server Error");
  }
}
