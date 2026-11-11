import { NextResponse } from "next/server";
import { kioskDevice, kioskPunch } from "@/lib/server/kiosk";

// A punch from the kiosk tablet (lib/server/kiosk.js): PIN checked here, in or
// out decided here. Refusals (wrong PIN, too soon…) come back as 200 with
// ok:false and a code, so the tablet can tell them from a lost connection.
export async function POST(req) {
  try {
    const dev = await kioskDevice(req.headers.get("x-kiosk-token"));
    if (!dev) return NextResponse.json({ ok: false, code: "not_set_up", error: "This tablet is not set up as a kiosk." }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    return NextResponse.json(await kioskPunch(dev, body));
  } catch (e) {
    console.error("[kiosk punch]", e);
    return NextResponse.json({ ok: false, code: "server", error: "Couldn't save the punch." }, { status: 500 });
  }
}
