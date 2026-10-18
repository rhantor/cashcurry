"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { Building2, LogOut, MessagesSquare, Search } from "lucide-react";
import { Avatar, LogoMark, Menu, cn } from "@/app/components/ui";
import BranchSwitcher from "./BranchSwitcher";

import { personName } from "@/lib/people";
import NotificationBell from "@/app/components/notifications/NotificationBell";
/**
 * The bar above every page: where you are, search (Ctrl+K), the branch, and you.
 * On phones it keeps to the essentials; the rest lives in the bottom bar.
 */
export default function TopBar({ page, user, isCompany, branches, activeBranchId, branchName, onSwitchBranch, onSearch, onSignOut, chatUnread = 0 }) {
  const crumb = page?.parent || page?.section;
  // Phones have no room for the branch box, so the branch sits under the
  // title — except on company-wide pages, which show every branch.
  const companyWide = page?.path?.startsWith("/company");
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/80 backdrop-blur-xl">
      <div className="flex h-14 items-center gap-3 px-4 sm:px-6 lg:h-16">
        {/* phone: the brand mark (the sidebar has it on computers) */}
        <Link href="/" aria-label="Home" className="shrink-0 lg:hidden">
          <LogoMark size={32} />
        </Link>

        <div className="min-w-0 flex-1">
          {/* The new title shows at once (fading in) — never waits for the old one to leave. */}
          <motion.div
            key={page?.path || "page"}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.18 } }}
          >
            {crumb && <p className="hidden truncate text-[11px] font-semibold uppercase tracking-wider text-subtle sm:block">{crumb}</p>}
            <h1 className={cn("truncate font-bold tracking-tight text-fg lg:text-lg", companyWide ? "text-base" : "text-[15px] leading-5 sm:text-base")}>
              {page?.label || "Cash Curry"}
            </h1>
          </motion.div>
          {!companyWide && (
            <div className="flex min-w-0 sm:hidden">
              {isCompany ? (
                branches.length > 0 && <BranchSwitcher inline user={user} branches={branches} activeId={activeBranchId} onSwitch={onSwitchBranch} />
              ) : (
                branchName && (
                  <span className="flex min-w-0 items-center gap-1 text-xs font-semibold text-brand">
                    <Building2 className="size-3 shrink-0" />
                    <span className="truncate">{branchName}</span>
                  </span>
                )
              )}
            </div>
          )}
        </div>

        {/* search: a box on computers, an icon on phones */}
        <button
          type="button"
          onClick={onSearch}
          className="hidden h-10 w-56 items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 text-sm text-subtle transition hover:border-brand/40 hover:text-muted md:flex"
        >
          <Search className="size-4" />
          <span className="flex-1 text-left">Search…</span>
          <kbd className="rounded-md border border-line bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-muted">Ctrl K</kbd>
        </button>
        <button type="button" onClick={onSearch} aria-label="Search" className="rounded-xl p-2 text-muted transition hover:bg-surface-2 hover:text-fg md:hidden">
          <Search className="size-5" />
        </button>

        {isCompany ? (
          branches.length > 0 && (
            <div className="hidden max-w-56 sm:block">
              <BranchSwitcher user={user} branches={branches} activeId={activeBranchId} onSwitch={onSwitchBranch} />
            </div>
          )
        ) : (
          branchName && (
            <span className="hidden items-center gap-1.5 rounded-xl bg-brand-soft px-3 py-2 text-xs font-semibold text-brand sm:inline-flex">
              <Building2 className="size-3.5" />
              {branchName}
            </span>
          )
        )}

        {/* chat lives in its own workspace (4.4) */}
        <Link
          href="/messages"
          aria-label={chatUnread ? `Chat, ${chatUnread} unread` : "Chat"}
          className="relative inline-flex size-9 items-center justify-center rounded-xl text-muted transition-colors hover:bg-surface-2 hover:text-fg"
        >
          <MessagesSquare className="size-[18px]" />
          {chatUnread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold leading-none text-white tabular-nums">
              {chatUnread > 99 ? "99+" : chatUnread}
            </span>
          )}
        </Link>
        <NotificationBell />

        <Menu
          align="end"
          width={230}
          trigger={(p) => (
            <button {...p} type="button" aria-label="Account" className={cn("rounded-full transition hover:ring-4 hover:ring-brand-soft")}>
              <Avatar name={personName(user)} size="md" />
            </button>
          )}
          items={[
            { label: personName(user) || "Account", hint: user?.role, disabled: true },
            "divider",
            { label: "Search", icon: Search, hint: "Ctrl K", onSelect: onSearch },
            { label: "Sign out", icon: LogOut, danger: true, onSelect: onSignOut },
          ]}
        />
      </div>
    </header>
  );
}
