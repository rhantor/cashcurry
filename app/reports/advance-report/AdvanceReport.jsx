"use client";
import { useCallback, useMemo, useState } from "react";
import { format, isValid, parseISO } from "date-fns";
import { useGetAdvanceEntriesQuery } from "@/lib/redux/api/AdvanceApiSlice";
import useReportData from "@/app/hooks/useReportData";
import ReportPage from "@/app/components/common/ReportPage";
import ReportErrorState from "@/app/components/common/ReportErrorState";
import { exportAdvanceAllStaffToExcel, exportAdvanceAllStaffToPDF, exportAdvancesToExcel, exportAdvancesToPDF } from "@/app/export/exportAdvanceData";
import { Chip } from "@/app/components/entry/Choices";
import { COLOR, ChartCard, RankedBars } from "@/app/components/dashboard/charts/kit";
import useCurrency from "@/app/hooks/useCurrency";
import { formatMoney } from "@/lib/region/currency";
import { Avatar, Skeleton, Tabs } from "@/app/components/ui";
import { ADVANCE_TYPES, AdvanceEditSheet, AdvanceRecord, AdvanceStatus, StaffSheet, paidBack, useDeleteAdvance } from "./AdvanceSheets";

import { personName } from "@/lib/people";
const nameOf = (a) => (a.staffName || "Unknown").trim();
const owedOf = (a) => (a.status === "closed" ? 0 : Math.max(0, (Number(a.amount) || 0) - paidBack(a)));
const asDate = (v) => {
  const d = typeof v === "string" ? parseISO(v) : v ? new Date(v) : null;
  return d && isValid(d) ? d : null;
};

/** Advances in the period, one row per staff member, biggest first. */
function byStaff(rows) {
  const map = new Map();
  for (const a of rows) {
    const name = nameOf(a);
    const s = map.get(name) || { id: name, staffName: name, totalAmount: 0, owed: 0, count: 0, lastDate: null, entries: [] };
    s.totalAmount += Number(a.amount) || 0;
    s.owed += owedOf(a);
    s.count += 1;
    s.entries.push(a);
    const d = asDate(a.date);
    if (d && (!s.lastDate || d > s.lastDate)) s.lastDate = d;
    map.set(name, s);
  }
  return [...map.values()]
    .map((s) => ({ ...s, entries: s.entries.sort((x, y) => String(y.date).localeCompare(String(x.date))) }))
    .sort((a, b) => b.totalAmount - a.totalAmount);
}

/**
 * Advance report: approved advances (and those already paid back through
 * payroll) over a period — each one, or totals per staff member. Shows who
 * took what, what is still owed, and opens each advance as a slip; it can be
 * changed or deleted until payroll has taken any of it back.
 */
export default function AdvanceReport() {
  const { ready, args, setFetchArgs, branchData, companyId, branchId } = useReportData();
  const { data = [], isLoading, error } = useGetAdvanceEntriesQuery(args);
  const currency = useCurrency();
  const money = (v) => formatMoney(v, currency);

  const [view, setView] = useState("entries");
  const [owedOnly, setOwedOnly] = useState(false);
  const [open, setOpen] = useState(null); // an advance
  const [staff, setStaff] = useState(null); // a staff summary
  const [editing, setEditing] = useState(null);
  const remove = useDeleteAdvance({ companyId, branchId, money });

  const advances = useMemo(() => data.filter((a) => a.status === "approved" || a.status === "closed"), [data]);
  const staffRows = useMemo(() => byStaff(advances), [advances]);
  const customFilters = useCallback((rows) => (owedOnly ? rows.filter((r) => (r.entries ? r.owed > 0 : owedOf(r) > 0)) : rows), [owedOnly]);

  if (error) return <ReportErrorState error={error} title="Couldn't load the advances" />;
  if (!ready) return <Skeleton className="m-6 h-64" rounded="rounded-2xl" />;

  const staffOf = (name) => staffRows.find((s) => s.staffName === name);
  const filters = (
    <div className="flex flex-wrap items-center gap-2">
      <Chip on={owedOnly} onClick={() => setOwedOnly((v) => !v)}>
        Still owed only
      </Chip>
    </div>
  );

  const entriesView = {
    data: advances,
    columns: [
      { key: "date", label: "Day", primary: true, render: (v) => (asDate(v) ? format(asDate(v), "EEE, d MMM yyyy") : "—") },
      {
        key: "staffName",
        label: "Staff",
        render: (_v, a) => (
          <span className="block max-w-[16rem]">
            <span className="block font-medium">{nameOf(a)}</span>
            <span className="block truncate text-xs text-muted">{[ADVANCE_TYPES[a.advanceType] || a.advanceType, a.reason].filter(Boolean).join(" · ")}</span>
          </span>
        ),
      },
      { key: "status", label: "Paid back", render: (_v, a) => <AdvanceStatus a={a} /> },
      { key: "createdBy", label: "By", hideOnMobile: true, render: (v) => <span className="text-muted">{personName(v) || "—"}</span> },
      { key: "amount", label: "Amount", align: "right", sortValue: (a) => Number(a.amount) || 0, render: (v) => <span className="font-semibold">{money(v)}</span> },
    ],
    filterConfig: { dateField: "date", searchFields: ["staffName", "reason", "advanceType"], customFilters },
    exportFunctions: { exportPDF: exportAdvancesToPDF, exportExcel: exportAdvancesToExcel },
    chartConfig: { enabled: true, type: "bar", valueField: "amount", theme: "cost" },
    searchPlaceholder: "Search staff or reason…",
    extra: (rows) => (
      <>
        {filters}
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="By staff" subtitle="Tap a name to see all of theirs" loading={isLoading}>
            <RankedBars
              format={money}
              color={COLOR.out}
              rows={byStaff(rows).map((s) => ({ name: s.staffName, value: s.totalAmount }))}
              onPick={(r) => setStaff(staffOf(r.name))}
              empty="No advances in this period"
            />
          </ChartCard>
          <ChartCard title="Paid back" subtitle="Of the advances in this period" loading={isLoading}>
            <RankedBars
              format={money}
              color={COLOR.bank}
              rows={[
                { name: "Paid back through payroll", value: rows.reduce((n, a) => n + (Number(a.amount) || 0) - owedOf(a), 0) },
                { name: "Still owed", value: rows.reduce((n, a) => n + owedOf(a), 0) },
              ].filter((r) => r.value > 0)}
              empty="No advances in this period"
            />
          </ChartCard>
        </div>
      </>
    ),
    renderer: (a, branch, close) => (
      <AdvanceRecord
        a={a}
        branch={branch}
        money={money}
        onClose={close}
        onEdit={() => (close(), setEditing(a))}
        onDelete={() => remove(a, close)}
      />
    ),
  };

  const staffView = {
    data: staffRows,
    columns: [
      {
        key: "staffName",
        label: "Staff",
        primary: true,
        render: (v) => (
          <span className="inline-flex items-center gap-2.5 font-medium">
            <Avatar name={v} size="sm" /> {v}
          </span>
        ),
      },
      { key: "count", label: "Times", align: "right", sortValue: (s) => s.count },
      { key: "lastDate", label: "Last one", hideOnMobile: true, render: (v) => (v ? format(v, "d MMM yyyy") : "—") },
      { key: "owed", label: "Still owed", align: "right", sortValue: (s) => s.owed, render: (v) => (v > 0 ? <span className="font-medium text-warning">{money(v)}</span> : <span className="text-subtle">—</span>) },
      { key: "totalAmount", label: "Taken", align: "right", sortValue: (s) => s.totalAmount, render: (v) => <span className="font-semibold">{money(v)}</span> },
    ],
    filterConfig: { dateField: "lastDate", searchFields: ["staffName"], customFilters },
    exportFunctions: { exportPDF: exportAdvanceAllStaffToPDF, exportExcel: exportAdvanceAllStaffToExcel },
    chartConfig: { enabled: false, valueField: "totalAmount" },
    searchPlaceholder: "Search staff…",
    extra: () => filters,
    renderer: (s, branch, close) => <StaffSheet staff={s} branch={branch} money={money} onClose={close} onOpen={(a) => (close(), setOpen(a))} />,
  };

  const v = view === "staff" ? staffView : entriesView;

  return (
    <>
      <ReportPage
        title="Advance Report"
        data={v.data}
        isLoading={isLoading}
        branchData={branchData}
        onDateSync={(d) => setFetchArgs(d)}
        toolbar={
          <Tabs
            value={view}
            onChange={setView}
            tabs={[
              { value: "entries", label: "Each advance" },
              { value: "staff", label: "By staff" },
            ]}
          />
        }
        columns={v.columns}
        filterConfig={v.filterConfig}
        exportFunctions={v.exportFunctions}
        chartConfig={v.chartConfig}
        showTotalsFooter
        searchBarShow
        searchPlaceholder={v.searchPlaceholder}
        extra={v.extra}
        modalContentRenderer={v.renderer}
      />

      {staff && <StaffSheet staff={staff} branch={branchData} money={money} onClose={() => setStaff(null)} onOpen={(a) => (setStaff(null), setOpen(a))} />}
      {open && (
        <AdvanceRecord
          a={open}
          branch={branchData}
          money={money}
          onClose={() => setOpen(null)}
          onEdit={() => (setOpen(null), setEditing(open))}
          onDelete={() => remove(open, () => setOpen(null))}
        />
      )}
      {editing && <AdvanceEditSheet a={editing} companyId={companyId} branchId={branchId} currency={currency} money={money} onClose={() => setEditing(null)} />}
    </>
  );
}
