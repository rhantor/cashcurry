"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Camera, FileText, Plus, Trash2 } from "lucide-react";
import { cn, toast } from "@/app/components/ui";
import { DropOverlay, hasFiles, isPdf, prepareFile, sizeOf, usePageDrop } from "./pageDrop";

/**
 * Several photos or PDFs (e.g. an ATM slip and a transfer screenshot):
 * a grid of what's attached plus a tile to add more. Drag files anywhere on
 * the page or paste them, as with a single proof.
 *   items: [{ id, file, url }] · onChange(items)
 *   progress (0–100, the whole batch) · required · invalid · shrink
 */
export default function ProofFiles({ label = "Receipts", items = [], onChange, progress = 0, required = false, invalid = false, pdf = true, shrink, hint }) {
  const [busy, setBusy] = useState(false);
  const uploading = progress > 0 && progress < 100;

  const add = async (files) => {
    if (!files?.length || uploading) return;
    setBusy(true);
    const added = [];
    for (const f of files) {
      try {
        const ready = await prepareFile(f, { pdf, shrink });
        added.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, file: ready, url: URL.createObjectURL(ready) });
      } catch (err) {
        toast.error(err.title || "Couldn't read a file", { description: `${f.name}: ${err.hint || "try another one."}` });
      }
    }
    setBusy(false);
    if (added.length) {
      onChange?.([...items, ...added]);
      toast.success(added.length > 1 ? `${added.length} files attached` : "File attached");
    }
  };
  const remove = (id) => onChange?.(items.filter((x) => x.id !== id));

  const { dragging, reset } = usePageDrop(add);
  const pick = (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    add(files);
  };
  const boxDrop = {
    onDragOver: (e) => hasFiles(e) && e.preventDefault(),
    onDrop: (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      e.stopPropagation();
      reset();
      add(Array.from(e.dataTransfer.files || []));
    },
  };

  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2">
        <span className="text-xs font-semibold text-muted">{label}</span>
        {required && <span className="rounded-md bg-warning-soft px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-warning">Needed</span>}
        {items.length > 0 && <span className="ml-auto text-xs text-subtle">{items.length} attached</span>}
      </div>

      {items.length === 0 ? (
        <label
          {...boxDrop}
          className={cn(
            "flex h-28 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed text-center transition-colors",
            dragging ? "border-brand bg-brand-soft" : invalid ? "border-danger/60 bg-danger-soft" : "border-line bg-surface-2/50 hover:border-brand/50 hover:bg-brand-soft/40"
          )}
        >
          <span className="flex size-10 items-center justify-center rounded-xl bg-surface text-brand shadow-card">
            <Camera className={cn("size-5", busy && "animate-pulse")} />
          </span>
          <span className="text-sm font-semibold text-fg">{busy ? "Preparing…" : "Take photos or choose files"}</span>
          {!busy && <span className="hidden text-xs text-muted lg:block">or drag them here · Ctrl+V to paste</span>}
          <input type="file" multiple accept={pdf ? "image/*,application/pdf" : "image/*"} onChange={pick} className="sr-only" />
        </label>
      ) : (
        <div {...boxDrop} className={cn("grid grid-cols-3 gap-2 rounded-2xl sm:grid-cols-4", dragging && "ring-4 ring-[var(--cc-ring)]")}>
          <AnimatePresence initial={false}>
            {items.map((x) => (
              <motion.div
                key={x.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="group relative aspect-square overflow-hidden rounded-xl border border-line bg-surface-2"
              >
                {isPdf(x.file) ? (
                  <a href={x.url} target="_blank" rel="noreferrer" className="flex size-full flex-col items-center justify-center gap-1 p-2 text-center">
                    <FileText className="size-7 text-danger" />
                    <span className="line-clamp-2 break-all text-[10px] font-medium text-muted">{x.file.name}</span>
                    <span className="text-[10px] text-subtle">{sizeOf(x.file.size)}</span>
                  </a>
                ) : (
                  <a href={x.url} target="_blank" rel="noreferrer">
                    <img src={x.url} alt={x.file.name} className="size-full object-cover" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => remove(x.id)}
                  disabled={uploading}
                  aria-label={`Remove ${x.file.name}`}
                  className="absolute right-1 top-1 flex size-7 items-center justify-center rounded-lg bg-surface/90 text-danger shadow-card backdrop-blur disabled:opacity-50"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
          <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-line text-muted transition hover:border-brand/50 hover:text-brand">
            <Plus className={cn("size-5", busy && "animate-pulse")} />
            <span className="text-[11px] font-semibold">Add</span>
            <input type="file" multiple accept={pdf ? "image/*,application/pdf" : "image/*"} onChange={pick} className="sr-only" />
          </label>
        </div>
      )}

      {uploading && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
          <motion.div className="h-full bg-brand" animate={{ width: `${progress}%` }} transition={{ duration: 0.2 }} />
        </div>
      )}
      {hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
      <DropOverlay show={dragging} title="Drop the files here" note={`They're added to ${label.toLowerCase()}`} />
    </div>
  );
}
