"use client";
import { forwardRef, useId } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "./cn";

const control =
  "w-full rounded-xl border bg-surface px-3.5 text-sm text-fg placeholder:text-subtle outline-none transition " +
  "focus:border-brand focus:ring-4 focus:ring-[var(--cc-ring)] disabled:opacity-60";

/**
 * Label + control + hint/error. The error slides in and the field gives a
 * small shake, so a mistake is noticed without a popup.
 */
export function Field({ label, hint, error, children, className, id: idProp }) {
  const auto = useId();
  const id = idProp || auto;
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label htmlFor={id} className="block text-xs font-semibold text-muted">
          {label}
        </label>
      )}
      <motion.div
        key={error ? `err-${error}` : "ok"}
        animate={error ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
        transition={{ duration: 0.35 }}
      >
        {typeof children === "function" ? children({ id, invalid: !!error }) : children}
      </motion.div>
      <AnimatePresence initial={false} mode="wait">
        {error ? (
          <motion.p
            key="error"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="text-xs font-medium text-danger"
          >
            {error}
          </motion.p>
        ) : hint ? (
          <motion.p key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-subtle">
            {hint}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export const Input = forwardRef(function Input({ invalid, className, ...rest }, ref) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(control, "h-10", invalid ? "border-danger" : "border-line", className)}
      {...rest}
    />
  );
});

export const Textarea = forwardRef(function Textarea({ invalid, className, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(control, "min-h-24 py-2.5", invalid ? "border-danger" : "border-line", className)}
      {...rest}
    />
  );
});

export const Select = forwardRef(function Select({ invalid, className, children, ...rest }, ref) {
  return (
    <select
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(control, "h-10 appearance-none bg-[length:16px] bg-[right_0.75rem_center] bg-no-repeat pr-9", invalid ? "border-danger" : "border-line", className)}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a9893' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
      }}
      {...rest}
    >
      {children}
    </select>
  );
});
