import { NextResponse } from "next/server";
import { adminDb } from "@/lib/server/firebaseAdmin";
import { openLink } from "@/lib/server/hires";
import { roleLabelOf } from "@/app/staff-management/lib/constants";

// Opening a join link (30 Oct): no sign-in — the link itself is the key. Only
// what the person needs comes back: who is taking them on, as what, what they
// have filled in and sent so far (file names, not where they are kept), and
// their appointment letter to sign, if one is ready.

const fail = (status, error) => NextResponse.json({ error }, { status });

export async function POST(req) {
  try {
    if (!adminDb) return fail(500, "Server is not configured.");
    const { token } = await req.json();
    const { state, link, hire } = await openLink(token);
    if (state === "missing") return NextResponse.json({ state });
    if (!hire) return NextResponse.json({ state: "closed" });

    const branchDoc = adminDb.collection("companies").doc(link.companyId).collection("branches").doc(link.branchId);
    const [company, branch, settings, letter] = await Promise.all([
      adminDb.collection("companies").doc(link.companyId).get(),
      branchDoc.get(),
      branchDoc.collection("settings").doc("settings").get(),
      state === "open" && hire.letterReady ? branchDoc.collection("newHires").doc(hire.id).collection("letter").doc("current").get() : null,
    ]);
    const files = Object.fromEntries(
      Object.entries(hire.files || {}).map(([k, v]) => [k, Array.isArray(v) ? v.map((f) => ({ name: f.name, contentType: f.contentType })) : v ? { name: v.name, contentType: v.contentType } : null])
    );
    return NextResponse.json({
      state,
      expiresAt: link.expiresAt,
      company: company.data()?.name || settings.data()?.basic?.companyName || "",
      branch: branch.data()?.name || "",
      job: roleLabelOf(hire.role) || "",
      startDate: hire.startDate || "",
      currency: settings.data()?.financeSales?.currency || "RM",
      details: state === "open" ? { firstName: hire.firstName || "", lastName: hire.lastName || "", phone: hire.phone || "", ...(hire.details || {}) } : { firstName: hire.details?.firstName || hire.firstName || "" },
      files: state === "open" ? files : {},
      letter: letter?.exists ? letter.data() : null,
    });
  } catch (error) {
    console.error("Join open error:", error);
    return fail(500, "Internal Server Error");
  }
}
