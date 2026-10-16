"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronRight, LayoutGrid, LogOut, Search, X } from "lucide-react";
import { Avatar, Sheet, cn, menuIcon } from "@/app/components/ui";
import { spring } from "@/app/components/ui/motion";
import BranchSwitcher from "./BranchSwitcher";
import { CountBadge } from "./SideNav";

const roleName = (r) => ({ owner: "Owner", gm: "General manager", superAdmin: "Super admin", branchAdmin: "Branch admin" })[r] || (r ? r[0].toUpperCase() + r.slice(1) : "");

/**
 * The phone's bottom bar: Home, the role's three most-used pages, and More —
 * a sheet with everything else: search, branch, then the menu as tidy
 * section cards whose groups (Purchases, Reports…) open on tap.
 */
export default function MobileNav({ items, sections, activePath, badges = {}, user, isCompany, branches, activeBranchId, onSwitchBranch, onSignOut }) {
  const [more, setMore] = useState(false);
  const inBar = new Set(items.map((i) => i.path));
  const inMore = !inBar.has(activePath);
  const moreBadge = Object.entries(badges).reduce((n, [path, c]) => n + (inBar.has(path) ? 0 : c || 0), 0);
  const close = () => setMore(false);

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
        <ul className="mx-auto flex max-w-lg items-stretch justify-around px-2">
          {items.map((it) => (
            <li key={it.path} className="flex-1">
              <Tab href={it.path} icon={it.icon} label={it.label} active={it.path === activePath} badge={badges[it.path]} />
            </li>
          ))}
          <li className="flex-1">
            <Tab onClick={() => setMore(true)} label="More" active={inMore && !!activePath} Icon={LayoutGrid} badge={moreBadge} />
          </li>
        </ul>
      </nav>

      <Sheet open={more} onClose={close}>
        <MoreMenu
          sections={sections}
          hidden={inBar}
          activePath={activePath}
          badges={badges}
          user={user}
          isCompany={isCompany}
          branches={branches}
          activeBranchId={activeBranchId}
          onSwitchBranch={(b) => {
            close();
            onSwitchBranch(b);
          }}
          onNavigate={close}
          onSignOut={onSignOut}
        />
      </Sheet>
    </>
  );
}

function MoreMenu({ sections, hidden, activePath, badges, user, isCompany, branches, activeBranchId, onSwitchBranch, onNavigate, onSignOut }) {
  const [q, setQ] = useState("");

  // Every page as a flat list, for the search box.
  const pages = useMemo(
    () =>
      sections.flatMap(({ section, items }) =>
        items.flatMap((it) => (it.children ? it.children.map((c) => ({ ...c, icon: it.icon, hint: it.label })) : [{ ...it, hint: section }]))
      ),
    [sections]
  );
  const found = q ? pages.filter((p) => `${p.label} ${p.hint}`.toLowerCase().includes(q.toLowerCase())) : [];

  // The menu without what the bottom bar already has.
  const shown = sections
    .map((s) => ({ ...s, items: s.items.filter((it) => it.children || !hidden.has(it.path)) }))
    .filter((s) => s.items.length);

  return (
    <div className="space-y-4">
      {/* me + branch */}
      <div className="flex items-center gap-3">
        <Avatar name={user?.userName || user?.username || user?.email} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold text-fg">{user?.userName || user?.username || "Me"}</p>
          <p className="text-xs text-muted">{roleName(user?.role)}</p>
        </div>
      </div>
      {isCompany && branches.length > 0 && (
        <BranchSwitcher user={user} branches={branches} activeId={activeBranchId} onSwitch={onSwitchBranch} />
      )}

      {/* search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Find a page"
          className="h-11 w-full rounded-xl border border-line bg-surface-2 pl-10 pr-10 text-sm text-fg outline-none transition placeholder:text-subtle focus:border-brand focus:bg-surface focus:ring-4 focus:ring-[var(--cc-ring)]"
        />
        {q && (
          <button type="button" onClick={() => setQ("")} aria-label="Clear" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-subtle">
            <X className="size-4" />
          </button>
        )}
      </div>

      {q ? (
        <Card>
          {found.length ? (
            found.map((p) => (
              <Row key={p.path} href={p.path} icon={p.icon} label={p.label} hint={p.hint} active={p.path === activePath} badge={badges[p.path]} onNavigate={onNavigate} />
            ))
          ) : (
            <p className="px-4 py-6 text-center text-sm text-muted">Nothing matches “{q}”</p>
          )}
        </Card>
      ) : (
        shown.map(({ section, items }) => (
          <div key={section}>
            <p className="mb-1.5 px-1 text-[11px] font-bold uppercase tracking-wider text-subtle">{section}</p>
            <Card>
              {items.map((it) =>
                it.children ? (
                  <GroupRow key={it.label} item={it} activePath={activePath} badges={badges} onNavigate={onNavigate} />
                ) : (
                  <Row key={it.path} href={it.path} icon={it.icon} label={it.label} active={it.path === activePath} badge={badges[it.path]} onNavigate={onNavigate} />
                )
              )}
            </Card>
          </div>
        ))
      )}

      <button
        type="button"
        onClick={onSignOut}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface py-3 text-sm font-semibold text-danger transition active:scale-[0.98]"
      >
        <LogOut className="size-4" /> Sign out
      </button>
    </div>
  );
}

const Card = ({ children }) => <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">{children}</div>;

function Row({ href, icon, label, hint, active, badge, onNavigate, sub = false }) {
  const Icon = icon && !sub ? menuIcon(icon) : null;
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 px-4 transition-colors active:bg-surface-2",
        sub ? "py-2.5 pl-12 text-[13px]" : "py-3 text-sm",
        active ? "bg-brand-soft/60 font-semibold text-brand" : "font-medium text-fg"
      )}
    >
      {Icon && (
        <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", active ? "bg-surface text-brand" : "bg-surface-2 text-muted")}>
          <Icon className="size-4" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate">{label}</span>
        {hint && <span className="block truncate text-xs font-normal text-muted">{hint}</span>}
      </span>
      <CountBadge count={badge} />
      {!sub && <ChevronRight className="size-4 shrink-0 text-subtle" />}
    </Link>
  );
}

function GroupRow({ item, activePath, badges, onNavigate }) {
  const childActive = item.children.some((c) => c.path === activePath);
  const [open, setOpen] = useState(childActive);
  const Icon = menuIcon(item.icon);
  const count = item.children.reduce((n, c) => n + (badges[c.path] || 0), 0);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className={cn("flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium transition-colors active:bg-surface-2", childActive ? "text-brand" : "text-fg")}
      >
        <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", childActive ? "bg-brand-soft text-brand" : "bg-surface-2 text-muted")}>
          <Icon className="size-4" />
        </span>
        <span className="flex-1 truncate">{item.label}</span>
        {!open && <CountBadge count={count} />}
        <span className="text-xs text-subtle">{item.children.length}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={spring.snappy}>
          <ChevronDown className="size-4 text-subtle" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1, transition: spring.soft }}
            exit={{ height: 0, opacity: 0, transition: { duration: 0.15 } }}
            className="overflow-hidden border-t border-line bg-surface-2/40"
          >
            {item.children.map((c) => (
              <Row key={c.path} href={c.path} label={c.label} active={c.path === activePath} badge={badges[c.path]} onNavigate={onNavigate} sub />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Tab({ href, onClick, icon, Icon: IconProp, label, active, badge = 0 }) {
  const Icon = IconProp || menuIcon(icon);
  const inner = (
    <motion.span whileTap={{ scale: 0.92 }} className="relative flex flex-col items-center gap-0.5 py-2">
      {active && <motion.span layoutId="bottom-nav-active" transition={spring.snappy} className="absolute top-1 h-8 w-14 rounded-full bg-brand-soft" />}
      <span className="relative">
        <Icon className={cn("size-5 transition-colors", active ? "text-brand" : "text-muted")} strokeWidth={active ? 2.2 : 1.9} />
        <CountBadge count={badge} className="absolute -right-3 -top-2 h-4 min-w-4 px-1 text-[10px] ring-2 ring-surface" />
      </span>
      <span className={cn("relative text-[11px] font-semibold transition-colors", active ? "text-brand" : "text-muted")}>{label}</span>
    </motion.span>
  );
  return href ? (
    <Link href={href} aria-current={active ? "page" : undefined} className="block">
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className="block w-full">
      {inner}
    </button>
  );
}
