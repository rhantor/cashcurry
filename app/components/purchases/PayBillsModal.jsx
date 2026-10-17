"use client";
import { businessToday } from "@/lib/region";
import React, { useMemo, useEffect, useState } from "react";
import { formatMoney } from "@/utils/formatMoney";
import useCurrency from "@/app/hooks/useCurrency";
import UploadInvoice from "@/app/components/purchases/UploadInvoice";

export default function PayBillsModal({
  open,
  onClose,
  bills = [], // [{id, invoiceNo, balance, ...}]
  onConfirm, // async(payload)
}) {
  const currency = useCurrency();
  const fmt = (v) => formatMoney(v, currency);
  const [allocs, setAllocs] = useState([]);
  const [paidFrom, setPaidFrom] = useState("front");
  const [method, setMethod] = useState("cash");
  const [note, setNote] = useState("");
  const [file, setFile] = useState(null);
  const [paymentDate, setPaymentDate] = useState(() => businessToday());
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setAllocs(
        bills.map((b) => ({ billId: b.id, amount: Number(b.balance) }))
      );
      setPaidFrom("front");
      setMethod("cash");
      setNote("");
      setFile(null);
      setPaymentDate(businessToday());
    }
  }, [open, bills]);

  const total = useMemo(
    () => allocs.reduce((s, a) => s + Number(a.amount || 0), 0),
    [allocs]
  );

  const totalBalance = useMemo(
    () => bills.reduce((s, b) => s + Number(b.balance || 0), 0),
    [bills]
  );

  const vendorName = bills[0]?.vendorName || "";
  const vendorId = bills[0]?.vendorId || "";

  const setAmount = (billId, v) => {
    const n = Number(v);
    setAllocs((prev) =>
      prev.map((a) =>
        a.billId === billId ? { ...a, amount: isNaN(n) ? 0 : n } : a
      )
    );
  };

  const fillFull = () =>
    setAllocs(bills.map((b) => ({ billId: b.id, amount: Number(b.balance) })));

  const isPartial = useMemo(() => {
    return bills.some((b) => {
      const a = allocs.find((x) => x.billId === b.id)?.amount ?? 0;
      return a > 0 && a < Number(b.balance);
    });
  }, [bills, allocs]);

  const basicValid =
    total > 0 &&
    !bills.some((b) => {
      const a = allocs.find((x) => x.billId === b.id);
      return !a || a.amount < 0 || a.amount > Number(b.balance);
    }) &&
    !(paidFrom === "back" && !method);

  const valid = basicValid && (!isPartial || note.trim().length > 0) && !!file && !!paymentDate;

  if (!open) return null;

  // Payment progress percentage
  const payPercent = totalBalance > 0 ? Math.min(100, Math.round((total / totalBalance) * 100)) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full sm:max-w-xl sm:rounded-2xl bg-surface rounded-t-2xl max-h-[92vh] flex flex-col shadow-2xl">

        {/* ─── Header ─── */}
        <div className="relative px-5 sm:px-6 py-4 border-b border-line bg-gradient-to-r from-surface-2 to-white flex-shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-fg tracking-tight">
                Record Payment
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-info-soft text-info text-xs font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                  {vendorName}
                </span>
                <span className="text-xs text-subtle">
                  {bills.length} {bills.length === 1 ? "bill" : "bills"} selected
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-subtle hover:text-muted hover:bg-surface-2 transition-all"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* ─── Scrollable Body ─── */}
        <div className="px-5 sm:px-6 pb-28 sm:pb-6 pt-4 overflow-y-auto flex-1 space-y-5">

          {/* ── Summary Cards ── */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-surface-2/60 rounded-xl p-3 border border-line">
              <div className="text-[10px] sm:text-xs font-semibold text-subtle uppercase tracking-wider">Outstanding</div>
              <div className="text-sm sm:text-base font-bold text-fg mt-1">{fmt(totalBalance)}</div>
            </div>
            <div className="bg-brand-soft rounded-xl p-3 border border-brand/20">
              <div className="text-[10px] sm:text-xs font-semibold text-brand uppercase tracking-wider">Paying Now</div>
              <div className="text-sm sm:text-base font-bold text-brand mt-1">{fmt(total)}</div>
            </div>
            <div className="bg-warning-soft rounded-xl p-3 border border-warning/30">
              <div className="text-[10px] sm:text-xs font-semibold text-warning uppercase tracking-wider">Remaining</div>
              <div className="text-sm sm:text-base font-bold text-warning mt-1">{fmt(Math.max(0, totalBalance - total))}</div>
            </div>
          </div>

          {/* ── Payment Progress Bar ── */}
          <div>
            <div className="flex items-center justify-between text-xs text-muted mb-1.5">
              <span>Payment Coverage</span>
              <span className={`font-semibold ${payPercent === 100 ? 'text-brand' : 'text-warning'}`}>
                {payPercent}%
              </span>
            </div>
            <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  payPercent === 100 ? 'bg-brand' : payPercent > 0 ? 'bg-orange-400' : 'bg-surface-2'
                }`}
                style={{ width: `${payPercent}%` }}
              />
            </div>
          </div>

          {/* ── Allocations Section ── */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-sm font-bold text-fg uppercase tracking-wider flex items-center gap-2">
                <svg className="w-4 h-4 text-subtle" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Bill Allocation
              </h3>
              <button
                onClick={fillFull}
                className="px-3 py-1.5 rounded-lg bg-brand-soft hover:bg-brand-soft text-brand text-xs font-medium transition-colors border border-brand/30"
              >
                Fill Full Balance
              </button>
            </div>

            {/* Hint for new users */}
            <div className="flex items-start gap-2 px-3 py-2 mb-2.5 rounded-lg bg-info-soft/70 border border-info/20 text-info text-xs leading-relaxed">
              <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>
                <strong>Tip:</strong> You can edit the <strong>Pay Amount</strong> for each bill to make a <strong>partial payment</strong>. Set it to <strong>0</strong> to skip a bill, or enter any amount up to the balance.
              </span>
            </div>

            {isPartial && (
              <div className="flex items-center gap-2 px-3 py-2 mb-2.5 rounded-lg bg-warning-soft border border-warning/30 text-warning text-xs">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <span>Partial payment detected — a note is required to explain the reason</span>
              </div>
            )}

            <div className="max-h-52 overflow-auto border border-line rounded-xl">
              <table className="min-w-full text-sm">
                <thead className="text-left sticky top-0 bg-surface-2/60/95 backdrop-blur">
                  <tr>
                    <th className="py-2.5 px-3 text-xs font-semibold text-muted uppercase tracking-wider">Invoice #</th>
                    <th className="py-2.5 px-3 text-right text-xs font-semibold text-muted uppercase tracking-wider">Balance Due</th>
                    <th className="py-2.5 px-3 text-right text-xs font-semibold text-muted uppercase tracking-wider">
                      Pay Amount
                      <div className="font-normal normal-case text-[10px] text-subtle tracking-normal mt-0.5">editable</div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {bills.map((b) => {
                    const a = allocs.find((x) => x.billId === b.id);
                    const amt = a?.amount ?? 0;
                    const invalid = amt < 0 || amt > Number(b.balance);
                    const isFull = amt === Number(b.balance);
                    return (
                      <tr key={b.id} className={`transition-colors ${invalid ? 'bg-danger-soft/50' : ''}`}>
                        <td className="py-2.5 px-3">
                          <div className="font-medium text-fg">{b.invoiceNo || b.reference || 'N/A'}</div>
                          {b.dueDate && (
                            <div className="text-[10px] text-subtle mt-0.5">Due: {b.dueDate}</div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium text-muted tabular-nums">
                          {fmt(b.balance)}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="relative inline-flex items-center">
                            <input
                              type="number"
                              inputMode="decimal"
                              className={`border rounded-lg p-2 w-28 text-right text-sm font-medium transition-colors ${
                                invalid
                                  ? "border-danger/30 bg-danger-soft text-danger"
                                  : isFull
                                  ? "border-brand/30 bg-brand-soft text-brand"
                                  : "border-line bg-surface text-fg"
                              }`}
                              value={amt}
                              min={0}
                              max={Number(b.balance)}
                              step="0.01"
                              onChange={(e) => setAmount(b.id, e.target.value)}
                            />
                            {isFull && (
                              <span className="absolute -top-1 -right-1 w-4 h-4 bg-brand rounded-full flex items-center justify-center">
                                <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              </span>
                            )}
                          </div>
                          {invalid && (
                            <p className="text-[10px] text-danger mt-1">Exceeds balance</p>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Payment Method Section ── */}
          <div>
            <h3 className="text-sm font-bold text-fg uppercase tracking-wider flex items-center gap-2 mb-3">
              <svg className="w-4 h-4 text-subtle" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              Payment Method
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-muted uppercase tracking-wider flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Date
                </label>
                <input
                  type="date"
                  className="mt-1.5 w-full border border-line rounded-xl p-2.5 text-sm font-medium text-fg bg-surface focus:ring-2 focus:ring-[var(--cc-ring)] focus:border-brand transition-all"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  max={businessToday()}
                  required
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted uppercase tracking-wider">Paid From</label>
                <select
                  className="mt-1.5 w-full border border-line rounded-xl p-2.5 text-sm font-medium text-fg bg-surface focus:ring-2 focus:ring-[var(--cc-ring)] focus:border-brand transition-all"
                  value={paidFrom}
                  onChange={(e) => {
                    const v = e.target.value;
                    setPaidFrom(v);
                    if (v === "front") setMethod("cash");
                    if (v === "back" && method === "cash") setMethod("");
                  }}
                >
                  <option value="front">Front Office (Cash)</option>
                  <option value="back">Back Office (Bank)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted uppercase tracking-wider">Method</label>
                <select
                  className={`mt-1.5 w-full border rounded-xl p-2.5 text-sm font-medium transition-all focus:ring-2 focus:ring-[var(--cc-ring)] focus:border-brand ${
                    paidFrom === "back" && !method
                      ? "border-danger/30 bg-danger-soft text-danger"
                      : "border-line bg-surface text-fg"
                  }`}
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                >
                  {paidFrom === "front" ? (
                    <option value="cash">Cash</option>
                  ) : (
                    <>
                      <option value="">Select method...</option>
                      <option value="card">Card</option>
                      <option value="qr">QR</option>
                      <option value="online">Online Transfer</option>
                      <option value="bank_transfer">Bank Transfer</option>
                    </>
                  )}
                </select>
                {paidFrom === "back" && !method && (
                  <p className="text-[10px] text-danger mt-1">Please select a payment method</p>
                )}
              </div>
            </div>
          </div>

          {/* ── Note ── */}
          <div>
            <label className="text-xs font-medium text-muted uppercase tracking-wider flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Note
              {isPartial && <span className="text-danger font-bold">*</span>}
              <span className="font-normal normal-case text-subtle ml-1">
                {isPartial ? "(required for partial)" : "(optional)"}
              </span>
            </label>
            <textarea
              className={`mt-1.5 w-full border rounded-xl p-3 text-sm transition-all focus:ring-2 focus:ring-[var(--cc-ring)] focus:border-brand resize-none ${
                isPartial && !note.trim()
                  ? "border-danger/30 bg-danger-soft/50"
                  : "border-line bg-surface"
              }`}
              placeholder={
                isPartial
                  ? "Explain why this is a partial payment..."
                  : "Add a reference note for this payment"
              }
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            {isPartial && !note.trim() && (
              <p className="text-[10px] text-danger mt-1 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
                </svg>
                A note is required when making a partial payment
              </p>
            )}
          </div>

          {/* ── Payment Proof Upload ── */}
          <div>
            <label className="text-xs font-medium text-muted uppercase tracking-wider flex items-center gap-1 mb-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              Payment Proof
              <span className="text-danger font-bold">*</span>
              <span className="font-normal normal-case text-subtle ml-1">(receipt / transfer slip)</span>
            </label>
            <div className={`rounded-xl border-2 border-dashed p-1 transition-all ${
              file
                ? "border-brand/30 bg-brand-soft/30"
                : "border-line bg-surface-2/60/50"
            }`}>
              <UploadInvoice file={file} onChange={setFile} allowCamera={true} />
            </div>
            {!file && (
              <p className="text-[10px] text-subtle mt-1.5 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Upload a photo or scan of the payment receipt. This is required.
              </p>
            )}
          </div>
        </div>

        {/* ─── Sticky Footer ─── */}
        <div className="flex-shrink-0 fixed bottom-0 left-0 right-0 sm:static bg-surface border-t border-line p-3 sm:p-4 flex items-center justify-between gap-3">
          <div className="text-xs text-subtle hidden sm:block">
            {valid ? (
              <span className="text-brand font-medium flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Ready to submit
              </span>
            ) : (
              <span className="text-subtle flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                {!file ? "Upload payment proof" : total <= 0 ? "Enter pay amount" : "Complete required fields"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-surface-2 hover:bg-surface-2 text-fg text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              className={`flex-1 sm:flex-none px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                valid && !isSubmitting
                  ? "bg-brand text-brand-fg hover:bg-brand shadow-sm hover:shadow-md"
                  : "bg-surface-2 text-subtle cursor-not-allowed"
              }`}
              disabled={!valid || isSubmitting}
              onClick={async () => {
                setIsSubmitting(true);
                try {
                  const cleanAllocs = allocs.filter((a) => Number(a.amount) > 0);
                  await onConfirm({
                    vendorId,
                    vendorName,
                    allocations: cleanAllocs,
                    paidFrom,
                    paidMethod: paidFrom === "front" ? "cash" : method,
                    note,
                    file, // pass the file to parent 
                    paymentDate, // pass the selected date
                  });
                } finally {
                  setIsSubmitting(false);
                }
              }}
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Processing...
                </span>
              ) : (
                `Confirm ${fmt(total)}`
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
