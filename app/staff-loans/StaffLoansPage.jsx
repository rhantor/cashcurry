"use client";
import React, { useMemo, useState } from "react";
import { format, isValid, parseISO } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarClock, ChevronDown, HandCoins, Search, Users, Wallet } from "lucide-react";
import { useGetStaffLoansQuery, useEditStaffLoanTermsMutation } from "@/lib/redux/api/staffLoanApiSlice";
import LoanTermsModal from "@/app/components/common/LoanTermsModal";
import useCurrency from "@/app/hooks/useCurrency";
import { formatMoney } from "@/lib/region/currency";
import { getSessionUser } from "@/lib/session";
import { Avatar, Badge, Button, Card, EmptyState, Input, Skeleton, Tabs, cn, toast } from "@/app/components/ui";

// ─── helpers ─────────────────────────────────────────────────────────────────

function getUser() {
  if (typeof window === "undefined") return {};
  try {
    return getSessionUser() || {};
  } catch {
    return {};
  }
}
const monthText = (m) => {
  const d = m ? parseISO(`${m}-01`) : null;
  return d && isValid(d) ? format(d, "MMM yyyy") : m || "";
};
// the monthly instalment; older loans may not have it saved
const emiOf = (l) => Number(l.emi) || Math.ceil((Number(l.amount) || 0) / Math.max(1, Number(l.durationMonths) || 1));
const paidCount = (l) => (l.installments || []).filter((i) => i.status === "paid").length;
const progressPct = (l) => {
  const total = (l.installments || []).length;
  return total ? Math.round((paidCount(l) / total) * 100) : 0;
};
const nextDue = (l) => (l.installments || []).filter((i) => i.status === "pending").sort((a, b) => a.month.localeCompare(b.month))[0] || null;
const STATUS = {
  approved: { label: "Paying back", tone: "brand" },
  pending: { label: "Waiting for approval", tone: "warning" },
  closed: { label: "Paid back", tone: "neutral" },
  rejected: { label: "Rejected", tone: "danger" },
};

// ─── one loan, opens to its instalments ──────────────────────────────────────

function LoanCard({ loan, money, onEditTerms, canEdit, flat = false }) {
  const [open, setOpen] = useState(false);
  const pct = progressPct(loan);
  const next = nextDue(loan);
  const migrated = loan.source === "migration";
  const st = STATUS[loan.status] || STATUS.pending;

  const body = (
    <>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-2/40">
        {!flat && <Avatar name={loan.staffName} />}
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-sm font-semibold text-fg">{flat ? `${money(loan.amount)} loan` : loan.staffName}</span>
            <Badge tone={st.tone} className="px-2 py-px text-[10px]">
              {st.label}
            </Badge>
            {migrated && (
              <Badge tone="warning" className="px-2 py-px text-[10px]">
                Brought over
              </Badge>
            )}
          </span>
          <span className="mt-0.5 block text-xs text-muted">
            {!flat && `${money(loan.amount)} · `}
            {loan.durationMonths} months × {money(emiOf(loan))} · {paidCount(loan)}/{(loan.installments || []).length} paid
          </span>
          <span className="mt-2 block h-1.5 max-w-xs overflow-hidden rounded-full bg-surface-2">
            <motion.span className={cn("block h-full rounded-full", loan.status === "closed" ? "bg-subtle" : "bg-brand")} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} />
          </span>
        </span>
        <span className="flex shrink-0 items-start gap-2">
          {next && (
            <span className="hidden text-right sm:block">
              <span className="block text-[11px] text-subtle">Next</span>
              <span className="block text-xs font-semibold text-fg">{monthText(next.month)}</span>
              <span className="block text-xs font-semibold tabular-nums text-info">{money(next.amount)}</span>
            </span>
          )}
          <motion.span animate={{ rotate: open ? 180 : 0 }} className="mt-1 text-subtle">
            <ChevronDown className="size-4" />
          </motion.span>
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="space-y-3 border-t border-line bg-surface-2/30 px-4 py-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  ["Loan", money(loan.amount), "text-fg"],
                  ["Paid back", money(loan.totalPaid || 0), "text-brand"],
                  ["Still owed", money(loan.remainingAmount || 0), "text-warning"],
                  ["Done", `${pct}%`, "text-info"],
                ].map(([k, v, c]) => (
                  <div key={k} className="rounded-xl bg-surface px-3 py-2 text-center">
                    <p className="text-[11px] text-subtle">{k}</p>
                    <p className={cn("text-sm font-bold tabular-nums", c)}>{v}</p>
                  </div>
                ))}
              </div>
              {loan.reason && <p className="text-xs italic text-muted">“{loan.reason}”</p>}

              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-subtle">Instalments</p>
                <ul className="max-h-56 space-y-1 overflow-y-auto pr-1">
                  {(loan.installments || []).map((i) => (
                    <li key={i.index} className={cn("flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs", i.status === "paid" ? "bg-brand-soft/60 text-brand" : "bg-surface text-fg")}>
                      <span className="flex size-5 items-center justify-center rounded-full bg-surface-2 text-[10px] font-semibold text-muted">{i.index}</span>
                      <span className="font-medium">{monthText(i.month)}</span>
                      {i.note && <span className="truncate text-[10px] italic text-warning">{i.note}</span>}
                      <span className="ml-auto font-semibold tabular-nums">{money(i.amount)}</span>
                      <span className="w-12 text-right text-[10px] font-semibold">{i.status === "paid" ? "Paid" : "Due"}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {canEdit && loan.status !== "closed" && (
                <Button variant="secondary" size="sm" icon={CalendarClock} onClick={() => onEditTerms(loan)}>
                  Change instalments
                </Button>
              )}

              {loan.termEdits?.length > 0 && (
                <div>
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-subtle">Changed before</p>
                  <ul className="space-y-1">
                    {loan.termEdits.map((e, i) => (
                      <li key={i} className="rounded-lg bg-surface px-3 py-1.5 text-[11px] text-muted">
                        <span className="font-semibold text-fg">{e.editedBy?.username || "Manager"}</span>
                        {e.editedAt ? ` · ${new Date(e.editedAt).toLocaleDateString()}` : ""}
                        {e.note && <span className="block italic">“{e.note}”</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
  return flat ? body : <Card className="overflow-hidden p-0">{body}</Card>;
}

// ─── the page ────────────────────────────────────────────────────────────────

/**
 * Staff loan tracker: every staff loan at the branch, what is still owed and
 * what payroll has taken back, each loan's instalments, and (for managers)
 * changing them — a different amount for a month or moving it on.
 */
export default function StaffLoansPage() {
  const user = getUser();
  const { companyId, branchId, role } = user;
  const currency = useCurrency();
  const money = (v) => formatMoney(v, currency);
  const canEdit = ["owner", "gm", "superAdmin", "branchAdmin", "manager"].includes(role);

  const { data: loanList = [], isLoading, isError } = useGetStaffLoansQuery({ companyId, branchId }, { skip: !companyId || !branchId, refetchOnMountOrArgChange: true });
  const [editStaffLoanTerms, { isLoading: saving }] = useEditStaffLoanTermsMutation();
  const [editTarget, setEditTarget] = useState(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active"); // 'all' | 'active' | 'closed'
  const [viewMode, setViewMode] = useState("loans"); // 'loans' | 'staff'

  const filtered = useMemo(() => {
    let list = loanList;
    if (statusFilter === "active") list = list.filter((l) => l.status !== "closed" && l.status !== "rejected");
    if (statusFilter === "closed") list = list.filter((l) => l.status === "closed");
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((l) => (l.staffName || "").toLowerCase().includes(q) || (l.reason || "").toLowerCase().includes(q));
    // still running first, then the most owed
    return [...list].sort((a, b) => (a.status === "closed") - (b.status === "closed") || (b.remainingAmount || 0) - (a.remainingAmount || 0));
  }, [loanList, statusFilter, search]);

  const stats = useMemo(() => {
    const active = loanList.filter((l) => l.status !== "closed" && l.status !== "rejected");
    return {
      staff: new Set(active.map((l) => l.staffId || l.staffName)).size,
      count: active.length,
      owed: active.reduce((s, l) => s + (l.remainingAmount || 0), 0),
      lent: active.reduce((s, l) => s + (l.amount || 0), 0),
      back: active.reduce((s, l) => s + (l.totalPaid || 0), 0),
    };
  }, [loanList]);

  const byStaff = useMemo(() => {
    const map = new Map();
    for (const l of filtered) {
      const key = l.staffId || l.staffName;
      const g = map.get(key) || { key, staffName: l.staffName, loans: [], owed: 0 };
      g.loans.push(l);
      g.owed += l.remainingAmount || 0;
      map.set(key, g);
    }
    return [...map.values()].sort((a, b) => b.owed - a.owed);
  }, [filtered]);

  async function handleSaveTerms(changes, note) {
    if (!editTarget) return;
    await editStaffLoanTerms({
      companyId,
      branchId,
      loanId: editTarget.id,
      changes,
      managerNote: note,
      editedBy: { uid: user.uid, username: user.username, role: user.role },
    }).unwrap();
    toast.success("Instalments updated", { description: editTarget.staffName });
    setEditTarget(null);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-5 sm:px-6 sm:py-6">
      {/* where things stand */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Still owed", value: money(stats.owed), note: "to take back from salaries", icon: Wallet, tone: "bg-warning-soft text-warning" },
          { label: "Paid back so far", value: money(stats.back), note: "through payroll", icon: HandCoins, tone: "bg-brand-soft text-brand" },
          { label: "Lent", value: money(stats.lent), note: "on loans still running", icon: Wallet, tone: "bg-info-soft text-info" },
          { label: "Staff with a loan", value: stats.staff, note: `${stats.count} loan${stats.count === 1 ? "" : "s"} running`, icon: Users, tone: "bg-surface-2 text-muted" },
        ].map((s) => (
          <Card key={s.label} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-semibold text-muted">{s.label}</p>
              <span className={cn("flex size-7 items-center justify-center rounded-lg", s.tone)}>
                <s.icon className="size-3.5" />
              </span>
            </div>
            <p className="mt-1.5 truncate text-lg font-bold tabular-nums text-fg">{isLoading ? "…" : s.value}</p>
            <p className="text-[11px] text-subtle">{s.note}</p>
          </Card>
        ))}
      </div>

      {/* find and group */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search staff or reason…" className="pl-9" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Tabs
            size="sm"
            value={statusFilter}
            onChange={setStatusFilter}
            tabs={[
              { value: "active", label: "Running" },
              { value: "closed", label: "Paid back" },
              { value: "all", label: "All" },
            ]}
          />
          <Tabs
            size="sm"
            value={viewMode}
            onChange={setViewMode}
            tabs={[
              { value: "loans", label: "Each loan" },
              { value: "staff", label: "By staff" },
            ]}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24" rounded="rounded-2xl" />
          ))}
        </div>
      ) : isError ? (
        <p className="rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">Couldn&apos;t load the loans. Refresh to try again.</p>
      ) : !filtered.length ? (
        <EmptyState title="No loans here" description={search ? "Nothing matches the search." : statusFilter === "active" ? "No staff loans are running." : "No loans in this group."} />
      ) : viewMode === "loans" ? (
        <div className="space-y-2.5">
          {filtered.map((loan) => (
            <LoanCard key={loan.id} loan={loan} money={money} canEdit={canEdit} onEditTerms={setEditTarget} />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {byStaff.map((g) => (
            <Card key={g.key} className="overflow-hidden p-0">
              <div className="flex items-center gap-3 border-b border-line bg-surface-2/50 px-4 py-3">
                <Avatar name={g.staffName} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-fg">{g.staffName}</p>
                  <p className="text-xs text-muted">
                    {g.loans.length} loan{g.loans.length === 1 ? "" : "s"}
                  </p>
                </div>
                <span className="text-right">
                  <span className="block text-[11px] text-subtle">Still owed</span>
                  <span className="block text-sm font-bold tabular-nums text-warning">{money(g.owed)}</span>
                </span>
              </div>
              <div className="divide-y divide-line">
                {g.loans.map((loan) => (
                  <LoanCard key={loan.id} loan={loan} money={money} canEdit={canEdit} onEditTerms={setEditTarget} flat />
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      {editTarget && <LoanTermsModal type="loan" record={editTarget} saving={saving} onClose={() => setEditTarget(null)} onSave={handleSaveTerms} />}
    </div>
  );
}
