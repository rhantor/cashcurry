"use client";
import { motion } from "framer-motion";
import { cn } from "./cn";
import { rise, spring } from "./motion";

/**
 * A surface. `interactive` lifts on hover and presses on tap (clickable cards);
 * by default it rises in when it appears (works inside a <Stagger> list).
 */
export function Card({ interactive = false, className, children, ...rest }) {
  return (
    <motion.div
      variants={rise}
      whileHover={interactive ? { y: -2, transition: spring.snappy } : undefined}
      whileTap={interactive ? { scale: 0.985 } : undefined}
      className={cn(
        "rounded-2xl border border-line bg-surface shadow-card",
        interactive && "cursor-pointer transition-shadow hover:shadow-float",
        className
      )}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export function CardHeader({ title, subtitle, action, className }) {
  return (
    <div className={cn("flex items-start justify-between gap-3 px-5 pt-5", className)}>
      <div className="min-w-0">
        <h3 className="truncate text-sm font-semibold text-fg">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export const CardBody = ({ className, children }) => <div className={cn("p-5", className)}>{children}</div>;
