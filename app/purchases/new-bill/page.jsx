"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { skipToken } from "@reduxjs/toolkit/query";
import useResolvedCompanyBranch from "@/utils/useResolvedCompanyBranch";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { AlertTriangle, ReceiptText, Store } from "lucide-react";
// BillPaidSection removed — bills are always created as credit/unpaid
import { useGetVendorsQuery } from "@/lib/redux/api/vendorsApiSlice";
import {
  useAddVendorBillMutation,
  useGetVendorBillsQuery,
  useLazyGetVendorBillsQuery,
} from "@/lib/redux/api/vendorBillsApiSlice";
import { useGetSingleBranchQuery } from "@/lib/redux/api/branchApiSlice";
import { uploadInvoiceFile } from "@/utils/storage/uploadInvoice";
// payVendorBills not needed here — payment happens via Due Bills page
import useCurrency from "@/app/hooks/useCurrency";
import { toast, confirmDialog } from "@/app/components/ui/notify";
import { stampOf } from "@/lib/people";
import { formatMoney } from "@/lib/region/currency";
import { Button, CountUp, DatePicker, Field, Input, Select, Skeleton, Textarea } from "@/app/components/ui";
import MoneyInput from "@/app/components/entry/MoneyInput";
import ProofUpload from "@/app/components/entry/ProofUpload";
import { EntryLayout, EntrySection, SummaryLine } from "@/app/components/entry/EntryLayout";

/* ----------------------- tiny helpers ----------------------- */
const todayISO = () => {
  const d = new Date();
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
};
// YYYY-MM-DD in UTC safe add
function addDaysISO(iso, days) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + Number(days || 0));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}
const clampMoney = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return "0.00";
  return n.toFixed(2);
};
const nonEmpty = (s) => (s || "").trim();

/* ----------------------- component ----------------------- */
export default function NewBillPage() {
  const currency = useCurrency();
  const { ready, companyId, branchId, user } = useResolvedCompanyBranch();

  // Vendors
  const vArgs = ready && companyId ? { companyId } : skipToken;
  const {
    data: vendors = [],
    isLoading: vendorsLoading,
    isError: vendorsIsError,
    error: vendorsError,
    refetch: refetchVendors,
  } = useGetVendorsQuery(vArgs);

  // Branch
  const bArgs =
    ready && companyId && branchId ? { companyId, branchId } : skipToken;
  const {
    data: _branchData,
    isLoading: branchLoading,
    isError: branchIsError,
    error: branchError,
  } = useGetSingleBranchQuery(bArgs);


  // Form state
  const [vendorId, setVendorId] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [userEditedDueDate, setUserEditedDueDate] = useState(false);
  const [autoFilledHint, setAutoFilledHint] = useState("");
  const [total, setTotal] = useState("");
  const [note, setNote] = useState("");

  const [file, setFile] = useState(null);
  const [uploadPct, setUploadPct] = useState(0);
  const [preview, setPreview] = useState(null);



  // Save/submit guards
  const [submitting, setSubmitting] = useState(false);
  const [errText, setErrText] = useState("");
  const lastSubmitHashRef = useRef(""); // prevents ultra-fast duplicate clicks

  const [addVendorBill, { isLoading: saving }] = useAddVendorBillMutation();
  const [findVendorBills] = useLazyGetVendorBillsQuery();

  const selectedVendor = useMemo(
    () => vendors.find((v) => v.id === vendorId),
    [vendors, vendorId]
  );

  // Vendor config names
  const vendorDueDays =
    selectedVendor?.dueDays ??
    selectedVendor?.creditDays ??
    selectedVendor?.creditTermsDays ??
    selectedVendor?.termsDays ??
    0;
  const maxOpen = selectedVendor?.maxOpenBills ?? null;

  // Open bills count for the vendor
  const listArgsBase =
    ready && companyId && branchId && vendorId
      ? { companyId, branchId, vendorId }
      : skipToken;

  const { data: openUnpaid = [], isLoading: openUnpaidLoading } =
    useGetVendorBillsQuery(
      listArgsBase === skipToken
        ? skipToken
        : { ...listArgsBase, status: "unpaid" }
    );
  const { data: openPartial = [], isLoading: openPartialLoading } =
    useGetVendorBillsQuery(
      listArgsBase === skipToken
        ? skipToken
        : { ...listArgsBase, status: "partially_paid" }
    );

  const currentOpen = openUnpaid.length + openPartial.length;
  const showMaxWarning =
    maxOpen != null && currentOpen >= Number(maxOpen);

  const disabledBase = !ready || !companyId || !branchId;
  const isUploading = uploadPct > 0 && uploadPct < 100;
  const saveDisabled =
    disabledBase ||
    saving ||
    submitting ||
    isUploading ||
    vendorsLoading ||
    branchLoading;

  /* ----------------------- default invoice date to today ----------------------- */
  useEffect(() => {
    if (ready && !invoiceDate) {
      const t = todayISO();
      setInvoiceDate(t);
      // due date auto-fill will run in the next effect
    }
  }, [ready, invoiceDate]);

  /* ----------------------- auto-fill due date ----------------------- */
  useEffect(() => {
    if (!invoiceDate) return;
    if (userEditedDueDate) return;
    if (Number(vendorDueDays) >= 0) {
      const computed = addDaysISO(invoiceDate, vendorDueDays);
      setDueDate(computed);
      setAutoFilledHint(
        `Auto-filled: ${vendorDueDays} day${
          vendorDueDays === 1 ? "" : "s"
        } from invoice date`
      );
    }
  }, [invoiceDate, vendorDueDays, userEditedDueDate]);

  /* ----------------------- unsaved-changes guard ----------------------- */
  const isDirty =
    vendorId ||
    invoiceNo ||
    (invoiceDate && invoiceDate !== todayISO()) ||
    userEditedDueDate ||
    total ||
    note ||
    file ||
    false;
  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (!isDirty || submitting) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty, submitting]);

  /* ----------------------- validation ----------------------- */
  const validate = () => {
    if (!vendorId) return "Select a vendor.";
    if (!nonEmpty(invoiceNo)) return "Enter invoice number.";
    if (!invoiceDate) return "Select invoice date.";
    if (!dueDate) return "Select due date.";
    // due date cannot be earlier than invoice date
    if (invoiceDate && dueDate && dueDate < invoiceDate)
      return "Due date cannot be earlier than the invoice date.";
    if (!total || Number(total) <= 0) return `Enter bill total (${currency}).`;
    if (!file) return "Attach invoice (PDF/Image).";
    return null;
  };

  /* ----------------------- reset form ----------------------- */
  const resetForm = () => {
    setVendorId("");
    setInvoiceNo("");
    setInvoiceDate(todayISO()); // back to today for speed
    setDueDate("");
    setUserEditedDueDate(false);
    setAutoFilledHint("");
    setTotal("");
    setNote("");
    setFile(null);
    setPreview(null);
    setUploadPct(0);

    setErrText("");
  };

  /* ----------------------- submit handler ----------------------- */
  const handleSave = async () => {
    setErrText("");

    // sanitize money
    const normalizedTotal = clampMoney(total);
    setTotal(normalizedTotal);

    const err = validate();
    if (err) {
      setErrText(err);
      toast.error(err);
      return;
    }

    // double-submit guard
    const submitHash = JSON.stringify({
      vendorId,
      invoiceNo: nonEmpty(invoiceNo),
      invoiceDate,
      dueDate,
      total: normalizedTotal,
    });
    if (lastSubmitHashRef.current === submitHash) return;
    lastSubmitHashRef.current = submitHash;

    // The same invoice saved twice would make the vendor owed twice. Check
    // this vendor's bills here for the number first (any status).
    try {
      const key = (v) => String(v || "").trim().toLowerCase().replace(/\s+/g, "");
      const theirs = await findVendorBills({ companyId, branchId, vendorId }).unwrap();
      const same = (theirs || []).find((b) => key(b.invoiceNo) && key(b.invoiceNo) === key(invoiceNo));
      if (same) {
        const ok = await confirmDialog({
          title: `${nonEmpty(invoiceNo)} is already saved`,
          message: `${selectedVendor?.name || "This vendor"} already has invoice ${same.invoiceNo} for ${money(same.total)}, dated ${day(same.invoiceDate)}${same.status === "paid" ? " (paid)" : ""}. Saving it again means they are owed for it twice.`,
          confirmLabel: "Save it again",
          danger: true,
        });
        if (!ok) {
          lastSubmitHashRef.current = "";
          return;
        }
      }
    } catch (e) {
      console.warn("[new-bill] duplicate check skipped:", e);
    }

    try {
      setSubmitting(true);

      // 1) Upload invoice
      const { url } = await uploadInvoiceFile(
        {
          companyId,
          branchId,
          vendorId,
          invoiceNo: nonEmpty(invoiceNo),
          invoiceDate,
        },
        file,
        (pct) => setUploadPct(pct)
      );

      // 2) Create bill
      const billPayload = {
        vendorId,
        vendorName: selectedVendor?.name || "",
        invoiceNo: nonEmpty(invoiceNo),
        invoiceDate,
        dueDate,
        total: Number(normalizedTotal),
        note: nonEmpty(note),
        attachments: [url],
        createdBy: stampOf(user || {}),
      };

      await addVendorBill({
        companyId,
        branchId,
        bill: billPayload,
        skipBalanceUpdate: false,
      }).unwrap();

      // Payment is handled separately via the Due Bills page

      // 4) Clear
      resetForm();
      lastSubmitHashRef.current = "";
      toast.success("Bill saved successfully!");
    } catch (e) {
      console.error(e);
      setErrText(e?.data?.message || e?.message || "Failed to save bill.");
      toast.error("Failed to save bill.");
      lastSubmitHashRef.current = "";
    } finally {
      setSubmitting(false);
      setUploadPct(0);
    }
  };

  /* ----------------------- guards ----------------------- */
  const money = (v) => formatMoney(v, currency);
  const day = (iso) => (iso ? format(parseISO(iso), "EEE, d MMM yyyy") : "—");

  if (!ready) return <Skeleton className="m-6 h-64" rounded="rounded-2xl" />;
  if (!companyId || !branchId) return <p className="p-6 text-sm text-danger">Couldn&apos;t tell which branch this is. Check your access.</p>;

  const save = (
    <Button size="lg" className="w-full" loading={saving || (submitting && !isUploading)} disabled={saveDisabled} onClick={handleSave}>
      {isUploading ? `Uploading… ${Math.floor(uploadPct)}%` : "Save bill"}
    </Button>
  );

  /* ----------------------- page ----------------------- */
  return (
    <EntryLayout
      aside={
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle">Bill total</p>
            <CountUp value={Number(total) || 0} format={money} className="mt-1 block text-3xl font-bold tracking-tight text-fg" />
            <p className="mt-0.5 text-xs text-muted">{selectedVendor?.name || "Pick the vendor"}</p>
          </div>
          <div className="space-y-2 border-t border-line pt-3">
            <SummaryLine label="Invoice" value={invoiceNo || "—"} muted={!invoiceNo} />
            <SummaryLine label="Dated" value={day(invoiceDate)} />
            <SummaryLine label="Due" value={day(dueDate)} muted={!dueDate} />
            <SummaryLine label="Invoice file" value={file ? "Attached" : "Needed"} muted={!file} />
          </div>
          {errText && <p className="rounded-xl bg-danger-soft px-3 py-2 text-xs font-medium text-danger">{errText}</p>}
          {save}
          <p className="text-[11px] text-muted">
            Saved as owed to the vendor. Pay it from{" "}
            <Link href="/purchases/due-bills" className="font-semibold text-brand hover:underline">
              Due bills
            </Link>
            .
          </p>
        </div>
      }
      bar={
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-subtle">{selectedVendor?.name || "New bill"}</p>
            <CountUp value={Number(total) || 0} format={money} className="block truncate text-lg font-bold tracking-tight text-fg" />
          </div>
          <div className="w-40 shrink-0">{save}</div>
        </div>
      }
    >
      {(vendorsIsError || branchIsError) && (
        <div className="rounded-2xl bg-danger-soft p-4 text-sm text-danger">
          <b>Couldn&apos;t load the vendors.</b> {vendorsError?.data?.message || vendorsError?.message || branchError?.message || ""}
          <button type="button" onClick={() => refetchVendors?.()} className="ml-2 font-semibold underline">
            Try again
          </button>
        </div>
      )}

      <EntrySection title="Who it's from">
        <Field label="Vendor">
          {({ id }) =>
            vendorsLoading ? (
              <Skeleton className="h-12" rounded="rounded-xl" />
            ) : (
              <Select id={id} className="h-12" value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
                <option value="">Choose a vendor…</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </Select>
            )
          }
        </Field>
        {selectedVendor && (
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            <span className="inline-flex items-center gap-1">
              <Store className="size-3.5" /> Pays in {vendorDueDays || 0} day{Number(vendorDueDays) === 1 ? "" : "s"}
            </span>
            {maxOpen != null && (
              <span>
                · {openUnpaidLoading || openPartialLoading ? "…" : currentOpen} of {maxOpen} open bills
              </span>
            )}
          </p>
        )}
        {showMaxWarning && (
          <p className="mt-3 flex gap-2 rounded-xl bg-warning-soft px-3 py-2.5 text-xs text-fg">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
            <span>
              <b>{selectedVendor?.name}</b> allows {maxOpen} unpaid bill{Number(maxOpen) === 1 ? "" : "s"} at a time and already has {currentOpen}. Saving this one goes over that.
            </span>
          </p>
        )}
        {!vendorsLoading && !vendors.length && (
          <p className="mt-2 text-xs text-muted">
            No vendors yet —{" "}
            <Link href="/purchases/vendors" className="font-semibold text-brand hover:underline">
              add one
            </Link>
            .
          </p>
        )}
      </EntrySection>

      <EntrySection title="The invoice">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Invoice number">{({ id }) => <Input id={id} size="lg" value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} placeholder="e.g. INV-1023" />}</Field>
          <Field label="Bill total">{({ id }) => <MoneyInput id={id} currency={currency} value={total} onValueChange={setTotal} />}</Field>
          <Field label="Invoice date">{() => <DatePicker size="lg" value={invoiceDate} onChange={setInvoiceDate} />}</Field>
          <Field label="Due" hint={autoFilledHint && !userEditedDueDate ? autoFilledHint : undefined}>
            {() => (
              <DatePicker
                size="lg"
                value={dueDate}
                onChange={(v) => {
                  setUserEditedDueDate(true);
                  setDueDate(v);
                  setAutoFilledHint("");
                }}
              />
            )}
          </Field>
        </div>
        <Field label="Note" hint="Optional" className="mt-4">
          {({ id }) => <Textarea id={id} rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. delivered by Ali, PO-55" />}
        </Field>
        <div className="mt-5">
          <ProofUpload
            label="Invoice photo or PDF"
            pdf
            required
            shrink={{ maxMB: 0.6, maxSide: 1600 }}
            file={file}
            preview={preview}
            progress={uploadPct}
            onPick={(f, url) => (setFile(f), setPreview(url))}
            onRemove={() => (setFile(null), setPreview(null), setUploadPct(0))}
          />
        </div>
      </EntrySection>

      <p className="flex items-center gap-1.5 px-1 text-xs text-subtle">
        <ReceiptText className="size-3.5" /> Every bill keeps its invoice — it&apos;s what the vendor is paid against.
      </p>
    </EntryLayout>
  );
}
