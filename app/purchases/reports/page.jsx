"use client";
import { Button, DateRangePicker, Select } from "@/app/components/ui";
import { format as fmtDate, parseISO } from "date-fns";
import { formatMoney, currencyInfo } from "@/lib/region/currency";
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
const niceDay = (k) => (k ? fmtDate(parseISO(k), "d MMM yyyy") : "");

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
        accent ? "border-brand/30 bg-brand-soft/50" : "border-line bg-surface"
      }`}
    >
      <p className="text-xs font-medium text-muted">{label}</p>
      {/* Proportional figures: tabular-nums makes a large standalone value look loose. */}
      <p className={`mt-1 text-2xl font-semibold ${accent ? "text-brand" : "text-fg"}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-subtle mt-0.5">{sub}</p>}
    </div>
  );
}

export default function PurchaseReportPage() {
  const { ready, companyId, branchId } = useResolvedCompanyBranch();
  const currency = useCurrency();
  const fmtMoney = (n) => formatMoney(n, currency);
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
        ? "bg-brand text-brand-fg"
        : "bg-surface text-muted border border-line hover:bg-surface-2 active:bg-surface-2"
    }`;

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-5 pb-24">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-fg">Purchase report</h1>
          <p className="text-muted text-sm mt-0.5">
            What you bought, how much of it, and what it cost.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon={SheetIcon} className="flex-1 sm:flex-none" disabled={busy || loading} onClick={handleCsv}>
            CSV
          </Button>
          <Button icon={FileText} className="flex-1 sm:flex-none" loading={busy} disabled={loading} onClick={handlePdf}>
            PDF
          </Button>
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
          <DateRangePicker
            className="sm:w-72"
            value={custom.start && custom.end ? { from: custom.start, to: custom.end } : null}
            onChange={(v) => setCustom({ start: v?.from || "", end: v?.to || "" })}
          />
        )}

        <p className="text-xs text-muted">
          {niceDay(active.start)} – {niceDay(active.end)} · counts goods actually received, at the invoiced price
        </p>
      </div>

      {/* -------------------------------- totals ------------------------------- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile
          label="Total spend"
          value={`${currencyInfo(currency).symbol} ${compact(shownTotals.spend)}`}
          sub={`${fmtMoney(shownTotals.spend)}`}
          accent
        />
        <StatTile label="Products bought" value={compact(visible.length)} sub="distinct items" />
        <StatTile label="Deliveries received" value={compact(totals.orderCount)} sub="purchase orders" />
        <StatTile
          label="Average per delivery"
          value={`${currencyInfo(currency).symbol} ${compact(totals.avgOrderValue)}`}
          sub={`${fmtMoney(totals.avgOrderValue)}`}
        />
      </div>

      {/* ------------------------------- filters ------------------------------- */}
      <div className="space-y-2.5">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <Select
            value={vendorId}
            onChange={(e) => setVendorId(e.target.value)}
            className="h-12 flex-1"
            aria-label="Supplier"
          >
            <option value="">All suppliers</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </Select>
          <Select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="h-12 sm:w-56"
            aria-label="Sort"
          >
            <option value="spend">Sort by spend</option>
            <option value="qty">Sort by quantity</option>
            <option value="name">Sort by name</option>
          </Select>
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
        <p className="py-10 text-center text-subtle animate-pulse">Loading…</p>
      ) : visible.length === 0 ? (
        <div className="py-14 px-6 text-center bg-surface rounded-3xl border border-line">
          <Package className="w-12 h-12 text-subtle mx-auto mb-3" />
          <h3 className="text-lg font-bold text-fg">Nothing purchased in this period</h3>
          <p className="text-muted text-sm mt-1 max-w-sm mx-auto">
            Only received deliveries count. Orders still waiting with a supplier are not included.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-surface rounded-3xl border border-line overflow-hidden">
            <table className="min-w-full text-sm">
              <thead className="bg-surface-2/60 border-b border-line">
                <tr className="text-muted">
                  <th className="px-4 py-3 text-left font-semibold">Item</th>
                  <th className="px-4 py-3 text-right font-semibold">Quantity</th>
                  <th className="px-4 py-3 text-right font-semibold">Spend</th>
                  <th className="px-4 py-3 text-right font-semibold">Avg price</th>
                  <th className="px-4 py-3 text-right font-semibold">Range</th>
                  <th className="px-4 py-3 text-right font-semibold">Times</th>
                  <th className="px-4 py-3 text-right font-semibold">Last bought</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {visible.map((r) => (
                  <tr
                    key={r.key}
                    onClick={() => setDetail(r)}
                    className="hover:bg-surface-2 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold text-fg">{r.name}</div>
                      <div className="text-xs text-muted">
                        {r.category} · {r.vendors.join(", ") || "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-fg">
                      {r.qty} <span className="text-xs font-normal text-subtle">{r.unit}</span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-fg">
                      {money(r.spend)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted">{money(r.avgPrice)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-xs text-muted">
                      {r.minPrice === r.maxPrice ? "—" : `${money(r.minPrice)}–${money(r.maxPrice)}`}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted">{r.orders}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted">
                      {niceDay(localDate(r.lastDate))}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-surface-2/60 border-t border-line">
                <tr className="font-bold text-fg">
                  <td className="px-4 py-3">Total</td>
                  <td className="px-4 py-3 text-right tabular-nums">{new Set(visible.map((r) => r.unit)).size === 1 ? `${shownTotals.qty} ${visible[0]?.unit || ""}` : ""}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {fmtMoney(shownTotals.spend)}
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
                className="w-full text-left rounded-2xl border border-line bg-surface p-3.5
                           active:bg-surface-2/60 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-fg text-[15px] leading-snug">{r.name}</p>
                    <p className="text-xs text-muted mt-0.5">{r.category}</p>
                  </div>
                  <p className="text-base font-bold text-fg tabular-nums shrink-0">
                    {fmtMoney(r.spend)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted mt-2">
                  <span className="font-semibold text-fg tabular-nums">
                    {r.qty} {r.unit}
                  </span>
                  <span>avg {money(r.avgPrice)}</span>
                  <span>{r.orders}× ordered</span>
                  <span>last {niceDay(localDate(r.lastDate))}</span>
                </div>
              </button>
            ))}
            <div className="rounded-2xl bg-brand text-brand-fg p-4 flex items-center justify-between">
              <span className="text-sm font-semibold">Total</span>
              <span className="text-lg font-bold tabular-nums">
                {fmtMoney(shownTotals.spend)}
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
              <StatTile label="Total spend" value={`${fmtMoney(detail.spend)}`} accent />
              <StatTile label="Average price" value={`${fmtMoney(detail.avgPrice)}`} sub={`per ${detail.unit}`} />
            </div>

            {detail.minPrice !== detail.maxPrice && (
              <div className="rounded-2xl border border-warning/30 bg-warning-soft/60 p-3.5 flex items-start gap-2.5">
                <TrendingUp className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                <p className="text-sm text-warning">
                  Price moved between {fmtMoney(detail.minPrice)} and{" "}
                  {fmtMoney(detail.maxPrice)} in this period.
                </p>
              </div>
            )}

            <div>
              <p className="text-sm font-semibold text-fg mb-2">Every purchase</p>
              <div className="rounded-2xl border border-line divide-y divide-line">
                {detail.history.map((h, idx) => (
                  <div key={idx} className="p-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-fg text-sm">{h.date}</p>
                        <p className="text-xs text-muted mt-0.5 truncate">
                          {h.vendor}
                          {h.poNo ? ` · ${h.poNo}` : ""}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-fg tabular-nums text-sm">
                          {fmtMoney(h.value)}
                        </p>
                        <p className="text-xs text-muted tabular-nums">
                          {h.qty} {detail.unit} @ {money(h.price)}
                        </p>
                      </div>
                    </div>
                    {h.orderedQty > 0 && h.orderedQty !== h.qty && (
                      <p className="text-xs text-warning mt-1.5">
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
