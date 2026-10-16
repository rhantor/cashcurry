"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Camera, ExternalLink, FileText, ImageDown, ImageUp, Trash2 } from "lucide-react";
import { cn, toast } from "@/app/components/ui";
import { DropOverlay, hasFiles, isPdf, prepareFile, sizeOf, usePageDrop } from "./pageDrop";

/**
 * A photo as proof (Z report, receipt…): tap to take or choose one, see it,
 * remove it. On a computer a photo can also be dragged onto the page —
 * anywhere: the whole screen becomes the drop target — or pasted (Ctrl+V).
 * Big photos are shrunk before upload (`shrink` = { maxMB, maxSide }).
 * `pdf` also takes PDF files (shown as a file card; pass the picked `file`).
 * `progress` (0–100) shows the upload; `required` marks it as needed.
 * `pageDrop={false}` limits dropping to the box (use it when a page has two).
 * onPick(file, url) · onRemove()
 */
export default function ProofUpload({
  label = "Photo",
  preview,
  file,
  progress = 0,
  required = false,
  invalid = false,
  pageDrop = true,
  pdf = false,
  pdfOnly = false,
  shrink = { maxMB: 1.2, maxSide: 2200 },
  hint,
  onPick,
  onRemove,
}) {
  const [busy, setBusy] = useState(false);
  const [overBox, setOverBox] = useState(false);
  const uploading = progress > 0 && progress < 100;

  const take = async (picked) => {
    if (!picked || uploading) return;
    setBusy(true);
    try {
      const ready = await prepareFile(picked, { pdf, pdfOnly, shrink });
      onPick?.(ready, URL.createObjectURL(ready));
      toast.success(`${label} attached`);
    } catch (err) {
      toast.error(err.title || "Couldn't read that file", { description: err.hint || "Try another one." });
    } finally {
      setBusy(false);
    }
  };

  // Drag a photo anywhere on the page; paste one with Ctrl+V.
  const { dragging, reset } = usePageDrop((files) => take(files[0]), pageDrop);

  const pick = (e) => {
    const picked = e.target.files?.[0];
    e.target.value = ""; // the same file can be picked again after removing it
    take(picked);
  };

  // dropping onto the box itself (also when page-wide dropping is off)
  const boxDrop = {
    onDragOver: (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      setOverBox(true);
    },
    onDragLeave: () => setOverBox(false),
    onDrop: (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      e.stopPropagation();
      reset();
      setOverBox(false);
      take(e.dataTransfer.files?.[0]);
    },
  };

  const target = overBox || dragging;

  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2">
        <span className="text-xs font-semibold text-muted">{label}</span>
        {required && <span className="rounded-md bg-warning-soft px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-warning">Needed</span>}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        {!preview ? (
          <motion.label
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, scale: target ? 1.01 : 1 }}
            exit={{ opacity: 0 }}
            {...boxDrop}
            className={cn(
              "flex h-28 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed text-center transition-colors",
              target
                ? "border-brand bg-brand-soft"
                : invalid
                  ? "border-danger/60 bg-danger-soft"
                  : "border-line bg-surface-2/50 hover:border-brand/50 hover:bg-brand-soft/40"
            )}
          >
            <span className="flex size-10 items-center justify-center rounded-xl bg-surface text-brand shadow-card">
              {busy ? <ImageUp className="size-5 animate-pulse" /> : target ? <ImageDown className="size-5" /> : <Camera className="size-5" />}
            </span>
            <span className="text-sm font-semibold text-fg">
              {busy ? "Preparing…" : target ? "Drop it here" : pdfOnly ? "Choose a PDF" : pdf ? "Take a photo or choose a file" : "Take or choose a photo"}
            </span>
            {/* computers: say it can be dragged or pasted too */}
            {!busy && !target && <span className="hidden text-xs text-muted lg:block">or drag one here · Ctrl+V to paste</span>}
            <input type="file" accept={pdfOnly ? "application/pdf" : pdf ? "image/*,application/pdf" : "image/*"} onChange={pick} className="sr-only" />
          </motion.label>
        ) : (pdf || pdfOnly) && isPdf(file) ? (
          <motion.div
            key="pdf"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            {...boxDrop}
            className={cn("relative flex items-center gap-3 overflow-hidden rounded-2xl border bg-surface-2/60 p-3", target ? "border-brand ring-4 ring-[var(--cc-ring)]" : "border-line")}
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-danger-soft text-danger">
              <FileText className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-fg">{file.name || "Document.pdf"}</span>
              <span className="text-xs text-muted">PDF · {sizeOf(file.size)}</span>
            </span>
            <a
              href={preview}
              target="_blank"
              rel="noreferrer"
              aria-label="Open the PDF"
              className="flex size-9 items-center justify-center rounded-xl text-muted transition hover:bg-surface hover:text-fg"
            >
              <ExternalLink className="size-4" />
            </a>
            <button
              type="button"
              onClick={onRemove}
              disabled={uploading}
              aria-label="Remove file"
              className="flex size-9 items-center justify-center rounded-xl text-danger transition hover:bg-surface disabled:opacity-50"
            >
              <Trash2 className="size-4" />
            </button>
            {uploading && (
              <div className="absolute inset-x-0 bottom-0 h-1 bg-black/10">
                <motion.div className="h-full bg-brand" animate={{ width: `${progress}%` }} transition={{ duration: 0.2 }} />
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="photo"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            {...boxDrop}
            className={cn("relative overflow-hidden rounded-2xl border bg-surface-2", target ? "border-brand ring-4 ring-[var(--cc-ring)]" : "border-line")}
          >
            <img src={preview} alt={label} className="max-h-64 w-full object-contain" />
            <div className="absolute right-2 top-2 flex gap-1.5">
              <a
                href={preview}
                target="_blank"
                rel="noreferrer"
                aria-label="Open full size"
                className="flex size-9 items-center justify-center rounded-xl bg-surface/90 text-fg shadow-card backdrop-blur transition hover:bg-surface"
              >
                <ExternalLink className="size-4" />
              </a>
              <button
                type="button"
                onClick={onRemove}
                disabled={uploading}
                aria-label="Remove photo"
                className="flex size-9 items-center justify-center rounded-xl bg-surface/90 text-danger shadow-card backdrop-blur transition hover:bg-surface disabled:opacity-50"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
            {uploading && (
              <div className="absolute inset-x-0 bottom-0 h-1.5 bg-black/10">
                <motion.div className="h-full bg-brand" animate={{ width: `${progress}%` }} transition={{ duration: 0.2 }} />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      {hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}

      {pageDrop && <DropOverlay show={dragging} note={`It becomes the ${label}${preview ? ", replacing the one attached" : ""}`} />}
    </div>
  );
}
