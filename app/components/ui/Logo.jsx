import { cn } from "./cn";

// The mark: a square split corner to corner, dark and mint — the two sides of
// the books — that together make one whole, with the C of Cash Curry in it.
// `inverse` is for dark or brand-green backgrounds (white square, dark C).
export function LogoMark({ size = 36, inverse = false, className, title = "Cash Curry" }) {
  const base = inverse ? "#ffffff" : "#0b4d40";
  const c = inverse ? "#0b4d40" : "#ffffff";
  // on a dark background the mint half goes brighter so the square stands out
  const mint = inverse ? "#3cc9a2" : "#22a082";
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" className={cn("shrink-0", className)} role="img" aria-label={title}>
      <rect width="80" height="80" rx="20" fill={base} />
      <path d="M74.142 5.858A20 20 0 0 1 80 20V60A20 20 0 0 1 60 80H20A20 20 0 0 1 5.858 74.142Z" fill={mint} />
      <path d="M54 26A20 20 0 1 0 54 54" fill="none" stroke={c} strokeWidth="9" strokeLinecap="round" />
    </svg>
  );
}

/**
 * The full logo: the mark and "cash·curry", the dot a coin. `size` is the
 * mark's height; the name scales with it. `inverse` for dark backgrounds;
 * `compact` drops the name (just the mark).
 */
export default function Logo({ size = 36, inverse = false, compact = false, className }) {
  if (compact) return <LogoMark size={size} inverse={inverse} className={className} />;
  const text = inverse ? "text-white" : "text-[#0b1f1a] dark:text-white";
  const coin = inverse ? "#a9e9d1" : "#22a082";
  const hole = inverse ? "#0b4d40" : "#ffffff";
  const dot = Math.max(6, Math.round(size * 0.24));
  return (
    <span className={cn("inline-flex items-center", className)} style={{ gap: size * 0.3 }}>
      <LogoMark size={size} inverse={inverse} />
      <span
        className={cn("inline-flex font-[family-name:var(--font-display)] items-center font-extrabold leading-none tracking-[-0.03em]", text)}
        style={{ fontSize: size * 0.56 }}
        aria-hidden
      >
        cash
        <svg width={dot} height={dot} viewBox="0 0 20 20" className="mx-[0.12em] translate-y-[0.06em]" aria-hidden>
          <circle cx="10" cy="10" r="9" fill={coin} />
          <circle cx="10" cy="10" r="3.6" fill={hole} />
        </svg>
        curry
      </span>
    </span>
  );
}
