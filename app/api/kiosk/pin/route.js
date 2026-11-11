import { NextResponse } from "next/server";
import crypto from "node:crypto";
import admin from "firebase-admin";
import { branchRef, callerMay } from "@/lib/server/kiosk";

// A staff member's kiosk PIN (11 Nov 2026), set by those who look after
// attendance — the kiosk login among them, who may not edit staff records.
// No PIN given: a new one nobody else at the branch has.

const fail = (status, error) => NextResponse.json({ error }, { status });

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const companyId = String(body.companyId || "");
    const branchId = String(body.branchId || "");
    const staffId = String(body.staffId || "");
    if (!staffId || staffId.includes("/")) return fail(400, "Whose PIN?");
    const who = await callerMay(req, companyId, branchId, "attendance.faces");
    if (who.error) return fail(who.status, who.error);
    const staffCol = branchRef(companyId, branchId).collection("staff");
    const [me, all] = await Promise.all([staffCol.doc(staffId).get(), staffCol.get()]);
    if (!me.exists) return fail(404, "Not on the staff list.");
    const taken = new Set(all.docs.filter((d) => d.id !== staffId).map((d) => String(d.data().pinCode || "")));
    let pin = String(body.pin || "");
    if (pin) {
      if (!/^\d{4}$/.test(pin)) return fail(400, "The PIN is 4 digits.");
      if (taken.has(pin)) return fail(409, "Someone else at this branch has that PIN. Pick another.");
    } else {
      for (let i = 0; i < 200 && (!pin || taken.has(pin)); i++) pin = String(crypto.randomInt(0, 10000)).padStart(4, "0");
      if (taken.has(pin)) return fail(500, "Couldn't find a free PIN.");
    }
    await me.ref.update({ pinCode: pin, pinSetAt: admin.firestore.FieldValue.serverTimestamp() });
    return NextResponse.json({ pin });
  } catch (e) {
    console.error("[kiosk pin]", e);
    return fail(500, "Couldn't set the PIN.");
  }
}
