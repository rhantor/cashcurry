"use client";
// Everything someone sent on their join link, as one PDF to keep, download or
// share (owner, 10 Nov 2026): the details they filled in with their photo,
// their IC/passport and other photos two to a page, then the appointment
// letter they signed and any PDFs they sent. Browser only.
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { PDFDocument } from "pdf-lib";
import { getBlob, ref } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { dayLabel, detailLines, documentsFrom, hireName, joinFileName } from "./model";
import { fileUrl } from "./client";

const BRAND = [11, 77, 64];
const M = 14; // margin, mm
const W = 210;

/** A stored file's bytes: through our own server first (the bucket may not allow the app to read it directly), then straight from storage. */
async function fileBlob(path) {
  try {
    const res = await fetch(`/api/proxy-image?url=${encodeURIComponent(await fileUrl(path))}`);
    if (res.ok) return await res.blob();
  } catch {
    // try storage itself
  }
  return getBlob(ref(storage, path));
}

/** A photo as a JPEG for the PDF, at most 1600 px on its long side: { data, w, h } — null when this browser can't draw it (e.g. HEIC). */
async function photoJpeg(blob) {
  let pic = null;
  let url = null;
  try {
    pic = await createImageBitmap(blob);
  } catch {
    // some kinds (an SVG, say) only an <img> can read
    try {
      url = URL.createObjectURL(blob);
      pic = await new Promise((ok, no) => {
        const img = new Image();
        img.onload = () => ok(img);
        img.onerror = no;
        setTimeout(() => no(new Error("too slow")), 15000);
        img.src = url;
      });
    } catch {
      pic = null;
    }
  }
  try {
    const w0 = pic?.naturalWidth || pic?.width;
    const h0 = pic?.naturalHeight || pic?.height;
    if (!w0 || !h0) return null;
    const k = Math.min(1, 1600 / Math.max(w0, h0));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w0 * k);
    canvas.height = Math.round(h0 * k);
    const g = canvas.getContext("2d");
    g.fillStyle = "#fff";
    g.fillRect(0, 0, canvas.width, canvas.height);
    g.drawImage(pic, 0, 0, canvas.width, canvas.height);
    return { data: canvas.toDataURL("image/jpeg", 0.85), w: canvas.width, h: canvas.height };
  } catch {
    return null;
  } finally {
    pic?.close?.();
    if (url) URL.revokeObjectURL(url);
  }
}

/** Fit w×h inside box bw×bh: { w, h }. */
const fit = (w, h, bw, bh) => {
  const k = Math.min(bw / w, bh / h);
  return { w: w * k, h: h * k };
};

/**
 * The PDF. hire: the new hire (with details, files, signed); letter: the saved
 * appointment letter's PDF bytes or null; company: the name on top; role: the
 * job's name as shown in the app.
 * → { blob, fileName, missed: [labels of files that couldn't be added] }
 */
export async function joinPdf(hire, { company = "", letter = null, role = "" } = {}) {
  const d = hire.details || {};
  const docs = documentsFrom(hire);
  const missed = [];
  // every file read first, so the first page can say where each one is
  const loaded = await Promise.all(
    docs.map(async (f) => {
      try {
        const blob = await fileBlob(f.path);
        const pdf = f.contentType === "application/pdf" || blob.type === "application/pdf";
        if (pdf) return { ...f, pdfBytes: new Uint8Array(await blob.arrayBuffer()) };
        const img = await photoJpeg(blob);
        return img ? { ...f, img } : { ...f, failed: true };
      } catch {
        return { ...f, failed: true };
      }
    })
  );

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const photo = loaded.find((f) => f.kind === "photo" && f.img);

  // ── page 1: who, and what they filled in ──
  doc.setFillColor(...BRAND);
  doc.rect(0, 0, W, 4, "F");
  doc.setTextColor(110);
  doc.setFontSize(9);
  doc.text(String(company || "").toUpperCase(), M, 14);
  doc.setTextColor(20);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(hireName(hire), M, 23);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(80);
  const job = [role || hire.role, hire.department, hire.startDate && `starts ${dayLabel(hire.startDate)}`].filter(Boolean).join(" · ");
  if (job) doc.text(job, M, 30);
  doc.text(`Details from their join link${hire.submittedAt ? `, filled in ${dayLabel(hire.submittedAt)}` : ""}.`, M, job ? 36 : 30);
  let top = 44;
  if (photo) {
    const s = fit(photo.img.w, photo.img.h, 34, 42);
    doc.addImage(photo.img.data, "JPEG", W - M - s.w, 9, s.w, s.h);
    top = Math.max(top, 9 + s.h + 5);
  }

  autoTable(doc, {
    startY: top,
    body: detailLines(d),
    theme: "grid",
    styles: { fontSize: 10, cellPadding: 2.6, lineColor: [220, 226, 224], textColor: 20 },
    columnStyles: { 0: { cellWidth: 44, textColor: 100, fillColor: [245, 248, 247] } },
    margin: { left: M, right: M },
  });

  const images = loaded.filter((f) => f.img && f.kind !== "photo");
  const pdfs = loaded.filter((f) => f.pdfBytes);
  const where = (f) => (f.failed ? "Couldn't add — open it in the app" : f.kind === "photo" ? "Above" : f.pdfBytes ? "At the end (their PDF)" : "Next pages");
  const rows = [...loaded.map((f) => [f.label, where(f)]), ...(letter ? [["Appointment letter", hire.signed ? `Signed ${dayLabel(hire.signed.at)} — after the photos` : "After the photos"]] : [])];
  if (rows.length) {
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 8,
      head: [["Documents", ""]],
      body: rows,
      theme: "grid",
      styles: { fontSize: 10, cellPadding: 2.6, lineColor: [220, 226, 224], textColor: 20 },
      headStyles: { fillColor: BRAND, textColor: 255 },
      columnStyles: { 0: { cellWidth: 70 } },
      margin: { left: M, right: M },
    });
  }
  for (const f of loaded) if (f.failed) missed.push(f.label);

  // ── their photos, two to a page ──
  const boxH = (297 - 2 * M - 2 * 8 - 6) / 2;
  images.forEach((f, i) => {
    const second = i % 2 === 1;
    if (!second) doc.addPage();
    const y0 = M + (second ? boxH + 8 + 6 : 0);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(20);
    doc.text(f.label, M, y0 + 5);
    doc.setFont("helvetica", "normal");
    const s = fit(f.img.w, f.img.h, W - 2 * M, boxH);
    doc.addImage(f.img.data, "JPEG", M + (W - 2 * M - s.w) / 2, y0 + 8, s.w, s.h);
  });

  // ── the signed letter, then their own PDFs ──
  const extra = [...(letter ? [{ label: "Appointment letter", bytes: letter }] : []), ...pdfs.map((f) => ({ label: f.label, bytes: f.pdfBytes }))];
  let bytes = doc.output("arraybuffer");
  if (extra.length) {
    const out = await PDFDocument.load(bytes);
    for (const x of extra) {
      try {
        const src = await PDFDocument.load(x.bytes, { ignoreEncryption: true });
        for (const p of await out.copyPages(src, src.getPageIndices())) out.addPage(p);
      } catch {
        missed.push(x.label);
      }
    }
    bytes = await out.save();
  }
  return { blob: new Blob([bytes], { type: "application/pdf" }), fileName: joinFileName(hire), missed };
}

/** Save a file to the device. */
export function saveBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Share it (WhatsApp and the rest, from the phone's share sheet). "shared" | "cancelled" | "again" (tap Share once more) | "saved" (no share sheet here: downloaded instead). */
export async function shareBlob(blob, fileName, title) {
  const file = new File([blob], fileName, { type: blob.type || "application/pdf" });
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return "shared";
    } catch (e) {
      if (e?.name === "AbortError") return "cancelled";
      // making the PDF took too long after the tap: the phone wants a fresh tap
      if (e?.name === "NotAllowedError") return "again";
    }
  }
  saveBlob(blob, fileName);
  return "saved";
}
