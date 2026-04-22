// Plain JS helpers shared across components

export const toDate = (x) =>
  x?.seconds ? new Date(x.seconds * 1000) : new Date(x);

export const byDateKey = (date) => toDate(date).toISOString().slice(0, 10);

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
