"use client";
import React from "react";
import { Card, Skeleton, cn } from "@/app/components/ui";

/**
 * The few figures at the top of a purchases screen. On a phone the first one
 * runs the full width and the rest sit two to a row, so they don't push the
 * list off the screen.
 * tiles: [{ label, value, note, icon, tone: "bg-…-soft text-…" }]
 */
export default function StatTiles({ tiles, loading }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {tiles.map((t, i) => (
        <Card key={t.label} className={cn("p-3 sm:p-4", i === 0 && "col-span-2 sm:col-span-1")}>
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-semibold text-muted">{t.label}</p>
            {t.icon && (
              <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg", t.tone)}>
                <t.icon className="size-3.5" />
              </span>
            )}
          </div>
          {loading ? (
            <Skeleton className="mt-2 h-6 w-24" />
          ) : (
            <p className={cn("mt-1 truncate font-bold tabular-nums text-fg", i === 0 ? "text-xl" : "text-base sm:text-xl")}>{t.value}</p>
          )}
          {t.note && <p className="line-clamp-2 text-[11px] text-subtle">{t.note}</p>}
        </Card>
      ))}
    </div>
  );
}
