"use client";
// Saved files on a record (bill pages, receipts, invoices): a small tile for
// each — the photo, or a PDF card, never a broken picture — and a sheet that
// shows them all. Tapping one opens it in the app's own viewer (FileViewer),
// never another tab.
import { useState } from "react";
import { FileText, Maximize2 } from "lucide-react";
import { Sheet, Skeleton } from "@/app/components/ui";
import { cn } from "@/app/components/ui/cn";
import FileViewer from "./FileViewer";

/** Storage links keep the file name before "?alt=media…": "…%2F123-0.pdf?alt=media". */
export const isPdfUrl = (u) => /\.pdf(\?|$)/i.test(String(u || ""));

/**
 * A square tile that opens the file in the viewer. `items` ([{ url, label }])
 * lets the viewer go on to the record's other files.
 */
export function FileThumb({ url, label = "File", className, items }) {
  const [open, setOpen] = useState(false);
  const list = items?.length ? items : [{ url, label }];
  const at = Math.max(0, list.findIndex((x) => x.url === url));
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} title={label} className={cn("block size-20 shrink-0 overflow-hidden rounded-xl border border-line bg-surface-2", className)}>
        {isPdfUrl(url) ? (
          <span className="flex size-full flex-col items-center justify-center gap-1 bg-danger-soft/60 text-danger">
            <FileText className="size-7" />
            <span className="text-[10px] font-bold tracking-wide">PDF</span>
          </span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={label} className="size-full object-cover" />
        )}
      </button>
      <FileViewer open={open} items={list} index={at} onClose={() => setOpen(false)} />
    </>
  );
}

/** One file, large: the photo itself, or a card for a PDF. `onOpen` opens it in the viewer. */
export function FileLarge({ url, label, onOpen }) {
  const [loading, setLoading] = useState(true);
  if (isPdfUrl(url)) {
    return (
      <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface-2/60 p-3 text-left transition hover:bg-surface-2">
        <span className="flex size-10 items-center justify-center rounded-xl bg-danger-soft text-danger">
          <FileText className="size-5" />
        </span>
        <span className="flex-1 text-sm font-semibold text-fg">{label} (PDF)</span>
        <Maximize2 className="size-4 text-subtle" />
      </button>
    );
  }
  return (
    <button type="button" onClick={onOpen} className="relative block w-full overflow-hidden rounded-2xl border border-line bg-surface-2">
      {loading && <Skeleton className="absolute inset-0" rounded="rounded-none" />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={label} className="max-h-96 w-full object-contain" onLoad={() => setLoading(false)} onError={() => setLoading(false)} />
    </button>
  );
}

const labelled = (groups) =>
  groups
    .filter((g) => g.urls?.length)
    .flatMap((g) => g.urls.map((u, i) => ({ url: u, label: `${g.title} ${g.urls.length > 1 ? i + 1 : ""}`.trim() })));

/** Every file of a record, in groups: [{ title: "Bill", urls }, { title: "Payment receipt", urls }]. */
export function FilesSheet({ open, onClose, title = "Files", groups = [] }) {
  const [viewing, setViewing] = useState(null); // index into every file
  const all = labelled(groups);
  return (
    <>
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
                    <FileLarge key={u} url={u} label={`${g.title} ${g.urls.length > 1 ? i + 1 : ""}`.trim()} onOpen={() => setViewing(all.findIndex((x) => x.url === u))} />
                  ))}
                </div>
              </section>
            ))}
        </div>
      </Sheet>
      <FileViewer open={open && viewing != null} items={all} index={Math.max(0, viewing ?? 0)} onClose={() => setViewing(null)} />
    </>
  );
}

/** The record's files as viewer items, in groups' order: for a tile that should page through all of them. */
export const viewerItems = labelled;
