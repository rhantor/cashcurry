"use client";
import { useState } from "react";
import { format, isValid, parseISO } from "date-fns";
import { ChevronRight, FileSpreadsheet, FileText } from "lucide-react";
import { useDeleteAdvanceEntryMutation, useUpdateAdvanceEntryMutation } from "@/lib/redux/api/AdvanceApiSlice";
import { getSessionUser } from "@/lib/session";
import { exportAdvanceStaffDetailToExcel, exportAdvanceStaffDetailToPDF, exportAdvanceToExcel, exportAdvanceToPDF, shareAdvance } from "@/app/export/exportAdvanceData";
import RecordSheet from "@/app/components/entry/RecordSheet";
import MoneyInput from "@/app/components/entry/MoneyInput";
import { Chip } from "@/app/components/entry/Choices";
import { Avatar, Badge, Button, DatePicker, Field, Sheet, Textarea, confirmDialog, toast } from "@/app/components/ui";

import { personName } from "@/lib/people";
export const ADVANCE_TYPES = { salary: "Salary advance", emergency: "Emergency", personal: "Personal" };
const STATUS = { pending: "Waiting for approval", approved: "Approved", rejected: "Rejected", closed: "Paid back" };

const day = (v, f = "EEE, d MMM yyyy") => {
  const d = typeof v === "string" ? parseISO(v) : v ? new Date(v) : null;
  return d && isValid(d) ? format(d, f) : "";
};
const monthText = (m) => (m && /^\d{4}-\d{2}$/.test(m) ? format(parseISO(`${m}-01`), "MMMM yyyy") : m || "");

/** How much of an advance has come back through payroll so far. */
export const paidBack = (a) => Number(a.totalPaid) || (a.status === "closed" ? Number(a.amount) || 0 : 0);
/** Once payroll has taken any of it back, it is changed from Payroll, not here. */
export const lockedByPayroll = (a) => a.status === "closed" || paidBack(a) > 0 || a.deducted === true;

export function AdvanceStatus({ a }) {
  if (a.status === "closed") return <Badge tone="info">Paid back</Badge>;
  const back = paidBack(a);
  if (back > 0) return <Badge tone="warning">Part paid back</Badge>;
  return <Badge tone="brand">Owed</Badge>;
}

/** One advance as a slip: who, how much, how it is paid back; change or delete while payroll hasn't touched it. */
export function AdvanceRecord({ a, branch, money, onClose, onEdit, onDelete }) {
  const locked = lockedByPayroll(a);
  const inst = Array.isArray(a.installments) ? a.installments : [];
  return (
    <RecordSheet
      onClose={onClose}
      title={`Advance · ${day(a.date, "EEEE, d MMMM yyyy")}`}
      branch={branch?.name}
      amount={a.amount}
      amountLabel={a.staffName || "Advance"}
      tone="out"
      money={money}
      note={locked ? "Payroll has already taken some or all of this back from salary — change it from Payroll." : undefined}
      rows={[
        { label: "Type", value: ADVANCE_TYPES[a.advanceType] || a.advanceType },
        { label: "Reason", value: a.reason },
        { label: "Status", value: a.status === "closed" ? "Paid back" : STATUS[a.status] || a.status },
        { label: "Paid from", value: a.paidFromOffice === "back" ? "Bank" : a.paidFromOffice === "front" ? "Till (cash)" : "" },
        { label: "Taken back from", value: a.deductionMonth ? `${monthText(a.deductionMonth)} salary` : "" },
        { label: "Paid back so far", value: paidBack(a) ? money(paidBack(a)) : "" },
        { label: "Still owed", value: a.status !== "closed" && Number(a.amount) - paidBack(a) > 0 ? money(Number(a.amount) - paidBack(a)) : "" },
        { label: "Approval note", value: a.approvalNotes },
      ]}
      files={null}
      by={personName(a.createdBy)}
      at={a.createdAt}
      share={() => shareAdvance(a, branch)}
      pdf={() => exportAdvanceToPDF(a, branch)}
      excel={() => exportAdvanceToExcel(a, branch)}
      onEdit={locked ? undefined : onEdit}
      onDelete={locked ? undefined : onDelete}
    >
      {inst.length > 1 && (
        <div className="mt-4 rounded-2xl border border-line p-3">
          <p className="mb-2 text-xs font-semibold text-muted">Instalments ({inst.length})</p>
          <ul className="space-y-1 text-sm">
            {inst.map((i) => (
              <li key={i.index} className="flex items-center justify-between gap-3">
                <span className="text-fg">{monthText(i.month)}</span>
                <span className="flex items-center gap-2">
                  <span className="font-semibold tabular-nums text-fg">{money(i.amount)}</span>
                  {i.status === "paid" ? <Badge tone="info">Paid</Badge> : <Badge>Due</Badge>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </RecordSheet>
  );
}

/** Everything one staff member took in the period, newest first; tap one to open it. */
export function StaffSheet({ staff, branch, money, onClose, onOpen }) {
  const owed = staff.entries.reduce((n, a) => n + (a.status === "closed" ? 0 : Math.max(0, Number(a.amount) - paidBack(a))), 0);
  return (
    <Sheet
      open
      onClose={onClose}
      title={staff.staffName}
      description={branch?.name}
      footer={
        <>
          <Button variant="secondary" size="lg" icon={FileText} className="flex-1" onClick={() => exportAdvanceStaffDetailToPDF(staff, branch)}>
            PDF
          </Button>
          <Button variant="secondary" size="lg" icon={FileSpreadsheet} className="flex-1" onClick={() => exportAdvanceStaffDetailToExcel(staff, branch)}>
            Excel
          </Button>
        </>
      }
    >
      <div className="flex items-center gap-3">
        <Avatar name={staff.staffName} size="lg" />
        <div className="grid flex-1 grid-cols-3 gap-2 text-center">
          {[
            ["Taken", money(staff.totalAmount)],
            ["Times", staff.count],
            ["Still owed", money(owed)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-surface-2 px-2 py-2">
              <p className="text-[11px] font-semibold text-muted">{k}</p>
              <p className="truncate text-sm font-bold tabular-nums text-fg">{v}</p>
            </div>
          ))}
        </div>
      </div>
      <ul className="mt-4 divide-y divide-line">
        {staff.entries.map((a) => (
          <li key={a.id}>
            <button type="button" onClick={() => onOpen(a)} className="flex w-full items-center gap-3 py-3 text-left transition hover:bg-surface-2/60">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-fg">{day(a.date)}</span>
                <span className="block truncate text-xs text-muted">{[ADVANCE_TYPES[a.advanceType] || a.advanceType, a.reason].filter(Boolean).join(" · ") || "—"}</span>
              </span>
              <AdvanceStatus a={a} />
              <span className="font-semibold tabular-nums text-fg">{money(a.amount)}</span>
              <ChevronRight className="size-4 text-subtle" />
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

/** Change an advance that payroll hasn't touched yet: day, amount, type, reason, status, note. */
export function AdvanceEditSheet({ a, companyId, branchId, currency, money, onClose }) {
  const [date, setDate] = useState(a.date || "");
  const [amount, setAmount] = useState(a.amount != null ? String(a.amount) : "");
  const [type, setType] = useState(a.advanceType || "personal");
  const [reason, setReason] = useState(a.reason || "");
  const [status, setStatus] = useState(a.status || "approved");
  const [notes, setNotes] = useState(a.approvalNotes || "");
  const [update, { isLoading }] = useUpdateAdvanceEntryMutation();

  const save = async () => {
    if (!(Number(amount) > 0)) return toast.warning("Enter the amount");
    if (!date) return toast.warning("Pick the day");
    try {
      await update({
        companyId,
        branchId,
        id: a.id,
        user: getSessionUser(),
        data: { amount: Number(amount), advanceType: type, reason: reason.trim(), date, status, approvalNotes: notes.trim() },
      }).unwrap();
      toast.success("Advance updated", { description: `${a.staffName || "Staff"} · ${money(amount)}` });
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Couldn't update the advance", { description: "Check your connection and try again." });
    }
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title="Change advance"
      description={a.staffName}
      footer={
        <>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-subtle">{ADVANCE_TYPES[type] || "Advance"}</p>
            <p className="truncate text-lg font-bold tabular-nums text-fg">{money(amount || 0)}</p>
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
      </div>

      <p className="mb-2 mt-5 text-xs font-semibold text-muted">Type</p>
      <div className="flex flex-wrap gap-2">
        {Object.entries(ADVANCE_TYPES).map(([v, l]) => (
          <Chip key={v} on={type === v} onClick={() => setType(v)}>
            {l}
          </Chip>
        ))}
      </div>

      <Field label="Reason" className="mt-5">
        {({ id }) => <Textarea id={id} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What it was for" />}
      </Field>

      <p className="mb-2 mt-5 text-xs font-semibold text-muted">Status</p>
      <div className="flex flex-wrap gap-2">
        {["pending", "approved", "rejected"].map((s) => (
          <Chip key={s} on={status === s} onClick={() => setStatus(s)}>
            {STATUS[s]}
          </Chip>
        ))}
      </div>
      {status !== "approved" && <p className="mt-2 text-xs text-warning">Only approved advances are counted in this report.</p>}

      <Field label="Approval note" className="mt-5">
        {({ id }) => <Textarea id={id} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />}
      </Field>
    </Sheet>
  );
}

/** Ask, then delete an advance. */
export function useDeleteAdvance({ companyId, branchId, money }) {
  const [del] = useDeleteAdvanceEntryMutation();
  return async (a, done) => {
    const ok = await confirmDialog({
      title: "Delete this advance?",
      message: `${a.staffName || "Staff"} · ${money(a.amount)} on ${day(a.date, "d MMM yyyy")}. This can't be undone.`,
      danger: true,
    });
    if (!ok) return;
    try {
      await del({ companyId, branchId, id: a.id, user: getSessionUser() }).unwrap();
      done?.();
      toast.success("Advance deleted");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't delete the advance");
    }
  };
}
