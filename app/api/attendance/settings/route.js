import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/server/firebaseAdmin";
import { isCompanyRole } from "@/lib/authz/permissions";
import { attendanceSettingsOf, mayReadAttendanceRules } from "@/lib/attendance/staffSettings";

// The branch's attendance rules (day cut-off, shifts, time zone) for anyone who
// works there, staff included — the rest of the settings document stays out of
// their reach (lib/attendance/staffSettings.js).
export async function GET(req) {
  try {
    if (!adminAuth || !adminDb) return NextResponse.json({ error: "Server is not configured." }, { status: 500 });
    const q = new URL(req.url).searchParams;
    const companyId = q.get("companyId") || "";
    const branchId = q.get("branchId") || "";
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(companyId) || !/^[A-Za-z0-9_-]{1,64}$/.test(branchId)) {
      return NextResponse.json({ error: "Which branch?" }, { status: 400 });
    }
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    let caller;
    try {
      caller = await adminAuth.verifyIdToken(token);
    } catch {
      return NextResponse.json({ error: "Your session has expired. Sign in again." }, { status: 401 });
    }
    const meSnap = await adminDb.collection("users").doc(caller.uid).get();
    const me = meSnap.exists ? meSnap.data() : null;
    if (!mayReadAttendanceRules(me, companyId, branchId, isCompanyRole)) {
      return NextResponse.json({ error: "You don't work at this branch." }, { status: 403 });
    }
    const snap = await adminDb.collection("companies").doc(companyId).collection("branches").doc(branchId).collection("settings").doc("settings").get();
    return NextResponse.json(attendanceSettingsOf(snap.exists ? snap.data() : {}), { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    console.error("[attendance settings]", e);
    return NextResponse.json({ error: "Couldn't read the attendance rules." }, { status: 500 });
  }
}
