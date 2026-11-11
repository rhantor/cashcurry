import { NextResponse } from "next/server";
import { getFile } from "@/lib/server/hires";
import { branchRef, callerMay } from "@/lib/server/kiosk";

// A kiosk punch's photo, for those who see attendance. Kept in storage where
// the app can't read it directly; this checks who is asking first.
export async function GET(req) {
  try {
    const q = new URL(req.url).searchParams;
    const companyId = q.get("companyId") || "";
    const branchId = q.get("branchId") || "";
    const punchId = q.get("punchId") || "";
    if (!companyId || !branchId || !/^[A-Za-z0-9_-]{1,64}$/.test(punchId)) return new NextResponse("Which punch?", { status: 400 });
    const who = await callerMay(req, companyId, branchId, "attendance.view");
    if (who.error) return new NextResponse(who.error, { status: who.status });
    const punch = await branchRef(companyId, branchId).collection("attendance").doc(punchId).get();
    const path = punch.exists ? punch.data().photoPath : null;
    if (!path) return new NextResponse("No photo", { status: 404 });
    const file = await getFile(path);
    if (!file) return new NextResponse("No photo", { status: 404 });
    return new NextResponse(file.buffer, { headers: { "Content-Type": file.contentType, "Cache-Control": "private, max-age=86400" } });
  } catch (e) {
    console.error("[attendance photo]", e);
    return new NextResponse("Couldn't read the photo", { status: 500 });
  }
}
