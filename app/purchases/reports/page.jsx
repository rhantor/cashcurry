/* eslint-disable react/prop-types */
"use client";
import React, { useMemo, useState } from "react";
import { skipToken } from "@reduxjs/toolkit/query";
import useResolvedCompanyBranch from "@/utils/useResolvedCompanyBranch";
import { useGetReceivedOrdersQuery } from "@/lib/redux/api/requisitionsApiSlice";
import { useGetVendorsQuery } from "@/lib/redux/api/vendorsApiSlice";
import { useGetBranchSettingsQuery } from "@/lib/redux/api/branchSettingsApiSlice";
import { useGetSingleBranchQuery } from "@/lib/redux/api/branchApiSlice";
import { useGetCompanyDetailsQuery } from "@/lib/redux/api/authApiSlice";
import Sheet from "@/app/components/purchases/Sheet";
import ItemFilterBar, { filterItems } from "@/app/components/purchases/ItemFilterBar";
import useToast from "@/app/components/purchases/useToast";
import useCurrency from "@/app/hooks/useCurrency";
import {
  aggregatePurchases,
  dateRangePresets,
  purchaseReportCsv,
  downloadCsv,
  localDate,
} from "@/utils/reports/purchaseReport";
import buildPurchaseReportPdf from "@/utils/pdf/purchaseReportPdf";
import { loadLogo } from "@/utils/pdf/purchaseOrderPdf";
import { FileText, Sheet as SheetIcon, Package, TrendingUp, Calendar } from "lucide-react";

const money = (n) => Number(n || 0).toFixed(2);

/** Compact form for headline numbers — 12.9K rather than 12,946. */
const compact = (n) => {
  const v = Number(n || 0);
  if (Math.abs(v) >= 1_000_000) return (v / 1_000_000).toFixed(1) + "M";
  if (Math.abs(v) >= 10_000) return (v / 1_000).toFixed(1) + "K";
  return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
};

/**
 * Headline number. Deliberately not a chart — a handful of totals is a KPI row,
 * and a one-bar chart would say less in more space.
 */
function StatTile({ label, value, sub, accent = false }) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        accent ? "border-mint-200 bg-mint-50/50" : "border-slate-200 bg-white"
      }`}
    >
      <p className="text-xs font-medium text-slate-500">{label}</p>
      {/* Proportional figures: tabular-nums makes a large standalone value look loose. */}
      <p className={`mt-1 text-2xl font-semibold ${accent ? "text-mint-800" : "text-slate-900"}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function PurchaseReportPage() {
  const { ready, companyId, branchId } = useResolvedCompanyBranch();
  const currency = useCurrency();
  const { toastOk, toastError, toastNode } = useToast();

  const presets = useMemo(() => dateRangePresets(), []);
  const [rangeId, setRangeId] = useState("thisMonth");
  const [custom, setCustom] = useState({ start: "", end: "" });

  const active = useMemo(() => {
    if (rangeId === "custom") {
      return {
        start: custom.start || localDate(new Date()),
        end: custom.end || localDate(new Date()),
        label: "Custom range",
      };
    }
    const p = presets.find((x) => x.id === rangeId) || presets[2];
    return { start: p.start, end: p.end, label: p.label };
  }, [rangeId, custom, presets]);

  const { data: orders = [], isLoading, isFetching } = useGetReceivedOrdersQuery(
    ready && companyId && branchId
      ? { companyId, branchId, startDate: active.start, endDate: active.end }
      : skipToken
  );
  const { data: vendors = [] } = useGetVendorsQuery(ready && companyId ? { companyId } : skipToken);
  const { data: branchSettings } = useGetBranchSettingsQuery(
    ready && companyId && branchId ? { companyId, branchId } : skipToken
  );
  const { data: branch } = useGetSingleBranchQuery(
    ready && companyId && branchId ? { companyId, branchId } : skipToken
  );
  const { data: company } = useGetCompanyDetailsQuery(ready && companyId ? companyId : skipToken);

  const [vendorId, setVendorId] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [sortBy, setSortBy] = useState("spend");
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(false);

  const scoped = useMemo(
    () => (vendorId ? orders.filter((o) => o.vendorId === vendorId) : orders),
    [orders, vendorId]
  );

  const { items, totals } = useMemo(
    () => aggregatePurchases(scoped, { startDate: active.start, endDate: active.end }),
    [scoped, active]
  );

  const visible = useMemo(() => {
    const rows = filterItems(items, { search, category });
    const sorted = [...rows];
    if (sortBy === "qty") sorted.sort((a, b) => b.qty - a.qty);
    else if (sortBy === "name") sorted.sort((a, b) => a.name.localeCompare(b.name));
    else sorted.sort((a, b) => b.spend - a.spend);
    return sorted;
  }, [items, search, category, sortBy]);

  const shownTotals = useMemo(
    () => ({
      spend: visible.reduce((a, r) => a + r.spend, 0),
      qty: visible.reduce((a, r) => a + r.qty, 0),
    }),
    [visible]
  );

  const meta = {
    branchName: branch?.name || "",
    companyName: company?.name || "",
    vendorName: vendorId ? vendors.find((v) => v.id === vendorId)?.name || "" : "",
    category,
    search,
    periodLabel: active.label,
    startDate: active.start,
    endDate: active.end,
  };

  const handleCsv = () => {
    if (!visible.length) return toastError("Nothing to export for this period.");
    downloadCsv(
      `Purchase-Report-${active.start}-to-${active.end}.csv`,
      purchaseReportCsv({
        items: visible,
        totals: { ...totals, ...shownTotals, itemCount: visible.length },
        currency,
        startDate: active.start,
        endDate: active.end,
        branchName: meta.branchName,
      })
    );
    toastOk("CSV downloaded.");
  };

  const handlePdf = async () => {
    if (!visible.length) return toastError("Nothing to export for this period.");
    setBusy(true);
    try {
      const logoDataUrl = await loadLogo(company?.logo);
      buildPurchaseReportPdf({
        items: visible,
        totals: { ...totals, ...shownTotals, itemCount: visible.length },
        meta,
        branchBasic: branchSettings?.basic,
        currency,
        logoDataUrl,
      });
      toastOk("PDF downloaded.");
    } catch (e) {
      console.error(e);
      toastError("Could not build the PDF.");
    } finally {
      setBusy(false);
    }
  };

  const loading = isLoading || isFetching;

  const rangeChip = (activeChip) =>
    `min-h-[44px] px-4 rounded-2xl text-sm font-semibold transition-colors ${
      activeChip
        ? "bg-slate-900 text-white"
        : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 active:bg-slate-100"
    }`;

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-4 pb-24">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Purchase Report</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            What you bought, how much of it, and what it cost.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleCsv}
            disabled={busy || loading}
            className="flex-1 sm:flex-none min-h-[48px] px-4 rounded-2xl bg-white border border-slate-200
                       text-slate-700 font-semibold flex items-center justify-center gap-2
                       hover:bg-slate-50 active:bg-slate-100 disabled:opacity-50 transition-colors"
          >
            <SheetIcon className="w-5 h-5" /> CSV
          </button>
          <button
            onClick={handlePdf}
            disabled={busy || loading}
            className="flex-1 sm:flex-none min-h-[48px] px-4 rounded-2xl bg-slate-900 text-white font-semibold
                       flex items-center justify-center gap-2 active:bg-slate-700 disabled:opacity-50
                       transition-colors"
          >
            <FileText className="w-5 h-5" /> {busy ? "Building…" : "PDF"}
          </button>
        </div>
      </div>

      {/* ------------------------------- period -------------------------------- */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <button key={p.id} onClick={() => setRangeId(p.id)} className={rangeChip(rangeId === p.id)}>
              {p.label}
            </button>
          ))}
          <button onClick={() => setRangeId("custom")} className={rangeChip(rangeId === "custom")}>
            <Calendar className="w-4 h-4 inline -mt-0.5 mr-1.5" />
            Custom
          </button>
        </div>

        {rangeId === "custom" && (
          <div className="flex flex-col sm:flex-row gap-2.5">
            <label className="flex-1">
              <span className="block text-xs font-medium text-slate-500 mb-1">From</span>
              <input
                type="date"
                value={custom.start}
                max={custom.end || undefined}
                onChange={(e) => setCustom((c) => ({ ...c, start: e.target.value }))}
                className="w-full min-h-[48px] px-4 text-[15px] border border-slate-200 rounded-2xl bg-slate-50
                           focus:bg-white focus:border-mint-500 focus:ring-2 focus:ring-mint-500/20 outline-none"
              />
            </label>
            <label className="flex-1">
              <span className="block text-xs font-medium text-slate-500 mb-1">To</span>
              <input
                type="date"
                value={custom.end}
                min={custom.start || undefined}
                onChange={(e) => setCustom((c) => ({ ...c, end: e.target.value }))}
                className="w-full min-h-[48px] px-4 text-[15px] border border-slate-200 rounded-2xl bg-slate-50
                           focus:bg-white focus:border-mint-500 focus:ring-2 focus:ring-mint-500/20 outline-none"
              />
            </label>
          </div>
        )}

        <p className="text-xs text-slate-500">
          {active.start} to {active.end} · counts goods actually received, at the invoiced price
        </p>
      </div>

      {/* -------------------------------- totals ------------------------------- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile
          label="Total spend"
          value={`${currency} ${compact(shownTotals.spend)}`}
          sub={`${currency} ${money(shownTotals.spend)}`}
          accent
        />
        <StatTile label="Products bought" value={compact(visible.length)} sub="distinct items" />
        <StatTile label="Deliveries received" value={compact(totals.orderCount)} sub="purchase orders" />
        <StatTile
          label="Average per delivery"
          value={`${currency} ${compact(totals.avgOrderValue)}`}
          sub={`${currency} ${money(totals.avgOrderValue)}`}
        />
      </div>

      {/* ------------------------------- filters ------------------------------- */}
      <div className="space-y-2.5">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <select
            value={vendorId}
            onChange={(e) => setVendorId(e.target.value)}
            className="flex-1 min-h-[48px] px-4 text-[15px] border border-slate-200 rounded-2xl bg-white
                       focus:border-mint-500 focus:ring-2 focus:ring-mint-500/20 outline-none transition-colors"
          >
            <option value="">All suppliers</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="sm:w-56 min-h-[48px] px-4 text-[15px] border border-slate-200 rounded-2xl bg-white
                       focus:border-mint-500 focus:ring-2 focus:ring-mint-500/20 outline-none transition-colors"
          >
            <option value="spend">Sort by spend</option>
            <option value="qty">Sort by quantity</option>
            <option value="name">Sort by name</option>
          </select>
        </div>

        <ItemFilterBar
          items={items}
          search={search}
          onSearchChange={setSearch}
          category={category}
          onCategoryChange={setCategory}
          placeholder="Find a product…"
        />
      </div>

      {/* --------------------------------- rows -------------------------------- */}
      {loading ? (
        <p className="py-10 text-center text-slate-400 animate-pulse">Loading…</p>
      ) : visible.length === 0 ? (
        <div className="py-14 px-6 text-center bg-white rounded-3xl border border-slate-100">
          <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-700">Nothing purchased in this period</h3>
          <p className="text-slate-500 text-sm mt-1 max-w-sm mx-auto">
            Only received deliveries count. Orders still waiting with a supplier are not included.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-3xl border border-slate-100 overflow-hidden">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr className="text-slate-600">
                  <th className="px-4 py-3 text-left font-semibold">Item</th>
                  <th className="px-4 py-3 text-right font-semibold">Quantity</th>
                  <th className="px-4 py-3 text-right font-semibold">Spend</th>
                  <th className="px-4 py-3 text-right font-semibold">Avg price</th>
                  <th className="px-4 py-3 text-right font-semibold">Range</th>
                  <th className="px-4 py-3 text-right font-semibold">Times</th>
                  <th className="px-4 py-3 text-right font-semibold">Last bought</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((r) => (
                  <tr
                    key={r.key}
                    onClick={() => setDetail(r)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{r.name}</div>
                      <div className="text-xs text-slate-500">
                        {r.category} · {r.vendors.join(", ") || "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-900">
                      {r.qty} <span className="text-xs font-normal text-slate-400">{r.unit}</span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-900">
                      {money(r.spend)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">{money(r.avgPrice)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-xs text-slate-500">
                      {r.minPrice === r.maxPrice ? "—" : `${money(r.minPrice)}–${money(r.maxPrice)}`}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">{r.orders}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-500">
                      {localDate(r.lastDate)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t border-slate-200">
                <tr className="font-bold text-slate-900">
                  <td className="px-4 py-3">Total</td>
                  <td className="px-4 py-3 text-right tabular-nums">{shownTotals.qty}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {currency} {money(shownTotals.spend)}
                  </td>
                  <td colSpan={4} />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2.5">
            {visible.map((r) => (
              <button
                key={r.key}
                onClick={() => setDetail(r)}
                className="w-full text-left rounded-2xl border border-slate-200 bg-white p-3.5
                           active:bg-slate-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 text-[15px] leading-snug">{r.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{r.category}</p>
                  </div>
                  <p className="text-base font-bold text-slate-900 tabular-nums shrink-0">
                    {currency} {money(r.spend)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 mt-2">
                  <span className="font-semibold text-slate-700 tabular-nums">
                    {r.qty} {r.unit}
                  </span>
                  <span>avg {money(r.avgPrice)}</span>
                  <span>{r.orders}× ordered</span>
                  <span>last {localDate(r.lastDate)}</span>
                </div>
              </button>
            ))}
            <div className="rounded-2xl bg-slate-900 text-white p-4 flex items-center justify-between">
              <span className="text-sm font-semibold">Total</span>
              <span className="text-lg font-bold tabular-nums">
                {currency} {money(shownTotals.spend)}
              </span>
            </div>
          </div>
        </>
      )}

      {/* ------------------------------- detail -------------------------------- */}
      <Sheet
        open={!!detail}
        title={detail?.name || ""}
        subtitle={detail ? `${detail.category} · ${detail.qty} ${detail.unit} in this period` : ""}
        onClose={() => setDetail(null)}
        maxWidth="max-w-lg"
      >
        {detail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <StatTile label="Total spend" value={`${currency} ${money(detail.spend)}`} accent />
              <StatTile label="Average price" value={`${currency} ${money(detail.avgPrice)}`} sub={`per ${detail.unit}`} />
            </div>

            {detail.minPrice !== detail.maxPrice && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-3.5 flex items-start gap-2.5">
                <TrendingUp className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-900">
                  Price moved between {currency} {money(detail.minPrice)} and {currency}{" "}
                  {money(detail.maxPrice)} in this period.
                </p>
              </div>
            )}

            <div>
              <p className="text-sm font-semibold text-slate-700 mb-2">Every purchase</p>
              <div className="rounded-2xl border border-slate-200 divide-y divide-slate-100">
                {detail.history.map((h, idx) => (
                  <div key={idx} className="p-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 text-sm">{h.date}</p>
                        <p className="text-xs text-slate-500 mt-0.5 truncate">
                          {h.vendor}
                          {h.poNo ? ` · ${h.poNo}` : ""}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-slate-900 tabular-nums text-sm">
                          {currency} {money(h.value)}
                        </p>
                        <p className="text-xs text-slate-500 tabular-nums">
                          {h.qty} {detail.unit} @ {money(h.price)}
                        </p>
                      </div>
                    </div>
                    {h.orderedQty > 0 && h.orderedQty !== h.qty && (
                      <p className="text-xs text-amber-700 mt-1.5">
                        Ordered {h.orderedQty}, received {h.qty}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Sheet>

      {toastNode}
    </div>
  );
}
