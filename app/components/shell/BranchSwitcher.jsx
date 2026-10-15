"use client";
import { useMemo, useState } from "react";
import { Building2, Check, ChevronsUpDown, Search, Star } from "lucide-react";
import { Popover, cn, useToast } from "@/app/components/ui";
import { useUpdateUserDefaultBranchMutation } from "@/lib/redux/api/authApiSlice";
import { updateSessionUser } from "@/lib/session";

/**
 * Which branch the screens show (owners, GMs). A search box appears once there
 * are more than a few branches; the star makes a branch your default (the one
 * you land on after login).
 */
export default function BranchSwitcher({ user, branches, activeId, onSwitch, compact = false }) {
  const toast = useToast();
  const [q, setQ] = useState("");
  const [saveDefault, { isLoading: saving }] = useUpdateUserDefaultBranchMutation();
  const active = branches.find((b) => b.id === activeId);
  const list = useMemo(
    () => branches.filter((b) => !q || `${b.name} ${b.address || ""}`.toLowerCase().includes(q.toLowerCase())),
    [branches, q]
  );

  const makeDefault = async (b) => {
    try {
      await saveDefault({ uid: user.uid, companyId: user.companyId, defaultBranchId: b.id }).unwrap();
      updateSessionUser({ defaultBranchId: b.id });
      toast.success("Default branch saved", { description: `You'll start in ${b.name}` });
    } catch {
      toast.error("Could not save the default branch");
    }
  };

  return (
    <Popover
      align="end"
      width={300}
      onOpenChange={(o) => !o && setQ("")}
      trigger={({ open, toggle, ref }) => (
        <button
          ref={ref}
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className={cn(
            "flex min-w-0 items-center gap-2 rounded-xl border border-line bg-surface text-left transition hover:bg-surface-2",
            compact ? "h-9 px-2.5" : "h-10 px-3"
          )}
        >
          <Building2 className="size-4 shrink-0 text-brand" />
          <span className="min-w-0 truncate text-sm font-semibold text-fg">{active?.name || "Choose branch"}</span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-subtle" />
        </button>
      )}
    >
      {({ close }) => (
        <div>
          {branches.length > 5 && (
            <div className="relative mb-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Find a branch"
                className="h-9 w-full rounded-xl bg-surface-2 pl-9 pr-3 text-sm text-fg outline-none placeholder:text-subtle"
              />
            </div>
          )}
          <p className="px-3 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-subtle">Branches</p>
          <ul className="max-h-72 overflow-y-auto">
            {list.map((b) => {
              const isActive = b.id === activeId;
              const isDefault = b.id === user?.defaultBranchId;
              return (
                <li key={b.id} className="group flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      close();
                      if (!isActive) onSwitch(b);
                    }}
                    className={cn(
                      "flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-colors hover:bg-surface-2",
                      isActive && "bg-brand-soft"
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className={cn("block truncate text-sm font-semibold", isActive ? "text-brand" : "text-fg")}>{b.name}</span>
                      {b.address && <span className="block truncate text-xs text-muted">{b.address}</span>}
                    </span>
                    {isActive && <Check className="size-4 shrink-0 text-brand" />}
                  </button>
                  <button
                    type="button"
                    disabled={saving || isDefault}
                    onClick={() => makeDefault(b)}
                    title={isDefault ? "Your default branch" : "Make default"}
                    aria-label={isDefault ? "Your default branch" : `Make ${b.name} your default`}
                    className={cn(
                      "rounded-lg p-2 transition",
                      isDefault ? "text-warning" : "text-subtle opacity-0 hover:bg-surface-2 hover:text-warning group-hover:opacity-100 focus:opacity-100"
                    )}
                  >
                    <Star className={cn("size-4", isDefault && "fill-current")} />
                  </button>
                </li>
              );
            })}
            {list.length === 0 && <li className="px-3 py-4 text-center text-sm text-muted">No branch matches “{q}”</li>}
          </ul>
        </div>
      )}
    </Popover>
  );
}
