// Read a supplier's invoice from its photo or PDF (owner, 16 Nov 2026), for
// Goods Arrived and New Vendor Bill. Whoever may take goods in or add a bill
// at the branch sends the picture (shrunk in the browser) and the items it
// could be; Claude reads it and the cleaned reading comes back. Nothing is
// saved here except a count of today's reads, so a branch can't run up the
// bill. The picture goes to Anthropic's API to be read.
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { adminAuth, adminDb, admin } from "@/lib/server/firebaseAdmin";
import { can, isCompanyRole } from "@/lib/authz/permissions";
import { companyGrants } from "@/lib/server/grants";
import { DAILY_READS, INVOICE_SCHEMA, MAX_INVOICE_BYTES, READ_TYPES, cleanReading, invoicePrompt } from "@/lib/purchases/invoiceRead";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = "claude-opus-5-5";
const fail = (status, error) => NextResponse.json({ error }, { status });

let client = null;
const claude = () => (client = client || new Anthropic());

/** One more read today for this branch, unless it has had its share. */
async function countRead(companyId, branchId, day) {
  const ref = adminDb.doc(`aiUsage/${companyId}_${branchId}_${day}`);
  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const used = snap.exists ? Number(snap.data().invoiceReads || 0) : 0;
    if (used >= DAILY_READS) return false;
    tx.set(ref, { companyId, branchId, day, invoiceReads: admin.firestore.FieldValue.increment(1), updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    return true;
  });
}

/** Is reading set up here? Only yes or no — the screens show the button only when it is. */
export async function GET() {
  return NextResponse.json({ ready: !!process.env.ANTHROPIC_API_KEY });
}

export async function POST(req) {
  try {
    if (!adminAuth || !adminDb) return fail(500, "Server is not configured.");
    if (!process.env.ANTHROPIC_API_KEY) return fail(503, "Reading invoices isn't set up yet. Fill the bill in by hand.");

    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return fail(401, "Sign in first.");
    let caller;
    try {
      caller = await adminAuth.verifyIdToken(token);
    } catch {
      return fail(401, "Your session has expired. Sign in again.");
    }

    const body = await req.json().catch(() => null);
    const { companyId, branchId, file, vendorName = "", items = [] } = body || {};
    if (!companyId || !branchId || !file?.data || !file?.type) return fail(400, "Missing the photo.");
    if (!READ_TYPES.includes(file.type)) return fail(400, "Send a photo (JPEG, PNG, WebP) or a PDF.");
    const bytes = Math.floor((String(file.data).length * 3) / 4);
    if (bytes > MAX_INVOICE_BYTES) return fail(413, "The file is too big to read. Take a closer photo of just the invoice.");

    const snap = await adminDb.collection("users").doc(caller.uid).get();
    const me = snap.exists ? snap.data() : null;
    const grants = await companyGrants(companyId);
    const allowed = me && me.companyId === companyId && (isCompanyRole(me.role) || me.branchId === branchId) &&
      (can(me.role, "purchases.order", grants) || can(me.role, "purchases.billAdd", grants));
    if (!allowed) return fail(403, "You can't add bills at this branch.");

    const day = new Date().toISOString().slice(0, 10);
    if (!(await countRead(companyId, branchId, day))) return fail(429, `This branch has read ${DAILY_READS} invoices today. Fill the rest in by hand.`);

    const known = (Array.isArray(items) ? items : [])
      .filter((i) => i && typeof i.id === "string")
      .slice(0, 250)
      .map((i) => ({ id: i.id, name: String(i.name || ""), unit: String(i.unit || "") }));
    const picture = file.type === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: file.data } }
      : { type: "image", source: { type: "base64", media_type: file.type, data: file.data } };

    let response;
    try {
      response = await claude().beta.messages.create({
        model: MODEL,
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default", // a declined request is retried on a fallback model
        output_config: { effort: "medium", format: { type: "json_schema", schema: INVOICE_SCHEMA } },
        messages: [{ role: "user", content: [picture, { type: "text", text: invoicePrompt({ vendorName, items: known }) }] }],
      });
    } catch (error) {
      if (error instanceof Anthropic.RateLimitError) return fail(429, "Too many invoices at once. Try again in a minute.");
      if (error instanceof Anthropic.BadRequestError) return fail(400, "That file couldn't be read. Try a clearer photo.");
      if (error instanceof Anthropic.AuthenticationError) {
        console.error("[read-invoice] API key rejected");
        return fail(503, "Reading invoices isn't set up right. Fill the bill in by hand.");
      }
      if (error instanceof Anthropic.APIError) {
        console.error("[read-invoice] API error", error.status, error.message);
        return fail(502, "Couldn't read the invoice just now. Try again, or fill it in by hand.");
      }
      throw error;
    }

    if (response.stop_reason === "refusal") return fail(422, "This picture couldn't be read. Fill the bill in by hand.");
    if (response.stop_reason === "max_tokens") return fail(422, "The invoice is too long to read in one go. Fill it in by hand.");
    const out = response.content.find((b) => b.type === "text")?.text || "";
    let raw;
    try {
      raw = JSON.parse(out);
    } catch {
      return fail(502, "Couldn't make sense of the invoice. Try a clearer photo.");
    }
    const reading = cleanReading(raw, known);
    if (!reading.readable) return fail(422, reading.problem ? `Couldn't read it: ${reading.problem}` : "No invoice lines found in this picture.");
    return NextResponse.json({ reading });
  } catch (error) {
    console.error("[read-invoice]", error);
    return fail(500, "Internal Server Error");
  }
}
