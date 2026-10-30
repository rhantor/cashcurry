import { NextResponse } from "next/server";
import admin from "firebase-admin";
import { adminAuth, adminDb } from "@/lib/server/firebaseAdmin";
import { isCompanyRole } from "@/lib/authz/permissions";
import { canManageTasks, canSetDuty, coverPatch, dutyNamed, rotaPatch, teamOf } from "@/lib/tasks/model";

// Who does a repeating task day by day (31 Oct): a task's rota, or one day
// given to someone (a cover). The database rules can't check the people in a
// rota or a cover, so they are saved here: whoever may set the task's duty
// (lib/tasks/model.js canSetDuty) names only those they could give it to —
// management: anyone with a login at the branch; a supervisor: their own team
// (staff whose record names them, or no one) — and themselves.

const fail = (status, error) => NextResponse.json({ error }, { status });
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(req) {
  try {
    if (!adminAuth || !adminDb) return fail(500, "Server is not configured.");
    const { companyId, branchId, taskId, today, rota, cover } = await req.json();
    if (!companyId || !branchId || !taskId || !DAY.test(today || "")) return fail(400, "Missing required identifiers");
    if (!rota && !(cover && DAY.test(cover.date || ""))) return fail(400, "Say who does it");

    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return fail(401, "Sign in first.");
    let caller;
    try {
      caller = await adminAuth.verifyIdToken(token);
    } catch {
      return fail(401, "Your session has expired. Sign in again.");
    }
    const meSnap = await adminDb.collection("users").doc(caller.uid).get();
    const me = meSnap.exists ? { uid: caller.uid, ...meSnap.data() } : null;
    if (!me || me.companyId !== companyId || !(isCompanyRole(me.role) || me.branchId === branchId)) return fail(403, "Not your branch.");

    const branch = adminDb.collection("companies").doc(companyId).collection("branches").doc(branchId);
    const taskRef = branch.collection("tasks").doc(taskId);
    const taskSnap = await taskRef.get();
    if (!taskSnap.exists) return fail(404, "That task is no longer here.");
    const task = { id: taskId, ...taskSnap.data() };
    if (!canSetDuty(task, me)) return fail(403, "You can't say who does this task.");

    // whom they may name: the branch's logins (management) or their team (a supervisor), and themselves
    const allowed = new Set([me.uid]);
    if (canManageTasks(me.role)) {
      const users = await adminDb.collection("users").where("companyId", "==", companyId).where("branchId", "==", branchId).get();
      users.forEach((u) => allowed.add(u.id));
    } else {
      const staff = await branch.collection("staff").get();
      teamOf(staff.docs.map((s) => s.data()), me.uid).forEach((uid) => allowed.add(uid));
    }
    const outsider = dutyNamed({ rota, cover }).find((uid) => !allowed.has(uid));
    if (outsider) return fail(403, "Only people you can give this task to can be put on it.");

    const patch = rota ? rotaPatch(task, me, rota, today) : coverPatch(task, cover.date, cover.person, today);
    await taskRef.update({ ...patch, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Task duty error:", error);
    return fail(500, "Internal Server Error");
  }
}
