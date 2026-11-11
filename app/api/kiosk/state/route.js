import { NextResponse } from "next/server";
import { kioskDevice, kioskState } from "@/lib/server/kiosk";

// The kiosk tablet's view (no sign-in: the tablet's token is the key): the
// branch, everyone on the staff list with whether they are in — no PINs.
export async function GET(req) {
  try {
    const dev = await kioskDevice(req.headers.get("x-kiosk-token"));
    if (!dev) return NextResponse.json({ error: "This tablet is not set up as a kiosk.", code: "not_set_up" }, { status: 401 });
    const timeZone = new URL(req.url).searchParams.get("tz");
    return NextResponse.json(await kioskState(dev, { timeZone }));
  } catch (e) {
    console.error("[kiosk state]", e);
    return NextResponse.json({ error: "Couldn't load the kiosk." }, { status: 500 });
  }
}
