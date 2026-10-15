import { cn } from "./cn";

/**
 * A placeholder with a soft shimmer, shaped like the content that is coming,
 * so the page doesn't jump when it arrives. Prefer this to a spinner for
 * cards, lists and tables.
 */
export function Skeleton({ className, rounded = "rounded-lg" }) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-shimmer bg-[length:200%_100%]", rounded, className)}
      style={{
        backgroundImage: "linear-gradient(90deg, var(--cc-shimmer) 0%, var(--cc-shimmer-hi) 45%, var(--cc-shimmer) 90%)",
      }}
    />
  );
}

/** Ready-made shapes for the common cases. */
export function SkeletonText({ lines = 3, className }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn("h-3", i === lines - 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}

export function SkeletonStat({ className }) {
  return (
    <div className={cn("rounded-2xl border border-line bg-surface p-5", className)}>
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-7 w-32" />
      <Skeleton className="mt-3 h-3 w-16" />
    </div>
  );
}

export function SkeletonRows({ rows = 5, className }) {
  return (
    <div className={cn("divide-y divide-line", className)}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 py-3">
          <Skeleton className="size-9" rounded="rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-3 w-1/5" />
          </div>
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}
