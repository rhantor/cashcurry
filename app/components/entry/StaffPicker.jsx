"use client";
import { useMemo, useState } from "react";
import { ChevronsUpDown, Search, UserRound } from "lucide-react";
import { Avatar, PickerShell, Skeleton, cn } from "@/app/components/ui";

/** "Ali Hassan" from a staff record, whichever name fields it has. */
export const staffName = (s) => (s ? (s.firstName || s.lastName ? `${s.firstName || ""} ${s.lastName || ""}`.trim() : s.name || s.staffName || "") : "");
const roleOf = (s) => [s?.role, s?.department].filter(Boolean).join(" · ");

/**
 * Pick a staff member: a field that opens a searchable list (a popover on
 * computers, a bottom sheet on phones). value = staff id; onChange(staff | null).
 */
export default function StaffPicker({ staff = [], value, onChange, loading = false, invalid = false, placeholder = "Choose a staff member" }) {
  const [q, setQ] = useState("");
  const chosen = staff.find((s) => s.id === value) || null;
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return [...staff]
      .sort((a, b) => staffName(a).localeCompare(staffName(b)))
      .filter((s) => !t || `${staffName(s)} ${roleOf(s)}`.toLowerCase().includes(t));
  }, [staff, q]);

  if (loading) return <Skeleton className="h-12 w-full" rounded="rounded-xl" />;

  return (
    <PickerShell
      title="Choose a staff member"
      width={340}
      onOpen={() => setQ("")}
      trigger={({ open, toggle, ref }) => (
        <button
          ref={ref}
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className={cn(
            "flex h-12 w-full items-center gap-3 rounded-xl border bg-surface px-3 text-left transition outline-none",
            "focus:border-brand focus:ring-4 focus:ring-[var(--cc-ring)]",
            open ? "border-brand ring-4 ring-[var(--cc-ring)]" : invalid ? "border-danger" : "border-line"
          )}
        >
          {chosen ? (
            <Avatar name={staffName(chosen)} src={chosen.photoURL || chosen.photoUrl} size="sm" />
          ) : (
            <span className="flex size-7 items-center justify-center rounded-full bg-surface-2 text-subtle">
              <UserRound className="size-4" />
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className={cn("block truncate text-sm", chosen ? "font-semibold text-fg" : "text-subtle")}>{chosen ? staffName(chosen) : placeholder}</span>
            {chosen && roleOf(chosen) && <span className="block truncate text-[11px] capitalize text-muted">{roleOf(chosen)}</span>}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-subtle" />
        </button>
      )}
    >
      {({ close, phone }) => (
        <div className={phone ? "" : "w-[328px]"}>
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
            <input
              autoFocus={!phone}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name or role"
              className="h-10 w-full rounded-xl bg-surface-2 pl-9 pr-3 text-sm text-fg outline-none placeholder:text-subtle"
            />
          </div>
          <ul className={cn("overflow-y-auto", phone ? "max-h-[55vh]" : "max-h-72")}>
            {list.map((s) => {
              const on = s.id === value;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(s);
                      close();
                    }}
                    className={cn("flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-surface-2", on && "bg-brand-soft")}
                  >
                    <Avatar name={staffName(s)} src={s.photoURL || s.photoUrl} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className={cn("block truncate text-sm font-semibold", on ? "text-brand" : "text-fg")}>{staffName(s) || "—"}</span>
                      {roleOf(s) && <span className="block truncate text-[11px] capitalize text-muted">{roleOf(s)}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
            {list.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">{staff.length ? `No one matches “${q}”` : "No staff in this branch yet"}</li>}
          </ul>
        </div>
      )}
    </PickerShell>
  );
}
