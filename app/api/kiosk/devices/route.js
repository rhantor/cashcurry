import { NextResponse } from "next/server";
import admin from "firebase-admin";
import { adminDb } from "@/lib/server/firebaseAdmin";
import { hashToken, newToken } from "@/lib/server/hires";
import { callerMay, deviceRef } from "@/lib/server/kiosk";
import { isValidTimeZone } from "@/lib/region/businessDay";
import { personName } from "@/lib/people";

// The branch's kiosk tablets (11 Nov 2026). Set up: someone who may open the
// kiosk does it once on the tablet and gets its token (only the hash is kept).
// List and remove: those who manage attendance.

const fail = (status, error) => NextResponse.json({ error }, { status });
const ids = (o) => ({ companyId: String(o?.companyId || ""), branchId: String(o?.branchId || "") });

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const { companyId, branchId } = ids(body);
    if (!companyId || !branchId) return fail(400, "Which branch?");
    const who = await callerMay(req, companyId, branchId, "kiosk.open");
    if (who.error) return fail(who.status, who.error);
    const token = newToken();
    await deviceRef(hashToken(token)).set({
      companyId,
      branchId,
      name: String(body.name || "").trim().slice(0, 60) || "Kiosk tablet",
      timeZone: isValidTimeZone(body.timeZone) ? body.timeZone : null,
      active: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: { uid: who.caller.uid, name: personName(who.me) || who.me.username || "" },
    });
    return NextResponse.json({ token });
  } catch (e) {
    console.error("[kiosk devices]", e);
    return fail(500, "Couldn't set up this tablet.");
  }
}

export async function GET(req) {
  try {
    const { companyId, branchId } = ids(Object.fromEntries(new URL(req.url).searchParams));
    const who = await callerMay(req, companyId, branchId, "kiosk.open");
    if (who.error) return fail(who.status, who.error);
    const snap = await adminDb.collection("kioskDevices").where("companyId", "==", companyId).where("branchId", "==", branchId).get();
    const devices = snap.docs
      .map((d) => ({ d, x: d.data() }))
      .filter(({ x }) => x.active !== false)
      .map(({ d, x }) => ({
        id: d.id,
        name: x.name,
        by: x.createdBy?.name || "",
        createdAt: x.createdAt?.toDate?.().toISOString() || null,
        lastSeenAt: x.lastSeenAt?.toDate?.().toISOString() || null,
      }))
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return NextResponse.json({ devices });
  } catch (e) {
    console.error("[kiosk devices]", e);
    return fail(500, "Couldn't list the tablets.");
  }
}

/** Stop a tablet: { companyId, branchId, id } (id from the list), or { token } from the tablet itself. */
export async function DELETE(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const { companyId, branchId } = ids(body);
    const who = await callerMay(req, companyId, branchId, "kiosk.open");
    if (who.error) return fail(who.status, who.error);
    const id = body.token ? hashToken(body.token) : String(body.id || "");
    if (!/^[a-f0-9]{64}$/.test(id)) return fail(400, "Which tablet?");
    const ref = deviceRef(id);
    const snap = await ref.get();
    if (!snap.exists || snap.data().companyId !== companyId || snap.data().branchId !== branchId) return fail(404, "No such tablet here.");
    await ref.delete();
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[kiosk devices]", e);
    return fail(500, "Couldn't remove the tablet.");
  }
}
