"use client";
import { useId, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "./cn";

/** A short label on hover or keyboard focus — for icon-only buttons. */
export default function Tooltip({ label, side = "top", children, className }) {
  const [show, setShow] = useState(false);
  const id = useId();
  const pos = side === "bottom" ? "top-full mt-2" : "bottom-full mb-2";
  return (
    <span
      className={cn("relative inline-flex", className)}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
      aria-describedby={show ? id : undefined}
    >
      {children}
      <AnimatePresence>
        {show && (
          <motion.span
            id={id}
            role="tooltip"
            initial={{ opacity: 0, y: side === "bottom" ? -3 : 3, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.12, delay: 0.25 } }}
            exit={{ opacity: 0, transition: { duration: 0.08 } }}
            className={cn(
              "pointer-events-none absolute left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-lg bg-fg px-2 py-1 text-xs font-medium text-bg shadow-float",
              pos
            )}
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
