"use client";
// Saved files on a record (bill pages, receipts, invoices): a small tile for
// each — the photo, or a PDF card, never a broken picture — and a sheet that
// shows them all.
import { useState } from "react";
import { ExternalLink, FileText } from "lucide-react";
import { Sheet, Skeleton } from "@/app/components/ui";
import { cn } from "@/app/components/ui/cn";

/** Storage links keep the file name before "?alt=media…": "…%2F123-0.pdf?alt=media". */
export const isPdfUrl = (u) => /\.pdf(\?|$)/i.test(String(u || ""));

/** A square tile that opens the file in a new tab. */
export function FileThumb({ url, label = "File", className }) {
  return (
    <a href={url} target="_blank" rel="noreferrer" title={label} className={cn("block size-20 shrink-0 overflow-hidden rounded-xl border border-line bg-surface-2", className)}>
      {isPdfUrl(url) ? (
        <span className="flex size-full flex-col items-center justify-center gap-1 bg-danger-soft/60 text-danger">
          <FileText className="size-7" />
          <span className="text-[10px] font-bold tracking-wide">PDF</span>
        </span>
      ) : (
        <img src={url} alt={label} className="size-full object-cover" />
      )}
    </a>
  );
}

/** One file, large: the photo itself, or a card for a PDF. */
export function FileLarge({ url, label }) {
  const [loading, setLoading] = useState(true);
  if (isPdfUrl(url)) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-2xl border border-line bg-surface-2/60 p-3 transition hover:bg-surface-2">
        <span className="flex size-10 items-center justify-center rounded-xl bg-danger-soft text-danger">
          <FileText className="size-5" />
        </span>
        <span className="flex-1 text-sm font-semibold text-fg">{label} (PDF)</span>
        <ExternalLink className="size-4 text-subtle" />
      </a>
    );
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" className="relative block overflow-hidden rounded-2xl border border-line bg-surface-2">
      {loading && <Skeleton className="absolute inset-0" rounded="rounded-none" />}
      <img src={url} alt={label} className="max-h-96 w-full object-contain" onLoad={() => setLoading(false)} onError={() => setLoading(false)} />
    </a>
  );
}

/** Every file of a record, in groups: [{ title: "Bill", urls }, { title: "Payment receipt", urls }]. */
export function FilesSheet({ open, onClose, title = "Files", groups = [] }) {
  return (
    <Sheet open={open} onClose={onClose} title={title} size="lg">
      <div className="space-y-6">
        {groups
          .filter((g) => g.urls?.length)
          .map((g) => (
            <section key={g.title} className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
                {g.title} · {g.urls.length}
              </h3>
              <div className="space-y-3">
                {g.urls.map((u, i) => (
                  <FileLarge key={u} url={u} label={`${g.title} ${g.urls.length > 1 ? i + 1 : ""}`.trim()} />
                ))}
              </div>
            </section>
          ))}
      </div>
    </Sheet>
  );
}
