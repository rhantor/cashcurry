import { Buffer } from "node:buffer";
import { NextResponse } from "next/server";
import { openLink, putFile, removeFile } from "@/lib/server/hires";
import { MAX_HEALTH_FILES, fileProblem } from "@/lib/hires/model";

// A document sent from a join link (30 Oct): IC or passport, photo, bank
// card, health certificate. Kept in storage at newHires/{c}/{b}/{hireId}/…
// (only those who manage staff or see pay can read it — storage.rules) and
// noted on the new hire. A second file of a kind replaces the first, except
// health certificates (up to 3). JSON { token, kind, remove: index } takes one away.

const fail = (status, error) => NextResponse.json({ error }, { status });
const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "image/heif": "heif", "application/pdf": "pdf" };

export async function POST(req) {
  try {
    const json = (req.headers.get("content-type") || "").includes("application/json");
    const form = json ? null : await req.formData();
    const body = json ? await req.json() : null;
    const token = json ? body.token : form.get("token");
    const kind = json ? body.kind : form.get("kind");

    const { state, link, hire, ref } = await openLink(token);
    if (state !== "open") return fail(410, "This link can't be used any more.");
    const many = kind === "health";
    const now = hire.files?.[kind];

    if (json) {
      // take one away
      const list = many ? now || [] : now ? [now] : [];
      const gone = list[Number(body.remove) || 0];
      if (!gone) return NextResponse.json({ ok: true });
      await removeFile(gone.path);
      await ref.update({ [`files.${kind}`]: many ? list.filter((f) => f !== gone) : null, updatedAt: new Date().toISOString() });
      return NextResponse.json({ ok: true });
    }

    const file = form.get("file");
    if (!file || typeof file.arrayBuffer !== "function") return fail(400, "No file");
    const problem = fileProblem(kind, { contentType: file.type, size: file.size });
    if (problem) return fail(400, problem);
    if (many && (now || []).length >= MAX_HEALTH_FILES) return fail(400, `Up to ${MAX_HEALTH_FILES} certificates`);

    const path = `newHires/${link.companyId}/${link.branchId}/${hire.id}/${kind}-${Date.now()}.${EXT[file.type] || "bin"}`;
    await putFile(path, Buffer.from(await file.arrayBuffer()), file.type);
    const saved = { path, name: String(file.name || kind).slice(0, 120), contentType: file.type, size: file.size, at: new Date().toISOString() };
    if (!many && now?.path) await removeFile(now.path); // replaced
    await ref.update({ [`files.${kind}`]: many ? [...(now || []), saved] : saved, updatedAt: new Date().toISOString() });
    return NextResponse.json({ ok: true, file: { name: saved.name, contentType: saved.contentType } });
  } catch (error) {
    console.error("Join upload error:", error);
    return fail(500, "Couldn't keep the file. Try again.");
  }
}
