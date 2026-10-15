"use client";
import { motion } from "framer-motion";
import { cn } from "./cn";
import { spring } from "./motion";

/** On/off toggle; the knob springs across. */
export default function Switch({ checked, onChange, label, disabled, className }) {
  return (
    <label className={cn("inline-flex cursor-pointer select-none items-center gap-3", disabled && "cursor-not-allowed opacity-60", className)}>
      <button
        type="button"
        role="switch"
        aria-checked={!!checked}
        disabled={disabled}
        onClick={() => onChange?.(!checked)}
        className={cn(
          "relative flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors",
          checked ? "bg-brand" : "bg-line"
        )}
      >
        <motion.span
          layout
          transition={spring.snappy}
          className={cn("size-5 rounded-full bg-white shadow", checked ? "ml-auto" : "ml-0")}
        />
      </button>
      {label && <span className="text-sm font-medium text-fg">{label}</span>}
    </label>
  );
}
