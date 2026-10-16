"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { addMonths, format, parseISO, subMonths } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarCheck2, CircleCheck, Info, ReceiptText, ShieldAlert } from "lucide-react";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { useAddSalaryEntryMutation, useGetSalaryEntriesQuery } from "@/lib/redux/api/salaryApiSlice";
import useCurrency from "@/app/hooks/useCurrency";
import useSession from "@/app/hooks/useSession";
import { useDefaultDate } from "@/app/hooks/useRegion";
import { formatMoney } from "@/lib/region/currency";
import { getSessionUser } from "@/lib/session";
import { salaryMonth, splitSalaryMonth } from "@/lib/payroll/salaryMonth";
import { Button, Card, CountUp, DatePicker, Field, Input, confirmDialog, cn, toast } from "@/app/components/ui";
import MoneyInput from "@/app/components/entry/MoneyInput";
import ProofUpload from "@/app/components/entry/ProofUpload";
import { Chip, PaidFromChoice } from "@/app/components/entry/Choices";
import { EntryLayout, EntrySection, SummaryLine } from "@/app/components/entry/EntryLayout";

const BANK_METHODS = [
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "card", label: "Card" },
  { value: "qr", label: "QR" },
  { value: "online", label: "Online" },
];
const monthLabel = (m, f = "MMMM yyyy") => (m ? format(parseISO(`${m}-01`), f) : "");
const lastDay = (m) => format(addMonths(parseISO(`${m}-01`), 1).getTime() - 864e5, "yyyy-MM-dd");

/**
 * Salary paid outside Payroll — one total for a work month (e.g. before
 * payroll was used, or for people not on it). Payroll's "Mark as paid"
 * records salaries by itself, so a month that already has salaries — from
 * payroll or by hand — can't be entered again here; the screen says so as
 * soon as the month is picked.
 */
export default function SalaryEntryPage() {
  const { companyId, branchId } = useSession();
  const currency = useCurrency();
  const money = (v) => formatMoney(v, currency);
  const [paymentDate, setPaymentDate, today] = useDefaultDate();
  const thisMonth = (today || "").slice(0, 7);
  const [month, setMonth] = useState(null); // null = this month
  const work = month || thisMonth;
  const [total, setTotal] = useState("");
  const [office, setOffice] = useState("front");
  const [method, setMethod] = useState("bank_transfer");
  const [notes, setNotes] = useState("");
  const [pdf, setPdf] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [progress, setProgress] = useState(0);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const args = companyId && branchId ? { companyId, branchId } : null;
  const [addSalaryEntry] = useAddSalaryEntryMutation();

  // the last few work months and what each already has
  const months = useMemo(() => (thisMonth ? [4, 3, 2, 1, 0].map((n) => format(subMonths(parseISO(`${thisMonth}-01`), n), "yyyy-MM")) : []), [thisMonth]);
  const { data: entries = [], isLoading } = useGetSalaryEntriesQuery(
    { ...args, startDate: months[0], endDate: thisMonth, dateField: "month" },
    { skip: !args || !months.length }
  );
  const byMonth = useMemo(() => Object.fromEntries(months.map((m) => [m, splitSalaryMonth(entries.filter((s) => s.month === m))])), [months, entries]);
  const status = byMonth[work];
  const taken = status && (status.payroll.count > 0 || status.byHand.length > 0);

  const paidMethod = office === "front" ? "cash" : method;

  const upload = () => {
    const task = uploadBytesResumable(ref(storage, `salarySheets/${companyId}/${branchId}/${work}-${Date.now()}.pdf`), pdf);
    return new Promise((resolve, reject) => {
      task.on("state_changed", (s) => setProgress((s.bytesTransferred / s.totalBytes) * 100), reject, async () => resolve(await getDownloadURL(task.snapshot.ref)));
    });
  };

  const save = async () => {
    if (!args || busy) return;
    const problems = {};
    if (!(Number(total) > 0)) problems.total = "Enter the total paid";
    if (!paymentDate) problems.date = "Pick the day it was paid";
    setErrors(problems);
    if (Object.keys(problems).length) return toast.error("Check the highlighted fields");
    if (taken) return toast.error(`${monthLabel(work)} salaries are already recorded`, { description: "See the note under the month." });

    const ok = await confirmDialog({
      title: `Save ${money(total)} as ${monthLabel(work)} salaries?`,
      message: `Paid ${format(parseISO(paymentDate), "d MMM yyyy")} from the ${office === "back" ? `bank (${BANK_METHODS.find((m) => m.value === method)?.label})` : "till (cash)"}${pdf ? " · salary sheet attached" : ""}.`,
      confirmLabel: "Save",
    });
    if (!ok) return;

    setBusy(true);
    try {
      // the list may be out of date: ask the database once more
      const fresh = await salaryMonth(companyId, branchId, work);
      if (fresh.payroll.count || fresh.byHand.length) {
        toast.error(`${monthLabel(work)} salaries are already recorded`, { description: "Someone saved them just now." });
        return;
      }
      const uploaded = pdf ? await upload() : "";
      const createdBy = getSessionUser() || {};
      const value = Number(total) || 0;
      await addSalaryEntry({
        companyId,
        branchId,
        data: {
          month: work,
          monthStart: `${work}-01`,
          monthEnd: lastDay(work),
          paymentDate,
          paymentMonth: paymentDate ? paymentDate.slice(0, 7) : null,
          paidFromOffice: office,
          paidMethod,
          totalSalary: value,
          amount: value,
          notes,
          pdfUrl: uploaded || "",
          createdBy,
          createdAt: new Date().toISOString(),
        },
      }).unwrap();
      toast.success("Salaries saved", { description: `${monthLabel(work)} · ${money(value)}` });
      setSaved(true);
      setTimeout(() => setSaved(false), 1400);
      setTotal("");
      setNotes("");
      setPdf(null);
      setPdfUrl(null);
      setProgress(0);
    } catch (err) {
      console.error("Salary save failed:", err);
      toast.error("Couldn't save the salaries", { description: "Check your connection and try again." });
    } finally {
      setBusy(false);
    }
  };

  const uploading = progress > 0 && progress < 100;
  const saveButton = (
    <Button size="lg" className="w-full" onClick={save} loading={busy && !uploading} success={saved} disabled={uploading || taken}>
      {uploading ? `Uploading sheet ${Math.round(progress)}%` : taken ? "Already recorded" : "Save salaries"}
    </Button>
  );

  return (
    <EntryLayout
      aside={
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle">Salaries</p>
            <CountUp value={Number(total) || 0} format={money} className="mt-1 block text-3xl font-bold tracking-tight text-fg" />
            <p className="mt-0.5 text-xs text-muted">For {monthLabel(work)}</p>
          </div>
          <div className="space-y-2 border-t border-line pt-3">
            <SummaryLine label="Paid on" value={paymentDate ? format(parseISO(paymentDate), "d MMM yyyy") : "—"} />
            <SummaryLine label="From" value={office === "back" ? `Bank · ${BANK_METHODS.find((m) => m.value === method)?.label}` : "Till (cash)"} />
            <SummaryLine label="Salary sheet" value={pdf ? "Attached" : "None"} muted={!pdf} />
          </div>
          {saveButton}
        </div>
      }
      bar={
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-subtle">{monthLabel(work, "MMM yyyy")} salaries</p>
            <CountUp value={Number(total) || 0} format={money} className="block truncate text-lg font-bold tracking-tight text-fg" />
          </div>
          <div className="w-40 shrink-0">{saveButton}</div>
        </div>
      }
      below={
        <Card className="p-4 sm:p-5">
          <h3 className="mb-2 text-sm font-semibold text-fg">Salaries by month</h3>
          <ul className="divide-y divide-line">
            {[...months].reverse().map((m) => {
              const s = byMonth[m];
              const hand = s?.byHand.reduce((n, x) => n + x.amount, 0) || 0;
              const none = !s || (!s.payroll.count && !s.byHand.length);
              return (
                <li key={m} className="flex items-center gap-3 py-2.5">
                  <span className="w-20 shrink-0 text-sm font-semibold text-fg">{monthLabel(m, "MMM yyyy")}</span>
                  <span className="min-w-0 flex-1 truncate text-xs text-muted">
                    {isLoading ? "…" : none ? "Nothing yet" : [s.payroll.count && `Payroll · ${s.payroll.count} staff`, s.byHand.length && "Entered by hand"].filter(Boolean).join(" + ")}
                  </span>
                  <span className={cn("shrink-0 text-sm tabular-nums", none ? "text-subtle" : "font-bold text-fg")}>{none ? "—" : money(s.payroll.total + hand)}</span>
                </li>
              );
            })}
          </ul>
        </Card>
      }
    >
      {/* where salaries normally come from */}
      <div className="flex gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-sm">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-info-soft text-info">
          <Info className="size-4" />
        </span>
        <p className="text-xs text-muted">
          Paying staff through <Link href="/payroll" className="font-semibold text-brand hover:underline">Payroll</Link> records their salaries by itself. Use this screen
          for a month&apos;s salaries paid <b className="text-fg">outside Payroll</b>, as one total.
        </p>
      </div>

      <EntrySection title="Which work month">
        <div className="flex flex-wrap gap-2">
          {months.map((m) => {
            const s = byMonth[m];
            const has = s && (s.payroll.count || s.byHand.length);
            return (
              <Chip key={m} on={work === m} onClick={() => setMonth(m)} className="inline-flex items-center gap-1">
                {has ? <CircleCheck className="size-3.5" /> : null}
                {monthLabel(m, "MMM yyyy")}
              </Chip>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-muted">The month the work was done — pick August when paying for August.</p>

        <AnimatePresence initial={false} mode="wait">
          {taken && (
            <motion.div key={work} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-3 flex gap-3 rounded-xl bg-warning-soft px-3.5 py-3 text-sm">
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" />
              <div className="min-w-0 text-fg">
                <p className="font-semibold">{monthLabel(work)} salaries are already recorded</p>
                <p className="mt-0.5 text-xs text-muted">
                  {status.payroll.count > 0 && <>Payroll paid {status.payroll.count} staff ({money(status.payroll.total)}). </>}
                  {status.byHand.length > 0 && (
                    <>
                      Entered by hand: {money(status.byHand.reduce((n, x) => n + x.amount, 0))}
                      {status.byHand[0].paymentDate ? `, paid ${format(parseISO(status.byHand[0].paymentDate), "d MMM")}` : ""}.{" "}
                    </>
                  )}
                  Saving again would count the month twice — change the existing record in the Salaries report instead.
                </p>
              </div>
            </motion.div>
          )}
          {!taken && status && !isLoading && (
            <motion.p key={`ok-${work}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-3 flex items-center gap-1.5 text-xs font-medium text-success">
              <CalendarCheck2 className="size-3.5" /> Nothing recorded for {monthLabel(work)} yet
            </motion.p>
          )}
        </AnimatePresence>
      </EntrySection>

      <EntrySection title="How much and when">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Total paid" error={errors.total}>
            {({ id, invalid }) => (
              <MoneyInput
                id={id}
                currency={currency}
                value={total}
                invalid={invalid}
                onValueChange={(v) => {
                  setTotal(v);
                  if (Number(v) > 0) setErrors((e) => ({ ...e, total: undefined }));
                }}
              />
            )}
          </Field>
          <Field label="Paid on" error={errors.date}>
            {({ invalid }) => <DatePicker size="lg" value={paymentDate} onChange={setPaymentDate} max={today} invalid={invalid} />}
          </Field>
        </div>
      </EntrySection>

      <EntrySection title="Paid from">
        <PaidFromChoice value={office} onChange={setOffice} tillNote="Cash in hand goes down" bankNote="Card, QR, online, transfer" />
        <AnimatePresence initial={false}>
          {office === "back" && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <p className="mb-2 mt-4 text-xs font-semibold text-muted">How was it paid?</p>
              <div className="flex flex-wrap gap-2">
                {BANK_METHODS.map((m) => (
                  <Chip key={m.value} on={method === m.value} onClick={() => setMethod(m.value)}>
                    {m.label}
                  </Chip>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <Field label="Note (optional)" className="mt-4">
          {({ id }) => <Input id={id} size="lg" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Part-timers, paid by hand" />}
        </Field>
      </EntrySection>

      <EntrySection>
        <ProofUpload
          label="Salary sheet (PDF, optional)"
          pdfOnly
          file={pdf}
          preview={pdf ? pdfUrl : null}
          progress={progress}
          onPick={(f, url) => {
            setPdf(f);
            setPdfUrl(url);
          }}
          onRemove={() => {
            setPdf(null);
            setPdfUrl(null);
          }}
        />
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
          <ReceiptText className="size-3.5" /> The sheet that lists who was paid what.
        </p>
      </EntrySection>
    </EntryLayout>
  );
}
