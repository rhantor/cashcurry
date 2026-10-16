"use client";
import Link from "next/link";
import { format, isValid, parseISO } from "date-fns";
import { motion } from "framer-motion";
import { ArrowRight, Image as ImageIcon, Inbox, Landmark, Pencil, Wallet } from "lucide-react";
import { Card, EmptyState, SkeletonRows, Stagger, cn } from "@/app/components/ui";

/**
 * The frame every entry form shares: the form on the left; on computers the
 * summary and save button stay in view on the right, on phones they ride in
 * a bar just above the bottom menu.
 *   aside — the summary card's content (computers)
 *   bar   — the compact total + button (phones)
 */
export function EntryLayout({ children, aside, bar, below }) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6 sm:py-6">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="min-w-0 space-y-5">{children}</div>
        <aside className="hidden lg:sticky lg:top-24 lg:block">
          <Card className="p-5">{aside}</Card>
        </aside>
      </div>
      {bar && (
        <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 mt-4 lg:hidden">
          <div className="rounded-2xl border border-line bg-surface/95 p-3 shadow-float backdrop-blur-xl">{bar}</div>
        </div>
      )}
      {below && <div className="mt-6">{below}</div>}
    </div>
  );
}

/** A form section: a small heading and its fields in a card. */
export function EntrySection({ title, action, children, className }) {
  return (
    <Card className={cn("p-4 sm:p-5", className)}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-sm font-semibold text-fg">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </Card>
  );
}

/** A label/value line in a summary. */
export function SummaryLine({ label, value, strong, muted }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className={muted ? "text-subtle" : "text-muted"}>{label}</span>
      <span className={cn("tabular-nums", strong ? "font-bold text-fg" : "font-semibold text-fg")}>{value}</span>
    </div>
  );
}

const nice = (d) => {
  const x = d ? parseISO(String(d).slice(0, 10)) : null;
  return x && isValid(x) ? format(x, "EEE, d MMM yyyy") : "—";
};

/**
 * The latest entries under a form, newest first.
 * items: [{ id, date, note, amount, proof?, onOpen?, onEdit? }]
 */
export function RecentEntries({ title = "Recent entries", viewAllHref, loading, error, items = [], money }) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-fg">{title}</h3>
        {viewAllHref && (
          <Link href={viewAllHref} className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline">
            See all <ArrowRight className="size-3.5" />
          </Link>
        )}
      </div>
      {loading ? (
        <SkeletonRows rows={4} />
      ) : error ? (
        <p className="py-6 text-center text-sm text-danger">Couldn&apos;t load the latest entries.</p>
      ) : !items.length ? (
        <EmptyState icon={Inbox} title="Nothing entered yet" description="Entries you save will show up here." className="py-8" />
      ) : (
        <Stagger as="ul" gap={0.03} className="divide-y divide-line">
          {items.map((it) => (
            <Stagger.Item as="li" key={it.id} className="flex items-center gap-2 py-1">
              <button
                type="button"
                onClick={it.onOpen}
                disabled={!it.onOpen}
                className="-mx-2 flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-surface-2 disabled:hover:bg-transparent"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-fg">{nice(it.date)}</span>
                  <span className="flex items-center gap-1.5 text-xs text-muted">
                    {it.proof && <ImageIcon className="size-3.5 shrink-0 text-info" aria-label="Has a photo" />}
                    <span className="truncate">{it.note}</span>
                  </span>
                </span>
                <span className="shrink-0 text-sm font-bold tabular-nums text-fg">{money(it.amount)}</span>
              </button>
              {it.onEdit && (
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  type="button"
                  onClick={it.onEdit}
                  aria-label={`Edit ${nice(it.date)}`}
                  className="flex size-9 shrink-0 items-center justify-center rounded-xl text-muted transition hover:bg-surface-2 hover:text-fg"
                >
                  <Pencil className="size-4" />
                </motion.button>
              )}
            </Stagger.Item>
          ))}
        </Stagger>
      )}
    </Card>
  );
}

const PLACES = {
  till: { icon: Wallet, tone: "bg-brand-soft text-brand" },
  bank: { icon: Landmark, tone: "bg-info-soft text-info" },
};

/** Which way the money moves, at the top of a transfer screen: from → to, and a line saying so. */
export function MoneyRoute({ from, to, children }) {
  const A = PLACES[from];
  const B = PLACES[to];
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-sm">
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", A.tone)}>
        <A.icon className="size-4" />
      </span>
      <motion.span animate={{ x: [0, 3, 0] }} transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}>
        <ArrowRight className="size-4 shrink-0 text-subtle" />
      </motion.span>
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", B.tone)}>
        <B.icon className="size-4" />
      </span>
      <p className="min-w-0 text-xs text-muted">{children}</p>
    </div>
  );
}
