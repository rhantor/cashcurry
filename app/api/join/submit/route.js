import { NextResponse } from "next/server";
import { adminDb } from "@/lib/server/firebaseAdmin";
import { openLink, tellHireSubmitted } from "@/lib/server/hires";
import { cleanDetails, detailProblems, hireName, isSignature, missingDocs } from "@/lib/hires/model";
import { RULES } from "@/app/staff-management/lib/validation";

// Sending a join form (30 Oct): their details (checked as the staff form
// checks them), the documents they must give, and — when there is a letter —
// their signature on it. Then the link is used up, and whoever manages staff
// is told to check it and accept them.

const fail = (status, error, extra = {}) => NextResponse.json({ error, ...extra }, { status });

export async function POST(req) {
  try {
    const { token, details: raw, signature, agreed } = await req.json();
    const { state, linkRef, hire, ref, link } = await openLink(token);
    if (state !== "open") return fail(410, "This link can't be used any more.");

    const details = cleanDetails(raw);
    const problems = detailProblems(details, RULES);
    if (Object.keys(problems).length) return fail(400, "Check the highlighted fields", { problems });
    const missing = missingDocs(hire.files, details);
    if (missing.length) return fail(400, "Some documents are still missing", { missing });
    if (hire.letterReady && !(agreed === true && isSignature(signature))) return fail(400, "Read the letter, tick that you accept it and sign");

    const at = new Date().toISOString();
    const batch = adminDb.batch();
    batch.update(ref, {
      details,
      ...(hire.letterReady ? { signed: { at, name: `${details.firstName} ${details.lastName}`.trim(), signature, userAgent: String(req.headers.get("user-agent") || "").slice(0, 300) } } : {}),
      status: "submitted",
      submittedAt: at,
      updatedAt: at,
    });
    batch.update(linkRef, { usedAt: at });
    await batch.commit();

    await tellHireSubmitted({ companyId: link.companyId, branchId: link.branchId, hire, name: hireName({ details }) }).catch((e) => console.warn("[hires] notify failed:", e?.message));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Join submit error:", error);
    return fail(500, "Couldn't send it. Try again.");
  }
}
