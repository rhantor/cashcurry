"use client";
import { useState } from "react";
import { format, isValid, parseISO } from "date-fns";
import { motion } from "framer-motion";
import { Building2, ExternalLink, FileSpreadsheet, FileText, Info, MoreHorizontal, Pencil, Share2, Trash2 } from "lucide-react";
import { Button, CountUp, Menu, Sheet, Skeleton } from "@/app/components/ui";

const when = (v) => {
  const d = typeof v === "string" ? parseISO(v) : v?.toDate ? v.toDate() : v?.seconds ? new Date(v.seconds * 1000) : v ? new Date(v) : null;
  return d && isValid(d) ? d : null;
};
import { isPdfUrl } from "@/app/components/common/Files";

const TONE = {
  bank: "from-[#2a78d6] to-[#1a4f94]",
  brand: "from-[#1f9a7c] to-[#0f5c4c]",
  out: "from-[#eb6834] to-[#a8431d]",
};

/** One attachment: the photo itself, or a file card for a PDF (opens in a new tab). */
function Attachment({ url, i }) {
  const [loading, setLoading] = useState(true);
  if (isPdfUrl(url)) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-2xl border border-line bg-surface-2/60 p-3 transition hover:bg-surface-2">
        <span className="flex size-10 items-center justify-center rounded-xl bg-danger-soft text-danger">
          <FileText className="size-5" />
        </span>
        <span className="flex-1 text-sm font-semibold text-fg">Document {i + 1} (PDF)</span>
        <ExternalLink className="size-4 text-subtle" />
      </a>
    );
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" className="relative block overflow-hidden rounded-2xl border border-line bg-surface-2">
      {loading && <Skeleton className="absolute inset-0" rounded="rounded-none" />}
      <img src={url} alt={`Attachment ${i + 1}`} className="max-h-80 w-full object-contain" onLoad={() => setLoading(false)} onError={() => setLoading(false)} />
    </a>
  );
}

/**
 * One saved record, like a slip: the amount on a coloured card, its details,
 * the attached photos/PDFs, who entered it and when. Share/PDF/Excel under
 * More; Edit when allowed.
 *   title, branch, amount, money, tone ("bank" | "brand" | "out"), amountLabel
 *   rows: [{ label, value }] (empty values are left out)
 *   files: [url] (null = this kind of record never has any); by; at (createdAt)
 *   share / pdf / excel: functions (each optional); onEdit; onDelete (red, asks first in the caller)
 *   note: a line above the details (e.g. why it can't be changed here)
 */
export default function RecordSheet({ open = true, onClose, title, branch, amount, money, amountLabel = "Amount", tone = "brand", rows = [], files = [], by, at, share, pdf, excel, onEdit, onDelete, note, children }) {
  const created = when(at);
  const menu = [
    share && { label: "Share", icon: Share2, onSelect: share },
    pdf && { label: "Download PDF", icon: FileText, onSelect: pdf },
    excel && { label: "Download Excel", icon: FileSpreadsheet, onSelect: excel },
  ].filter(Boolean);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      description={
        branch ? (
          <span className="inline-flex items-center gap-1.5">
            <Building2 className="size-3.5" />
            {branch}
          </span>
        ) : undefined
      }
      footer={
        (menu.length > 0 || onEdit || onDelete) && (
          <>
            {onDelete && (
              <Button variant="secondary" size="lg" icon={Trash2} onClick={onDelete} aria-label="Delete" className="shrink-0 px-3.5 text-danger sm:px-4">
                <span className="hidden sm:inline">Delete</span>
              </Button>
            )}
            {onEdit && (
              <Button variant="secondary" size="lg" icon={Pencil} onClick={onEdit} className="flex-1">
                Edit
              </Button>
            )}
            {menu.length > 0 && (
              <Menu
                align="end"
                width={200}
                trigger={(p) => (
                  <Button {...p} size="lg" icon={MoreHorizontal} variant={onEdit ? "secondary" : "primary"} className="flex-1">
                    Share or download
                  </Button>
                )}
                items={menu}
              />
            )}
          </>
        )
      }
    >
      <div className={`rounded-2xl bg-gradient-to-br ${TONE[tone] || TONE.brand} p-4 text-white`}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">{amountLabel}</p>
        <CountUp value={Number(amount) || 0} format={money} className="mt-0.5 block text-3xl font-bold tracking-tight" />
      </div>

      {note && (
        <p className="mt-3 flex gap-2 rounded-xl bg-info-soft px-3 py-2.5 text-xs text-fg">
          <Info className="mt-px size-3.5 shrink-0 text-info" />
          <span>{note}</span>
        </p>
      )}

      <dl className="mt-4 divide-y divide-line">
        {rows
          .filter((r) => r.value !== undefined && r.value !== null && r.value !== "")
          .map((r, i) => (
            <motion.div
              key={r.label}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.04 * i }}
              className="flex items-start justify-between gap-4 py-2.5 text-sm"
            >
              <dt className="shrink-0 text-muted">{r.label}</dt>
              <dd className="min-w-0 whitespace-pre-line break-words text-right font-medium text-fg">{r.value}</dd>
            </motion.div>
          ))}
      </dl>

      {children}

      {files === null ? null : files.length > 0 ? (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold text-muted">{files.length > 1 ? `Attachments (${files.length})` : "Attachment"}</p>
          {files.map((u, i) => (
            <Attachment key={u} url={u} i={i} />
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-xl bg-surface-2 px-3 py-2.5 text-center text-xs text-muted">No attachment</p>
      )}

      <p className="mt-4 text-center text-[11px] text-subtle">
        Entered by {by || "Unknown"}
        {created ? ` · ${format(created, "d MMM, h:mm a")}` : ""}
      </p>
    </Sheet>
  );
}
