"use client";
import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { motion } from "framer-motion";
import { ArrowRight, Landmark, Wallet } from "lucide-react";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { useAddWithdrawEntryMutation, useGetWithdrawEntriesQuery } from "@/lib/redux/api/cashWithdrawApiSlice";
import { useGetSingleBranchQuery } from "@/lib/redux/api/branchApiSlice";
import { exportWithdrawalToExcel, exportWithdrawalToPDF, shareWithdrawal } from "@/utils/export/exportWithdrawData";
import useCurrency from "@/app/hooks/useCurrency";
import useSession from "@/app/hooks/useSession";
import { useDefaultDate } from "@/app/hooks/useRegion";
import { formatMoney } from "@/lib/region/currency";
import { getSessionUser } from "@/lib/session";
import { Button, CountUp, DatePicker, Field, Input, Textarea, cn, confirmDialog, toast } from "@/app/components/ui";
import MoneyInput from "@/app/components/entry/MoneyInput";
import ProofFiles from "@/app/components/entry/ProofFiles";
import RecordSheet from "@/app/components/entry/RecordSheet";
import { EntryLayout, EntrySection, RecentEntries, SummaryLine } from "@/app/components/entry/EntryLayout";

// What the cash was taken out for (kept as stored before).
const CATEGORIES = ["Supplier Payment", "Staff Advance", "Staff Salary", "Utility Bills", "Rent/Deposit", "Maintenance", "Transport/Delivery", "Petty Cash", "Other"];
const METHODS = ["ATM Withdraw", "Online Transfer", "Other"];
const day = (d) => (d ? format(parseISO(d), "EEE, d MMM") : "");

function Chip({ on, onClick, children }) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
        on ? "border-brand bg-brand text-brand-fg" : "border-line bg-surface text-fg hover:bg-surface-2"
      )}
    >
      {children}
    </motion.button>
  );
}

/**
 * Bank to cash (stored as a withdrawal): money taken out of the bank into the till (an ATM
 * withdrawal or a transfer). Not the owner taking money — that is drawings
 * (roadmap 4.9). Day, amount, what for, how, a reference and note, and at
 * least one slip or screenshot. Asks once before saving.
 */
export default function CashWithdrawPage() {
  const { companyId, branchId } = useSession();
  const currency = useCurrency();
  const money = (v) => formatMoney(v, currency);
  const [date, setDate, today] = useDefaultDate();
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [method, setMethod] = useState(METHODS[0]);
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState([]); // [{ id, file, url }]
  const [progress, setProgress] = useState(0);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [viewing, setViewing] = useState(null);

  const args = companyId && branchId ? { companyId, branchId } : null;
  const [addWithdrawEntry] = useAddWithdrawEntryMutation();
  const { data: branchData = {} } = useGetSingleBranchQuery(args ?? undefined, { skip: !args });

  // this month's withdrawals, for the list under the form
  const month = (date || today || "").slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  const { data: rows = [], isLoading, isError } = useGetWithdrawEntriesQuery(
    { ...args, startDate: `${month}-01`, endDate: month ? `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}` : "" },
    { skip: !args || !month }
  );
  const recent = useMemo(() => [...rows].sort((a, b) => (a.date === b.date ? String(b.createdAt).localeCompare(String(a.createdAt)) : a.date < b.date ? 1 : -1)).slice(0, 5), [rows]);

  useEffect(() => setErrors((e) => (e.amount && Number(amount) > 0 ? { ...e, amount: undefined } : e)), [amount]);
  useEffect(() => setErrors((e) => (e.files && files.length ? { ...e, files: undefined } : e)), [files.length]);

  // every file at once; progress = how many are done
  const uploadAll = async () => {
    let done = 0;
    return Promise.all(
      files.map(
        ({ file }) =>
          new Promise((resolve, reject) => {
            const ext = file.name.split(".").pop();
            const path = `withdrawReceipts/${companyId}/${branchId}/${date}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}.${ext}`;
            const task = uploadBytesResumable(ref(storage, path), file);
            task.on("state_changed", null, reject, async () => {
              const url = await getDownloadURL(task.snapshot.ref);
              done += 1;
              setProgress((done / files.length) * 100);
              resolve(url);
            });
          })
      )
    );
  };

  const save = async () => {
    if (!args || busy) return;
    const problems = {};
    if (!date) problems.date = "Pick the day";
    if (!(Number(amount) > 0)) problems.amount = "Enter the amount taken out";
    if (!files.length) problems.files = "Attach the ATM slip or transfer screenshot";
    setErrors(problems);
    if (Object.keys(problems).length) return toast.error("Check the highlighted fields");

    const ok = await confirmDialog({
      title: `Move ${money(amount)} from the bank to the till?`,
      message: `${day(date)} · ${category} · ${method}${reference ? ` · ${reference}` : ""}\nThe till goes up and the bank goes down by this amount.`,
      confirmLabel: "Save",
    });
    if (!ok) return;

    setBusy(true);
    try {
      const urls = await uploadAll();
      const createdBy = getSessionUser() || {};
      await addWithdrawEntry({
        companyId,
        branchId,
        data: {
          date,
          amount: Number(amount) || 0,
          category,
          method,
          reference: reference || "",
          notes: notes || "",
          receiptUrl: urls[0] || "", // older screens read the first one
          receiptUrls: urls,
          createdBy,
          createdAt: new Date().toISOString(),
        },
      }).unwrap();
      toast.success("Bank to cash saved", { description: `${day(date)} · ${money(amount)} · ${category}` });
      setSaved(true);
      setTimeout(() => setSaved(false), 1400);
      setAmount("");
      setCategory(CATEGORIES[0]);
      setMethod(METHODS[0]);
      setReference("");
      setNotes("");
      setFiles([]);
      setProgress(0);
    } catch (err) {
      console.error("Withdrawal save failed:", err);
      toast.error("Couldn't save it", { description: "Check your connection and try again." });
    } finally {
      setBusy(false);
    }
  };

  const uploading = progress > 0 && progress < 100;
  const saveButton = (
    <Button size="lg" className="w-full" onClick={save} loading={busy && !uploading} success={saved} disabled={uploading}>
      {uploading ? `Uploading ${Math.round(progress)}%` : "Save"}
    </Button>
  );

  return (
    <>
      <EntryLayout
        aside={
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle">Bank to till</p>
              <CountUp value={Number(amount) || 0} format={money} className="mt-1 block text-3xl font-bold tracking-tight text-fg" />
              <p className="mt-0.5 text-xs text-muted">{date ? day(date) : "Pick a day"}</p>
            </div>
            <div className="space-y-2 border-t border-line pt-3">
              <SummaryLine label="Bank" value={`− ${money(amount || 0)}`} />
              <SummaryLine label="Cash in the till" value={`+ ${money(amount || 0)}`} />
              <SummaryLine label="For" value={category} />
              <SummaryLine label="Slips" value={files.length ? `${files.length} attached` : "Needed"} muted={!files.length} />
            </div>
            {saveButton}
          </div>
        }
        bar={
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle">Bank to cash</p>
              <CountUp value={Number(amount) || 0} format={money} className="block truncate text-lg font-bold tracking-tight text-fg" />
            </div>
            <div className="w-40 shrink-0">{saveButton}</div>
          </div>
        }
        below={
          <RecentEntries
            title="Bank to cash this month"
            viewAllHref="/reports/withdrawal-report"
            loading={isLoading && !!args}
            error={isError}
            money={money}
            items={recent.map((w) => ({
              id: w.id,
              date: w.date,
              amount: w.amount,
              proof: !!(w.receiptUrls?.length || w.receiptUrl),
              note: [w.category, w.method].filter(Boolean).join(" · "),
              onOpen: () => setViewing(w),
            }))}
          />
        }
      >
        {/* what this screen is for, so it isn't mistaken for the owner taking money */}
        <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-sm">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-info-soft text-info">
            <Landmark className="size-4" />
          </span>
          <ArrowRight className="size-4 shrink-0 text-subtle" />
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
            <Wallet className="size-4" />
          </span>
          <p className="min-w-0 text-xs text-muted">
            Cash taken <b className="text-fg">out of the bank into the till</b> — by ATM or transfer.
          </p>
        </div>

        <EntrySection title="When and how much">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Day" error={errors.date}>
              {({ invalid }) => <DatePicker value={date} onChange={setDate} max={today} invalid={invalid} />}
            </Field>
            <Field label="Amount taken out" error={errors.amount}>
              {({ id, invalid }) => <MoneyInput id={id} currency={currency} value={amount} invalid={invalid} onValueChange={setAmount} />}
            </Field>
          </div>
        </EntrySection>

        <EntrySection title="What for and how">
          <p className="mb-2 text-xs font-semibold text-muted">What the cash is for</p>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <Chip key={c} on={category === c} onClick={() => setCategory(c)}>
                {c}
              </Chip>
            ))}
          </div>
          <p className="mb-2 mt-5 text-xs font-semibold text-muted">How it was taken out</p>
          <div className="flex flex-wrap gap-2">
            {METHODS.map((x) => (
              <Chip key={x} on={method === x} onClick={() => setMethod(x)}>
                {x}
              </Chip>
            ))}
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Reference (optional)">
              {({ id }) => <Input id={id} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Slip or transfer number" />}
            </Field>
            <Field label="Note (optional)">
              {({ id }) => <Textarea id={id} rows={1} className="min-h-10" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything worth remembering" />}
            </Field>
          </div>
        </EntrySection>

        <EntrySection>
          <ProofFiles
            label="Slips and screenshots"
            required
            invalid={!!errors.files}
            items={files}
            onChange={setFiles}
            progress={progress}
            hint="ATM slip, bank app screenshot — add as many as you need."
          />
          {errors.files && <p className="mt-2 text-xs font-medium text-danger">{errors.files}</p>}
        </EntrySection>
      </EntryLayout>

      {viewing && (
        <RecordSheet
          onClose={() => setViewing(null)}
          title={`Bank to cash · ${viewing.date ? format(parseISO(viewing.date), "EEEE, d MMMM yyyy") : ""}`}
          branch={branchData?.name}
          amount={viewing.amount}
          amountLabel="Bank to till"
          tone="bank"
          money={money}
          rows={[
            { label: "For", value: viewing.category },
            { label: "How", value: viewing.method },
            { label: "Reference", value: viewing.reference },
            { label: "Note", value: viewing.notes },
          ]}
          files={viewing.receiptUrls?.length ? viewing.receiptUrls : viewing.receiptUrl ? [viewing.receiptUrl] : []}
          by={viewing.createdBy?.username || viewing.createdBy?.userName}
          at={viewing.createdAt}
          share={() => shareWithdrawal(viewing, branchData)}
          pdf={() => exportWithdrawalToPDF(viewing, branchData)}
          excel={() => exportWithdrawalToExcel(viewing, branchData)}
        />
      )}
    </>
  );
}
