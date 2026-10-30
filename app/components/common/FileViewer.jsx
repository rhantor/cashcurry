"use client";
// Files opened inside the app, not in another tab (the Android app has no
// tabs): a full-screen viewer for a record's photos and PDFs. Photos zoom
// (pinch, double-tap, the buttons, the wheel) and pan; PDFs are drawn page by
// page with pdf.js, so they read the same in the phone app as in a browser.
// ← → (or a swipe) go through the files; Esc closes.
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, ExternalLink, Minus, Plus, X } from "lucide-react";
import { Skeleton } from "@/app/components/ui";
import { cn } from "@/app/components/ui/cn";

const isPdf = (u) => /\.pdf(\?|$)/i.test(String(u || ""));
const MAX_ZOOM = 5;

// pdf.js, loaded the first time a PDF is opened
let pdfjs = null;
async function loadPdfjs() {
  if (!pdfjs) {
    pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
  }
  return pdfjs;
}

/** A PDF's pages, as wide as the viewer; `zoom` scales them. Falls back to the browser's own viewer. */
function PdfPages({ url, zoom }) {
  const box = useRef(null);
  const [pages, setPages] = useState(null); // each page drawn, as an image
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let dead = false;
    let doc = null;
    setPages(null);
    setFailed(false);
    (async () => {
      try {
        const lib = await loadPdfjs();
        doc = await lib.getDocument({ url }).promise;
        const width = Math.min(box.current?.clientWidth || 800, 1200);
        const out = [];
        for (let i = 1; i <= doc.numPages && !dead; i++) {
          const page = await doc.getPage(i);
          const base = page.getViewport({ scale: 1 });
          // sharp on phones: draw at the screen's pixel density
          const ratio = Math.min(window.devicePixelRatio || 1, 2);
          const vp = page.getViewport({ scale: (width / base.width) * ratio });
          const canvas = document.createElement("canvas");
          canvas.width = vp.width;
          canvas.height = vp.height;
          await page.render({ canvasContext: canvas.getContext("2d"), viewport: vp }).promise;
          out.push(canvas.toDataURL("image/jpeg", 0.92));
          if (!dead) setPages([...out]);
        }
      } catch (e) {
        console.error("PDF view failed", e);
        if (!dead) setFailed(true);
      }
    })();
    return () => {
      dead = true;
      doc?.destroy?.();
    };
  }, [url]);

  if (failed) {
    // the file couldn't be read here: the browser's own viewer
    return <iframe src={url} title="PDF" className="h-full w-full rounded-xl bg-white" />;
  }
  return (
    <div ref={box} className="mx-auto w-full max-w-[1200px] space-y-3 pb-6">
      {!pages && <Skeleton className="mx-auto aspect-[1/1.41] w-full max-w-3xl" rounded="rounded-xl" />}
      {pages?.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={i} src={src} alt={`Page ${i + 1}`} style={{ width: `${zoom * 100}%`, maxWidth: "none" }} className="mx-auto block rounded-lg bg-white shadow-float" />
      ))}
    </div>
  );
}

/** One photo: fits the screen, zooms and pans. */
function Photo({ url, zoom, setZoom }) {
  const [loading, setLoading] = useState(true);
  const pinch = useRef(null);
  const pointers = useRef(new Map());
  const lastTap = useRef(0);

  useEffect(() => setLoading(true), [url]);

  const down = (e) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom };
    }
  };
  const move = (e) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      setZoom(Math.min(MAX_ZOOM, Math.max(1, (pinch.current.zoom * d) / pinch.current.d)));
    }
  };
  const up = (e) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };
  const tap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) setZoom((z) => (z > 1 ? 1 : 2.5));
    lastTap.current = now;
  };

  return (
    <div className={cn("flex items-center justify-center", zoom > 1 ? "min-h-full min-w-full" : "h-full w-full")} style={{ touchAction: zoom > 1 ? "pan-x pan-y" : "pan-y" }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onClick={tap}>
      {loading && <Skeleton className="absolute inset-10" rounded="rounded-2xl" />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        draggable={false}
        onLoad={() => setLoading(false)}
        onError={() => setLoading(false)}
        style={zoom > 1 ? { width: `${zoom * 100}%`, maxWidth: "none", maxHeight: "none" } : undefined}
        className={cn("select-none object-contain", zoom > 1 ? "" : "max-h-full max-w-full")}
      />
    </div>
  );
}

/**
 * The viewer. items: [{ url, label, pdf? }] (`pdf`: a PDF whose address doesn't
 * say so, e.g. one drawn here); `index` the one to open with. Pass
 * `open={false}` (or no items) to close it.
 */
export default function FileViewer({ open, items = [], index = 0, onClose }) {
  const [at, setAt] = useState(index);
  const [zoom, setZoom] = useState(1);
  const swipe = useRef(null);
  const count = items.length;
  const item = items[Math.min(at, count - 1)];

  useEffect(() => {
    if (open) setAt(index);
  }, [open, index]);
  useEffect(() => setZoom(1), [at, open]);

  const go = useCallback((step) => count > 1 && setAt((i) => (i + step + count) % count), [count]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose?.();
      } else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    // before any sheet underneath, so Esc closes only the viewer
    document.addEventListener("keydown", onKey, true);
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = before;
    };
  }, [open, go, onClose]);

  if (!open || !item || typeof document === "undefined") return null;
  const pdf = item.pdf ?? isPdf(item.url);
  const zoomBy = (f) => setZoom((z) => Math.min(MAX_ZOOM, Math.max(1, Math.round(z * f * 100) / 100)));

  return createPortal(
    <div className="fixed inset-0 z-[260] flex flex-col bg-black/95 text-white" role="dialog" aria-modal="true" aria-label={item.label || "File"}>
      <div className="flex shrink-0 items-center gap-2 px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <p className="min-w-0 flex-1 truncate text-sm font-semibold">
          {item.label || (pdf ? "PDF" : "Photo")}
          {count > 1 && <span className="ml-2 font-normal text-white/60">{at + 1} of {count}</span>}
        </p>
        <button type="button" onClick={() => zoomBy(1 / 1.5)} disabled={zoom <= 1} className="flex size-10 items-center justify-center rounded-full hover:bg-white/10 disabled:opacity-30" aria-label="Zoom out">
          <Minus className="size-5" />
        </button>
        <button type="button" onClick={() => zoomBy(1.5)} disabled={zoom >= MAX_ZOOM} className="flex size-10 items-center justify-center rounded-full hover:bg-white/10 disabled:opacity-30" aria-label="Zoom in">
          <Plus className="size-5" />
        </button>
        <a href={item.url} target="_blank" rel="noreferrer" className="flex size-10 items-center justify-center rounded-full hover:bg-white/10" aria-label="Open the original" title="Open the original">
          <ExternalLink className="size-5" />
        </a>
        <button type="button" onClick={onClose} className="flex size-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20" aria-label="Close">
          <X className="size-5" />
        </button>
      </div>

      <div
        className="relative min-h-0 flex-1 overflow-auto px-2"
        onWheel={(e) => {
          if (!e.ctrlKey && !e.metaKey) return;
          zoomBy(e.deltaY < 0 ? 1.15 : 1 / 1.15);
        }}
        onTouchStart={(e) => (swipe.current = e.touches.length === 1 && zoom === 1 ? e.touches[0].clientX : null)}
        onTouchEnd={(e) => {
          if (swipe.current == null) return;
          const dx = e.changedTouches[0].clientX - swipe.current;
          swipe.current = null;
          if (Math.abs(dx) > 60) go(dx < 0 ? 1 : -1);
        }}
      >
        {pdf ? <PdfPages key={item.url} url={item.url} zoom={zoom} /> : <Photo key={item.url} url={item.url} zoom={zoom} setZoom={setZoom} />}
      </div>

      {count > 1 && (
        <>
          <button type="button" onClick={() => go(-1)} className="absolute left-2 top-1/2 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 sm:flex" aria-label="Previous">
            <ChevronLeft className="size-6" />
          </button>
          <button type="button" onClick={() => go(1)} className="absolute right-2 top-1/2 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 sm:flex" aria-label="Next">
            <ChevronRight className="size-6" />
          </button>
          <div className="flex shrink-0 justify-center gap-1.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
            {items.map((x, i) => (
              <button key={x.url + i} type="button" onClick={() => setAt(i)} className={cn("h-1.5 rounded-full transition-all", i === at ? "w-5 bg-white" : "w-1.5 bg-white/40")} aria-label={`File ${i + 1}`} />
            ))}
          </div>
        </>
      )}
    </div>,
    document.body
  );
}
