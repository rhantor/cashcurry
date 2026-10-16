"use client";

import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarCheck2, Landmark, NotebookPen, Pencil, Wallet, X } from "lucide-react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import {
  useAddSalesEntryMutation,
  useGetSalesEntriesQuery,
  useUpdateSalesEntryMutation,
  useDeleteSalesEntryMutation,
} from "@/lib/redux/api/salesApiSlice";
import { db, storage } from "@/lib/firebase";
import { useDefaultDate } from "@/app/hooks/useRegion";
import useCurrency from "@/app/hooks/useCurrency";
import useSession from "@/app/hooks/useSession";
import { useGetBranchSettingsQuery } from "@/lib/redux/api/branchSettingsApiSlice";
import { useGetSingleBranchQuery } from "@/lib/redux/api/branchApiSlice";
import { formatMoney } from "@/lib/region/currency";
import { getSessionUser } from "@/lib/session";
import useCrudActions from "@/app/components/common/useCrudActions";
import ItemsReportModal from "@/app/reports/sales-report/SalesReportModal";
import { Badge, Button, CountUp, DatePicker, Field, Input, Skeleton, cn, confirmDialog, toast } from "@/app/components/ui";
import MoneyInput from "@/app/components/entry/MoneyInput";
import ProofUpload from "@/app/components/entry/ProofUpload";
import { EntryLayout, EntrySection, RecentEntries, SummaryLine } from "@/app/components/entry/EntryLayout";

const day = (d) => (d ? format(parseISO(d), "EEE, d MMM") : "");
const blank = (tenders) => Object.fromEntries(tenders.map((t) => [t.key, ""]));

/**
 * Sales entry: one day's takings by payment type, with the Z report photo.
 * The total, what goes to the bank and what stays in the till update as you
 * type. A day that is already in is flagged before saving, with a way to edit
 * it instead.
 */
export default function SalesEntry() {
  const { companyId, branchId, role } = useSession();
  const currency = useCurrency();
  const money = (v) => formatMoney(v, currency);
  // Defaults to today on the branch's clock, after its day cut-off.
  const [date, setDate, today] = useDefaultDate();

  const [form, setForm] = useState({});
  const [notes, setNotes] = useState({});
  const [openNote, setOpenNote] = useState(null);
  const [editing, setEditing] = useState(null); // the entry being edited
  const [viewing, setViewing] = useState(null); // the entry open in the view modal
  const [proofFile, setProofFile] = useState(null);
  const [proofPreview, setProofPreview] = useState(null);
  const [proofUrl, setProofUrl] = useState(null);
  const [progress, setProgress] = useState(0);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [nudge, setNudge] = useState(0); // shakes the "already entered" box

  const args = companyId && branchId ? { companyId, branchId } : null;
  const { data: settings, isLoading: settingsLoading } = useGetBranchSettingsQuery(args ?? undefined, { skip: !args });
  const { data: branchData = {} } = useGetSingleBranchQuery(args ?? undefined, { skip: !args });
  const [addSalesEntry, { isLoading: creating }] = useAddSalesEntryMutation();
  const { canEdit, doUpdate, updating } = useCrudActions({
    useUpdateMutationHook: useUpdateSalesEntryMutation,
    useDeleteMutationHook: useDeleteSalesEntryMutation,
  });

  const tenders = useMemo(() => {
    const list = settings?.financeSales?.tenders || [];
    return list.filter((t) => t.enabled !== false).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [settings]);

  // a field per payment type, keeping anything already typed
  useEffect(() => {
    if (!tenders.length) return;
    setForm((prev) => Object.fromEntries(tenders.map((t) => [t.key, prev?.[t.key] ?? ""])));
    setNotes((prev) => Object.fromEntries(tenders.map((t) => [t.key, prev?.[t.key] ?? ""])));
  }, [tenders]);

  // this month's sales: the recent list, the "already entered" check, the view modal's month total
  const month = (date || today || "").slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  const monthEnd = month ? `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}` : "";
  const { data: sales = [], isLoading: salesLoading, isError: salesError } = useGetSalesEntriesQuery(
    { companyId, branchId, startDate: `${month}-01`, endDate: monthEnd },
    { skip: !args || !month }
  );
  const recent = useMemo(() => [...sales].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 5), [sales]);
  const taken = sales.find((s) => s.date === date && s.id !== editing?.id);

  // figures
  const num = (k) => parseFloat(form[k]) || 0;
  const total = tenders.reduce((n, t) => n + (t.includeInTotal === false ? 0 : num(t.key)), 0);
  const banked = tenders.reduce((n, t) => n + (t.banked ? num(t.key) : 0), 0);
  const till = num("cash");
  const proofNeeded = tenders.some((t) => t.requireProof && num(t.key) > 0);
  const hasProof = !!(proofFile || proofUrl);

  const reset = () => {
    setEditing(null);
    setForm(blank(tenders));
    setNotes(blank(tenders));
    setOpenNote(null);
    setDate(today);
    setProofFile(null);
    setProofPreview(null);
    setProofUrl(null);
    setProgress(0);
    setErrors({});
  };

  const startEdit = (entry) => {
    setEditing(entry);
    setDate(entry.date);
    setForm(Object.fromEntries(tenders.map((t) => [t.key, entry[t.key] ? String(entry[t.key]) : ""])));
    setNotes({ ...blank(tenders), ...(entry.notes || {}) });
    setProofFile(null);
    setProofPreview(entry.zReportUrl || null);
    setProofUrl(entry.zReportUrl || null);
    setProgress(0);
    setErrors({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const uploadProof = () => {
    const ext = proofFile.name?.split(".").pop() || "jpg";
    const task = uploadBytesResumable(ref(storage, `zReports/${companyId}/${branchId}/${date}-${Date.now()}.${ext}`), proofFile);
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
    if (busy) return;
    const problems = {};
    if (!date) problems.date = "Pick the day these sales are for";
    if (taken) {
      setNudge((n) => n + 1);
      toast.error("This day is already entered", { description: "Edit that entry instead." });
      return;
    }
    if (proofNeeded && !hasProof) problems.proof = "A photo of the Z report is needed for these payment types";
    setErrors(problems);
    if (Object.keys(problems).length) {
      toast.error("Check the highlighted fields");
      return;
    }

    // A day with nothing taken (e.g. closed) is allowed, but asked about.
    if (!tenders.some((t) => num(t.key) > 0)) {
      const ok = await confirmDialog({
        title: `Save ${day(date)} with no sales?`,
        message: "Every amount is empty. Save it only if the restaurant took nothing that day.",
        confirmLabel: "Save with no sales",
      });
      if (!ok) return;
    }

    setBusy(true);
    try {
      // The month list may be out of date: ask the database once more before creating.
      if (!editing || editing.date !== date) {
        const snap = await getDocs(query(collection(db, "companies", companyId, "branches", branchId, "sales"), where("date", "==", date)));
        if (snap.docs.some((d) => d.id !== editing?.id)) {
          setNudge((n) => n + 1);
          toast.error("This day is already entered", { description: "Someone just saved it — see Recent entries." });
          return;
        }
      }

      const url = proofFile ? await uploadProof() : proofUrl || null;
      const payload = {
        date,
        ...form,
        notes,
        total,
        zReportUrl: url,
        tenderMeta: tenders.map((t) => ({
          key: t.key,
          label: t.label,
          includeInTotal: t.includeInTotal !== false,
          banked: !!t.banked,
          requireProof: !!t.requireProof,
          order: t.order ?? null,
        })),
      };

      if (editing) {
        await doUpdate({ companyId, branchId, id: editing.id, patch: payload });
        toast.success("Sales updated", { description: `${day(date)} · ${money(total)}` });
      } else {
        const createdBy = getSessionUser() || {};
        await addSalesEntry({ companyId, branchId, data: { ...payload, createdBy, createdAt: new Date().toISOString() } }).unwrap();
        toast.success("Sales saved", { description: `${day(date)} · ${money(total)}` });
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 1400);
      reset();
    } catch (err) {
      console.error("Sales entry save failed:", err);
      toast.error("Couldn't save the sales", { description: "Check your connection and try again." });
    } finally {
      setBusy(false);
    }
  };

  const uploading = progress > 0 && progress < 100;
  const saving = busy || creating || updating;
  const label = uploading ? "Uploading photo…" : editing ? "Update sales" : "Save sales";
  const saveButton = (
    <Button size="lg" className="w-full" onClick={save} loading={saving} success={saved} disabled={settingsLoading || !tenders.length}>
      {label}
    </Button>
  );

  return (
    <>
      <EntryLayout
        aside={
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle">Total sales</p>
              <CountUp value={total} format={money} className="mt-1 block text-3xl font-bold tracking-tight text-fg" />
              <p className="mt-0.5 text-xs text-muted">{date ? day(date) : "Pick a day"}</p>
            </div>
            <div className="space-y-2 border-t border-line pt-3">
              <SummaryLine label="To the bank" value={money(banked)} />
              <SummaryLine label="Cash in the till" value={money(till)} />
              {tenders.some((t) => t.includeInTotal === false && num(t.key)) && (
                <SummaryLine muted label="Not counted in total" value={money(tenders.reduce((n, t) => n + (t.includeInTotal === false ? num(t.key) : 0), 0))} />
              )}
            </div>
            {saveButton}
            {editing && (
              <Button variant="ghost" className="w-full" onClick={reset} icon={X}>
                Cancel editing
              </Button>
            )}
          </div>
        }
        bar={
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle">Total</p>
              <CountUp value={total} format={money} className="block truncate text-lg font-bold tracking-tight text-fg" />
            </div>
            {editing && (
              <Button variant="secondary" size="lg" onClick={reset} aria-label="Cancel editing" className="px-3">
                <X className="size-5" />
              </Button>
            )}
            <div className="w-40 shrink-0">{saveButton}</div>
          </div>
        }
        below={
          <RecentEntries
            viewAllHref="/reports/sales-report"
            loading={salesLoading && !!args}
            error={salesError}
            money={money}
            items={recent.map((s, i) => ({
              id: s.id,
              date: s.date,
              amount: s.total,
              proof: !!s.zReportUrl,
              note: s.createdBy?.username || s.createdBy?.userName || "—",
              onOpen: () => setViewing(s),
              // A supervisor may change only the latest day.
              onEdit: canEdit && (role !== "supervisor" || i === 0) ? () => startEdit(s) : undefined,
            }))}
          />
        }
      >
        {/* editing banner */}
        <AnimatePresence>
          {editing && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="flex items-center gap-3 rounded-2xl border border-info/30 bg-info-soft px-4 py-3 text-sm text-fg"
            >
              <Pencil className="size-4 shrink-0 text-info" />
              <span className="min-w-0 flex-1">
                Editing the sales for <b>{day(editing.date)}</b>
              </span>
              <button type="button" onClick={reset} className="text-xs font-semibold text-info hover:underline">
                Cancel
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <EntrySection title="Which day">
          <Field error={errors.date}>
            {({ invalid }) => <DatePicker value={date} onChange={(d) => (setDate(d), setErrors((e) => ({ ...e, date: undefined })))} max={today} invalid={invalid} />}
          </Field>
          <AnimatePresence>
            {taken && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <motion.div
                  key={nudge}
                  animate={nudge ? { x: [0, -6, 6, -4, 4, 0] } : undefined}
                  transition={{ duration: 0.35 }}
                  className="mt-3 flex items-center gap-3 rounded-xl bg-warning-soft px-3.5 py-2.5 text-sm"
                >
                  <CalendarCheck2 className="size-4 shrink-0 text-warning" />
                  <span className="min-w-0 flex-1 text-fg">
                    {day(date)} is already entered: <b>{money(taken.total)}</b>
                  </span>
                  {canEdit && (
                    <button type="button" onClick={() => startEdit(taken)} className="shrink-0 text-xs font-semibold text-warning hover:underline">
                      Edit it
                    </button>
                  )}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </EntrySection>

        <EntrySection title="Takings by payment type">
          {settingsLoading || (!tenders.length && args) ? (
            settingsLoading ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-[4.5rem]" rounded="rounded-xl" />
                ))}
              </div>
            ) : (
              <p className="rounded-xl bg-surface-2 px-4 py-6 text-center text-sm text-muted">
                No payment types are set up for this branch yet. Add them in Branch Settings.
              </p>
            )
          ) : (
            <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
              {tenders.map((t) => {
                const noteOpen = openNote === t.key || !!notes[t.key];
                return (
                  <div key={t.key}>
                    <div className="mb-1.5 flex items-center gap-1.5">
                      <label htmlFor={`tender-${t.key}`} className="text-xs font-semibold text-muted">
                        {t.label}
                      </label>
                      {t.banked ? (
                        <Landmark className="size-3 text-info" aria-label="Goes to the bank" />
                      ) : t.key === "cash" ? (
                        <Wallet className="size-3 text-brand" aria-label="Stays in the till" />
                      ) : null}
                      {t.requireProof && <Badge tone="warning">Photo needed</Badge>}
                      {t.includeInTotal === false && <Badge>Not in total</Badge>}
                      <button
                        type="button"
                        onClick={() => setOpenNote(openNote === t.key ? null : t.key)}
                        aria-label={`Note for ${t.label}`}
                        className={cn(
                          "ml-auto rounded-lg p-1 transition",
                          notes[t.key] ? "text-brand" : "text-subtle hover:bg-surface-2 hover:text-fg"
                        )}
                      >
                        <NotebookPen className="size-3.5" />
                      </button>
                    </div>
                    <MoneyInput
                      id={`tender-${t.key}`}
                      currency={currency}
                      value={form[t.key]}
                      onValueChange={(v) => setForm((f) => ({ ...f, [t.key]: v }))}
                    />
                    <AnimatePresence initial={false}>
                      {noteOpen && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                          <Input
                            className="mt-2 h-9 text-xs"
                            placeholder={`Note for ${t.label}…`}
                            value={notes[t.key] ?? ""}
                            onChange={(e) => setNotes((n) => ({ ...n, [t.key]: e.target.value }))}
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          )}
        </EntrySection>

        <EntrySection>
          <ProofUpload
            label="Z report photo"
            preview={proofPreview}
            progress={progress}
            required={proofNeeded}
            invalid={!!errors.proof}
            onPick={(file, url) => {
              setProofFile(file);
              setProofPreview(url);
              setProgress(0);
              setErrors((e) => ({ ...e, proof: undefined }));
            }}
            onRemove={() => {
              setProofFile(null);
              setProofPreview(null);
              setProofUrl(null);
              setProgress(0);
            }}
          />
          {errors.proof && <p className="mt-2 text-xs font-medium text-danger">{errors.proof}</p>}
        </EntrySection>
      </EntryLayout>

      {viewing && (
        <ItemsReportModal
          item={viewing}
          branchData={branchData}
          monthTotal={sales
            .filter((s) => s.date?.startsWith(viewing.date?.slice(0, 7)))
            .reduce((n, s) => n + (parseFloat(s.total) || 0), 0)
            .toFixed(2)}
          onClose={() => setViewing(null)}
          onEdit={
            canEdit && (role !== "supervisor" || viewing.id === recent[0]?.id)
              ? () => {
                  setViewing(null);
                  startEdit(viewing);
                }
              : undefined
          }
        />
      )}
    </>
  );
}
