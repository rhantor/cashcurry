"use client";
import { forwardRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "./cn";
import { spring } from "./motion";
import { Spinner, SuccessCheck } from "./Spinner";

const VARIANTS = {
  primary: "bg-brand text-brand-fg hover:bg-brand-hover shadow-sm",
  secondary: "bg-surface text-fg border border-line hover:bg-surface-2",
  ghost: "text-fg hover:bg-surface-2",
  soft: "bg-brand-soft text-brand hover:brightness-95",
  danger: "bg-danger text-white hover:brightness-95 shadow-sm",
};
const SIZES = {
  sm: "h-8 px-3 text-xs gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-5 text-base gap-2 rounded-xl",
  icon: "size-10 rounded-xl",
};

/**
 * Button. Presses in under the finger. `loading` swaps the label for a
 * spinner (keeping the width); `success` shows a check that draws itself.
 */
const Button = forwardRef(function Button(
  { variant = "primary", size = "md", loading = false, success = false, icon: Icon, className, children, disabled, ...rest },
  ref
) {
  const state = success ? "success" : loading ? "loading" : "idle";
  return (
    <motion.button
      ref={ref}
      whileTap={disabled || loading ? undefined : { scale: 0.97 }}
      transition={spring.snappy}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "relative inline-flex select-none items-center justify-center font-semibold transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-60",
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...rest}
    >
      {/* The label stays in the layout (invisible while busy) so the width never jumps. */}
      <span className={cn("inline-flex items-center gap-[inherit]", state !== "idle" && "invisible")}>
        {Icon && <Icon className="size-4 shrink-0" aria-hidden="true" />}
        {children}
      </span>
      <AnimatePresence>
        {state !== "idle" && (
          <motion.span
            key={state}
            className="absolute inset-0 flex items-center justify-center"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={spring.snappy}
          >
            {state === "loading" ? <Spinner /> : <SuccessCheck size={18} />}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
});

export default Button;
