"use client";
// Photos from a message, full screen: ← / → (or the arrows) between them,
// download, Esc or tap outside to close.
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Download, Loader2, X } from "lucide-react";
import { downloadFile } from "@/lib/chat/client";

export default function PhotoViewer({ photos, start = 0, onClose }) {
  const [i, setI] = useState(start);
  const [saving, setSaving] = useState(false);
  const n = photos?.length || 0;
  useEffect(() => setI(start), [start, photos]);
  useEffect(() => {
    if (!n) return;
    const key = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setI((x) => (x + 1) % n);
      if (e.key === "ArrowLeft") setI((x) => (x - 1 + n) % n);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [n, onClose]);
  if (!n || typeof document === "undefined") return null;
  const f = photos[i];
  const btn = "rounded-full bg-white/10 p-2.5 text-white backdrop-blur transition-colors hover:bg-white/20";
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90" role="dialog" aria-modal="true" aria-label="Photo" onClick={onClose}>
      <div className="absolute right-3 top-3 flex gap-2" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          aria-label="Download"
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            await downloadFile(f);
            setSaving(false);
          }}
          className={btn}
        >
          {saving ? <Loader2 className="size-5 animate-spin" /> : <Download className="size-5" />}
        </button>
        <button type="button" aria-label="Close" onClick={onClose} className={btn}>
          <X className="size-5" />
        </button>
      </div>
      {n > 1 && (
        <>
          <button type="button" aria-label="Previous photo" onClick={(e) => (e.stopPropagation(), setI((x) => (x - 1 + n) % n))} className={`${btn} absolute left-3`}>
            <ChevronLeft className="size-6" />
          </button>
          <button type="button" aria-label="Next photo" onClick={(e) => (e.stopPropagation(), setI((x) => (x + 1) % n))} className={`${btn} absolute right-3`}>
            <ChevronRight className="size-6" />
          </button>
          <span className="absolute bottom-4 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white">
            {i + 1} / {n}
          </span>
        </>
      )}
      <img src={f.url} alt={f.name} onClick={(e) => e.stopPropagation()} className="max-h-[88vh] max-w-[92vw] rounded-lg object-contain shadow-2xl" />
    </div>,
    document.body
  );
}
