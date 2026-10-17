"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { Logo, cn } from "@/app/components/ui";

const TONE = {
  danger: "bg-danger-soft text-danger",
  warning: "bg-warning-soft text-warning",
  info: "bg-info-soft text-info",
  brand: "bg-brand-soft text-brand",
};

/**
 * A whole-screen message — something went wrong, a page that doesn't exist,
 * a page that isn't for this role. One look for all of them.
 *   icon, tone, code (big faint text, e.g. "404"), title, message,
 *   detail (small mono text, e.g. the error), actions: [{ label, href?, onClick?, primary?, icon? }],
 *   full (true = fills the window and shows the logo; false = sits inside the app)
 */
export default function StatusScreen({ icon: Icon, tone = "danger", code, title, message, detail, actions = [], full = true }) {
  return (
    <section className={cn("relative flex items-center justify-center overflow-hidden bg-bg px-6 text-center", full ? "min-h-screen" : "min-h-[70vh] py-12")}>
      {full && (
        <Link href="/" className="absolute left-6 top-6" aria-label="Cash Curry home">
          <Logo size={34} />
        </Link>
      )}
      {code && (
        <span aria-hidden className="pointer-events-none absolute select-none text-[34vw] font-black leading-none tracking-tighter text-fg/[0.035] sm:text-[22rem]">
          {code}
        </span>
      )}
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 200, damping: 22 }} className="relative w-full max-w-md">
        {Icon && (
          <motion.span
            initial={{ scale: 0.6, rotate: -8 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.05 }}
            className={cn("mx-auto flex size-16 items-center justify-center rounded-3xl shadow-card", TONE[tone])}
          >
            <Icon className="size-7" />
          </motion.span>
        )}
        <h1 className="mt-5 text-2xl font-bold tracking-tight text-fg">{title}</h1>
        {message && <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">{message}</p>}
        {detail && <p className="mx-auto mt-3 max-w-sm break-all rounded-xl bg-surface-2 px-3 py-2 font-mono text-[11px] text-subtle">{detail}</p>}
        {actions.length > 0 && (
          <div className="mt-7 flex flex-wrap justify-center gap-2">
            {actions.map((a) => {
              const cls = cn(
                "inline-flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-semibold transition active:scale-[0.98]",
                a.primary ? "bg-brand text-brand-fg shadow-card hover:brightness-105" : "border border-line bg-surface text-fg hover:bg-surface-2"
              );
              const inner = (
                <>
                  {a.icon && <a.icon className="size-4" />}
                  {a.label}
                </>
              );
              return a.href ? (
                <Link key={a.label} href={a.href} className={cls}>
                  {inner}
                </Link>
              ) : (
                <button key={a.label} type="button" onClick={a.onClick} className={cls}>
                  {inner}
                </button>
              );
            })}
          </div>
        )}
      </motion.div>
    </section>
  );
}
