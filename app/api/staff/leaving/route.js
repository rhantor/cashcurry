import { NextResponse } from "next/server";
import admin from "firebase-admin";
import { adminAuth, adminDb } from "@/lib/server/firebaseAdmin";
import { staffManager, staffRecord } from "@/lib/server/staffAccess";
import { facesRef, forgetFaces } from "@/lib/server/kiosk";
import { cleanLeaving, latestLastDay } from "@/lib/staff/leaving";
import { personName } from "@/lib/people";

// Someone left the job, or comes back (owner, 12 Nov 2026; lib/staff/leaving.js).
// Whoever may manage staff at the branch. Leaving: the record is switched off
// with the last day and why, their kiosk face is deleted (the server is the only
// place it lives), their staff app login is switched off and signed out, and
// they drop out of the "who to message / give a task to" lists. Back: all on
// again (the face is taken again on the kiosk).

const fail = (status, error) => NextResponse.json({ error }, { status });
const del = admin.firestore.FieldValue.delete;
const now = admin.firestore.FieldValue.serverTimestamp;

/** The staff app login behind the record (never an office login). */
async function staffLogin(uid) {
  if (!uid) return null;
  const u = await adminDb.collection("users").doc(uid).get();
  return u.exists && u.data().role === "staff" ? { uid, ...u.data() } : null;
}

/** Their name in the chat directory: marked left (or not) so pickers skip them. */
async function markChat(companyId, uid, left) {
  if (!uid) return;
  const ref = adminDb.doc(`companies/${companyId}/chatPeople/${uid}`);
  const snap = await ref.get();
  if (snap.exists) await ref.update({ left: left ? true : del() });
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const companyId = String(body.companyId || "");
    const branchId = String(body.branchId || "");
    const staffId = String(body.staffId || "");
    if (!companyId || !branchId || !staffId || [companyId, branchId, staffId].some((x) => x.includes("/"))) return fail(400, "Missing required identifiers");
    const who = await staffManager(req, companyId, branchId);
    if (who.error) return fail(who.status, who.error);

    const staff = await staffRecord(companyId, branchId, staffId);
    if (!staff.exists) return fail(404, "Staff record not found in this branch.");
    const s = staff.data;
    const by = { uid: who.caller.uid, name: personName(who.me) || who.me.username || "" };
    const login = await staffLogin(s.uid);

    if (body.back) {
      if (s.active !== false) return NextResponse.json({ ok: true, already: true });
      await staff.ref.update({
        active: del(),
        leftOn: del(),
        leftReason: del(),
        leftNote: del(),
        leftAt: del(),
        leftBy: del(),
        lastLeft: { leftOn: s.leftOn || null, leftReason: s.leftReason || null },
        backAt: now(),
        backBy: by,
      });
      if (login) await adminAuth.updateUser(login.uid, { disabled: false }).catch(() => {});
      await markChat(companyId, login?.uid, false);
      return NextResponse.json({ ok: true });
    }

    const r = cleanLeaving(body, latestLastDay());
    if (r.error) return fail(400, r.error);
    const first = s.active !== false; // not a change to someone already marked left
    await staff.ref.update({ active: false, ...r.value, ...(first ? { leftAt: now(), leftBy: by } : { leftEditedAt: now() }) });
    if (first) {
      await facesRef(companyId, branchId).doc(staffId).delete().catch(() => {});
      forgetFaces(companyId, branchId);
    }
    if (login) {
      await adminAuth.updateUser(login.uid, { disabled: true }).catch(() => {});
      await adminAuth.revokeRefreshTokens(login.uid).catch(() => {});
      await markChat(companyId, login.uid, true);
    }
    // an office login (manager, cashier…) linked to the record is not switched off from here
    const office = s.officeUid ? s.officeName || "an office login" : s.uid && !login ? "an office login" : null;
    return NextResponse.json({ ok: true, office });
  } catch (error) {
    console.error("Staff leaving error:", error);
    return fail(500, "Internal Server Error");
  }
}
