"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import imageCompression from "browser-image-compression";
import { Camera, ExternalLink, ImageUp, Trash2 } from "lucide-react";
import { cn, toast } from "@/app/components/ui";

const MAX_MB = 1.2;
const MAX_SIDE = 2200;

/**
 * A photo as proof (Z report, receipt…): tap to take or choose one, see it,
 * remove it. Big photos are shrunk before upload. `progress` (0–100) shows
 * the upload; `required` marks it as needed.
 * onPick(file, previewUrl) · onRemove()
 */
export default function ProofUpload({ label = "Photo", preview, progress = 0, required = false, invalid = false, onPick, onRemove }) {
  const [busy, setBusy] = useState(false);

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // the same photo can be picked again after removing it
    if (!file) return;
    if (!file.type?.startsWith("image/")) {
      toast.error("That isn't a photo", { description: "Choose an image file (JPG or PNG)." });
      return;
    }
    setBusy(true);
    try {
      const small = file.size > MAX_MB * 1024 * 1024 ? await imageCompression(file, { maxSizeMB: MAX_MB, maxWidthOrHeight: MAX_SIDE, useWebWorker: true }) : file;
      onPick?.(small, URL.createObjectURL(small));
    } catch {
      toast.error("Couldn't read that photo", { description: "Try another one." });
    } finally {
      setBusy(false);
    }
  };

  const uploading = progress > 0 && progress < 100;

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
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={cn(
              "flex h-28 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed text-center transition-colors",
              invalid ? "border-danger/60 bg-danger-soft" : "border-line bg-surface-2/50 hover:border-brand/50 hover:bg-brand-soft/40"
            )}
          >
            <span className="flex size-10 items-center justify-center rounded-xl bg-surface text-brand shadow-card">
              {busy ? <ImageUp className="size-5 animate-pulse" /> : <Camera className="size-5" />}
            </span>
            <span className="text-sm font-semibold text-fg">{busy ? "Preparing photo…" : "Take or choose a photo"}</span>
            <input type="file" accept="image/*" onChange={pick} className="sr-only" />
          </motion.label>
        ) : (
          <motion.div
            key="photo"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="relative overflow-hidden rounded-2xl border border-line bg-surface-2"
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
    </div>
  );
}
