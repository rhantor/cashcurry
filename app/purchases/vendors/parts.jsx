"use client";
import React from "react";
import { format, parseISO } from "date-fns";
import { ChevronRight } from "lucide-react";
import { EmptyState, Skeleton, cn } from "@/app/components/ui";

/** "2026-10-15" (or an ISO time) → "15 Oct 2026"; anything else as it is. */
export const niceDate = (v) => {
  if (!v) return "—";
  try {
    return format(typeof v === "string" ? parseISO(v) : new Date(v), "d MMM yyyy");
  } catch {
    return String(v);
  }
};

/** A list of bills or payments inside the vendor sheet: one tappable row each. */
export function RowList({ loading, rows, empty, children }) {
  if (loading)
    return (
      <div className="space-y-2">
        <Skeleton className="h-14" rounded="rounded-xl" />
        <Skeleton className="h-14" rounded="rounded-xl" />
      </div>
    );
  if (!rows.length) return <EmptyState className="py-8" {...empty} />;
  return <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">{children}</ul>;
}

export function Row({ title, sub, amount, amountTone, onClick }) {
  return (
    <li>
      <button type="button" onClick={onClick} className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-surface-2/60 active:bg-surface-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-fg">{title}</p>
          <p className="truncate text-[11px] text-muted">{sub}</p>
        </div>
        <span className={cn("shrink-0 text-sm font-bold tabular-nums", amountTone || "text-fg")}>{amount}</span>
        <ChevronRight className="size-4 shrink-0 text-subtle" />
      </button>
    </li>
  );
}

/** A small total over a list: "3 bills · RM 1,200.00" with an action on the right. */
export function ListHead({ label, value, children }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm text-muted">
        {label} <b className="tabular-nums text-fg">{value}</b>
      </p>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}
