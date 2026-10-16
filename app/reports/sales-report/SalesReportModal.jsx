"use client";
import { useMemo, useState } from "react";
import { format, isValid, parseISO } from "date-fns";
import { motion } from "framer-motion";
import { Building2, Download, FileSpreadsheet, FileText, ImageIcon, Landmark, MoreHorizontal, Pencil, Share2, Wallet } from "lucide-react";
import { exportToExcel, exportToPDF, handleShare, handleShareImage as shareImage } from "@/utils/export/exportData";
import useCurrency from "@/app/hooks/useCurrency";
import { formatMoney } from "@/lib/region/currency";
import { Badge, Button, CountUp, Menu, Sheet, Skeleton, cn, toast } from "@/app/components/ui";

const DEFAULT_TENDERS = [
  { key: "cash", label: "Cash", enabled: true, includeInTotal: true, order: 1 },
  { key: "card", label: "Card", enabled: true, includeInTotal: true, order: 2, banked: true },
  { key: "qr", label: "QR", enabled: true, includeInTotal: true, order: 3, banked: true },
  { key: "grab", label: "Grab", enabled: true, includeInTotal: true, order: 4 },
  { key: "foodpanda", label: "Foodpanda", enabled: true, includeInTotal: true, order: 5 },
  { key: "online", label: "Online", enabled: false, includeInTotal: true, order: 6 },
  { key: "cheque", label: "Cheque", enabled: false, includeInTotal: true, order: 7 },
  { key: "promotion", label: "Promotion", enabled: false, includeInTotal: false, order: 8 },
];

const when = (v) => {
  const d = typeof v === "string" ? parseISO(v) : v?.toDate ? v.toDate() : v ? new Date(v) : null;
  return d && isValid(d) ? d : null;
};

/**
 * One day's sales, like a receipt: the day's total and the month so far,
 * each payment type (with its note, and whether it goes to the bank or
 * stays in the till), the Z report photo, who entered it. Share as an image
 * or PDF, download PDF/Excel, and — when `onEdit` is given — edit it.
 * Props as before: item (the sale), branchData, monthTotal ("1234.50"), onClose.
 */
export default function ItemsReportModal({ item, branchData, onClose, monthTotal, onEdit }) {
  const currency = useCurrency();
  const money = (v) => formatMoney(v, currency);
  const [imgLoading, setImgLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [shared, setShared] = useState(null); // a generated image the device couldn't share directly

  const tenders = useMemo(() => {
    if (!item) return DEFAULT_TENDERS;
    if (Array.isArray(item.tenderMeta) && item.tenderMeta.length) {
      return [...item.tenderMeta]
        .map((t) => ({ key: t.key, label: t.label ?? t.key, includeInTotal: t.includeInTotal !== false, banked: !!t.banked, enabled: true, order: t.order ?? 9999 }))
        .sort((a, b) => a.order - b.order);
    }
    const present = DEFAULT_TENDERS.filter((t) => Object.hasOwn(item, t.key));
    return (present.length ? present : DEFAULT_TENDERS).sort((a, b) => a.order - b.order);
  }, [item]);

  if (!item) return null;

  const total =
    item.total ??
    tenders.filter((t) => t.includeInTotal).reduce((n, t) => n + Math.round((parseFloat(item[t.key]) || 0) * 100), 0) / 100;
  const branchTitle = Array.isArray(branchData) ? branchData.map((b) => b.name).join(", ") : branchData?.name || "Branch";
  const day = when(item.date);
  const created = when(item.createdAt);
  const by = item.createdBy?.username || item.createdBy?.userName || "Unknown";

  const doShareImage = async () => {
    setSharing(true);
    try {
      const dataUrl = await shareImage(item, branchData, tenders, monthTotal);
      if (dataUrl) setShared(dataUrl);
    } catch (err) {
      toast.error("Couldn't make the image", { description: String(err?.message || err) });
    } finally {
      setSharing(false);
    }
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={day ? format(day, "EEEE, d MMMM yyyy") : "Sales"}
      description={
        <span className="inline-flex items-center gap-1.5">
          <Building2 className="size-3.5" />
          {branchTitle}
        </span>
      }
      footer={
        <>
          <Menu
            align="start"
            width={210}
            trigger={(p) => (
              <Button {...p} variant="secondary" size="lg" icon={MoreHorizontal} aria-label="More: PDF, Excel" className="shrink-0 px-3.5 sm:px-4">
                <span className="hidden sm:inline">More</span>
              </Button>
            )}
            items={[
              { label: "Share as PDF", icon: Share2, onSelect: () => handleShare(item, branchData, tenders, monthTotal) },
              { label: "Download PDF", icon: FileText, onSelect: () => exportToPDF(item, branchData, tenders, monthTotal) },
              { label: "Download Excel", icon: FileSpreadsheet, onSelect: () => exportToExcel(item, branchData, tenders, monthTotal) },
            ]}
          />
          {onEdit && (
            <Button variant="secondary" size="lg" icon={Pencil} onClick={onEdit} aria-label="Edit" className="shrink-0 px-3.5 sm:px-4">
              <span className="hidden sm:inline">Edit</span>
            </Button>
          )}
          <Button size="lg" className="min-w-0 flex-1 whitespace-nowrap" icon={ImageIcon} loading={sharing} onClick={doShareImage}>
            Share image
          </Button>
        </>
      }
    >
      {/* the day and the month */}
      <div className="rounded-2xl bg-gradient-to-br from-[#1f9a7c] to-[#0f5c4c] p-4 text-white">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">Day total</p>
        <CountUp value={Number(total) || 0} format={money} className="mt-0.5 block text-3xl font-bold tracking-tight" />
        {monthTotal != null && (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold">
            Month so far · {money(monthTotal)}
          </p>
        )}
      </div>

      {/* payment types */}
      <ul className="mt-4 divide-y divide-line">
        {tenders.map((t, i) => {
          const v = parseFloat(item[t.key]) || 0;
          const note = item.notes?.[t.key];
          return (
            <motion.li
              key={t.key}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.04 * i }}
              className="flex items-start gap-3 py-2.5"
            >
              <span
                className={cn(
                  "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg",
                  t.banked ? "bg-info-soft text-info" : t.key === "cash" ? "bg-brand-soft text-brand" : "bg-surface-2 text-muted"
                )}
              >
                {t.banked ? <Landmark className="size-3.5" /> : <Wallet className="size-3.5" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className={cn("text-sm font-medium", v ? "text-fg" : "text-subtle")}>{t.label}</span>
                  {!t.includeInTotal && <Badge>Not in total</Badge>}
                </span>
                {note && <span className="mt-0.5 block text-xs italic text-muted">“{note}”</span>}
              </span>
              <span className={cn("shrink-0 text-sm tabular-nums", v ? "font-semibold text-fg" : "text-subtle")}>{money(v)}</span>
            </motion.li>
          );
        })}
      </ul>

      {/* Z report */}
      {item.zReportUrl ? (
        <a href={item.zReportUrl} target="_blank" rel="noreferrer" className="mt-4 block">
          <p className="mb-1.5 text-xs font-semibold text-muted">Z report</p>
          <div className="relative overflow-hidden rounded-2xl border border-line bg-surface-2">
            {imgLoading && <Skeleton className="absolute inset-0" rounded="rounded-none" />}
            <img
              src={item.zReportUrl}
              alt="Z report"
              className="max-h-80 w-full object-contain"
              onLoad={() => setImgLoading(false)}
              onError={() => setImgLoading(false)}
            />
          </div>
        </a>
      ) : (
        <p className="mt-4 rounded-xl bg-surface-2 px-3 py-2.5 text-center text-xs text-muted">No Z report photo</p>
      )}

      {/* the image made for sharing, when the device can't share it directly */}
      {shared && (
        <div className="mt-4 rounded-2xl border border-brand/30 bg-brand-soft p-3 text-center">
          <p className="mb-2 flex items-center justify-center gap-1.5 text-xs font-semibold text-brand">
            <Download className="size-3.5" /> Image ready — long-press (or right-click) to save or copy
          </p>
          <img src={shared} alt="Sales summary to share" className="mx-auto max-w-[85%] rounded-xl border border-line shadow-card" />
          <button type="button" onClick={() => setShared(null)} className="mt-2 text-xs font-semibold text-brand hover:underline">
            Done
          </button>
        </div>
      )}

      <p className="mt-4 text-center text-[11px] text-subtle">
        Entered by {by}
        {created ? ` · ${format(created, "d MMM, h:mm a")}` : ""}
      </p>
    </Sheet>
  );
}
