"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Avatar, Tooltip, cn, menuIcon } from "@/app/components/ui";
import { spring } from "@/app/components/ui/motion";

const roleName = (r) => ({ owner: "Owner", gm: "General manager", superAdmin: "Super admin", branchAdmin: "Branch admin" })[r] || (r ? r[0].toUpperCase() + r.slice(1) : "");

/** The computer's sidebar: sections, a sliding highlight, groups that open, and a collapsed (icons only) mode. */
export default function SideNav({ sections, activePath, badges = {}, user, companyName, collapsed, onToggleCollapsed, onSignOut }) {
  return (
    <motion.aside
      animate={{ width: collapsed ? 76 : 256 }}
      transition={spring.soft}
      className="fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-line bg-surface lg:flex"
    >
      {/* brand */}
      <div className={cn("flex h-16 shrink-0 items-center gap-2.5 border-b border-line", collapsed ? "justify-center px-0" : "px-4")}>
        <Link href="/" className="flex min-w-0 items-center gap-2.5" aria-label="Home">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand text-base font-black text-brand-fg shadow-sm">C</span>
          {!collapsed && (
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold leading-tight text-fg">Cash Curry</span>
              <span className="block truncate text-[11px] font-medium text-muted">{companyName || " "}</span>
            </span>
          )}
        </Link>
      </div>

      {/* menu */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-3">
        {sections.map(({ section, items }) => (
          <div key={section} className="mb-3">
            {!collapsed ? (
              <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-subtle">{section}</p>
            ) : (
              <div className="mx-auto my-2 h-px w-6 bg-line" />
            )}
            <ul className="space-y-0.5">
              {items.map((it) =>
                it.children ? (
                  <Group key={it.label} item={it} activePath={activePath} collapsed={collapsed} onExpand={onToggleCollapsed} />
                ) : (
                  <li key={it.path}>
                    <NavLink href={it.path} icon={it.icon} label={it.label} active={it.path === activePath} collapsed={collapsed} badge={badges[it.path]} />
                  </li>
                )
              )}
            </ul>
          </div>
        ))}
      </nav>

      {/* me */}
      <div className={cn("shrink-0 border-t border-line p-3", collapsed && "flex flex-col items-center gap-2")}>
        <div className={cn("flex items-center gap-3", !collapsed && "rounded-xl px-2 py-1.5")}>
          <Avatar name={user?.userName || user?.username || user?.email} size="md" />
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-fg">{user?.userName || user?.username || "Me"}</p>
              <p className="truncate text-xs text-muted">{roleName(user?.role)}</p>
            </div>
          )}
          {!collapsed && (
            <Tooltip label="Sign out">
              <button type="button" onClick={onSignOut} aria-label="Sign out" className="rounded-lg p-2 text-muted transition hover:bg-danger-soft hover:text-danger">
                <LogOut className="size-4" />
              </button>
            </Tooltip>
          )}
        </div>
        <button
          type="button"
          onClick={onToggleCollapsed}
          className={cn(
            "mt-1 flex items-center gap-2 rounded-lg text-xs font-semibold text-muted transition hover:bg-surface-2 hover:text-fg",
            collapsed ? "p-2" : "w-full px-3 py-2"
          )}
          aria-label={collapsed ? "Expand menu" : "Collapse menu"}
        >
          {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          {!collapsed && "Collapse"}
        </button>
        {collapsed && (
          <Tooltip label="Sign out" side="top">
            <button type="button" onClick={onSignOut} aria-label="Sign out" className="rounded-lg p-2 text-muted transition hover:bg-danger-soft hover:text-danger">
              <LogOut className="size-4" />
            </button>
          </Tooltip>
        )}
      </div>
    </motion.aside>
  );
}

/**
 * A count that pops in, and whose number pops when it changes. The badge stays
 * in place while the number changes, so the label next to it never jumps.
 */
export function CountBadge({ count, className }) {
  return (
    <AnimatePresence initial={false}>
      {count > 0 && (
        <motion.span
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1, transition: spring.bouncy }}
          exit={{ scale: 0.4, opacity: 0, transition: { duration: 0.12 } }}
          className={cn(
            "inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-danger px-1.5 text-[11px] font-bold leading-none text-white tabular-nums",
            className
          )}
        >
          <motion.span key={count} initial={{ scale: 1.6 }} animate={{ scale: 1, transition: spring.bouncy }}>
            {count > 99 ? "99+" : count}
          </motion.span>
        </motion.span>
      )}
    </AnimatePresence>
  );
}

function NavLink({ href, icon, label, active, collapsed, sub = false, badge = 0 }) {
  const Icon = icon ? menuIcon(icon) : null;
  const link = (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl text-sm font-medium transition-colors",
        collapsed ? "size-11 justify-center" : sub ? "py-1.5 pl-3 pr-2 text-[13px]" : "px-3 py-2",
        active ? "text-brand" : "text-muted hover:bg-surface-2 hover:text-fg"
      )}
    >
      {active && (
        <motion.span
          layoutId={sub ? "nav-active-sub" : "nav-active"}
          transition={spring.snappy}
          className={cn("absolute inset-0 rounded-xl", sub ? "bg-brand-soft/70" : "bg-brand-soft")}
        />
      )}
      {Icon && <Icon className="relative size-[18px] shrink-0 transition-transform group-hover:scale-110" strokeWidth={1.9} />}
      {!collapsed && <span className="relative flex-1 truncate">{label}</span>}
      {!collapsed && <CountBadge count={badge} className="relative" />}
      {collapsed && badge > 0 && (
        // icons only: a dot that breathes on the icon's corner
        <span className="absolute right-2 top-2 flex size-2.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-danger opacity-60" />
          <span className="relative inline-flex size-2.5 rounded-full bg-danger ring-2 ring-surface" />
        </span>
      )}
    </Link>
  );
  return collapsed ? (
    <Tooltip label={badge > 0 ? `${label} · ${badge} waiting` : label} side="bottom" className="w-full justify-center">
      {link}
    </Tooltip>
  ) : (
    link
  );
}

function Group({ item, activePath, collapsed, onExpand }) {
  const childActive = item.children.some((c) => c.path === activePath);
  const [open, setOpen] = useState(childActive);
  useEffect(() => {
    if (childActive) setOpen(true);
  }, [childActive]);
  const Icon = menuIcon(item.icon);

  if (collapsed) {
    // Icons only: the group's icon opens the full menu with this group expanded.
    return (
      <li>
        <Tooltip label={item.label} side="bottom" className="w-full justify-center">
          <button
            type="button"
            onClick={() => {
              setOpen(true);
              onExpand();
            }}
            className={cn(
              "relative flex size-11 items-center justify-center rounded-xl transition-colors",
              childActive ? "bg-brand-soft text-brand" : "text-muted hover:bg-surface-2 hover:text-fg"
            )}
            aria-label={item.label}
          >
            <Icon className="size-[18px]" strokeWidth={1.9} />
          </button>
        </Tooltip>
      </li>
    );
  }

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className={cn(
          "group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
          childActive ? "text-fg" : "text-muted hover:bg-surface-2 hover:text-fg"
        )}
      >
        <Icon className={cn("size-[18px] shrink-0 transition-transform group-hover:scale-110", childActive && "text-brand")} strokeWidth={1.9} />
        <span className="flex-1 truncate text-left">{item.label}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={spring.snappy}>
          <ChevronDown className="size-4 text-subtle" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.ul
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1, transition: spring.soft }}
            exit={{ height: 0, opacity: 0, transition: { duration: 0.15 } }}
            className="ml-[21px] overflow-hidden border-l border-line pl-2"
          >
            {item.children.map((c) => (
              <li key={c.path} className="py-px">
                <NavLink href={c.path} label={c.label} active={c.path === activePath} collapsed={false} sub />
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </li>
  );
}
