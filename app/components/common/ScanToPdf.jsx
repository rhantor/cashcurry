"use client";
// Scan many pages into ONE PDF, in the app (30 Oct): a long grocery bill of
// 20+ pages no longer needs another scanner app. Take each page with the
// camera (or pick photos), put them in order, turn the crooked ones, choose
// colour or black & white (sharper text, smaller file) and how small the file
// should be — then one PDF comes back to attach. Everything happens on the
// phone; nothing is uploaded until the bill is saved.
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { jsPDF } from "jspdf";
import { ArrowLeft, ArrowRight, Camera, FileText, ImagePlus, RotateCw, Trash2 } from "lucide-react";
import { Button, Sheet, cn, toast } from "@/app/components/ui";
import { Chip } from "@/app/components/entry/Choices";

export const MAX_PAGES = 60;

/** How small the PDF is: the longest side of each page and the JPEG quality — and roughly what a page weighs. */
export const QUALITIES = {
  small: { label: "Small", px: 1100, q: 0.5, kb: 110, hint: "Fine to read, quick to send" },
  medium: { label: "Medium", px: 1600, q: 0.68, kb: 240, hint: "Clear — the usual choice" },
  high: { label: "High", px: 2200, q: 0.82, kb: 520, hint: "Sharpest, biggest file" },
};

/** A rough size before the PDF is made: pages × what a page weighs (black & white is lighter). */
export function estimateMb(pages, quality, tone) {
  const per = QUALITIES[quality]?.kb || QUALITIES.medium.kb;
  return Math.round(((pages * per * (tone === "bw" ? 0.7 : 1)) / 1024) * 10) / 10;
}

const loadImage = (url) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });

/** One page drawn to a JPEG: turned, scaled to the quality, in colour or black & white. → { data, w, h } */
async function renderPage(page, { px, q }, tone) {
  const img = await loadImage(page.url);
  const turned = page.turn % 180 !== 0;
  const srcW = turned ? img.height : img.width;
  const srcH = turned ? img.width : img.height;
  const scale = Math.min(1, px / Math.max(srcW, srcH));
  const w = Math.round(srcW * scale);
  const h = Math.round(srcH * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.translate(w / 2, h / 2);
  ctx.rotate((page.turn * Math.PI) / 180);
  const dw = (turned ? h : w);
  const dh = (turned ? w : h);
  ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
  if (tone === "bw") {
    // grey, with the contrast pushed so the print stands out from the paper
    const data = ctx.getImageData(0, 0, w, h);
    const d = data.data;
    for (let i = 0; i < d.length; i += 4) {
      const y = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      const v = Math.max(0, Math.min(255, (y - 128) * 1.45 + 150));
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    ctx.putImageData(data, 0, 0);
  }
  return { data: canvas.toDataURL("image/jpeg", q), w, h };
}

/** The pages as one PDF File: each page as big as A4 allows, in order. */
export async function pagesToPdf(pages, quality = "medium", tone = "color", onProgress) {
  const settings = QUALITIES[quality] || QUALITIES.medium;
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  for (let i = 0; i < pages.length; i++) {
    const { data, w, h } = await renderPage(pages[i], settings, tone);
    const landscape = w > h;
    if (i > 0) pdf.addPage("a4", landscape ? "landscape" : "portrait");
    else if (landscape) {
      pdf.deletePage(1);
      pdf.addPage("a4", "landscape");
    }
    const pw = pdf.internal.pageSize.getWidth();
    const ph = pdf.internal.pageSize.getHeight();
    const r = Math.min(pw / w, ph / h);
    pdf.addImage(data, "JPEG", (pw - w * r) / 2, (ph - h * r) / 2, w * r, h * r, undefined, "FAST");
    onProgress?.(i + 1);
  }
  const blob = pdf.output("blob");
  const day = format(new Date(), "yyyy-MM-dd"); // the phone's own day, for the name only
  return new File([blob], `scan-${day}-${pages.length}p.pdf`, { type: "application/pdf" });
}

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/**
 * The scanner, in a sheet. onDone(file) gets the one PDF. maxMb: the largest
 * file the place it goes takes (pay-out bills: 10 MB).
 */
export default function ScanToPdf({ open, onClose, onDone, maxMb = 10, title = "Scan pages into one PDF" }) {
  const [pages, setPages] = useState([]); // [{ id, url, turn }]
  const [quality, setQuality] = useState("medium");
  const [tone, setTone] = useState("color");
  const [busy, setBusy] = useState(0); // pages done while making the PDF; 0 = idle
  const [made, setMade] = useState(null); // the PDF made, before it is used

  // a fresh start each time it opens; photos freed when it closes
  useEffect(() => {
    if (open) return;
    setPages((list) => {
      list.forEach((p) => URL.revokeObjectURL(p.url));
      return [];
    });
    setMade(null);
    setBusy(0);
  }, [open]);
  useEffect(() => setMade(null), [pages, quality, tone]);
  // Esc closes only the scanner, not the form it was opened from (that would lose what was typed)
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      onClose?.();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  const add = (e) => {
    const files = [...(e.target.files || [])].filter((f) => f.type.startsWith("image/"));
    e.target.value = "";
    if (!files.length) return;
    setPages((list) => {
      const room = MAX_PAGES - list.length;
      if (files.length > room) toast.warning(`Up to ${MAX_PAGES} pages`, { description: `${files.length - room} left out.` });
      return [...list, ...files.slice(0, Math.max(0, room)).map((f, i) => ({ id: `${Date.now()}-${i}-${f.name}`, url: URL.createObjectURL(f), turn: 0 }))];
    });
  };
  const turn = (id) => setPages((l) => l.map((p) => (p.id === id ? { ...p, turn: (p.turn + 90) % 360 } : p)));
  const drop = (id) =>
    setPages((l) => {
      const p = l.find((x) => x.id === id);
      if (p) URL.revokeObjectURL(p.url);
      return l.filter((x) => x.id !== id);
    });
  const move = (i, step) =>
    setPages((l) => {
      const next = [...l];
      const [x] = next.splice(i, 1);
      next.splice(i + step, 0, x);
      return next;
    });

  const estimate = useMemo(() => estimateMb(pages.length, quality, tone), [pages.length, quality, tone]);

  const make = async () => {
    setBusy(1);
    try {
      const file = await pagesToPdf(pages, quality, tone, (n) => setBusy(n));
      setMade(file);
      if (file.size > maxMb * 1024 * 1024) toast.warning(`It came to ${mb(file.size)} — over ${maxMb} MB`, { description: "Choose Small, or black & white, and make it again." });
    } catch (e) {
      console.error(e);
      toast.error("Couldn't make the PDF", { description: "A photo may not have opened. Take it again and try once more." });
    } finally {
      setBusy(0);
    }
  };
  const use = () => {
    if (!made) return;
    onDone?.(made);
    toast.success(`PDF added · ${pages.length} page${pages.length === 1 ? "" : "s"} · ${mb(made.size)}`);
    onClose?.();
  };
  const tooBig = made && made.size > maxMb * 1024 * 1024;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      layer="z-[60]" // above the form it was opened from
      size="lg"
      title={title}
      description="Take each page (or pick photos), put them in order, then make one PDF."
      footer={
        <div className="flex w-full flex-wrap items-center gap-3">
          <p className="min-w-0 flex-1 text-xs text-muted">
            {busy ? `Making page ${busy} of ${pages.length}…` : made ? `${pages.length} page${pages.length === 1 ? "" : "s"} · ${mb(made.size)}` : pages.length ? `${pages.length} page${pages.length === 1 ? "" : "s"} · about ${estimate} MB` : "No pages yet"}
          </p>
          {made && !tooBig ? (
            <Button icon={FileText} onClick={use}>Use this PDF</Button>
          ) : (
            <Button icon={FileText} onClick={make} loading={!!busy} disabled={!pages.length}>Make one PDF</Button>
          )}
        </div>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-2">
          <label className="flex h-14 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-brand/50 bg-brand-soft/40 text-sm font-semibold text-brand hover:bg-brand-soft">
            <Camera className="size-5" /> Take a page
            <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={add} />
          </label>
          <label className="flex h-14 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-line text-sm font-semibold text-fg hover:bg-surface-2">
            <ImagePlus className="size-5" /> Pick photos
            <input type="file" accept="image/*" multiple className="sr-only" onChange={add} />
          </label>
        </div>

        {pages.length > 0 && (
          <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {pages.map((p, i) => (
              <li key={p.id} className="overflow-hidden rounded-xl border border-line bg-surface">
                <div className="relative flex aspect-[3/4] items-center justify-center overflow-hidden bg-surface-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={`Page ${i + 1}`} className="max-h-full max-w-full object-contain transition-transform" style={{ transform: `rotate(${p.turn}deg)` }} />
                  <span className="absolute left-1.5 top-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-white">{i + 1}</span>
                </div>
                <div className="flex items-center justify-between gap-1 px-1 py-1">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move page ${i + 1} earlier`} className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-fg disabled:opacity-30"><ArrowLeft className="size-4" /></button>
                  <button type="button" onClick={() => turn(p.id)} aria-label={`Turn page ${i + 1}`} className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-fg"><RotateCw className="size-4" /></button>
                  <button type="button" onClick={() => drop(p.id)} aria-label={`Remove page ${i + 1}`} className="rounded-lg p-2 text-muted hover:bg-danger-soft hover:text-danger"><Trash2 className="size-4" /></button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === pages.length - 1} aria-label={`Move page ${i + 1} later`} className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-fg disabled:opacity-30"><ArrowRight className="size-4" /></button>
                </div>
              </li>
            ))}
          </ol>
        )}

        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted">Look</p>
          <div className="flex flex-wrap gap-1.5">
            <Chip on={tone === "color"} onClick={() => setTone("color")}>Colour</Chip>
            <Chip on={tone === "bw"} onClick={() => setTone("bw")}>Black & white — sharper text</Chip>
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted">File size</p>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(QUALITIES).map(([k, v]) => (
              <button key={k} type="button" onClick={() => setQuality(k)} aria-pressed={quality === k} className={cn("rounded-xl border p-2.5 text-left transition", quality === k ? "border-brand bg-brand-soft" : "border-line hover:bg-surface-2")}>
                <span className="block text-sm font-semibold text-fg">{v.label}</span>
                <span className="block text-[11px] leading-tight text-muted">{v.hint}</span>
                {pages.length > 0 && <span className="mt-1 block text-[11px] font-semibold tabular-nums text-fg">≈ {estimateMb(pages.length, k, tone)} MB</span>}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted">The bill takes files up to {maxMb} MB.</p>
        </div>
      </div>
    </Sheet>
  );
}
