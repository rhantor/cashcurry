"use client";
import { businessToday } from "@/lib/region";
import React, { useMemo, useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { AlertTriangle, Wallet } from "lucide-react";
import { formatMoney } from "@/lib/region/currency";
import useCurrency from "@/app/hooks/useCurrency";
import { Button, DatePicker, Field, Sheet, Textarea, cn } from "@/app/components/ui";
import MoneyInput from "@/app/components/entry/MoneyInput";
import ProofUpload from "@/app/components/entry/ProofUpload";
import { Chip, PaidFromChoice } from "@/app/components/entry/Choices";

const BANK_METHODS = [
  ["bank_transfer", "Bank transfer"],
  ["online", "Online"],
  ["qr", "QR"],
  ["card", "Card"],
];

// money in cents, so 0.1 + 0.2 compares as 0.30
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const nice = (k) => (/^\d{4}-\d{2}-\d{2}$/.test(k || "") ? format(parseISO(k), "d MMM") : k || "");

/**
 * Pay one vendor's ticked bills: how much goes to each (all of it by default;
 * less for a part payment, 0 to leave one), from the till or the bank, on
 * which day, with the receipt. A part payment needs a note saying why.
 * onConfirm({ vendorId, vendorName, allocations, paidFrom, paidMethod, note, file, paymentDate })
 */
export default function PayBillsModal({ open, onClose, bills = [], onConfirm }) {
  const currency = useCurrency();
  const fmt = (v) => formatMoney(Number(v || 0), currency);
  const [allocs, setAllocs] = useState([]);
  const [paidFrom, setPaidFrom] = useState("front");
  const [method, setMethod] = useState("cash");
  const [note, setNote] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [paymentDate, setPaymentDate] = useState(() => businessToday());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (open) {
      setAllocs(bills.map((b) => ({ billId: b.id, amount: r2(b.balance) })));
      setPaidFrom("front");
      setMethod("cash");
      setNote("");
      setFile(null);
      setPreview(null);
      setPaymentDate(businessToday());
      setTried(false);
    }
  }, [open, bills]);

  const amountOf = (id) => allocs.find((x) => x.billId === id)?.amount ?? 0;
  const total = useMemo(() => r2(allocs.reduce((s, a) => s + Number(a.amount || 0), 0)), [allocs]);
  const totalBalance = useMemo(() => r2(bills.reduce((s, b) => s + Number(b.balance || 0), 0)), [bills]);
  const vendorName = bills[0]?.vendorName || "";
  const vendorId = bills[0]?.vendorId || "";

  const setAmount = (billId, v) => setAllocs((prev) => prev.map((a) => (a.billId === billId ? { ...a, amount: r2(v) } : a)));

  const over = bills.some((b) => amountOf(b.id) > r2(b.balance));
  const isPartial = bills.some((b) => {
    const a = amountOf(b.id);
    return a > 0 && a < r2(b.balance);
  });
  const problems = [
    total <= 0 && "Enter what you're paying.",
    over && "A bill can't be paid more than it owes.",
    paidFrom === "back" && !method && "Pick how the bank paid.",
    isPartial && !note.trim() && "Say why it's a part payment.",
    !file && "Add the receipt or transfer slip.",
    !paymentDate && "Pick the day it was paid.",
  ].filter(Boolean);
  const valid = problems.length === 0;

  const submit = async () => {
    setTried(true);
    if (!valid || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onConfirm({
        vendorId,
        vendorName,
        allocations: allocs.filter((a) => Number(a.amount) > 0),
        paidFrom,
        paidMethod: paidFrom === "front" ? "cash" : method,
        note,
        file,
        paymentDate,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const left = r2(Math.max(0, totalBalance - total));

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`Pay ${vendorName}`}
      description={`${bills.length} bill${bills.length === 1 ? "" : "s"} · ${fmt(totalBalance)} owed`}
      footer={
        <div className="space-y-2 sm:flex sm:items-center sm:gap-3 sm:space-y-0">
          <p className={cn("min-w-0 text-xs sm:flex-1 sm:truncate", tried && !valid ? "text-danger" : "text-muted")}>
            {valid ? (left > 0 ? `${fmt(left)} stays owed` : "Pays these bills off") : problems[0]}
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button icon={Wallet} className="flex-1 sm:flex-none" loading={isSubmitting} disabled={tried && !valid} onClick={submit}>
              Pay {fmt(total)}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        {/* what goes to each bill */}
        <section>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle">How much to each bill</p>
            {total !== totalBalance && (
              <button type="button" className="text-xs font-semibold text-brand hover:underline" onClick={() => setAllocs(bills.map((b) => ({ billId: b.id, amount: r2(b.balance) })))}>
                Pay all in full
              </button>
            )}
          </div>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
            {bills.map((b) => {
              const amt = amountOf(b.id);
              const bal = r2(b.balance);
              const bad = amt > bal;
              const overdue = b.dueDate && b.dueDate < businessToday();
              return (
                <li key={b.id} className={cn("flex items-center gap-3 p-3", bad && "bg-danger-soft/50")}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-fg">{b.invoiceNo || b.reference || "No invoice no."}</p>
                    <p className={cn("truncate text-[11px]", overdue ? "text-danger" : "text-muted")}>
                      owes {fmt(bal)}
                      {b.dueDate ? ` · ${overdue ? "was due" : "due"} ${nice(b.dueDate)}` : ""}
                    </p>
                    <div className="mt-1 flex gap-1">
                      <Chip on={amt === bal} onClick={() => setAmount(b.id, bal)} className="px-2 py-0.5 text-[11px]">
                        All
                      </Chip>
                      <Chip on={amt === 0} onClick={() => setAmount(b.id, 0)} className="px-2 py-0.5 text-[11px]">
                        Not now
                      </Chip>
                    </div>
                  </div>
                  <div className="w-36 shrink-0">
                    <MoneyInput currency={currency} value={amt ? String(amt) : ""} onValueChange={(v) => setAmount(b.id, v)} invalid={bad} aria-label={`Pay to ${b.invoiceNo || "bill"}`} />
                    {bad && <p className="mt-1 text-right text-[11px] text-danger">More than it owes</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {/* where from */}
        <section className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle">Paid from</p>
          <PaidFromChoice
            value={paidFrom}
            onChange={(v) => {
              setPaidFrom(v);
              setMethod(v === "front" ? "cash" : "");
            }}
            tillNote="Cash from the front office"
            bankNote="Transfer, QR or card"
          />
          {paidFrom === "back" && (
            <div className="flex flex-wrap gap-1.5">
              {BANK_METHODS.map(([v, label]) => (
                <Chip key={v} on={method === v} onClick={() => setMethod(v)}>
                  {label}
                </Chip>
              ))}
            </div>
          )}
          <Field label="Paid on">{() => <DatePicker value={paymentDate} onChange={setPaymentDate} max={businessToday()} />}</Field>
        </section>

        {isPartial && (
          <p className="flex gap-2 rounded-xl bg-warning-soft px-3 py-2.5 text-xs text-fg">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
            Part payment — the rest stays owed on the bill. Add a note saying why.
          </p>
        )}
        <Field label="Note" hint={isPartial ? "Needed for a part payment" : "Optional"}>
          {({ id }) => (
            <Textarea
              id={id}
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={isPartial ? "e.g. rest next week, short of cash" : "e.g. transfer ref, who took it"}
              className={cn(tried && isPartial && !note.trim() && "border-danger")}
            />
          )}
        </Field>

        <ProofUpload
          label="Receipt or transfer slip"
          pdf
          required
          invalid={tried && !file}
          pageDrop={false}
          shrink={{ maxMB: 0.6, maxSide: 1600 }}
          file={file}
          preview={preview}
          onPick={(f, url) => {
            setFile(f);
            setPreview(f && !/pdf/i.test(f.type) ? url : null);
          }}
          onRemove={() => {
            setFile(null);
            setPreview(null);
          }}
        />
      </div>
    </Sheet>
  );
}
