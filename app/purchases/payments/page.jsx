/* eslint-disable react/prop-types */
"use client";
import React, { useMemo, useState, useEffect } from "react";
import { skipToken } from "@reduxjs/toolkit/query";
import useResolvedCompanyBranch from "@/utils/useResolvedCompanyBranch";
import { useGetVendorPaymentsQuery } from "@/lib/redux/api/vendorPaymentsApiSlice";
import { useGetVendorsQuery } from "@/lib/redux/api/vendorsApiSlice";
import { useGetSingleBranchQuery } from "@/lib/redux/api/branchApiSlice";
import PaymentDetailsModal from "@/app/components/purchases/PaymentDetailsModal";
import useCurrency from "@/app/hooks/useCurrency";

const METHOD_LABELS = {
  cash: "Cash",
  card: "Card",
  qr: "QR",
  online: "Online",
  bank_transfer: "Bank Transfer",
};

const PAGE_SIZE = 10;

const makeFmtRM = (currency) => (v) =>
  `${currency} ${Number(v ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

function PaginationBar({ page, pageCount, onPrev, onNext }) {
  const disabledPrev = page <= 1;
  const disabledNext = page >= pageCount;
  return (
    <div className="flex items-center justify-between gap-3 mt-3">
      <div className="text-sm text-gray-600">
        Page {page} of {pageCount || 1}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onPrev}
          disabled={disabledPrev}
          className={`px-3 py-1.5 rounded-lg ${
            disabledPrev
              ? "bg-gray-200 text-gray-500"
              : "bg-white border hover:bg-gray-50"
          }`}
        >
          Prev
        </button>
        <button
          onClick={onNext}
          disabled={disabledNext}
          className={`px-3 py-1.5 rounded-lg ${
            disabledNext
              ? "bg-gray-200 text-gray-500"
              : "bg-white border hover:bg-gray-50"
          }`}
        >
          Next
        </button>
      </div>
    </div>
  );
}

function possessive(name) {
  if (!name) return "Payments";
  const endsWithS = /s$/i.test(name.trim());
  return `${name.trim()}${endsWithS ? "’" : "’s"} Payments`;
}

// Safely extract an ISO-ish string, then format to local date
function getDisplayDate(p) {
  // Prefer explicit ISO string
  const iso =
    p?.createdISO ||
    p?.createdAt?.toDate?.()?.toISOString?.() ||
    (typeof p?.createdAt === "number"
      ? new Date(p.createdAt).toISOString()
      : undefined) ||
    (p?.created?.seconds
      ? new Date(p.created.seconds * 1000).toISOString()
      : undefined);

  if (!iso) return "-";
  try {
    const dt = new Date(iso);
    // e.g., 2025-09-23 14:30
    const d = dt.toLocaleDateString(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const t = dt.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${d} ${t}`;
  } catch {
    return p?.createdISO || "-";
  }
}

export default function PaymentsPage() {
  const { ready, companyId, branchId } = useResolvedCompanyBranch();
  const currency = useCurrency();
  const fmtRM = makeFmtRM(currency);

  // Vendors (for filter)
  const vArgs = ready && companyId ? { companyId } : skipToken;
  const {
    data: vendors = [],
    isLoading: vendorsLoading,
    isError: vendorsIsError,
    error: vendorsError,
    refetch: refetchVendors,
  } = useGetVendorsQuery(vArgs, {
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });

  // Branch name for title
  const bArgs =
    ready && companyId && branchId ? { companyId, branchId } : skipToken;
  const {
    data: branchData,
    isLoading: branchLoading,
    isError: branchIsError,
    error: branchError,
  } = useGetSingleBranchQuery(bArgs);

  const title = possessive(branchData?.name || "");

  // Filters
  const [vendorId, setVendorId] = useState("");
  const [method, setMethod] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selectedPayment, setSelectedPayment] = useState(null);

  // Pagination
  const [page, setPage] = useState(1);

  // Payments query (server-side filtering)
  const args =
    ready && companyId && branchId
      ? {
          companyId,
          branchId,
          vendorId: vendorId || undefined,
          method: method || undefined,
          from: from || undefined,
          to: to || undefined,
        }
      : skipToken;

  const {
    data: rawPayments = [],
    isLoading: paymentsLoading,
    isError: paymentsIsError,
    error: paymentsError,
    refetch,
  } = useGetVendorPaymentsQuery(args, {
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });

  // Sort newest → oldest for consistent UX
  const payments = useMemo(() => {
    const sortKey = (p) => {
      const d =
        Date.parse(p?.createdISO) ||
        p?.createdAt?.toDate?.()?.getTime?.() ||
        (typeof p?.createdAt === "number" ? p.createdAt : undefined) ||
        (p?.created?.seconds ? p.created.seconds * 1000 : 0);
      return Number.isFinite(d) ? d : 0;
    };
    return [...(rawPayments || [])].sort((a, b) => sortKey(b) - sortKey(a));
  }, [rawPayments]);

  // Reset to first page when dependencies change
  useEffect(() => {
    setPage(1);
  }, [vendorId, method, from, to, companyId, branchId, ready]);

  const pageCount = Math.max(1, Math.ceil((payments?.length || 0) / PAGE_SIZE));
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const start = (page - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE;

  const visible = useMemo(
    () => (payments || []).slice(start, end),
    [payments, start, end]
  );

  const totalRMAll = useMemo(
    () =>
      (payments || []).reduce(
        (s, p) => s + Number(p.total ?? p.totalPaid ?? 0),
        0
      ),
    [payments]
  );
  const totalRMPage = useMemo(
    () =>
      (visible || []).reduce(
        (s, p) => s + Number(p.total ?? p.totalPaid ?? 0),
        0
      ),
    [visible]
  );

  const showingFrom = payments.length ? start + 1 : 0;
  const showingTo = Math.min(end, payments.length);

  const clearFilters = () => {
    setVendorId("");
    setMethod("");
    setFrom("");
    setTo("");
  };

  /* ----------------------- Guards ----------------------- */
  if (!ready) {
    return (
      <div className="p-3 sm:p-4">
        <h1 className="text-lg sm:text-xl font-bold text-mint-500">
          Payments
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
          Payments
        </h1>
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3">
          Couldn’t resolve company/branch. Please check your access.
        </div>
      </div>
    );
  }

  /* ----------------------- Page ----------------------- */
  return (
    <div className="p-3 sm:p-4">
      <div className="mb-3 sm:mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h1 className="text-lg sm:text-xl font-bold text-mint-500">
          {branchLoading ? "Loading…" : branchData?.name ? title : "Payments"}
        </h1>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">
            Showing {showingFrom}–{showingTo} of {payments.length}
          </span>
          <button
            onClick={() => refetch()}
            className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Data load errors */}
      {(vendorsIsError || branchIsError || paymentsIsError) && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">
          <strong>Couldn’t load data.</strong>{" "}
          <span className="text-sm">
            {(vendorsError &&
              (vendorsError.data?.message ||
                vendorsError.error ||
                vendorsError.message)) ||
              (branchError &&
                (branchError.data?.message ||
                  branchError.error ||
                  branchError.message)) ||
              (paymentsError &&
                (paymentsError.data?.message ||
                  paymentsError.error ||
                  paymentsError.message)) ||
              "Unknown error"}
          </span>
          <div className="mt-2 flex gap-3">
            <button
              onClick={() => refetchVendors?.()}
              className="text-sm text-mint-600 underline"
            >
              Retry vendors
            </button>
            <button
              onClick={() => refetch?.()}
              className="text-sm text-mint-600 underline"
            >
              Retry payments
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl shadow p-3 sm:p-4 mb-4 grid gap-3 md:grid-cols-4">
        <div>
          <label className="text-sm text-gray-600">Vendor</label>
          <select
            className="mt-1 w-full border rounded-lg p-2"
            value={vendorId}
            onChange={(e) => setVendorId(e.target.value)}
            disabled={vendorsLoading}
          >
            <option value="">
              {vendorsLoading ? "Loading vendors…" : "All vendors"}
            </option>
            {!vendorsLoading &&
              vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
          </select>
        </div>
        <div>
          <label className="text-sm text-gray-600">Method</label>
          <select
            className="mt-1 w-full border rounded-lg p-2"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
          >
            <option value="">All methods</option>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="qr">QR</option>
            <option value="online">Online</option>
            <option value="bank_transfer">Bank Transfer</option>
          </select>
        </div>
        <div>
          <label className="text-sm text-gray-600">From</label>
          <input
            type="date"
            className="mt-1 w-full border rounded-lg p-2"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div>
          <label className="text-sm text-gray-600">To</label>
          <input
            type="date"
            className="mt-1 w-full border rounded-lg p-2"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>

        <div className="md:col-span-4 flex flex-wrap items-center gap-2">
          <button
            onClick={clearFilters}
            className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm"
            disabled={vendorsLoading}
          >
            Clear filters
          </button>
          {from && to && from > to && (
            <span className="text-xs text-red-600">
              “From” date cannot be later than “To”.
            </span>
          )}
        </div>
      </div>

      {/* Loading skeleton */}
      {(paymentsLoading || branchLoading) && (
        <div className="bg-white rounded-xl shadow p-4">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-gray-200 rounded w-1/3" />
            <div className="h-4 bg-gray-200 rounded w-2/3" />
            <div className="h-4 bg-gray-200 rounded w-1/2" />
            <div className="h-4 bg-gray-200 rounded w-3/4" />
          </div>
        </div>
      )}

      {/* Mobile card list */}
      <div className="md:hidden space-y-3">
        {visible.map((p) => {
          const officeChip =
            p.paidFromOffice === "front"
              ? "bg-emerald-100 text-emerald-700"
              : "bg-indigo-100 text-indigo-700";
          const methodLabel =
            METHOD_LABELS[p.paidMethod] || p.paidMethod || "-";
          return (
            <div key={p.id} className="bg-white rounded-xl shadow p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm text-gray-500">{getDisplayDate(p)}</p>
                  <p className="font-medium truncate">{p.vendorName || "-"}</p>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[11px] bg-gray-100">
                  {methodLabel}
                </span>
              </div>

              <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-lg bg-gray-50 p-2">
                  <p className="text-gray-500">Bills</p>
                  <p className="font-semibold">{p.allocations?.length || 0}</p>
                </div>
                <div className={`rounded-lg p-2 ${officeChip}`}>
                  <p className="opacity-80">Office</p>
                  <p className="font-semibold">
                    {p.paidFromOffice === "front" ? "Front" : "Back"}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-50 p-2 text-right">
                  <p className="text-gray-500">Amount</p>
                  <p className="font-semibold">
                    {fmtRM(p.total ?? p.totalPaid)}
                  </p>
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between">
                <div className="text-xs text-gray-600 truncate">
                  Ref: {p.reference || <span className="text-gray-400">—</span>}
                </div>
                <div className="flex items-center gap-2">
                  {p.receiptURL ? (
                    <a
                      href={p.receiptURL}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-mint-600 underline"
                    >
                      Receipt
                    </a>
                  ) : (
                    <span className="text-xs text-gray-400">No receipt</span>
                  )}
                  <button
                    className="px-3 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs"
                    onClick={() => setSelectedPayment(p)}
                  >
                    Details
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {!visible.length && !paymentsLoading && (
          <div className="bg-white rounded-xl shadow p-4 text-center text-gray-500">
            No payments to show.
          </div>
        )}

        {/* Pager (mobile) */}
        <PaginationBar
          page={page}
          pageCount={pageCount}
          onPrev={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => Math.min(pageCount, p + 1))}
        />
      </div>

      {/* Desktop/tablet table */}
      <div className="hidden md:block bg-white rounded-xl shadow p-4 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-left text-gray-600">
            <tr>
              <th className="py-2">Date</th>
              <th className="py-2">Vendor</th>
              <th className="py-2">Bills</th>
              <th className="py-2">Office</th>
              <th className="py-2">Method</th>
              <th className="py-2">Reference</th>
              <th className="py-2">Receipt</th>
              <th className="py-2 text-right">Amount</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((p) => {
              const officeChip =
                p.paidFromOffice === "front"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-indigo-100 text-indigo-700";
              const methodLabel =
                METHOD_LABELS[p.paidMethod] || p.paidMethod || "-";
              return (
                <tr key={p.id} className="border-t">
                  <td className="py-2">{getDisplayDate(p)}</td>
                  <td className="py-2">{p.vendorName || "-"}</td>
                  <td className="py-2">{p.allocations?.length || 0}</td>
                  <td className="py-2">
                    <span
                      className={`px-2 py-1 rounded-full text-xs ${officeChip}`}
                    >
                      {p.paidFromOffice === "front" ? "Front" : "Back"}
                    </span>
                  </td>
                  <td className="py-2">
                    <span className="px-2 py-1 rounded-full text-xs bg-gray-100">
                      {methodLabel}
                    </span>
                  </td>
                  <td className="py-2">
                    {p.reference || <span className="text-gray-400">—</span>}
                  </td>
                  <td className="py-2">
                    {p.receiptURL ? (
                      <a
                        href={p.receiptURL}
                        target="_blank"
                        rel="noreferrer"
                        className="text-mint-600 hover:underline"
                      >
                        View
                      </a>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="py-2 font-medium text-right">
                    {fmtRM(p.total ?? p.totalPaid)}
                  </td>
                  <td className="py-2 text-right">
                    <button
                      className="px-3 py-1 rounded-lg bg-gray-100 hover:bg-gray-200"
                      onClick={() => setSelectedPayment(p)}
                    >
                      Details
                    </button>
                  </td>
                </tr>
              );
            })}
            {!visible.length && !paymentsLoading && (
              <tr>
                <td className="py-6 text-center text-gray-500" colSpan={9}>
                  No payments to show.
                </td>
              </tr>
            )}
          </tbody>

          {visible.length > 0 && (
            <tfoot>
              <tr className="border-t">
                <td className="py-3 font-semibold" colSpan={7}>
                  Page total
                </td>
                <td className="py-3 font-semibold text-right">
                  {fmtRM(totalRMPage)}
                </td>
                <td />
              </tr>
              <tr>
                <td className="py-1 text-sm text-gray-500" colSpan={7}>
                  All results total
                </td>
                <td className="py-1 text-sm text-right text-gray-500">
                  {fmtRM(totalRMAll)}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>

        {/* Pager (desktop/tablet) */}
        <PaginationBar
          page={page}
          pageCount={pageCount}
          onPrev={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => Math.min(pageCount, p + 1))}
        />
      </div>

      {/* Details modal */}
      <PaymentDetailsModal
        open={!!selectedPayment}
        onClose={() => setSelectedPayment(null)}
        payment={selectedPayment}
        companyId={companyId}
        branchId={branchId}
      />
    </div>
  );
}
