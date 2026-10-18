"use client";
// Pieces shared by the staff app's screens (Home, My pay, Me).
import Link from "next/link";
import { ChevronRight, Clock, Coffee, MoonStar, Timer } from "lucide-react";
import { Sheet, Skeleton, cn } from "@/app/components/ui";
import { formatMoney } from "@/utils/formatMoney";

const monthName = (period) => {
  const [y, m] = String(period || "").split("-").map(Number);
  return y && m ? new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" }) : period || "";
};
export { monthName };

const hrs = (n) => (Math.round(n * 10) / 10).toLocaleString("en", { maximumFractionDigits: 1 });

/** This pay period so far: hours, OT and what that comes to. */
export function PeriodCard({ staff, period, stats, loading, currency, href }) {
  if (loading) return <Skeleton className="h-44" rounded="rounded-3xl" />;
  const label = period?.type === "weekly" ? "This week so far" : "This month so far";
  const body = (
    <div className="relative overflow-hidden rounded-3xl bg-brand p-5 text-brand-fg shadow-float">
      <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute -bottom-16 right-10 size-32 rounded-full bg-white/5" />
      <div className="relative flex items-center justify-between">
        <p className="text-sm font-medium opacity-90">{stats.isFixed ? "Monthly salary" : label}</p>
        {href && <ChevronRight className="size-5 opacity-80" />}
      </div>
      <p className="relative mt-2 text-3xl font-semibold tracking-tight">{formatMoney(stats.earnings, currency)}</p>
      {stats.isFixed ? (
        <p className="relative mt-3 text-sm opacity-90">A fixed salary — your hours are not counted.</p>
      ) : (
        <>
          <p className="relative text-xs opacity-80">Earned so far, before deductions</p>
          <div className="relative mt-4 grid grid-cols-3 gap-2">
            <Stat icon={Clock} label="Hours" value={hrs(stats.basicHours)} />
            <Stat icon={Timer} label="Overtime" value={`+${hrs(stats.otHours)}`} />
            <Stat icon={Coffee} label="Days" value={stats.daysWorked} />
          </div>
          {(stats.pendingOtDays > 0 || stats.lateDays > 0 || staff?.hasPaidBreak) && (
            <div className="relative mt-3 flex flex-wrap gap-1.5">
              {stats.pendingOtDays > 0 && <Chip>{stats.pendingOtDays} early-OT day{stats.pendingOtDays > 1 ? "s" : ""} waiting for approval</Chip>}
              {stats.lateDays > 0 && <Chip>Late {Math.round(stats.lateMinutes)} min over {stats.lateDays} day{stats.lateDays > 1 ? "s" : ""}</Chip>}
              {staff?.hasPaidBreak && <Chip><MoonStar className="size-3" /> Paid break</Chip>}
            </div>
          )}
        </>
      )}
    </div>
  );
  return href ? <Link href={href} className="block transition active:scale-[0.99]">{body}</Link> : body;
}

const Stat = ({ icon: Icon, label, value }) => (
  <div className="rounded-2xl px-3 py-2.5" style={{ backgroundColor: "rgb(255 255 255 / 0.12)" }}>
    <p className="flex items-center gap-1 text-[11px] font-medium opacity-80"><Icon className="size-3" /> {label}</p>
    <p className="mt-0.5 text-lg font-semibold">{value}</p>
  </div>
);
const Chip = ({ children }) => (
  <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ backgroundColor: "rgb(255 255 255 / 0.16)" }}>{children}</span>
);

/** A small figure on a card: what they owe, a balance. */
export function MoneyTile({ icon: Icon, label, amount, currency, tone = "default", hint, href }) {
  const body = (
    <div className="h-full rounded-2xl border border-line bg-surface p-4">
      <p className="flex items-center gap-2 text-xs font-medium text-muted">
        <span className={cn("inline-flex size-7 items-center justify-center rounded-lg", tone === "warning" ? "bg-warning-soft text-warning" : "bg-brand-soft text-brand")}>
          <Icon className="size-4" />
        </span>
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold">{formatMoney(amount, currency)}</p>
      {hint && <p className="mt-0.5 text-xs text-subtle">{hint}</p>}
    </div>
  );
  return href ? <Link href={href} className="block">{body}</Link> : body;
}

/** A section heading with an optional link on the right. */
export const Heading = ({ children, href, more = "See all" }) => (
  <div className="flex items-center justify-between px-1">
    <h2 className="text-sm font-semibold text-fg">{children}</h2>
    {href && <Link href={href} className="text-xs font-semibold text-brand">{more}</Link>}
  </div>
);

/** One payslip in a list. */
export function PayslipRow({ slip, currency, onOpen }) {
  return (
    <button type="button" onClick={() => onOpen(slip)} className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3.5 text-left transition hover:bg-surface-2">
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{monthName(slip.period)}</span>
        <span className={cn("block text-xs", slip.status === "paid" ? "text-success" : "text-muted")}>
          {slip.status === "paid" ? `Paid${slip.paidOn ? ` · ${new Date(slip.paidOn).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : ""}` : "Ready — not paid yet"}
        </span>
      </span>
      <span className="text-right">
        <span className="block text-base font-semibold">{formatMoney(slip.netPay, currency)}</span>
        <span className="block text-[11px] text-subtle">take home</span>
      </span>
      <ChevronRight className="size-4 text-subtle" />
    </button>
  );
}

const Line = ({ label, value, currency, minus, strong, note }) =>
  value ? (
    <div className={cn("flex items-start justify-between gap-3 py-1.5 text-sm", strong && "font-semibold")}>
      <span className="text-muted">
        {label}
        {note && <span className="block text-xs text-subtle">{note}</span>}
      </span>
      <span className={cn("tabular-nums", minus && "text-danger")}>{minus ? "−" : ""}{formatMoney(value, currency)}</span>
    </div>
  ) : null;

/** A payslip opened up: what was earned, what was taken, what's left. */
export function PayslipSheet({ slip, currency, onClose }) {
  const s = slip || {};
  return (
    <Sheet open={!!slip} onClose={onClose} title={`Payslip · ${monthName(s.period)}`} description={s.status === "paid" ? "Paid" : "Ready — not paid yet"}>
      <div className="space-y-5">
        <div className="rounded-2xl bg-brand-soft p-4 text-center">
          <p className="text-xs font-medium text-brand">Take home</p>
          <p className="mt-1 text-3xl font-semibold text-fg">{formatMoney(s.netPay, currency)}</p>
        </div>
        {!!(s.workedHours || s.workedDays || s.otHours) && (
          <div className="flex gap-2 text-center [&>*]:flex-1">
            {[["Hours", s.workedHours], ["Days", s.workedDays], ["OT hours", s.otHours]].filter(([, v]) => Number(v) > 0).map(([k, v]) => (
              <div key={k} className="rounded-xl border border-line px-2 py-2">
                <p className="text-[11px] text-muted">{k}</p>
                <p className="text-sm font-semibold">{hrs(Number(v) || 0)}</p>
              </div>
            ))}
          </div>
        )}
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-subtle">Earned</p>
          <div className="divide-y divide-line/60">
            <Line label="Basic pay" value={s.basePay} currency={currency} />
            <Line label="Overtime" value={s.otPay} currency={currency} />
            <Line label="Public holidays" value={s.phPay} currency={currency} />
            <Line label="Allowance" value={s.allowance} currency={currency} />
            <Line label="Bonus" value={s.bonus} currency={currency} note={s.bonusNote} />
            <Line label="Other" value={s.otherEarnings} currency={currency} note={s.otherEarningsNote} />
            <Line label="Total earned" value={s.grossEarnings} currency={currency} strong />
          </div>
        </div>
        {!!s.totalDeductions && (
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-subtle">Taken off</p>
            <div className="divide-y divide-line/60">
              {(s.statutory || []).map((d) => <Line key={d.key || d.name} label={d.name} value={d.employeeAmt} currency={currency} minus />)}
              <Line label="Advance paid back" value={s.advanceAmt} currency={currency} minus note={s.advanceDue > s.advanceAmt ? `The rest (${formatMoney(s.advanceDue - s.advanceAmt, currency)}) moves to next month` : ""} />
              <Line label="Loan paid back" value={s.loanAmt} currency={currency} minus note={s.loanDue > s.loanAmt ? `The rest (${formatMoney(s.loanDue - s.loanAmt, currency)}) moves to next month` : s.loanNote} />
              <Line label="Absent days" value={s.absentAmount} currency={currency} minus />
              <Line label="Penalty" value={s.penalty} currency={currency} minus note={s.penaltyNote} />
              <Line label="Other" value={s.otherDeductions} currency={currency} minus note={s.otherDeductionsNote} />
              <Line label="Total taken off" value={s.totalDeductions} currency={currency} minus strong />
            </div>
          </div>
        )}
        {s.extraNote && <p className="rounded-xl bg-surface-2 px-3 py-2 text-xs text-muted">{s.extraNote}</p>}
        <p className="text-center text-xs text-subtle">Something wrong? Ask your manager — Requests or Chat.</p>
      </div>
    </Sheet>
  );
}
