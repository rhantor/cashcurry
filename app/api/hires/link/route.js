import { NextResponse } from "next/server";
import { adminDb } from "@/lib/server/firebaseAdmin";
import { staffManager } from "@/lib/server/staffAccess";
import { hashToken, hireRef, newToken } from "@/lib/server/hires";
import { linkExpiry } from "@/lib/hires/model";

// A new hire's join link (30 Oct): whoever manages staff at the branch makes
// one — or a fresh one, which stops the old one working — to send on
// WhatsApp. The link works for 7 days and is used once. Only the token's hash
// is kept (joinLinks/{hash}); the address is shown to the manager here, once.

const fail = (status, error) => NextResponse.json({ error }, { status });

export async function POST(req) {
  try {
    const { companyId, branchId, hireId } = await req.json();
    if (!companyId || !branchId || !hireId) return fail(400, "Missing required identifiers");
    const who = await staffManager(req, companyId, branchId);
    if (who.error) return fail(who.status, who.error);

    const ref = hireRef(companyId, branchId, hireId);
    const snap = await ref.get();
    if (!snap.exists) return fail(404, "That new hire is no longer here.");
    const hire = snap.data();
    if (["accepted", "cancelled"].includes(hire.status)) return fail(409, "They have joined already, or it was cancelled.");

    const token = newToken();
    const hash = hashToken(token);
    const expiresAt = linkExpiry();
    const batch = adminDb.batch();
    if (hire.linkHash) batch.delete(adminDb.collection("joinLinks").doc(hire.linkHash)); // the old link stops working
    batch.set(adminDb.collection("joinLinks").doc(hash), { companyId, branchId, hireId, expiresAt, usedAt: null, createdAt: new Date().toISOString() });
    batch.update(ref, {
      linkHash: hash,
      link: { expiresAt, sentAt: new Date().toISOString(), by: { uid: who.caller.uid, name: who.me.firstName || who.me.username || "" } },
      status: "sent",
      updatedAt: new Date().toISOString(),
    });
    await batch.commit();

    const origin = req.headers.get("origin") || new URL(req.url).origin;
    return NextResponse.json({ url: `${origin}/join/${token}`, expiresAt });
  } catch (error) {
    console.error("Join link error:", error);
    return fail(500, "Internal Server Error");
  }
}
