"use client";
import { useState } from "react";
import Link from "next/link";
import { format, isValid, parseISO } from "date-fns";
import { ChevronRight, ExternalLink, FileSpreadsheet, FileText } from "lucide-react";
import { useDeleteStaffLoanMutation, useUpdateStaffLoanMutation } from "@/lib/redux/api/staffLoanApiSlice";
import { getSessionUser } from "@/lib/session";
import { exportStaffLoansToExcel, exportStaffLoansToPDF } from "@/app/export/exportStaffLoans";
import RecordSheet from "@/app/components/entry/RecordSheet";
import MoneyInput from "@/app/components/entry/MoneyInput";
import { Chip } from "@/app/components/entry/Choices";
import { Avatar, Badge, Button, DatePicker, Field, Input, Sheet, Textarea, confirmDialog, toast } from "@/app/components/ui";

import { personName } from "@/lib/people";
const STATUS = { pending: "Waiting for approval", approved: "Approved", rejected: "Rejected", closed: "Paid back" };
const day = (v, f = "EEE, d MMM yyyy") => {
  const d = typeof v === "string" ? parseISO(v) : v ? new Date(v) : null;
  return d && isValid(d) ? format(d, f) : "";
};
const monthText = (m) => (m && /^\d{4}-\d{2}$/.test(m) ? format(parseISO(`${m}-01`), "MMM yyyy") : m || "");

export const paidBack = (l) => Number(l.totalPaid) || (l.status === "closed" ? Number(l.amount) || 0 : 0);
export const owedOf = (l) => (l.status === "closed" ? 0 : Math.max(0, (Number(l.amount) || 0) - paidBack(l)));
export const migrated = (l) => l?.source === "migration";
/** The monthly instalment; older loans may not have it saved. */
export const emiOf = (l) => Number(l.emi) || Math.ceil((Number(l.amount) || 0) / Math.max(1, Number(l.durationMonths) || 1));
/** Once any of it has been paid back (or it came over from before the app), its terms are changed in the Staff Loan Tracker. */
export const locked = (l) => l.status === "closed" || paidBack(l) > 0 || migrated(l);

export function LoanStatus({ l }) {
  if (l.status === "closed") return <Badge tone="info">Paid back</Badge>;
  if (paidBack(l) > 0) return <Badge tone="warning">Part paid back</Badge>;
  return <Badge tone="brand">Owed</Badge>;
}

function Progress({ l, money }) {
  const total = Number(l.amount) || 0;
  const pct = total ? Math.min(100, (paidBack(l) / total) * 100) : 0;
  return (
    <div className="mt-4 rounded-2xl border border-line p-3">
      <div className="flex justify-between text-xs">
        <span className="font-semibold text-muted">Paid back</span>
        <span className="font-semibold tabular-nums text-fg">
          {money(paidBack(l))} of {money(total)}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
      </div>
      {Array.isArray(l.installments) && l.installments.length > 0 && (
        <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
          {l.installments.map((i) => (
            <li key={i.index} className="flex items-center justify-between gap-2">
              <span className={i.status === "paid" ? "text-subtle line-through" : "text-fg"}>{monthText(i.month)}</span>
              <span className={i.status === "paid" ? "tabular-nums text-subtle" : "tabular-nums font-medium text-fg"}>{money(i.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** One staff loan as a slip: the terms, how much is paid back, its instalments. */
export function LoanRecord({ l, branch, money, onClose, onEdit, onDelete }) {
  const isLocked = locked(l);
  return (
    <RecordSheet
      onClose={onClose}
      title={`Staff loan · ${day(l.date, "EEEE, d MMMM yyyy")}`}
      branch={branch?.name}
      amount={l.amount}
      amountLabel={l.staffName || "Staff loan"}
      tone="out"
      money={money}
      note={
        isLocked ? (
          <>
            {migrated(l) ? "Brought over from before the app. " : "Some of it has been paid back. "}
            Change its terms in the{" "}
            <Link href="/staff-loans" className="font-semibold text-brand underline">
              Staff Loan Tracker
            </Link>
            .
          </>
        ) : undefined
      }
      rows={[
        { label: "Paid back over", value: `${Number(l.durationMonths) || 1} month${Number(l.durationMonths) > 1 ? "s" : ""}` },
        { label: "Each month", value: money(emiOf(l)) },
        { label: "Starts", value: l.repaymentStartDate ? day(l.repaymentStartDate, "MMMM yyyy") : "" },
        { label: "Still owed", value: owedOf(l) ? money(owedOf(l)) : "" },
        { label: "Reason", value: l.reason },
        { label: "Status", value: STATUS[l.status] || l.status },
        { label: "Paid from", value: l.paidFromOffice === "back" ? "Bank" : l.paidFromOffice === "front" ? "Till (cash)" : "" },
        { label: "Approval note", value: l.approvalNotes },
      ]}
      files={null}
      by={personName(l.createdBy)}
      at={l.createdAt}
      pdf={() => exportStaffLoansToPDF([l], branch, "range", { from: l.date, to: l.date })}
      excel={() => exportStaffLoansToExcel([l], branch, "range", { from: l.date, to: l.date })}
      onEdit={isLocked ? undefined : onEdit}
      onDelete={isLocked ? undefined : onDelete}
    >
      <Progress l={l} money={money} />
    </RecordSheet>
  );
}

/** One staff member's loans in the period; tap one to open it. */
export function StaffSheet({ staff, branch, money, range, onClose, onOpen }) {
  return (
    <Sheet
      open
      onClose={onClose}
      title={staff.staffName}
      description={branch?.name}
      footer={
        <>
          <Button variant="secondary" size="lg" icon={FileText} className="flex-1" onClick={() => exportStaffLoansToPDF(staff.entries, branch, "range", range)}>
            PDF
          </Button>
          <Button variant="secondary" size="lg" icon={FileSpreadsheet} className="flex-1" onClick={() => exportStaffLoansToExcel(staff.entries, branch, "range", range)}>
            Excel
          </Button>
        </>
      }
    >
      <div className="flex items-center gap-3">
        <Avatar name={staff.staffName} size="lg" />
        <div className="grid flex-1 grid-cols-3 gap-2 text-center">
          {[
            ["Borrowed", money(staff.totalAmount)],
            ["Paid back", money(staff.totalPaid)],
            ["Still owed", money(staff.owed)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-surface-2 px-2 py-2">
              <p className="text-[11px] font-semibold text-muted">{k}</p>
              <p className="truncate text-sm font-bold tabular-nums text-fg">{v}</p>
            </div>
          ))}
        </div>
      </div>
      <ul className="mt-4 divide-y divide-line">
        {staff.entries.map((l) => (
          <li key={l.id}>
            <button type="button" onClick={() => onOpen(l)} className="flex w-full items-center gap-3 py-3 text-left transition hover:bg-surface-2/60">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-fg">{day(l.date)}</span>
                <span className="block truncate text-xs text-muted">{[`${Number(l.durationMonths) || 1} months`, l.reason].filter(Boolean).join(" · ")}</span>
              </span>
              <LoanStatus l={l} />
              <span className="font-semibold tabular-nums text-fg">{money(l.amount)}</span>
              <ChevronRight className="size-4 text-subtle" />
            </button>
          </li>
        ))}
      </ul>
      <Link href="/staff-loans" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline">
        Open the Staff Loan Tracker <ExternalLink className="size-3" />
      </Link>
    </Sheet>
  );
}

/** Change a loan nothing has been paid back on yet; the instalments are laid out again from the new terms. */
export function LoanEditSheet({ l, companyId, branchId, currency, money, onClose }) {
  const [date, setDate] = useState(l.date || "");
  const [amount, setAmount] = useState(l.amount != null ? String(l.amount) : "");
  const [months, setMonths] = useState(String(l.durationMonths || 1));
  const [start, setStart] = useState(l.repaymentStartDate || "");
  const [reason, setReason] = useState(l.reason || "");
  const [status, setStatus] = useState(l.status || "approved");
  const [notes, setNotes] = useState(l.approvalNotes || "");
  const [update, { isLoading }] = useUpdateStaffLoanMutation();

  const n = Math.max(1, Math.round(Number(months) || 1));
  const total = Number(amount) || 0;
  const emi = Math.ceil(total / n);

  const save = async () => {
    if (!(total > 0)) return toast.warning("Enter the amount");
    if (!date) return toast.warning("Pick the day");
    // the same schedule the loan form builds: equal months, the last takes the rest
    const base = start ? new Date(start) : new Date();
    base.setDate(1);
    const installments = Array.from({ length: n }, (_, i) => {
      const d = new Date(base);
      d.setMonth(d.getMonth() + i);
      return {
        index: i + 1,
        month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        amount: i === n - 1 ? total - emi * (n - 1) : emi,
        status: "pending",
        paidAt: null,
      };
    });
    try {
      await update({
        companyId,
        branchId,
        id: l.id,
        user: getSessionUser(),
        data: {
          amount: total,
          durationMonths: n,
          emi,
          reason: reason.trim(),
          date,
          repaymentStartDate: start || null,
          installments,
          totalPaid: 0,
          remainingAmount: total,
          status,
          approvalNotes: notes.trim(),
        },
      }).unwrap();
      toast.success("Loan updated", { description: `${l.staffName || "Staff"} · ${money(total)}` });
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Couldn't update the loan", { description: "Check your connection and try again." });
    }
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title="Change staff loan"
      description={l.staffName}
      footer={
        <>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-subtle">
              {n} × {money(emi)}
            </p>
            <p className="truncate text-lg font-bold tabular-nums text-fg">{money(total)}</p>
          </div>
          <Button variant="ghost" size="lg" onClick={onClose}>
            Cancel
          </Button>
          <Button size="lg" onClick={save} loading={isLoading}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Day">{() => <DatePicker size="lg" value={date} onChange={setDate} />}</Field>
        <Field label="Amount">{({ id }) => <MoneyInput id={id} currency={currency} value={amount} onValueChange={setAmount} />}</Field>
        <Field label="Paid back over (months)">{({ id }) => <Input id={id} size="lg" type="number" min={1} inputMode="numeric" value={months} onChange={(e) => setMonths(e.target.value)} />}</Field>
        <Field label="First month taken back">{() => <DatePicker size="lg" value={start} onChange={setStart} />}</Field>
      </div>
      <Field label="Reason" className="mt-5">
        {({ id }) => <Textarea id={id} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />}
      </Field>
      <p className="mb-2 mt-5 text-xs font-semibold text-muted">Status</p>
      <div className="flex flex-wrap gap-2">
        {["pending", "approved", "rejected"].map((s) => (
          <Chip key={s} on={status === s} onClick={() => setStatus(s)}>
            {STATUS[s]}
          </Chip>
        ))}
      </div>
      {status !== "approved" && <p className="mt-2 text-xs text-warning">Only approved loans are counted in this report.</p>}
      <Field label="Approval note" className="mt-5">
        {({ id }) => <Textarea id={id} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />}
      </Field>
    </Sheet>
  );
}

/** Ask, then delete a staff loan. */
export function useDeleteLoan({ companyId, branchId, money }) {
  const [del] = useDeleteStaffLoanMutation();
  return async (l, done) => {
    const ok = await confirmDialog({
      title: "Delete this staff loan?",
      message: `${l.staffName || "Staff"} · ${money(l.amount)} on ${day(l.date, "d MMM yyyy")}. This can't be undone.`,
      danger: true,
    });
    if (!ok) return;
    try {
      await del({ companyId, branchId, id: l.id, user: getSessionUser() }).unwrap();
      done?.();
      toast.success("Staff loan deleted");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't delete the staff loan");
    }
  };
}
