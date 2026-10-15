"use client";
import { motion } from "framer-motion";
import { cn } from "./cn";

/** A small ring that spins — inside buttons and inline. */
export function Spinner({ size = 16, className }) {
  return (
    <svg
      className={cn("animate-spin", className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** A check mark that draws itself — "saved", "paid", "done". */
export function SuccessCheck({ size = 16, className }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <motion.path
        d="M5 12.5l4.5 4.5L19 7.5"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      />
    </svg>
  );
}

/**
 * The full-area loader: three dots that bounce in turn, in brand colour.
 * For a whole page or panel; lists and cards use <Skeleton> instead.
 */
export function Loader({ label = "Loading", className }) {
  return (
    <div role="status" aria-label={label} className={cn("flex flex-col items-center gap-3 py-10 text-brand", className)}>
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="block size-2.5 rounded-full bg-current"
            animate={{ y: [0, -7, 0], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.13, ease: "easeInOut" }}
          />
        ))}
      </div>
      <span className="text-xs font-medium text-muted">{label}…</span>
    </div>
  );
}
