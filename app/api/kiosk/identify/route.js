import { NextResponse } from "next/server";
import { kioskDevice, kioskIdentify } from "@/lib/server/kiosk";

// Who is in front of the kiosk tablet (face first, 11 Nov 2026). The tablet
// sends the face's 128 numbers; the faces it is compared with stay here.
export async function POST(req) {
  try {
    const dev = await kioskDevice(req.headers.get("x-kiosk-token"));
    if (!dev) return NextResponse.json({ ok: false, code: "not_set_up" }, { status: 401 });
    return NextResponse.json(await kioskIdentify(dev, await req.json().catch(() => ({}))));
  } catch (e) {
    console.error("[kiosk identify]", e);
    return NextResponse.json({ ok: false, code: "server" }, { status: 500 });
  }
}
