"use client";
import { useEffect, useMemo, useState } from "react";
import { endOfMonth, endOfWeek, format, isValid, parseISO, startOfMonth, startOfWeek, subDays, subMonths } from "date-fns";
import { ArrowDownWideNarrow, ArrowUpNarrowWide, CalendarRange, Download, FileSpreadsheet, FileText, Hash, Search, Sigma, TrendingUp } from "lucide-react";
import useCurrency from "@/app/hooks/useCurrency";
import { useBusinessToday } from "@/app/hooks/useRegion";
import { formatMoney } from "@/lib/region/currency";
import { Button, Card, CountUp, DataTable, DateRangePicker, Input, Menu, Select, Skeleton, Tabs, cn } from "@/app/components/ui";
import { COLOR, ChartCard, TimeChart } from "@/app/components/dashboard/charts/kit";

// The periods a report can show. The values are what the export functions
// have always received as `filterType`, so their titles keep working.
const PERIODS = [
  { value: "monthly", label: "This month" },
  { value: "weekly", label: "This week" },
  { value: "last7days", label: "Last 7 days" },
  { value: "month", label: "Pick a month" },
  { value: "range", label: "Dates" },
];
const THEME = { sales: COLOR.in, cost: COLOR.out, deposit: COLOR.bank, default: COLOR.bank };
const key = (d) => format(d, "yyyy-MM-dd");
// A record's day as "yyyy-MM-dd", whether it is stored as text, a Date or a Firestore timestamp.
const dayOf = (v) => {
  if (!v) return "";
  if (typeof v === "string") return v.length >= 10 ? v.slice(0, 10) : v.length === 7 ? `${v}-01` : v;
  const d = v.toDate ? v.toDate() : v.seconds ? new Date(v.seconds * 1000) : new Date(v);
  return isValid(d) ? key(d) : "";
};
// "createdBy.username" → entry.createdBy.username
const pick = (obj, path) => path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);

/**
 * A report over a period: pick the period, see the total and the trend, then
 * every record — a table on computers, cards on phones — searchable, newest
 * or oldest first, exported to PDF or Excel. Tapping a record opens it.
 *
 * Props as before: data, branchData, columns [{ key, label, render(val, row), align?, primary?, aside?, hideOnMobile? }],
 * filterConfig { dateField, searchFields, customFilters }, exportFunctions { exportPDF, exportExcel },
 * modalContentRenderer(item, branchData, close, monthTotal), searchBarShow, searchPlaceholder,
 * onDateSync({ startDate, endDate }), chartConfig { enabled, type, valueField, theme }, showTotalsFooter, isLoading.
 * `title` is shown by the top bar now; `toolbar` adds controls next to the period.
 */
export default function ReportPage({
  data = [],
  branchData,
  columns = [],
  filterConfig = {},
  exportFunctions = {},
  modalContentRenderer,
  searchBarShow,
  searchPlaceholder,
  onDateSync,
  chartConfig,
  showTotalsFooter,
  isLoading = false,
  toolbar,
}) {
  const currency = useCurrency();
  const money = (v) => formatMoney(v, currency);
  const today = useBusinessToday();
  const [filterType, setFilterType] = useState("monthly");
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const [selectedMonth, setSelectedMonth] = useState("");
  const [searchDesc, setSearchDesc] = useState("");
  const [sortOrder, setSortOrder] = useState("desc");
  const [selectedItem, setSelectedItem] = useState(null);

  const { dateField = "date", searchFields = [], customFilters } = filterConfig || {};

  // the period as two day keys
  const { from, to } = useMemo(() => {
    const t = parseISO(today);
    if (filterType === "weekly") return { from: key(startOfWeek(t)), to: key(endOfWeek(t)) };
    if (filterType === "last7days") return { from: key(subDays(t, 6)), to: today };
    if (filterType === "range") return { from: dateRange.from || today, to: dateRange.to || dateRange.from || today };
    if (filterType === "month" && selectedMonth) {
      const m = parseISO(`${selectedMonth}-01`);
      return { from: key(startOfMonth(m)), to: key(endOfMonth(m)) };
    }
    return { from: key(startOfMonth(t)), to: key(endOfMonth(t)) };
  }, [filterType, dateRange, selectedMonth, today]);

  // the page fetches the period from the server
  useEffect(() => {
    onDateSync?.({ startDate: from, endDate: to });
  }, [from, to]);

  const filteredData = useMemo(() => {
    let rows = data.filter((r) => {
      const d = dayOf(r[dateField]);
      return d >= from && d <= to;
    });
    const q = searchDesc.trim().toLowerCase();
    if (q && searchFields.length) rows = rows.filter((r) => searchFields.some((f) => String(pick(r, f) ?? "").toLowerCase().includes(q)));
    if (customFilters) rows = customFilters(rows);
    return [...rows].sort((a, b) => {
      const x = dayOf(a[dateField]);
      const y = dayOf(b[dateField]);
      return sortOrder === "asc" ? x.localeCompare(y) : y.localeCompare(x);
    });
  }, [data, dateField, from, to, searchDesc, searchFields, customFilters, sortOrder]);

  // the figure the report adds up
  const valueField = chartConfig?.valueField ?? (data.length && "total" in (data[0] || {}) ? "total" : columns.some((c) => c.key === "amount") ? "amount" : undefined);
  const val = (r) => (Number.isFinite(+r[valueField]) ? +r[valueField] : 0);
  const total = valueField ? filteredData.reduce((n, r) => n + val(r), 0) : 0;
  const best = valueField ? filteredData.reduce((b, r) => (val(r) > (b ? val(b) : -Infinity) ? r : b), null) : null;

  // per day, for the chart
  const chartData = useMemo(() => {
    if (!chartConfig?.enabled || !valueField) return [];
    const byDay = new Map();
    for (const r of filteredData) {
      const d = dayOf(r[dateField]);
      byDay.set(d, (byDay.get(d) || 0) + val(r));
    }
    return [...byDay].sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date, v }));
  }, [chartConfig?.enabled, valueField, filteredData, dateField]);
  const color = typeof chartConfig?.theme === "object" ? chartConfig.theme.stroke : THEME[chartConfig?.theme] || THEME.default;

  // the month the open record falls in, for its sheet
  const monthTotal = useMemo(() => {
    if (!valueField) return "0.00";
    const m = dayOf(selectedItem?.[dateField] || today).slice(0, 7);
    return data
      .filter((r) => dayOf(r[dateField]).startsWith(m))
      .reduce((n, r) => n + val(r), 0)
      .toFixed(2);
  }, [data, valueField, dateField, selectedItem, today]);

  // columns for the table; the added-up figure sits on the right of each phone card
  const tableColumns = useMemo(() => {
    const anyAside = columns.some((c) => c.aside);
    return columns.map((c, i) => ({
      key: c.key,
      label: c.label,
      align: c.align || (c.key === valueField ? "right" : undefined),
      primary: c.primary || (i === 0 && !columns.some((x) => x.primary)),
      aside: c.aside || (!anyAside && c.key === valueField),
      hideOnMobile: c.hideOnMobile || c.key === "__actions",
      render: (r) => (c.render ? c.render(r[c.key], r) : r[c.key]),
    }));
  }, [columns, valueField]);

  const exportArgs = [filteredData, branchData, filterType, dateRange, selectedMonth, searchDesc];
  const months = useMemo(() => Array.from({ length: 18 }, (_, i) => format(subMonths(parseISO(today), i), "yyyy-MM")), [today]);
  const periodText = from === to ? format(parseISO(from), "d MMM yyyy") : `${format(parseISO(from), "d MMM")} – ${format(parseISO(to), "d MMM yyyy")}`;

  const facts = valueField
    ? [
        { icon: Sigma, label: "Total", value: <CountUp value={total} format={money} /> },
        { icon: Hash, label: "Entries", value: filteredData.length },
        { icon: TrendingUp, label: "Average", value: filteredData.length ? money(total / filteredData.length) : "—" },
        { icon: CalendarRange, label: "Highest", value: best ? money(val(best)) : "—", note: best ? format(parseISO(dayOf(best[dateField])), "d MMM") : "" },
      ]
    : [];

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-5 sm:px-6 sm:py-6">
      {/* the period */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <div className="-mx-1 max-w-full overflow-x-auto px-1">
          <Tabs
            size="sm"
            tabs={PERIODS}
            value={filterType}
            onChange={(v) => {
              setFilterType(v);
              if (v === "month" && !selectedMonth) setSelectedMonth(months[0]);
            }}
          />
        </div>
        {filterType === "month" && (
          <Select className="h-9 w-44" value={selectedMonth || months[0]} onChange={(e) => setSelectedMonth(e.target.value)} aria-label="Month">
            {months.map((m) => (
              <option key={m} value={m}>
                {format(parseISO(`${m}-01`), "MMMM yyyy")}
              </option>
            ))}
          </Select>
        )}
        {filterType === "range" && (
          <div className="w-full sm:w-64">
            <DateRangePicker value={{ from, to }} max={today} onChange={(r) => setDateRange(r)} />
          </div>
        )}
        {filterType !== "range" && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted">
            <CalendarRange className="size-3.5" />
            {periodText}
          </span>
        )}
        {toolbar && <div className="ml-auto">{toolbar}</div>}
      </div>

      {/* the period in four numbers */}
      {facts.length > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {facts.map((f) => (
            <Card key={f.label} className="p-4">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
                <f.icon className="size-3.5" /> {f.label}
              </p>
              {isLoading ? (
                <Skeleton className="mt-2 h-6 w-24" />
              ) : (
                <>
                  <p className="mt-1 truncate text-lg font-bold tabular-nums tracking-tight text-fg sm:text-xl">{f.value}</p>
                  {f.note && <p className="text-[11px] text-subtle">{f.note}</p>}
                </>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* the trend */}
      {chartConfig?.enabled && valueField && (
        <ChartCard title="Day by day" subtitle={periodText} loading={isLoading}>
          <TimeChart
            data={chartData}
            currency={currency}
            height={chartConfig.height || 240}
            series={[{ key: "v", name: "Total", color, kind: chartConfig.type === "bar" ? "bar" : "area" }]}
          />
        </ChartCard>
      )}

      {/* the records */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {searchBarShow && (
            <div className="relative w-full min-w-0 sm:w-auto sm:max-w-sm sm:flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
              <Input value={searchDesc} onChange={(e) => setSearchDesc(e.target.value)} placeholder={searchPlaceholder || "Search"} className="pl-9" />
            </div>
          )}
          <div className={cn("flex w-full items-center gap-2 sm:w-auto", "sm:ml-auto")}>
            <Button
              variant="secondary"
              icon={sortOrder === "desc" ? ArrowDownWideNarrow : ArrowUpNarrowWide}
              onClick={() => setSortOrder((s) => (s === "desc" ? "asc" : "desc"))}
            >
              {sortOrder === "desc" ? "Newest first" : "Oldest first"}
            </Button>
            {(exportFunctions.exportPDF || exportFunctions.exportExcel) && (
              <Menu
                align="end"
                width={200}
                trigger={(p) => (
                  <Button {...p} variant="secondary" icon={Download} disabled={!filteredData.length}>
                    Export
                  </Button>
                )}
                items={[
                  exportFunctions.exportPDF && { label: "PDF", icon: FileText, onSelect: () => exportFunctions.exportPDF(...exportArgs) },
                  exportFunctions.exportExcel && { label: "Excel", icon: FileSpreadsheet, onSelect: () => exportFunctions.exportExcel(...exportArgs) },
                ].filter(Boolean)}
              />
            )}
          </div>
        </div>

        <DataTable
          key={`${from}-${to}-${searchDesc}-${sortOrder}`}
          columns={tableColumns}
          rows={filteredData}
          loading={isLoading}
          onRowClick={modalContentRenderer ? setSelectedItem : undefined}
          pageSize={10}
          empty={{ icon: CalendarRange, title: "Nothing in this period", description: searchDesc ? "Nothing matches the search — try other words." : "Pick another period to see more." }}
          footer={
            showTotalsFooter && valueField && filteredData.length
              ? Object.fromEntries(tableColumns.map((c, i) => [c.key, i === 0 ? "Total" : c.key === valueField ? money(total) : ""]))
              : undefined
          }
        />
      </div>

      {selectedItem && modalContentRenderer?.(selectedItem, branchData, () => setSelectedItem(null), monthTotal)}
    </div>
  );
}
