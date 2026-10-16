"use client";

import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Landmark } from "lucide-react";
import { serverTimestamp } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { useAddDepositEntryMutation, useGetDepositEntryQuery } from "@/lib/redux/api/depositApiSlice";
import { useGetSingleBranchQuery } from "@/lib/redux/api/branchApiSlice";
import { exportDepositToExcel, exportDepositToPDF, shareDeposit } from "@/utils/export/exportDepositData";
import useCurrency from "@/app/hooks/useCurrency";
import useSession from "@/app/hooks/useSession";
import { useDefaultDate } from "@/app/hooks/useRegion";
import { formatMoney } from "@/lib/region/currency";
import { getSessionUser } from "@/lib/session";
import { Button, CountUp, DatePicker, Field, Input, cn, toast } from "@/app/components/ui";
import MoneyInput from "@/app/components/entry/MoneyInput";
import ProofUpload from "@/app/components/entry/ProofUpload";
import RecordSheet from "@/app/components/entry/RecordSheet";
import { EntryLayout, EntrySection, RecentEntries, SummaryLine } from "@/app/components/entry/EntryLayout";

const day = (d) => (d ? format(parseISO(d), "EEE, d MMM") : "");

/**
 * Cash deposit: cash from the till paid into the bank. Day, amount, the bank,
 * the slip's trace number and a photo (or PDF) of the slip — all needed.
 * Banks used before are one tap away.
 */
export default function DepositEntryPage() {
  const { companyId, branchId } = useSession();
  const currency = useCurrency();
  const money = (v) => formatMoney(v, currency);
  const [date, setDate, today] = useDefaultDate();
  const [amount, setAmount] = useState("");
  const [bankName, setBankName] = useState("");
  const [traceNo, setTraceNo] = useState("");
  const [receipt, setReceipt] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState(null);
  const [progress, setProgress] = useState(0);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [viewing, setViewing] = useState(null);

  const args = companyId && branchId ? { companyId, branchId } : null;
  const [addDepositEntry] = useAddDepositEntryMutation();
  const { data: deposits = [], isLoading, isError } = useGetDepositEntryQuery({ ...args, latest: 5 }, { skip: !args });
  const { data: branchData = {} } = useGetSingleBranchQuery(args ?? undefined, { skip: !args });

  // banks this branch has used, for one-tap filling
  const banks = useMemo(() => [...new Set(deposits.map((d) => String(d.bankName || "").trim()).filter(Boolean))].slice(0, 4), [deposits]);

  // a highlighted field calms down once it is filled
  const clear = (k) => setErrors((e) => (e[k] ? { ...e, [k]: undefined } : e));
  useEffect(() => (Number(amount) > 0 ? clear("amount") : undefined), [amount]);
  useEffect(() => (bankName.trim() ? clear("bank") : undefined), [bankName]);
  useEffect(() => (traceNo.trim() ? clear("trace") : undefined), [traceNo]);

  const upload = () => {
    const ext = receipt.name.split(".").pop();
    const task = uploadBytesResumable(ref(storage, `deposits/${companyId}/${branchId}/${Date.now()}.${ext}`), receipt);
    return new Promise((resolve, reject) => {
      task.on(
        "state_changed",
        (s) => setProgress((s.bytesTransferred / s.totalBytes) * 100),
        reject,
        async () => resolve(await getDownloadURL(task.snapshot.ref))
      );
    });
  };

  const save = async () => {
    if (!args || busy) return;
    const problems = {};
    if (!date) problems.date = "Pick the day";
    if (!(parseFloat(amount) > 0)) problems.amount = "Enter the amount paid in";
    if (!bankName.trim()) problems.bank = "Which bank?";
    if (!traceNo.trim()) problems.trace = "The trace number on the slip";
    if (!receipt) problems.slip = "A photo of the bank slip is needed";
    setErrors(problems);
    if (Object.keys(problems).length) return toast.error("Check the highlighted fields");

    setBusy(true);
    try {
      const fileURL = await upload();
      const createdBy = getSessionUser() || {};
      await addDepositEntry({
        companyId,
        branchId,
        data: { date, amount, bankName, traceNo, fileURL, createdAt: serverTimestamp(), createdBy: createdBy || "Unknown" },
      }).unwrap();
      toast.success("Deposit saved", { description: `${day(date)} · ${money(amount)} to ${bankName}` });
      setSaved(true);
      setTimeout(() => setSaved(false), 1400);
      setAmount("");
      setTraceNo("");
      setReceipt(null);
      setReceiptPreview(null);
      setProgress(0);
      setDate(today);
    } catch (err) {
      console.error("Deposit save failed:", err);
      toast.error("Couldn't save the deposit", { description: "Check your connection and try again." });
    } finally {
      setBusy(false);
    }
  };

  const uploading = progress > 0 && progress < 100;
  const saveButton = (
    <Button size="lg" className="w-full" onClick={save} loading={busy && !uploading} success={saved} disabled={uploading}>
      {uploading ? `Uploading slip ${Math.round(progress)}%` : "Save deposit"}
    </Button>
  );

  return (
    <>
      <EntryLayout
        aside={
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle">Into the bank</p>
              <CountUp value={Number(amount) || 0} format={money} className="mt-1 block text-3xl font-bold tracking-tight text-fg" />
              <p className="mt-0.5 text-xs text-muted">{date ? day(date) : "Pick a day"}</p>
            </div>
            <div className="space-y-2 border-t border-line pt-3">
              <SummaryLine label="Cash in the till" value={`− ${money(amount || 0)}`} />
              <SummaryLine label="Bank" value={`+ ${money(amount || 0)}`} />
              <SummaryLine label="Slip" value={receipt ? "Attached" : "Needed"} muted={!receipt} />
            </div>
            {saveButton}
          </div>
        }
        bar={
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle">Deposit</p>
              <CountUp value={Number(amount) || 0} format={money} className="block truncate text-lg font-bold tracking-tight text-fg" />
            </div>
            <div className="w-40 shrink-0">{saveButton}</div>
          </div>
        }
        below={
          <RecentEntries
            title="Latest deposits"
            viewAllHref="/reports/deposit-report"
            loading={isLoading && !!args}
            error={isError}
            money={money}
            items={deposits.map((d) => ({
              id: d.id,
              date: d.date,
              amount: d.amount,
              proof: !!d.fileURL,
              note: [d.bankName, d.traceNo && `#${d.traceNo}`].filter(Boolean).join(" · "),
              onOpen: () => setViewing(d),
            }))}
          />
        }
      >
        <EntrySection title="When and how much">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Day" error={errors.date}>
              {({ invalid }) => <DatePicker value={date} onChange={setDate} max={today} invalid={invalid} />}
            </Field>
            <Field label="Amount paid in" error={errors.amount}>
              {({ id, invalid }) => <MoneyInput id={id} currency={currency} value={amount} invalid={invalid} onValueChange={setAmount} />}
            </Field>
          </div>
        </EntrySection>

        <EntrySection title="The bank slip">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Bank" error={errors.bank}>
              {({ id, invalid }) => <Input id={id} invalid={invalid} value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="e.g. Maybank" />}
            </Field>
            <Field label="Trace number" error={errors.trace}>
              {({ id, invalid }) => <Input id={id} invalid={invalid} value={traceNo} onChange={(e) => setTraceNo(e.target.value)} placeholder="On the slip" />}
            </Field>
          </div>
          {banks.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {banks.map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setBankName(b)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition",
                    bankName === b ? "bg-info-soft text-info" : "bg-surface-2 text-muted hover:text-fg"
                  )}
                >
                  <Landmark className="size-3" /> {b}
                </button>
              ))}
            </div>
          )}
          <div className="mt-5">
            <ProofUpload
              label="Slip photo"
              pdf
              required
              invalid={!!errors.slip}
              file={receipt}
              preview={receiptPreview}
              progress={progress}
              onPick={(f, url) => {
                setReceipt(f);
                setReceiptPreview(url);
                clear("slip");
              }}
              onRemove={() => {
                setReceipt(null);
                setReceiptPreview(null);
              }}
            />
            {errors.slip && <p className="mt-2 text-xs font-medium text-danger">{errors.slip}</p>}
          </div>
        </EntrySection>
      </EntryLayout>

      {viewing && (
        <RecordSheet
          onClose={() => setViewing(null)}
          title={`Deposit · ${viewing.date ? format(parseISO(viewing.date), "EEEE, d MMMM yyyy") : ""}`}
          branch={branchData?.name}
          amount={viewing.amount}
          amountLabel="Paid into the bank"
          tone="bank"
          money={money}
          rows={[
            { label: "Bank", value: viewing.bankName },
            { label: "Trace number", value: viewing.traceNo },
          ]}
          files={viewing.fileURL ? [viewing.fileURL] : []}
          by={viewing.createdBy?.username || viewing.createdBy?.userName}
          at={viewing.createdAt}
          share={() => shareDeposit(viewing, branchData)}
          pdf={() => exportDepositToPDF(viewing, branchData)}
          excel={() => exportDepositToExcel(viewing, branchData)}
        />
      )}
    </>
  );
}
