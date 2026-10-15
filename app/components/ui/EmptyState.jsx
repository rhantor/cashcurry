"use client";
import { motion } from "framer-motion";
import { Inbox } from "lucide-react";
import { cn } from "./cn";
import { spring } from "./motion";

/** "Nothing here yet" — a gently floating icon, a line of text, and what to do next. */
export default function EmptyState({ icon: Icon = Inbox, title, description, action, className }) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-12 text-center", className)}>
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1, transition: spring.bouncy }}
        className="relative mb-4"
      >
        <span className="absolute inset-0 -z-10 scale-150 rounded-full bg-brand-soft blur-xl" />
        <motion.span
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="flex size-14 items-center justify-center rounded-2xl bg-brand-soft text-brand"
        >
          <Icon className="size-7" />
        </motion.span>
      </motion.div>
      <h3 className="text-sm font-semibold text-fg">{title}</h3>
      {description && <p className="mt-1 max-w-xs text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
