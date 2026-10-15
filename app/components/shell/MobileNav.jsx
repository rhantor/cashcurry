"use client";
import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { LayoutGrid, LogOut } from "lucide-react";
import { Button, Sheet, cn, menuIcon } from "@/app/components/ui";
import { spring } from "@/app/components/ui/motion";
import BranchSwitcher from "./BranchSwitcher";

/**
 * The phone's bottom bar: Home, the role's three most-used pages, and More —
 * which opens everything else (and the branch) in a bottom sheet.
 */
export default function MobileNav({ items, sections, activePath, user, isCompany, branches, activeBranchId, onSwitchBranch, onSignOut }) {
  const [more, setMore] = useState(false);
  const inMore = !items.some((i) => i.path === activePath);

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
        <ul className="mx-auto flex max-w-lg items-stretch justify-around px-2">
          {items.map((it) => (
            <li key={it.path} className="flex-1">
              <Tab href={it.path} icon={it.icon} label={it.label} active={it.path === activePath} />
            </li>
          ))}
          <li className="flex-1">
            <Tab onClick={() => setMore(true)} label="More" active={inMore && activePath !== undefined} Icon={LayoutGrid} />
          </li>
        </ul>
      </nav>

      <Sheet open={more} onClose={() => setMore(false)} title="Menu">
        {isCompany && branches.length > 0 && (
          <div className="mb-5">
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-subtle">Branch</p>
            <BranchSwitcher
              user={user}
              branches={branches}
              activeId={activeBranchId}
              onSwitch={(b) => {
                setMore(false);
                onSwitchBranch(b);
              }}
            />
          </div>
        )}
        <div className="space-y-5">
          {sections.map(({ section, items: list }) => (
            <div key={section}>
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-subtle">{section}</p>
              <div className="grid grid-cols-2 gap-2">
                {list.flatMap((it) => (it.children ? it.children.map((c) => ({ ...c, icon: it.icon })) : [it])).map((it) => {
                  const Icon = menuIcon(it.icon);
                  const active = it.path === activePath;
                  return (
                    <Link
                      key={it.path}
                      href={it.path}
                      onClick={() => setMore(false)}
                      className={cn(
                        "flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm font-medium transition active:scale-[0.98]",
                        active ? "border-brand/30 bg-brand-soft text-brand" : "border-line bg-surface text-fg"
                      )}
                    >
                      <Icon className="size-4 shrink-0 opacity-80" />
                      <span className="truncate">{it.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
          <Button variant="secondary" icon={LogOut} className="w-full text-danger" onClick={onSignOut}>
            Sign out
          </Button>
        </div>
      </Sheet>
    </>
  );
}

function Tab({ href, onClick, icon, Icon: IconProp, label, active }) {
  const Icon = IconProp || menuIcon(icon);
  const inner = (
    <motion.span whileTap={{ scale: 0.92 }} className="relative flex flex-col items-center gap-0.5 py-2">
      {active && (
        <motion.span layoutId="bottom-nav-active" transition={spring.snappy} className="absolute top-1 h-8 w-14 rounded-full bg-brand-soft" />
      )}
      <Icon className={cn("relative size-5 transition-colors", active ? "text-brand" : "text-muted")} strokeWidth={active ? 2.2 : 1.9} />
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
