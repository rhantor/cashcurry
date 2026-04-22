"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { skipToken } from "@reduxjs/toolkit/query";
import useResolvedCompanyBranch from "@/utils/useResolvedCompanyBranch";
import UploadInvoice from "@/app/components/purchases/UploadInvoice";
import BillMetaFields from "@/app/components/purchases/BillMetaFields";
// BillPaidSection removed — bills are always created as credit/unpaid
import { useGetVendorsQuery } from "@/lib/redux/api/vendorsApiSlice";
import {
  useAddVendorBillMutation,
  useGetVendorBillsQuery,
} from "@/lib/redux/api/vendorBillsApiSlice";
import { useGetSingleBranchQuery } from "@/lib/redux/api/branchApiSlice";
import { uploadInvoiceFile } from "@/utils/storage/uploadInvoice";
// payVendorBills not needed here — payment happens via Due Bills page
import useCurrency from "@/app/hooks/useCurrency";

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
function possessive(name) {
  if (!name) return "New Bill";
  const endsWithS = /s$/i.test(name.trim());
  return `${name.trim()}${endsWithS ? "’" : "’s"} New Bill`;
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
    data: branchData,
    isLoading: branchLoading,
    isError: branchIsError,
    error: branchError,
  } = useGetSingleBranchQuery(bArgs);

  const title = possessive(branchData?.name || "");

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



  // Save/submit guards
  const [submitting, setSubmitting] = useState(false);
  const [errText, setErrText] = useState("");
  const lastSubmitHashRef = useRef(""); // prevents ultra-fast duplicate clicks

  const [addVendorBill, { isLoading: saving }] = useAddVendorBillMutation();

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
    dueDate ||
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
      alert(err);
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
        createdBy: user || {},
      };

      const { id: billId } = await addVendorBill({
        companyId,
        branchId,
        bill: billPayload,
        skipBalanceUpdate: false,
      }).unwrap();

      // Payment is handled separately via the Due Bills page

      // 4) Clear
      resetForm();
      lastSubmitHashRef.current = "";
      alert("✅ Bill saved successfully!");
    } catch (e) {
      console.error(e);
      setErrText(e?.data?.message || e?.message || "Failed to save bill.");
      alert("❌ Failed to save bill.");
      lastSubmitHashRef.current = "";
    } finally {
      setSubmitting(false);
      setUploadPct(0);
    }
  };

  /* ----------------------- guards ----------------------- */
  if (!ready) {
    return (
      <div className="p-3 sm:p-4">
        <h1 className="text-lg sm:text-xl font-bold text-mint-500">
          New Bill
        </h1>
        <div className="bg-white rounded-xl shadow p-4 text-sm text-gray-500">
          Resolving company & branch…
        </div>
      </div>
    );
  }

  if (!companyId || !branchId) {
    return (
      <div className="p-3 sm:p-4">
        <h1 className="text-lg sm:text-xl font-bold text-mint-500">
          New Bill
        </h1>
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3">
          Couldn’t resolve company/branch. Please check your access.
        </div>
      </div>
    );
  }

  /* ----------------------- page ----------------------- */
  return (
    <div className="p-3 sm:p-4">
      <div className="mb-3 sm:mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h1 className="text-lg sm:text-xl font-bold text-mint-500">
          {branchLoading ? "Loading…" : branchData?.name ? title : "New Bill"}
        </h1>

        {(saving || submitting || isUploading) && (
          <div
            className="text-xs px-2 py-1 rounded bg-mint-50 text-mint-700 border border-mint-200"
            aria-live="polite"
          >
            {isUploading ? `Uploading… ${Math.floor(uploadPct)}%` : "Saving…"}
          </div>
        )}
      </div>

      {(vendorsIsError || branchIsError) && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">
          <strong>Couldn’t load required data.</strong>{" "}
          <span className="text-sm">
            {(vendorsError &&
              (vendorsError.data?.message ||
                vendorsError.error ||
                vendorsError.message)) ||
              (branchError &&
                (branchError.data?.message ||
                  branchError.error ||
                  branchError.message)) ||
              "Unknown error"}
          </span>
          <div className="mt-2">
            <button
              onClick={() => {
                refetchVendors?.();
              }}
              className="text-sm text-mint-600 underline"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {showMaxWarning && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-3">
          <strong>Credit limit reached:</strong> {selectedVendor?.name} allows
          max {maxOpen} open credit bill{Number(maxOpen) === 1 ? "" : "s"}. You
          currently have{" "}
          {openUnpaidLoading || openPartialLoading ? "…" : currentOpen}. Paying
          this bill now will bypass the limit; creating it as credit will exceed
          it.
        </div>
      )}

      <form
        className="bg-white rounded-xl shadow p-3 sm:p-4 space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!saveDisabled) handleSave();
        }}
        aria-busy={saving || submitting}
      >
        <BillMetaFields
          vendors={vendors}
          loading={vendorsLoading}
          error={vendorsIsError}
          onRetry={() => refetchVendors?.()}
          vendorId={vendorId}
          setVendorId={(v) => {
            setVendorId(v);
            // keep user's manual due date if already set
          }}
          invoiceNo={invoiceNo}
          setInvoiceNo={(v) => setInvoiceNo(v)}
          invoiceDate={invoiceDate}
          setInvoiceDate={(v) => setInvoiceDate(v)} // auto-fill handled in effect
          dueDate={dueDate}
          setDueDate={(v) => {
            setUserEditedDueDate(true);
            setDueDate(v);
            setAutoFilledHint("");
          }}
          total={total}
          setTotal={(v) => {
            // live sanitize: keep digits & dot, prevent negative
            const cleaned = String(v).replace(/[^\d.]/g, "");
            setTotal(cleaned);
          }}
          note={note}
          setNote={(v) => setNote(v)}
        />

        {autoFilledHint && !userEditedDueDate && (
          <p className="text-xs text-emerald-600 -mt-3">{autoFilledHint}</p>
        )}

        <div className="space-y-2">
          <UploadInvoice
            file={file}
            onChange={setFile}
            progress={uploadPct} // ← optional
            maxFileSizeMB={5} // ← optional override
            compressMaxSizeMB={0.6} // ← optional override
            compressMaxWidthOrHeight={1600} // ← optional override
            allowCamera={true} // ← optional (default true)
          />
          {isUploading && (
            <div className="w-full bg-gray-200 rounded-full h-2" aria-hidden>
              <div
                className="h-2 rounded-full bg-mint-500 transition-[width] duration-200"
                style={{ width: `${uploadPct}%` }}
              />
            </div>
          )}
        </div>



        {errText && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">
            {errText}
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2">
          <button
            type="button"
            className="px-4 py-2 rounded-lg bg-gray-100"
            onClick={resetForm}
            disabled={saving || submitting || isUploading}
          >
            Clear
          </button>

          <button
            type="submit"
            onClick={(e) => {
              e.preventDefault();
              if (!saveDisabled) handleSave();
            }}
            disabled={saveDisabled}
            className={`px-4 py-2 rounded-lg ${
              saveDisabled
                ? "bg-gray-300 text-gray-500"
                : "bg-mint-500 text-white hover:bg-mint-600 active:scale-[0.99]"
            }`}
          >
            {isUploading
              ? `Uploading… ${Math.floor(uploadPct)}%`
              : saving || submitting
              ? "Saving…"
              : "Save Bill"}
          </button>
        </div>
      </form>
    </div>
  );
}
