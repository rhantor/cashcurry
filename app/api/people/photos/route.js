import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/server/firebaseAdmin";

// Everyone's photo in the company (owner, 12 Nov 2026: "the photo from the
// join link shows everywhere"). Staff records hold the photo; most screens
// only know a login (uid) or a staff id, and staff may not read each other's
// records — so the server reads them and hands back only the photo links:
// { byStaff: { staffId: url }, byUid: { uid: url }, byName: { name: url } }
// (byName: for reports that only kept the name — a name two people share is
// left out, so no one gets someone else's face). Names are already in
// the company's chat directory; nothing else leaves here.

const cache = new Map(); // companyId → { at, data }, a few minutes per server instance
const TTL = 3 * 60000;
const nameKey = (n) => String(n || "").trim().replace(/\s+/g, " ").toLowerCase();

export async function GET(req) {
  try {
    if (!adminAuth || !adminDb) return NextResponse.json({ byStaff: {}, byUid: {}, byName: {} });
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    let caller;
    try {
      caller = await adminAuth.verifyIdToken(token);
    } catch {
      return NextResponse.json({ error: "Your session has expired. Sign in again." }, { status: 401 });
    }
    const me = await adminDb.collection("users").doc(caller.uid).get();
    const companyId = me.exists ? me.data().companyId : null;
    if (!companyId) return NextResponse.json({ byStaff: {}, byUid: {}, byName: {} });

    const fresh = new URL(req.url).searchParams.get("fresh") === "1";
    const hit = cache.get(companyId);
    if (!fresh && hit && Date.now() - hit.at < TTL) return NextResponse.json(hit.data);

    const company = adminDb.collection("companies").doc(companyId);
    const branches = await company.collection("branches").listDocuments();
    const byStaff = {};
    const byUid = {};
    const named = new Map(); // name → url, or null when two people share it
    await Promise.all(
      branches.map(async (b) => {
        const snap = await b.collection("staff").get();
        snap.forEach((d) => {
          const s = d.data();
          const url = typeof s.photoUrl === "string" && /^https?:\/\//.test(s.photoUrl) ? s.photoUrl : null;
          // every record counts for a shared name, with a photo or not
          const name = nameKey(`${s.firstName || ""} ${s.lastName || ""}`);
          if (name) named.set(name, named.has(name) ? null : url);
          if (!url) return;
          byStaff[d.id] = url;
          if (s.uid) byUid[s.uid] = url;
          if (s.officeUid) byUid[s.officeUid] = url;
        });
      })
    );
    const byName = Object.fromEntries([...named].filter(([, url]) => url));
    const data = { byStaff, byUid, byName };
    cache.set(companyId, { at: Date.now(), data });
    return NextResponse.json(data);
  } catch (e) {
    console.error("People photos error:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
