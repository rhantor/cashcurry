"use client";
import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDownToLine, ArrowUpFromLine, Building2, CalendarDays, ChartColumn, CheckCircle2, ChevronDown, ChevronRight, FileText,
  HandCoins, Inbox, LayoutDashboard, ListChecks, Receipt, ShoppingBag, Users, Wallet,
} from "lucide-react";
import { Card, Stagger, cn, useIsPhone } from "@/app/components/ui";
import { menuIcon } from "@/app/components/ui/icons";

const TONE = {
  in: "bg-brand-soft text-brand",
  out: "bg-warning-soft text-warning",
  bank: "bg-info-soft text-info",
  plain: "bg-surface-2 text-fg",
};

// The things people do most, in order; each shows only to roles that can open it.
const ACTIONS = [
  ["/entry-data/sales-entry", "Add sales", ShoppingBag, "in"],
  ["/entry-data/cost-entry", "Add cost", Receipt, "out"],
  ["/entry-data/deposit-entry", "Cash to bank", ArrowUpFromLine, "bank"],
  ["/entry-data/cash-withdraw", "Bank to cash", ArrowDownToLine, "bank"],
  ["/entry-data/advance-entry", "Advance", HandCoins, "out"],
  ["/entry-data/salary-entry", "Salary", Users, "out"],
  ["/requested-panel", "Requests", Inbox, "plain"],
  ["/supervisor-panel", "My requests", ListChecks, "plain"],
  ["/dashboard", "Dashboard", LayoutDashboard, "plain"],
  ["/company/dashboard", "Company", Building2, "plain"],
  ["/cash-tracker", "Cash tracker", Wallet, "in"],
  ["/purchases/new-bill", "New bill", FileText, "out"],
  ["/reports", "Summary", ChartColumn, "bank"],
  ["/attendance-log", "Attendance", CalendarDays, "plain"],
];

/** A heading over a home section. */
export function HomeSection({ title, children, className }) {
  return (
    <section className={className}>
      <h2 className="mb-3 px-1 text-[11px] font-bold uppercase tracking-[0.14em] text-subtle">{title}</h2>
      {children}
    </section>
  );
}

/** Up to eight one-tap shortcuts as icon tiles. `badges` = { path: count }. */
export function QuickActions({ pages, badges = {} }) {
  const open = new Set(pages.map((p) => p.path));
  const list = ACTIONS.filter(([path]) => open.has(path)).slice(0, 8);
  if (!list.length) return null;
  return (
    <Stagger className="grid grid-cols-4 gap-2 sm:gap-3 lg:grid-cols-8">
      {list.map(([path, label, Icon, tone]) => (
        <Stagger.Item key={path}>
          <Link
            href={path}
            className="group flex flex-col items-center gap-2 rounded-2xl p-2 text-center transition active:scale-95 sm:border sm:border-line sm:bg-surface sm:p-3 sm:shadow-card sm:hover:-translate-y-0.5"
          >
            <span className={cn("relative flex size-12 items-center justify-center rounded-2xl transition group-hover:scale-105 sm:size-11", TONE[tone])}>
              <Icon className="size-5" />
              {badges[path] > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white ring-2 ring-bg">
                  {badges[path] > 99 ? "99+" : badges[path]}
                </span>
              )}
            </span>
            <span className="text-[11px] font-semibold leading-tight text-fg sm:text-xs">{label}</span>
          </Link>
        </Stagger.Item>
      ))}
    </Stagger>
  );
}

/** What needs doing now; a calm "all caught up" when nothing does. items: [{ icon, tone, title, note, href }]. */
export function Attention({ items }) {
  if (!items.length) {
    return (
      <Card className="flex items-center gap-3 p-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-success-soft text-success">
          <CheckCircle2 className="size-5" />
        </span>
        <div>
          <p className="text-sm font-semibold text-fg">You&apos;re all caught up</p>
          <p className="text-xs text-muted">Nothing is waiting for you right now.</p>
        </div>
      </Card>
    );
  }
  return (
    <Stagger className="grid gap-3 sm:grid-cols-2">
      {items.map((a) => (
        <Stagger.Item key={a.title}>
          <Link href={a.href} className="block">
            <Card interactive className="flex items-center gap-3 p-4">
              <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", TONE[a.tone])}>
                <a.icon className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-fg">{a.title}</p>
                <p className="truncate text-xs text-muted">{a.note}</p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-subtle" />
            </Card>
          </Link>
        </Stagger.Item>
      ))}
    </Stagger>
  );
}

/**
 * Every page the role can open, grouped like the sidebar. On phones each group
 * starts folded (tap to open), so the page stays short. `sections` from navFor(role).
 */
export function AllPages({ sections }) {
  const phone = useIsPhone();
  return (
    <div className="grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {sections.map((s) => (
        <PageGroup key={s.section} {...s} folded={phone} />
      ))}
    </div>
  );
}

function PageGroup({ section, items, folded }) {
  const [open, setOpen] = useState(false);
  const links = items.flatMap((it) =>
    it.children?.length ? it.children.map((c) => ({ ...c, icon: it.icon, group: it.label })) : [it]
  );
  const shown = !folded || open;
  return (
    <Card className="p-2">
      {folded ? (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left"
        >
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-subtle">{section}</span>
          <span className="rounded-full bg-surface-2 px-2 py-px text-[11px] font-semibold text-muted">{links.length}</span>
          <ChevronDown className={cn("ml-auto size-4 text-subtle transition-transform", open && "rotate-180")} />
        </button>
      ) : (
        <p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-[0.14em] text-subtle">{section}</p>
      )}
      <AnimatePresence initial={false}>
        {shown && (
          <motion.ul
            initial={folded ? { height: 0, opacity: 0 } : false}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            {links.map((l) => {
              const Icon = menuIcon(l.icon);
              return (
                <li key={l.path}>
                  <Link href={l.path} className="flex items-center gap-3 rounded-xl px-3 py-2 transition-colors hover:bg-surface-2 active:bg-surface-2">
                    <Icon className="size-4 shrink-0 text-muted" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-fg">{l.label}</span>
                    {l.group && l.group !== section && <span className="hidden shrink-0 text-[11px] text-subtle sm:inline">{l.group}</span>}
                    <ChevronRight className="size-3.5 shrink-0 text-subtle" />
                  </Link>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </Card>
  );
}
