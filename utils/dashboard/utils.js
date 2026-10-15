// Plain JS helpers shared across components
import { format } from "date-fns";

export const toDate = (x) =>
  x?.seconds ? new Date(x.seconds * 1000) : new Date(x);

// Chart bucketing key. Note: UTC, so only safe for "yyyy-MM-dd" strings; use
// dayKey for anything that decides which records are counted.
export const byDateKey = (date) => toDate(date).toISOString().slice(0, 10);

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The local calendar day ("yyyy-MM-dd") a record belongs to, or null.
 * A business `date` string is taken as written — it already names the day.
 * Timestamps (Firestore, ISO strings, Date) are placed on the local day, the
 * same way the summary report does.
 */
export const dayKey = (v) => {
  if (!v) return null;
  if (typeof v === "string" && DATE_ONLY.test(v)) return v;
  const d = toDate(v);
  return Number.isNaN(+d) ? null : format(d, "yyyy-MM-dd");
};

export const num = (v) => Number(v || 0);

// ─── Currency formatters ──────────────────────────────────────────────────────
// Use mkFmt / mkCompact in chart components so the currency symbol comes from
// branch settings (useCurrency) rather than being hard-coded as "RM".
//
// Usage in a chart:
//   const fmt     = mkFmt(currency);     // "USD 1,234.56"
//   const compact = mkCompact(currency); // "1.2k"  (no prefix — for Y-axis ticks)

export const mkFmt = (currency = "RM") => (v) =>
  `${currency} ${Number(v || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

// Compact form for Y-axis tick labels (no currency prefix needed there)
export const mkCompact = () => (v) => {
  const n = Number(v || 0);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return n.toFixed(0);
};

// ─── Legacy ───────────────────────────────────────────────────────────────────
// Kept for any component not yet migrated. New code should use mkFmt instead.
export const RM = (v) =>
  `RM ${Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

export const PCT = (v) => `${Math.round((v || 0) * 100)}%`;

export const sortByDateKey = (arr, key = "date") =>
  [...arr].sort((a, b) => a[key].localeCompare(b[key]));
