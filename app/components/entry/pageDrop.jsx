"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ImageDown } from "lucide-react";

export const hasFiles = (e) => Array.from(e.dataTransfer?.types || []).includes("Files");

/**
 * Files dragged anywhere over the page, or pasted with Ctrl+V, go to
 * `onFiles(files[])`. Returns whether a drag is over the page now (to show
 * <DropOverlay>). The browser never opens a dropped file in place of the app.
 */
export function usePageDrop(onFiles, enabled = true) {
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);
  const latest = useRef(onFiles);
  latest.current = onFiles;

  useEffect(() => {
    if (!enabled) return;
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
      e.preventDefault();
      depth.current = 0;
      setDragging(false);
      latest.current(Array.from(e.dataTransfer.files || []));
    };
    const paste = (e) => {
      const files = Array.from(e.clipboardData?.files || []).filter((f) => f.type?.startsWith("image/"));
      if (!files.length) return;
      e.preventDefault();
      latest.current(files);
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
  }, [enabled]);

  // a drop handled by a box itself ends the page drag too
  const reset = () => {
    depth.current = 0;
    setDragging(false);
  };
  return { dragging, reset };
}

/** The whole screen as the drop target while files are dragged over it. */
export function DropOverlay({ show, title = "Drop the photo here", note }) {
  const [mounted, setMounted] = useState(false); // the portal is client-only
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {show && (
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
            <p className="text-base font-bold text-fg">{title}</p>
            {note && <p className="text-xs text-muted">{note}</p>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

const MAX_FILE_MB = 20;
export const isPdf = (f) => f?.type === "application/pdf" || /\.pdf$/i.test(f?.name || "");
export const sizeOf = (b = 0) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/**
 * Checks a picked or dropped file and shrinks a big photo. Resolves to the
 * file to upload; rejects with { title, hint } to show the person.
 */
export async function prepareFile(file, { pdf = false, pdfOnly = false, shrink = { maxMB: 1.2, maxSide: 2200 } } = {}) {
  if (pdfOnly && !isPdf(file)) throw { title: "Use a PDF", hint: "This one takes a PDF file only." };
  const asPdf = (pdf || pdfOnly) && isPdf(file);
  if (!asPdf && !file.type?.startsWith("image/")) {
    throw { title: pdf ? "Use a photo or a PDF" : "That isn't a photo", hint: pdf ? "JPG, PNG or PDF." : "Use an image file (JPG or PNG)." };
  }
  if (file.size > MAX_FILE_MB * 1024 * 1024) throw { title: "That file is too big", hint: `Up to ${MAX_FILE_MB} MB.` };
  if (asPdf || file.size <= shrink.maxMB * 1024 * 1024) return file;
  const { default: imageCompression } = await import("browser-image-compression");
  return imageCompression(file, { maxSizeMB: shrink.maxMB, maxWidthOrHeight: shrink.maxSide, useWebWorker: true });
}
