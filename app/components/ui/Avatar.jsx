import { cn } from "./cn";

// Soft background + strong text, picked from the name so a person keeps their colour.
const SWATCHES = [
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
  "bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300",
  "bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300",
];
const hash = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const initials = (name) =>
  String(name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "?";

const SIZES = { sm: "size-7 text-[10px]", md: "size-9 text-xs", lg: "size-12 text-sm" };

/** A person's photo, or their initials on a colour that's always theirs. `status` adds an online dot. */
export default function Avatar({ name, src, size = "md", status, className }) {
  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      {src ? (
        // Staff photos come from Storage URLs (a plain <img>, not next/image).
        <img src={src} alt={name || ""} className={cn("rounded-full object-cover", SIZES[size])} />
      ) : (
        <span className={cn("inline-flex items-center justify-center rounded-full font-bold", SIZES[size], SWATCHES[hash(name) % SWATCHES.length])}>
          {initials(name)}
        </span>
      )}
      {status && (
        <span
          className={cn(
            "absolute bottom-0 right-0 size-2.5 rounded-full ring-2 ring-surface",
            status === "online" ? "bg-success" : status === "busy" ? "bg-warning" : "bg-subtle"
          )}
        />
      )}
    </span>
  );
}
