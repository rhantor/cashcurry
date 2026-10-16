"use client";
import { Card, CountUp, Skeleton, cn } from "@/app/components/ui";

const TONES = {
  brand: "bg-brand-soft text-brand",
  info: "bg-info-soft text-info",
  neutral: "bg-surface-2 text-muted",
};

/**
 * One figure on a dashboard: label, the amount counting up, a short note.
 * `size="lg"` for the headline figures, `"sm"` for the secondary ones.
 * While `loading`, a skeleton of the same shape holds the place.
 */
export default function StatCard({ label, value, format, icon: Icon, tone = "neutral", hint, size = "lg", loading = false, className }) {
  const lg = size === "lg";
  if (loading) {
    return (
      <div className={cn("rounded-2xl border border-line bg-surface", lg ? "p-4 sm:p-5" : "p-4", className)}>
        <Skeleton className="h-3 w-20" />
        <Skeleton className={cn("mt-3", lg ? "h-7 w-28" : "h-5 w-20")} />
        {hint && <Skeleton className="mt-2.5 h-3 w-24" />}
      </div>
    );
  }
  return (
    <Card className={cn(lg ? "p-4 sm:p-5" : "p-4", className)}>
      <div className="flex items-start justify-between gap-2">
        <span title={label} className={cn("min-w-0 truncate font-semibold text-muted", lg ? "text-xs sm:text-[13px]" : "text-xs")}>{label}</span>
        {Icon && (
          <span className={cn("flex shrink-0 items-center justify-center rounded-xl", lg ? "size-8 sm:size-9" : "size-7", TONES[tone])}>
            <Icon className={lg ? "size-4" : "size-3.5"} />
          </span>
        )}
      </div>
      <CountUp
        value={value}
        format={format}
        className={cn("mt-2 block whitespace-nowrap font-bold tracking-tight text-fg", lg ? "text-lg sm:text-xl 2xl:text-2xl" : "text-base")}
      />
      {hint && <p className={cn("mt-1 truncate text-muted", lg ? "text-xs" : "text-[11px]")}>{hint}</p>}
    </Card>
  );
}
