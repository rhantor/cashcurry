"use client";
import { useState } from "react";
import { format, isValid, parseISO } from "date-fns";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { useDeleteSalaryEntryMutation, useUpdateSalaryEntryMutation } from "@/lib/redux/api/salaryApiSlice";
import { getSessionUser } from "@/lib/session";
import { exportOneSalaryToExcel, exportOneSalaryToPDF, shareSalary } from "@/app/export/exportSalary";
import RecordSheet from "@/app/components/entry/RecordSheet";
import MoneyInput from "@/app/components/entry/MoneyInput";
import ProofUpload from "@/app/components/entry/ProofUpload";
import { Chip, PaidFromChoice } from "@/app/components/entry/Choices";
import { Button, DatePicker, Field, Sheet, Textarea, confirmDialog, toast } from "@/app/components/ui";

import { personName } from "@/lib/people";
// the same ways the salary entry form offers
const METHODS = { cash: "Cash", bank_transfer: "Bank transfer", card: "Card", qr: "QR", online: "Online", cheque: "Cheque" };
export const monthText = (m, f = "MMMM yyyy") => (m && /^\d{4}-\d{2}/.test(m) ? format(parseISO(`${m.slice(0, 7)}-01`), f) : "");
const day = (v, f = "EEE, d MMM yyyy") => {
  const d = typeof v === "string" ? parseISO(v) : v ? new Date(v) : null;
  return d && isValid(d) ? format(d, f) : "";
};
export const fromPayroll = (s) => s?.source === "payroll";
export const amountOf = (s) => Number(s.totalSalary ?? s.amount ?? s.netPay) || 0;

/** One salary record as a slip; a payroll one shows its pay breakdown and is changed from Payroll. */
export function SalaryRecord({ s, branch, money, canEdit, onClose, onEdit, onDelete }) {
  const payroll = fromPayroll(s);
  const pos = (v) => Number(v) > 0;
  const earn = payroll
    ? [
        ["Basic pay", s.basePay],
        ["Allowance", s.allowance],
        [`Overtime${s.otHours ? ` (${s.otHours}h)` : ""}`, s.otPay],
        ["Public holiday", s.phPay],
        ["Bonus", s.bonus],
        ["Other earnings", s.otherEarnings],
      ].filter(([, v]) => pos(v))
    : [];
  const less = payroll
    ? [
        ...(s.statutory || []).map((x) => [`${x.name}${x.employeeRate ? ` (${x.employeeRate}%)` : ""}`, x.employeeAmt]),
        ["Advance taken back", s.advanceAmt],
        ["Loan instalment", s.loanAmt],
        ["Penalty", s.penalty],
        ["Other deductions", s.otherDeductions],
      ].filter(([, v]) => pos(v))
    : [];
  return (
    <RecordSheet
      onClose={onClose}
      title={payroll ? s.staffName || "Salary" : `Salaries · ${monthText(s.month)}`}
      branch={branch?.name}
      amount={amountOf(s)}
      amountLabel={payroll ? `Net pay · ${monthText(s.month)}` : "Salaries paid"}
      tone="out"
      money={money}
      note={payroll ? "From a payroll run — change it from Payroll." : undefined}
      rows={[
        { label: "Salary month", value: monthText(s.month) },
        { label: "Paid on", value: day(s.paymentDate) },
        { label: "Paid from", value: s.paidFromOffice === "back" ? `Bank${METHODS[s.paidMethod] ? ` · ${METHODS[s.paidMethod]}` : ""}` : s.paidFromOffice === "front" ? "Till (cash)" : METHODS[s.payMethod] || s.payMethod },
        { label: "Note", value: s.notes },
      ]}
      files={s.pdfUrl ? [s.pdfUrl] : payroll ? null : []}
      by={personName(s.createdBy)}
      at={s.createdAt}
      share={() => shareSalary(s, branch)}
      pdf={() => exportOneSalaryToPDF(s, branch)}
      excel={() => exportOneSalaryToExcel(s, branch)}
      onEdit={payroll || !canEdit ? undefined : onEdit}
      onDelete={payroll || !canEdit ? undefined : onDelete}
    >
      {payroll && (earn.length > 0 || less.length > 0) && (
        <div className="mt-4 rounded-2xl border border-line p-3 text-sm">
          {earn.map(([k, v]) => (
            <p key={k} className="flex justify-between gap-3 py-0.5">
              <span className="text-muted">{k}</span>
              <span className="tabular-nums text-fg">{money(v)}</span>
            </p>
          ))}
          {less.length > 0 && <div className="my-1.5 border-t border-dashed border-line" />}
          {less.map(([k, v]) => (
            <p key={k} className="flex justify-between gap-3 py-0.5">
              <span className="text-muted">{k}</span>
              <span className="tabular-nums text-danger">−{money(v)}</span>
            </p>
          ))}
          <p className="mt-1.5 flex justify-between gap-3 border-t border-line pt-1.5 font-semibold">
            <span className="text-fg">Net pay</span>
            <span className="tabular-nums text-fg">{money(amountOf(s))}</span>
          </p>
        </div>
      )}
    </RecordSheet>
  );
}

/** Change a salary entered by hand: amount, paid on, till or bank, note, the salary sheet (PDF). */
export function SalaryEditSheet({ s, companyId, branchId, currency, money, onClose }) {
  const [amount, setAmount] = useState(String(amountOf(s) || ""));
  const [paymentDate, setPaymentDate] = useState(s.paymentDate || "");
  const [office, setOffice] = useState(s.paidFromOffice || "front");
  const [method, setMethod] = useState(s.paidMethod || "cash");
  const [notes, setNotes] = useState(s.notes || "");
  const [pdf, setPdf] = useState(null);
  const [preview, setPreview] = useState(s.pdfUrl || null);
  const [removed, setRemoved] = useState(false);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [update] = useUpdateSalaryEntryMutation();

  const pickOffice = (o) => {
    setOffice(o);
    if (o === "front") setMethod("cash");
    else if (method === "cash") setMethod("bank_transfer");
  };

  // the same path the salary entry form writes to
  const upload = () => {
    const task = uploadBytesResumable(ref(storage, `salarySheets/${companyId}/${branchId}/${s.month || "unknown"}-${Date.now()}.pdf`), pdf);
    return new Promise((resolve, reject) => {
      task.on("state_changed", (x) => setProgress((x.bytesTransferred / x.totalBytes) * 100), reject, async () => resolve(await getDownloadURL(task.snapshot.ref)));
    });
  };

  const save = async () => {
    if (!(Number(amount) > 0)) return toast.warning("Enter the amount");
    if (!paymentDate) return toast.warning("Pick the day it was paid");
    setBusy(true);
    try {
      const data = {
        amount: Number(amount),
        totalSalary: Number(amount),
        paymentDate,
        paymentMonth: paymentDate.slice(0, 7),
        paidFromOffice: office,
        paidMethod: office === "front" ? "cash" : method,
        notes: notes.trim(),
      };
      // only touch the sheet when it changed, so an unrelated edit never drops it
      if (pdf) data.pdfUrl = await upload();
      else if (removed && s.pdfUrl) data.pdfUrl = "";
      await update({ companyId, branchId, entryId: s.id, user: getSessionUser(), data }).unwrap();
      toast.success("Salary updated", { description: `${monthText(s.month)} · ${money(amount)}` });
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Couldn't update the salary", { description: "Check your connection and try again." });
    } finally {
      setBusy(false);
    }
  };

  const uploading = progress > 0 && progress < 100;
  return (
    <Sheet
      open
      onClose={onClose}
      title="Change salaries"
      description={`${monthText(s.month)} salary`}
      footer={
        <>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-subtle">{monthText(s.month, "MMM yyyy")}</p>
            <p className="truncate text-lg font-bold tabular-nums text-fg">{money(amount || 0)}</p>
          </div>
          <Button variant="ghost" size="lg" onClick={onClose}>
            Cancel
          </Button>
          <Button size="lg" onClick={save} loading={busy && !uploading} disabled={uploading}>
            {uploading ? "Uploading…" : "Save"}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Amount">{({ id }) => <MoneyInput id={id} currency={currency} value={amount} onValueChange={setAmount} />}</Field>
        <Field label="Paid on">{() => <DatePicker size="lg" value={paymentDate} onChange={setPaymentDate} />}</Field>
      </div>

      <p className="mb-2 mt-5 text-xs font-semibold text-muted">Paid from</p>
      <PaidFromChoice value={office} onChange={pickOffice} bankNote="Transfer, card, QR, online" />
      {office === "back" && (
        <div className="mt-3 flex flex-wrap gap-2">
          {["bank_transfer", "card", "qr", "online"].map((m) => (
            <Chip key={m} on={method === m} onClick={() => setMethod(m)}>
              {METHODS[m]}
            </Chip>
          ))}
        </div>
      )}

      <Field label="Note" className="mt-5">
        {({ id }) => <Textarea id={id} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />}
      </Field>

      <div className="mt-5">
        <ProofUpload
          label="Salary sheet (PDF)"
          pdfOnly
          pageDrop={false}
          file={pdf}
          preview={preview}
          progress={progress}
          onPick={(f, url) => {
            setPdf(f);
            setPreview(url);
            setRemoved(false);
          }}
          onRemove={() => {
            setPdf(null);
            setPreview(null);
            setRemoved(true);
            setProgress(0);
          }}
        />
      </div>
    </Sheet>
  );
}

/** Ask, then delete a salary entered by hand. */
export function useDeleteSalary({ companyId, branchId, money }) {
  const [del] = useDeleteSalaryEntryMutation();
  return async (s, done) => {
    const ok = await confirmDialog({
      title: "Delete these salaries?",
      message: `${monthText(s.month)} · ${money(amountOf(s))}. This can't be undone.`,
      danger: true,
    });
    if (!ok) return;
    try {
      await del({ companyId, branchId, salaryId: s.id, user: getSessionUser() }).unwrap();
      done?.();
      toast.success("Salaries deleted");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't delete the salaries");
    }
  };
}
