import { NextResponse } from "next/server";
import admin from "firebase-admin";
import { FACE_MODEL, cleanSamples, lookalike, packSamples } from "@/lib/attendance/face";
import { branchRef, callerMay, facesOf, facesRef, forgetFaces } from "@/lib/server/kiosk";
import { personName } from "@/lib/people";

// Staff faces for the kiosk (11 Nov 2026): who has one, add one, remove one.
// For those who look after attendance (the kiosk login, managers). The faces
// themselves never leave the server.

const fail = (status, error) => NextResponse.json({ error }, { status });
const ids = (o) => ({ companyId: String(o?.companyId || ""), branchId: String(o?.branchId || ""), staffId: String(o?.staffId || "") });

export async function GET(req) {
  try {
    const { companyId, branchId } = ids(Object.fromEntries(new URL(req.url).searchParams));
    const who = await callerMay(req, companyId, branchId, "attendance.faces");
    if (who.error) return fail(who.status, who.error);
    const snap = await facesRef(companyId, branchId).get();
    return NextResponse.json({
      faces: snap.docs.map((d) => ({ staffId: d.id, at: d.data().enrolledAt?.toDate?.().toISOString() || null, by: d.data().enrolledBy?.name || "", current: d.data().model === FACE_MODEL })),
    });
  } catch (e) {
    console.error("[kiosk faces]", e);
    return fail(500, "Couldn't list the faces.");
  }
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const { companyId, branchId, staffId } = ids(body);
    if (!staffId || staffId.includes("/")) return fail(400, "Whose face?");
    const who = await callerMay(req, companyId, branchId, "attendance.faces");
    if (who.error) return fail(who.status, who.error);
    if (body.consent !== true) return fail(400, "Tick that they agreed first.");
    const staff = await branchRef(companyId, branchId).collection("staff").doc(staffId).get();
    if (!staff.exists) return fail(404, "Not on the staff list.");
    const { samples, error } = cleanSamples(body.samples);
    if (error) return fail(400, error);
    const other = lookalike(samples, await facesOf(companyId, branchId, { fresh: true }), staffId);
    if (other) {
      const o = await branchRef(companyId, branchId).collection("staff").doc(other).get();
      return fail(409, `This face looks like ${o.exists ? `${o.data().firstName || ""} ${o.data().lastName || ""}`.trim() : "someone else"}, who is already added. Check it is the right person.`);
    }
    await facesRef(companyId, branchId).doc(staffId).set({
      samples: packSamples(samples),
      count: samples.length,
      model: FACE_MODEL,
      consent: true,
      enrolledAt: admin.firestore.FieldValue.serverTimestamp(),
      enrolledBy: { uid: who.caller.uid, name: personName(who.me) || who.me.username || "" },
    });
    forgetFaces(companyId, branchId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[kiosk faces]", e);
    return fail(500, "Couldn't save the face.");
  }
}

export async function DELETE(req) {
  try {
    const { companyId, branchId, staffId } = ids(await req.json().catch(() => ({})));
    if (!staffId || staffId.includes("/")) return fail(400, "Whose face?");
    const who = await callerMay(req, companyId, branchId, "attendance.faces");
    if (who.error) return fail(who.status, who.error);
    await facesRef(companyId, branchId).doc(staffId).delete();
    forgetFaces(companyId, branchId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[kiosk faces]", e);
    return fail(500, "Couldn't remove the face.");
  }
}
