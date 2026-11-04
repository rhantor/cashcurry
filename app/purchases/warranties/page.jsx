"use client";
// Purchases → Warranties (owner, 4 Nov 2026): everything under warranty at this
// branch, what ends soonest first, and whether each will be renewed.
// lib/warranties/model.js says when people are warned.
import React, { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { skipToken } from "@reduxjs/toolkit/query";
import { BellOff, FileText, Mail, Pencil, Phone, Plus, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { Chip } from "@/app/components/entry/Choices";
import ProofUpload from "@/app/components/entry/ProofUpload";
import ConfirmSheet from "@/app/components/purchases/ConfirmSheet";
import Sheet from "@/app/components/purchases/Sheet";
import useToast from "@/app/components/purchases/useToast";
import { DatePicker, Field, Textarea, cn } from "@/app/components/ui";
import WarrantyFields from "@/app/components/warranties/WarrantyFields";
import useResolvedCompanyBranch from "@/app/hooks/useResolvedCompanyBranch";
import { can } from "@/lib/authz/permissions";
import { useGetVendorsQuery } from "@/lib/redux/api/vendorsApiSlice";
import { businessToday } from "@/lib/region";
import { addWarranty, deleteWarranty, renewWarranty, setRenewing, updateWarranty, uploadPaper, useWarranties } from "@/lib/warranties/client";
import { LENGTHS, addMonths, emptyWarranty, leftText, sortWarranties, stateOf, warrantyCounts, warrantyFields, warrantyProblems } from "@/lib/warranties/model";

const dayText = (d) => (d ? format(parseISO(d), "d MMM yyyy") : "—");
const TONE = {
  soon: "bg-warning-soft text-warning",
  expired: "bg-danger-soft text-danger",
  active: "bg-success-soft text-success",
  stopped: "bg-surface-2 text-muted",
};
const FILTERS = [
  { key: "all", label: "All" },
  { key: "soon", label: "Ending soon" },
  { key: "expired", label: "Ended" },
  { key: "active", label: "Covered" },
  { key: "stopped", label: "Not renewing" },
];

function Tile({ label, value, hint, on, onClick, tone }) {
  return (
    <button type="button" onClick={onClick} className={cn("rounded-2xl border bg-surface p-4 text-left transition-colors", on ? "border-brand" : "border-line")}>
      <p className="text-xs font-semibold uppercase tracking-wide text-subtle">{label}</p>
      <p className={cn("mt-1 text-2xl font-bold tabular-nums", value > 0 ? tone : "text-fg")}>{value}</p>
      <p className="text-xs text-muted">{hint}</p>
    </button>
  );
}

export default function WarrantiesPage() {
  const { ready, companyId, branchId, user } = useResolvedCompanyBranch();
  const { toastOk, toastError, toastNode } = useToast();
  const today = businessToday();
  const { list, loading } = useWarranties(ready ? companyId : null, ready ? branchId : null);
  const { data: vendors = [] } = useGetVendorsQuery(ready && companyId ? { companyId } : skipToken);
  const canDelete = can(user?.role, "records.delete");

  const [filter, setFilter] = useState("all");
  const counts = useMemo(() => warrantyCounts(list, today), [list, today]);
  const shown = useMemo(() => sortWarranties(list, today).filter((w) => filter === "all" || stateOf(w, today) === filter), [list, today, filter]);

  const [openId, setOpenId] = useState(null);
  const open = list.find((w) => w.id === openId) || null;

  // adding or changing one
  const [form, setForm] = useState(null); // { id?, ...fields }
  const [paper, setPaper] = useState(null);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const startForm = (w) => {
    setErrors({});
    setPaper(null);
    setForm(w ? { ...emptyWarranty(), ...w } : emptyWarranty(today));
  };
  const save = async () => {
    const problems = warrantyProblems(form);
    setErrors(problems);
    if (Object.keys(problems).length) return;
    setBusy(true);
    try {
      const fields = warrantyFields(form, vendors.find((v) => v.id === form.vendorId));
      const paperURL = await uploadPaper(companyId, branchId, user, paper?.file);
      if (form.id) await updateWarranty(companyId, branchId, form.id, { ...fields, ...(paperURL ? { paperURL } : {}) });
      else await addWarranty(companyId, branchId, { ...fields, paperURL }, user);
      setForm(null);
      toastOk("Warranty saved.");
    } catch (e) {
      console.error(e);
      toastError("Could not save the warranty.");
    } finally {
      setBusy(false);
    }
  };

  // renewed
  const [renewing, setRenew] = useState(null); // { endsOn, paper, error }
  const startRenew = () => setRenew({ endsOn: "", paper: null, error: "" });
  const saveRenew = async () => {
    if (!renewing.endsOn || renewing.endsOn <= open.endsOn) return setRenew({ ...renewing, error: "Pick a day after it ends now" });
    setBusy(true);
    try {
      const paperURL = await uploadPaper(companyId, branchId, user, renewing.paper?.file);
      await renewWarranty(companyId, branchId, open, { endsOn: renewing.endsOn, paperURL }, user);
      setRenew(null);
      toastOk(`Renewed until ${dayText(renewing.endsOn)}.`);
    } catch (e) {
      console.error(e);
      toastError("Could not save the renewal.");
    } finally {
      setBusy(false);
    }
  };

  const stop = async (w, renewingAgain) => {
    try {
      await setRenewing(companyId, branchId, w.id, renewingAgain, user);
      toastOk(renewingAgain ? "Reminders are back on." : "No more reminders for this one.");
    } catch (e) {
      console.error(e);
      toastError("Could not change it.");
    }
  };

  const [toDelete, setToDelete] = useState(null);
  const confirmDelete = async () => {
    try {
      await deleteWarranty(companyId, branchId, toDelete.id);
      setToDelete(null);
      setOpenId(null);
      toastOk("Warranty deleted.");
    } catch (e) {
      console.error(e);
      toastError("Could not delete it.");
    }
  };

  const state = open ? stateOf(open, today) : null;

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-5 pb-24">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-fg">Warranties</h1>
          <p className="mt-0.5 text-sm text-muted">You&apos;re told 15 and 7 days before one ends.</p>
        </div>
        <button onClick={() => startForm(null)} className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-brand px-5 font-semibold text-brand-fg transition-colors active:brightness-95">
          <Plus className="size-5" /> Add a warranty
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Tile label="Ending soon" value={counts.soon} hint="Within 15 days" tone="text-warning" on={filter === "soon"} onClick={() => setFilter(filter === "soon" ? "all" : "soon")} />
        <Tile label="Ended" value={counts.expired} hint="Not renewed yet" tone="text-danger" on={filter === "expired"} onClick={() => setFilter(filter === "expired" ? "all" : "expired")} />
        <Tile label="Covered" value={counts.active} hint="More than 15 days left" tone="text-fg" on={filter === "active"} onClick={() => setFilter(filter === "active" ? "all" : "active")} />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <Chip key={f.key} on={filter === f.key} onClick={() => setFilter(f.key)}>
            {f.label}
          </Chip>
        ))}
      </div>

      <div className="space-y-2.5">
        {shown.map((w) => {
          const s = stateOf(w, today);
          return (
            <button key={w.id} type="button" onClick={() => setOpenId(w.id)} className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-4 text-left transition-colors hover:bg-surface-2/60">
              <ShieldCheck className="size-5 shrink-0 text-subtle" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-fg">{w.itemName}</span>
                <span className="block truncate text-xs text-muted">
                  {w.soldBy ? `${w.soldBy} · ` : ""}Ends {dayText(w.endsOn)}
                </span>
              </span>
              <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold", TONE[s])}>{s === "stopped" ? "Not renewing" : leftText(w, today)}</span>
            </button>
          );
        })}
        {!loading && shown.length === 0 && (
          <div className="rounded-3xl border border-line bg-surface px-6 py-14 text-center">
            <ShieldCheck className="mx-auto mb-3 size-10 text-subtle" />
            <p className="font-bold text-fg">{list.length ? "Nothing here" : "No warranties yet"}</p>
            {!list.length && <p className="mx-auto mt-1 max-w-sm text-sm text-muted">Add one here, or switch on &ldquo;Has warranty&rdquo; when you enter equipment in Cost Entry.</p>}
          </div>
        )}
      </div>

      {/* one warranty */}
      <Sheet open={!!open && !form && !renewing} title={open?.itemName || ""} subtitle={open?.soldBy} onClose={() => setOpenId(null)} maxWidth="max-w-2xl">
        {open && (
          <div className="space-y-4">
            <div className={cn("rounded-2xl px-4 py-3 text-sm font-semibold", TONE[state])}>
              {state === "stopped" ? `Not being renewed${open.stoppedBy ? ` (${open.stoppedBy})` : ""}` : `${leftText(open, today)} · ends ${dayText(open.endsOn)}`}
            </div>

            {state !== "stopped" ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <button onClick={startRenew} className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-brand font-semibold text-brand-fg active:brightness-95">
                  <RefreshCw className="size-4" /> Renewed
                </button>
                <button onClick={() => stop(open, false)} className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-surface-2 font-semibold text-fg">
                  <BellOff className="size-4" /> Don&apos;t renew
                </button>
              </div>
            ) : (
              <button onClick={() => stop(open, true)} className="min-h-[48px] w-full rounded-2xl bg-surface-2 font-semibold text-fg">
                Remind me again
              </button>
            )}

            <dl className="grid gap-x-4 gap-y-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-subtle">Bought on</dt>
                <dd className="font-medium text-fg">{dayText(open.startDate)}</dd>
              </div>
              <div>
                <dt className="text-xs text-subtle">Serial number</dt>
                <dd className="font-medium text-fg">{open.serial || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-subtle">Email</dt>
                <dd className="min-w-0 break-words font-medium text-fg">
                  {open.soldByEmail ? (
                    <a className="inline-flex items-center gap-1 text-brand" href={`mailto:${open.soldByEmail}`}>
                      <Mail className="size-3.5" /> {open.soldByEmail}
                    </a>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-subtle">Phone</dt>
                <dd className="font-medium text-fg">
                  {open.soldByPhone ? (
                    <a className="inline-flex items-center gap-1 text-brand" href={`tel:${open.soldByPhone}`}>
                      <Phone className="size-3.5" /> {open.soldByPhone}
                    </a>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
            </dl>

            {open.note && <p className="whitespace-pre-wrap rounded-2xl bg-surface-2 px-4 py-3 text-sm text-fg">{open.note}</p>}

            {open.paperURL && (
              <a href={open.paperURL} target="_blank" rel="noopener noreferrer" className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-line font-semibold text-fg">
                <FileText className="size-4" /> Open the warranty paper
              </a>
            )}

            {open.history?.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-subtle">Before this</p>
                <ul className="space-y-1.5 text-sm">
                  {[...open.history].reverse().map((h) => (
                    <li key={h.renewedAt} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-2 px-3 py-2">
                      <span className="text-fg">
                        Until {dayText(h.endsOn)}
                        {h.renewedBy ? ` · renewed by ${h.renewedBy}` : ""}
                      </span>
                      {h.paperURL && (
                        <a href={h.paperURL} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand">
                          Paper
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex gap-2 border-t border-line pt-3">
              <button onClick={() => startForm(open)} className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-surface-2 text-sm font-semibold text-fg">
                <Pencil className="size-4" /> Edit
              </button>
              {canDelete && (
                <button onClick={() => setToDelete(open)} className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-danger-soft text-sm font-semibold text-danger">
                  <Trash2 className="size-4" /> Delete
                </button>
              )}
            </div>
          </div>
        )}
      </Sheet>

      {/* add or edit */}
      <Sheet
        open={!!form}
        title={form?.id ? "Edit warranty" : "Add a warranty"}
        onClose={() => setForm(null)}
        maxWidth="max-w-2xl"
        footer={
          <button onClick={save} disabled={busy} className="min-h-[52px] w-full rounded-2xl bg-brand text-base font-bold text-brand-fg transition-colors active:brightness-95 disabled:opacity-40">
            {busy ? "Saving…" : "Save warranty"}
          </button>
        }
      >
        {form && (
          <div className="space-y-3">
            <WarrantyFields value={form} onChange={setForm} vendors={vendors} errors={errors} paper={paper} onPaper={setPaper} />
            {form.paperURL && !paper && <p className="text-xs text-muted">The paper already saved stays unless you add a new one.</p>}
            <Field label="Note (optional)">{({ id }) => <Textarea id={id} rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />}</Field>
          </div>
        )}
      </Sheet>

      {/* renewed */}
      <Sheet
        open={!!renewing}
        title="Renewed"
        subtitle={open?.itemName}
        onClose={() => setRenew(null)}
        maxWidth="max-w-xl"
        footer={
          <button onClick={saveRenew} disabled={busy} className="min-h-[52px] w-full rounded-2xl bg-brand text-base font-bold text-brand-fg transition-colors active:brightness-95 disabled:opacity-40">
            {busy ? "Saving…" : "Save renewal"}
          </button>
        }
      >
        {renewing && open && (
          <div className="space-y-3">
            <p className="text-sm text-muted">It ends {dayText(open.endsOn)} now. Reminders start again from the new date.</p>
            <Field label="New end date" error={renewing.error}>
              {({ invalid }) => <DatePicker value={renewing.endsOn} onChange={(endsOn) => setRenew({ ...renewing, endsOn, error: "" })} invalid={invalid} />}
            </Field>
            <div className="flex flex-wrap gap-1.5">
              {LENGTHS.map((l) => {
                const end = addMonths(open.endsOn, l.months);
                return (
                  <Chip key={l.months} on={renewing.endsOn === end} onClick={() => setRenew({ ...renewing, endsOn: end, error: "" })}>
                    {l.label} more
                  </Chip>
                );
              })}
            </div>
            <ProofUpload
              label="New warranty paper (optional)"
              pdf
              pageDrop={false}
              shrink={{ maxMB: 0.6, maxSide: 1600 }}
              file={renewing.paper?.file}
              preview={renewing.paper?.preview}
              onPick={(file, preview) => setRenew({ ...renewing, paper: { file, preview } })}
              onRemove={() => setRenew({ ...renewing, paper: null })}
            />
          </div>
        )}
      </Sheet>

      <ConfirmSheet
        open={!!toDelete}
        title="Delete this warranty?"
        message={toDelete ? `"${toDelete.itemName}" and its reminders will be removed. Its cost is not affected.` : ""}
        confirmLabel="Delete"
        tone="danger"
        onConfirm={confirmDelete}
        onClose={() => setToDelete(null)}
      />

      {toastNode}
    </div>
  );
}
