"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Building2, Clock, CornerDownLeft, LogOut, Search } from "lucide-react";
import { cn, menuIcon } from "@/app/components/ui";
import { fade, pop } from "@/app/components/ui/motion";

const RECENT_KEY = "cc-recent-pages";
export const readRecent = () => {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
  } catch {
    return [];
  }
};
/** Remember a visited page (most recent first, five kept) for the empty search. */
export const rememberPage = (path) => {
  try {
    const next = [path, ...readRecent().filter((p) => p !== path)].slice(0, 5);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* private mode */
  }
};

// Every word typed must appear somewhere in the label, its group or section.
const matches = (text, q) => q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => text.toLowerCase().includes(w));

/**
 * Ctrl+K: jump to any page you can open, switch branch, or sign out — by typing
 * a few letters. Arrow keys move, Enter opens, Esc closes.
 */
export default function CommandPalette({ open, onClose, pages, branches, activeBranchId, onSwitchBranch, onSignOut }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [index, setIndex] = useState(0);
  const list = useRef(null);

  useEffect(() => {
    if (open) {
      setQ("");
      setIndex(0);
    }
  }, [open]);

  const results = useMemo(() => {
    const out = [];
    if (!q) {
      const recent = readRecent()
        .map((path) => pages.find((p) => p.path === path))
        .filter(Boolean);
      recent.forEach((p) => out.push({ group: "Recent", label: p.label, hint: p.parent || p.section, icon: menuIcon(p.icon), recent: true, run: () => router.push(p.path) }));
    }
    pages
      .filter((p) => !q || matches(`${p.label} ${p.parent || ""} ${p.section}`, q))
      .filter((p) => q || !out.some((r) => r.label === p.label))
      .forEach((p) => out.push({ group: "Pages", label: p.label, hint: p.parent || p.section, icon: menuIcon(p.icon), run: () => router.push(p.path) }));
    branches
      .filter((b) => b.id !== activeBranchId && (!q ? false : matches(`${b.name} branch switch`, q)))
      .forEach((b) => out.push({ group: "Switch branch", label: b.name, hint: "Branch", icon: Building2, run: () => onSwitchBranch(b) }));
    if (!q || matches("sign out log out logout", q)) out.push({ group: "Account", label: "Sign out", icon: LogOut, danger: true, run: onSignOut });
    return out;
  }, [q, pages, branches, activeBranchId, router, onSwitchBranch, onSignOut]);

  useEffect(() => setIndex(0), [q]);
  useEffect(() => {
    list.current?.querySelector(`[data-i="${index}"]`)?.scrollIntoView?.({ block: "nearest" });
  }, [index]);

  const choose = (r) => {
    onClose();
    r?.run();
  };
  const onKey = (e) => {
    if (e.key === "ArrowDown") setIndex((i) => Math.min(i + 1, results.length - 1));
    else if (e.key === "ArrowUp") setIndex((i) => Math.max(i - 1, 0));
    else if (e.key === "Enter") choose(results[index]);
    else if (e.key === "Escape") onClose();
    else return;
    e.preventDefault();
  };

  if (typeof document === "undefined") return null;
  let lastGroup = null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[65] flex items-start justify-center px-3 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Search">
          <motion.div variants={fade} initial="hidden" animate="show" exit="exit" onClick={onClose} className="fixed inset-0 bg-black/40 backdrop-blur-[2px]" />
          <motion.div variants={pop} initial="hidden" animate="show" exit="exit" className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-surface shadow-float">
            <div className="flex items-center gap-3 border-b border-line px-4">
              <Search className="size-5 shrink-0 text-subtle" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onKey}
                placeholder="Search pages, branches…"
                className="h-14 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-subtle"
              />
              <kbd className="rounded-md border border-line px-1.5 py-0.5 text-[10px] font-semibold text-muted">Esc</kbd>
            </div>
            <ul ref={list} className="max-h-[50vh] overflow-y-auto p-2">
              {results.length === 0 && <li className="px-3 py-10 text-center text-sm text-muted">Nothing matches “{q}”</li>}
              {results.map((r, i) => {
                const header = r.group !== lastGroup;
                lastGroup = r.group;
                const Icon = r.recent ? Clock : r.icon;
                return (
                  <li key={`${r.group}-${r.label}-${i}`}>
                    {header && <p className="px-3 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wider text-subtle first:pt-1">{r.group}</p>}
                    <button
                      type="button"
                      data-i={i}
                      onMouseMove={() => setIndex(i)}
                      onClick={() => choose(r)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                        i === index ? "bg-brand-soft" : "hover:bg-surface-2"
                      )}
                    >
                      <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", i === index ? "bg-surface text-brand" : "bg-surface-2 text-muted")}>
                        {Icon && <Icon className="size-4" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={cn("block truncate font-semibold", r.danger ? "text-danger" : "text-fg")}>{r.label}</span>
                        {r.hint && <span className="block truncate text-xs text-muted">{r.hint}</span>}
                      </span>
                      {i === index && <CornerDownLeft className="size-4 text-brand" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
