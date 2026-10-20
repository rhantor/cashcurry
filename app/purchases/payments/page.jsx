"use client";
import React, { useMemo, useState } from "react";
import { skipToken } from "@reduxjs/toolkit/query";
import { format, parseISO } from "date-fns";
import { Building2, Landmark, ReceiptText, RefreshCw, Wallet, X } from "lucide-react";
import useResolvedCompanyBranch from "@/app/hooks/useResolvedCompanyBranch";
import { useGetVendorPaymentsQuery } from "@/lib/redux/api/vendorPaymentsApiSlice";
import { useGetVendorsQuery } from "@/lib/redux/api/vendorsApiSlice";
import PaymentDetailsModal from "@/app/components/purchases/PaymentDetailsModal";
import useCurrency from "@/app/hooks/useCurrency";
import { formatMoney } from "@/lib/region/currency";
import { dayKey } from "@/lib/finance/rules";
import { Badge, Button, Card, DataTable, DateRangePicker, Select, Skeleton } from "@/app/components/ui";
import { Chip } from "@/app/components/entry/Choices";
import StatTiles from "@/app/components/purchases/StatTiles";

const METHODS = [
  ["cash", "Cash"],
  ["card", "Card"],
  ["qr", "QR"],
  ["online", "Online"],
  ["bank_transfer", "Bank transfer"],
];
const METHOD_LABEL = Object.fromEntries(METHODS);

// The day a payment belongs to: the date picked when paying, else the day it was saved.
const payDay = (p) => (/^\d{4}-\d{2}-\d{2}$/.test(p?.paymentDate || "") ? p.paymentDate : dayKey(p?.createdISO || p?.createdAt) || "");
const amountOf = (p) => Number(p?.total ?? p?.totalPaid ?? 0);
const niceDay = (k) => (k ? format(parseISO(k), "EEE, d MMM yyyy") : "—");

/** Every payment made to a vendor from this branch — newest first, with filters and a total. */
export default function PaymentsPage() {
  const { ready, companyId, branchId } = useResolvedCompanyBranch();
  const currency = useCurrency();
  const money = (v) => formatMoney(Number(v ?? 0), currency);

  const { data: vendors = [], isLoading: vendorsLoading } = useGetVendorsQuery(ready && companyId ? { companyId } : skipToken, {
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });

  const [vendorId, setVendorId] = useState("");
  const [method, setMethod] = useState("");
  const [range, setRange] = useState({ from: "", to: "" });
  const [selected, setSelected] = useState(null);

  const {
    data: raw = [],
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useGetVendorPaymentsQuery(ready && companyId && branchId ? { companyId, branchId, vendorId: vendorId || undefined, method: method || undefined } : skipToken, {
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });

  // the dates are checked here, on the payment's own day (the saved time is UTC)
  const payments = useMemo(
    () =>
      raw
        .map((p) => ({ ...p, __day: payDay(p) }))
        .filter((p) => (!range.from || p.__day >= range.from) && (!range.to || p.__day <= range.to))
        .sort((a, b) => (b.__day + (b.createdISO || "")).localeCompare(a.__day + (a.createdISO || ""))),
    [raw, range]
  );

  const total = payments.reduce((s, p) => s + amountOf(p), 0);
  const front = payments.filter((p) => p.paidFromOffice === "front");
  const back = payments.filter((p) => p.paidFromOffice !== "front");
  const filtered = vendorId || method || range.from || range.to;
  const clear = () => {
    setVendorId("");
    setMethod("");
    setRange({ from: "", to: "" });
  };

  if (!ready) return <Skeleton className="m-6 h-64" rounded="rounded-2xl" />;
  if (!companyId || !branchId) return <p className="p-6 text-sm text-danger">Couldn&apos;t tell which branch this is. Check your access.</p>;

  const tiles = [
    { label: "Paid to vendors", value: money(total), note: `${payments.length} payment${payments.length === 1 ? "" : "s"}${filtered ? " · filtered" : ""}`, icon: Wallet, tone: "bg-brand-soft text-brand" },
    { label: "From the front office", value: money(front.reduce((s, p) => s + amountOf(p), 0)), note: `${front.length} paid in cash at the till`, icon: Building2, tone: "bg-warning-soft text-warning" },
    { label: "From the back office", value: money(back.reduce((s, p) => s + amountOf(p), 0)), note: `${back.length} paid from the bank`, icon: Landmark, tone: "bg-info-soft text-info" },
  ];

  const columns = [
    { key: "day", label: "Paid on", sortValue: (p) => p.__day, render: (p) => <span className="whitespace-nowrap">{niceDay(p.__day)}</span> },
    { key: "vendorName", label: "Vendor", primary: true, sortable: true, render: (p) => p.vendorName || "—" },
    { key: "bills", label: "Bills", align: "right", sortValue: (p) => p.allocations?.length || 0, render: (p) => p.allocations?.length || 0 },
    {
      key: "office",
      label: "From",
      render: (p) => <Badge tone={p.paidFromOffice === "front" ? "warning" : "info"}>{p.paidFromOffice === "front" ? "Front office" : "Back office"}</Badge>,
    },
    { key: "method", label: "Method", render: (p) => METHOD_LABEL[p.paidMethod] || p.paidMethod || "—" },
    { key: "reference", label: "Reference", render: (p) => p.reference || <span className="text-subtle">—</span> },
    {
      key: "receipt",
      label: "Receipt",
      hideOnMobile: true,
      render: (p) => (p.receiptURL ? <ReceiptText className="size-4 text-brand" aria-label="Has a receipt" /> : <span className="text-subtle">—</span>),
    },
    { key: "amount", label: "Amount", align: "right", aside: true, sortValue: amountOf, render: (p) => <span className="font-semibold">{money(amountOf(p))}</span> },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-fg">Vendor payments</h1>
          <p className="text-sm text-muted">Every bill payment made from this branch. Tap one to see the bills it paid.</p>
        </div>
        <Button variant="secondary" icon={RefreshCw} loading={isFetching && !isLoading} onClick={() => refetch()}>
          Refresh
        </Button>
      </div>

      <StatTiles tiles={tiles} loading={isLoading} />

      <Card className="space-y-3 p-3 sm:p-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <DateRangePicker className="sm:w-64" placeholder="Any date" value={range.from ? range : null} onChange={(v) => setRange(v || { from: "", to: "" })} />
          <Select className="sm:w-64" value={vendorId} onChange={(e) => setVendorId(e.target.value)} disabled={vendorsLoading} aria-label="Vendor">
            <option value="">{vendorsLoading ? "Loading vendors…" : "All vendors"}</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </Select>
          {filtered && (
            <Button variant="ghost" icon={X} onClick={clear} className="sm:ml-auto">
              Clear
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Chip on={!method} onClick={() => setMethod("")}>
            Any method
          </Chip>
          {METHODS.map(([v, label]) => (
            <Chip key={v} on={method === v} onClick={() => setMethod(method === v ? "" : v)}>
              {label}
            </Chip>
          ))}
        </div>
      </Card>

      {isError && (
        <div className="rounded-2xl bg-danger-soft p-4 text-sm text-danger">
          <b>Couldn&apos;t load the payments.</b> {error?.data?.message || error?.message || ""}
          <button type="button" onClick={() => refetch()} className="ml-2 font-semibold underline">
            Try again
          </button>
        </div>
      )}

      <DataTable
        columns={columns}
        rows={payments}
        loading={isLoading}
        onRowClick={setSelected}
        defaultSort={{ key: "day", dir: "desc" }}
        empty={{
          icon: Wallet,
          title: filtered ? "No payments match" : "No payments yet",
          description: filtered ? "Try another date, vendor or method." : "Payments show here once you pay a bill from Due bills.",
          action: filtered ? (
            <Button variant="secondary" onClick={clear}>
              Clear filters
            </Button>
          ) : null,
        }}
        footer={payments.length ? { day: "Total", amount: money(total) } : null}
      />

      <PaymentDetailsModal open={!!selected} onClose={() => setSelected(null)} payment={selected} companyId={companyId} branchId={branchId} />
    </div>
  );
}
