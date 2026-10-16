"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import imageCompression from "browser-image-compression";
import { Camera, ExternalLink, FileText, ImageDown, ImageUp, Trash2 } from "lucide-react";
import { cn, toast } from "@/app/components/ui";

const MAX_FILE_MB = 20;
const isPdf = (f) => f?.type === "application/pdf" || /\.pdf$/i.test(f?.name || "");
const sizeOf = (b = 0) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const hasFiles = (e) => Array.from(e.dataTransfer?.types || []).includes("Files");

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
  shrink = { maxMB: 1.2, maxSide: 2200 },
  hint,
  onPick,
  onRemove,
}) {
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false); // a file is being dragged over the page
  const [overBox, setOverBox] = useState(false);
  const depth = useRef(0);
  const [mounted, setMounted] = useState(false); // the overlay portal is client-only
  useEffect(() => setMounted(true), []);
  const uploading = progress > 0 && progress < 100;

  // the latest handler for the page-wide listeners below
  const take = useRef(null);
  take.current = async (picked) => {
    if (!picked || uploading) return;
    const asPdf = pdf && isPdf(picked);
    if (!asPdf && !picked.type?.startsWith("image/")) {
      toast.error(pdf ? "Use a photo or a PDF" : "That isn't a photo", { description: pdf ? "JPG, PNG or PDF." : "Use an image file (JPG or PNG)." });
      return;
    }
    if (picked.size > MAX_FILE_MB * 1024 * 1024) {
      toast.error("That file is too big", { description: `Up to ${MAX_FILE_MB} MB.` });
      return;
    }
    setBusy(true);
    try {
      const small =
        !asPdf && picked.size > shrink.maxMB * 1024 * 1024
          ? await imageCompression(picked, { maxSizeMB: shrink.maxMB, maxWidthOrHeight: shrink.maxSide, useWebWorker: true })
          : picked;
      onPick?.(small, URL.createObjectURL(small));
      toast.success(`${label} attached`);
    } catch {
      toast.error("Couldn't read that photo", { description: "Try another one." });
    } finally {
      setBusy(false);
    }
  };

  // Drag a photo anywhere on the page; paste one with Ctrl+V.
  useEffect(() => {
    if (!pageDrop) return;
    const enter = (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth.current += 1;
      setDragging(true);
    };
    const over = (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault(); // allows dropping
      e.dataTransfer.dropEffect = "copy";
    };
    const leave = (e) => {
      if (!hasFiles(e)) return;
      depth.current = Math.max(0, depth.current - 1);
      if (!depth.current) setDragging(false);
    };
    const drop = (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault(); // never let the browser open the photo in place of the app
      depth.current = 0;
      setDragging(false);
      setOverBox(false);
      take.current(e.dataTransfer.files?.[0]);
    };
    const paste = (e) => {
      const pasted = Array.from(e.clipboardData?.files || []).find((f) => f.type?.startsWith("image/"));
      if (!pasted) return;
      e.preventDefault();
      take.current(pasted);
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    window.addEventListener("paste", paste);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
      window.removeEventListener("paste", paste);
    };
  }, [pageDrop]);

  const pick = (e) => {
    const picked = e.target.files?.[0];
    e.target.value = ""; // the same file can be picked again after removing it
    take.current(picked);
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
      depth.current = 0;
      setDragging(false);
      setOverBox(false);
      take.current(e.dataTransfer.files?.[0]);
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
              {busy ? "Preparing…" : target ? "Drop it here" : pdf ? "Take a photo or choose a file" : "Take or choose a photo"}
            </span>
            {/* computers: say it can be dragged or pasted too */}
            {!busy && !target && <span className="hidden text-xs text-muted lg:block">or drag one here · Ctrl+V to paste</span>}
            <input type="file" accept={pdf ? "image/*,application/pdf" : "image/*"} onChange={pick} className="sr-only" />
          </motion.label>
        ) : pdf && isPdf(file) ? (
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

      {/* the whole screen is the drop target while a file is dragged over it */}
      {pageDrop && mounted &&
        createPortal(
          <AnimatePresence>
            {dragging && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="pointer-events-none fixed inset-0 z-[250] flex items-center justify-center bg-brand/10 p-6 backdrop-blur-[2px]"
              >
                <motion.div
                  initial={{ scale: 0.94, y: 8 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.96 }}
                  className="flex w-full max-w-md flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-brand bg-surface/95 px-8 py-10 text-center shadow-float"
                >
                  <motion.span
                    animate={{ y: [0, -6, 0] }}
                    transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                    className="flex size-14 items-center justify-center rounded-2xl bg-brand-soft text-brand"
                  >
                    <ImageDown className="size-7" />
                  </motion.span>
                  <p className="text-base font-bold text-fg">Drop the photo here</p>
                  <p className="text-xs text-muted">
                    It becomes the {label}
                    {preview ? ", replacing the one attached" : ""}
                  </p>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
}
