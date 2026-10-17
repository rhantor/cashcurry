"use client";
import { useCallback, useMemo, useState } from "react";
import { format, isValid, parseISO } from "date-fns";
import { skipToken } from "@reduxjs/toolkit/query";
import { useGetStaffLoansQuery } from "@/lib/redux/api/staffLoanApiSlice";
import useReportData from "@/app/hooks/useReportData";
import ReportPage from "@/app/components/common/ReportPage";
import ReportErrorState from "@/app/components/common/ReportErrorState";
import { exportStaffLoanTotalsToExcel, exportStaffLoanTotalsToPDF, exportStaffLoansToExcel, exportStaffLoansToPDF } from "@/utils/export/exportStaffLoans";
import { Chip } from "@/app/components/entry/Choices";
import { COLOR, ChartCard, RankedBars } from "@/app/components/dashboard/charts/kit";
import useCurrency from "@/app/hooks/useCurrency";
import { formatMoney } from "@/lib/region/currency";
import { Avatar, Skeleton, Tabs } from "@/app/components/ui";
import { LoanEditSheet, LoanRecord, LoanStatus, StaffSheet, emiOf, owedOf, paidBack, useDeleteLoan } from "./LoanSheets";

const nameOf = (l) => (l.staffName || "Unknown").trim();
const asDate = (v) => {
  const d = typeof v === "string" ? parseISO(v) : v ? new Date(v) : null;
  return d && isValid(d) ? d : null;
};

/** Loans in the period, one row per staff member, biggest first. */
function byStaff(rows) {
  const map = new Map();
  for (const l of rows) {
    const name = nameOf(l);
    const s = map.get(name) || { id: name, staffName: name, totalAmount: 0, totalPaid: 0, owed: 0, count: 0, lastDate: null, entries: [] };
    s.totalAmount += Number(l.amount) || 0;
    s.totalPaid += paidBack(l);
    s.owed += owedOf(l);
    s.count += 1;
    s.entries.push(l);
    const d = asDate(l.date);
    if (d && (!s.lastDate || d > s.lastDate)) s.lastDate = d;
    map.set(name, s);
  }
  return [...map.values()]
    .map((s) => ({ ...s, entries: s.entries.sort((x, y) => String(y.date).localeCompare(String(x.date))) }))
    .sort((a, b) => b.totalAmount - a.totalAmount);
}

/**
 * Staff loan report: approved staff loans (and those already paid back)
 * given in a period — each loan, or totals per staff member — with what has
 * come back through payroll and what is still owed. Each loan opens as a
 * slip with its instalments; it can be changed or deleted until any of it
 * has been paid back (then the Staff Loan Tracker handles it).
 */
export default function LoanReport() {
  const { ready, args, setFetchArgs, branchData, companyId, branchId } = useReportData();
  const { data = [], isLoading, error } = useGetStaffLoansQuery(args);
  const currency = useCurrency();
  const money = (v) => formatMoney(v, currency);

  const [view, setView] = useState("entries");
  const [owedOnly, setOwedOnly] = useState(false);
  const [open, setOpen] = useState(null);
  const [staff, setStaff] = useState(null);
  const [editing, setEditing] = useState(null);
  const remove = useDeleteLoan({ companyId, branchId, money });
  const range = args === skipToken ? {} : { from: args.startDate, to: args.endDate };

  const loans = useMemo(() => data.filter((l) => l.status === "approved" || l.status === "closed"), [data]);
  const staffRows = useMemo(() => byStaff(loans), [loans]);
  const customFilters = useCallback((rows) => (owedOnly ? rows.filter((r) => (r.entries ? r.owed > 0 : owedOf(r) > 0)) : rows), [owedOnly]);

  if (error) return <ReportErrorState error={error} title="Couldn't load the staff loans" />;
  if (!ready) return <Skeleton className="m-6 h-64" rounded="rounded-2xl" />;

  const filters = (
    <div className="flex flex-wrap items-center gap-2">
      <Chip on={owedOnly} onClick={() => setOwedOnly((v) => !v)}>
        Still owed only
      </Chip>
    </div>
  );

  const entriesView = {
    data: loans,
    columns: [
      { key: "date", label: "Day", primary: true, render: (v) => (asDate(v) ? format(asDate(v), "EEE, d MMM yyyy") : "—") },
      {
        key: "staffName",
        label: "Staff",
        render: (_v, l) => (
          <span className="block max-w-[16rem]">
            <span className="block font-medium">{nameOf(l)}</span>
            <span className="block truncate text-xs text-muted">{[`${Number(l.durationMonths) || 1} × ${money(emiOf(l))}`, l.reason].filter(Boolean).join(" · ")}</span>
          </span>
        ),
      },
      { key: "status", label: "Paid back", render: (_v, l) => <LoanStatus l={l} /> },
      { key: "remainingAmount", label: "Still owed", align: "right", hideOnMobile: true, sortValue: owedOf, render: (_v, l) => (owedOf(l) ? <span className="text-warning">{money(owedOf(l))}</span> : <span className="text-subtle">—</span>) },
      { key: "amount", label: "Amount", align: "right", sortValue: (l) => Number(l.amount) || 0, render: (v) => <span className="font-semibold">{money(v)}</span> },
    ],
    filterConfig: { dateField: "date", searchFields: ["staffName", "reason"], customFilters },
    exportFunctions: { exportPDF: exportStaffLoansToPDF, exportExcel: exportStaffLoansToExcel },
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
              onPick={(r) => setStaff(staffRows.find((s) => s.staffName === r.name))}
              empty="No staff loans in this period"
            />
          </ChartCard>
          <ChartCard title="Paid back" subtitle="Of the loans in this period" loading={isLoading}>
            <RankedBars
              format={money}
              color={COLOR.bank}
              rows={[
                { name: "Paid back through payroll", value: rows.reduce((n, l) => n + paidBack(l), 0) },
                { name: "Still owed", value: rows.reduce((n, l) => n + owedOf(l), 0) },
              ].filter((r) => r.value > 0)}
              empty="No staff loans in this period"
            />
          </ChartCard>
        </div>
      </>
    ),
    renderer: (l, branch, close) => <LoanRecord l={l} branch={branch} money={money} onClose={close} onEdit={() => (close(), setEditing(l))} onDelete={() => remove(l, close)} />,
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
      { key: "count", label: "Loans", align: "right", sortValue: (s) => s.count },
      { key: "totalPaid", label: "Paid back", align: "right", hideOnMobile: true, sortValue: (s) => s.totalPaid, render: (v) => (v > 0 ? money(v) : <span className="text-subtle">—</span>) },
      { key: "owed", label: "Still owed", align: "right", sortValue: (s) => s.owed, render: (v) => (v > 0 ? <span className="font-medium text-warning">{money(v)}</span> : <span className="text-subtle">—</span>) },
      { key: "totalAmount", label: "Borrowed", align: "right", sortValue: (s) => s.totalAmount, render: (v) => <span className="font-semibold">{money(v)}</span> },
    ],
    filterConfig: { dateField: "lastDate", searchFields: ["staffName"], customFilters },
    exportFunctions: { exportPDF: exportStaffLoanTotalsToPDF, exportExcel: exportStaffLoanTotalsToExcel },
    chartConfig: { enabled: false, valueField: "totalAmount" },
    searchPlaceholder: "Search staff…",
    extra: () => filters,
    renderer: (s, branch, close) => <StaffSheet staff={s} branch={branch} money={money} range={range} onClose={close} onOpen={(l) => (close(), setOpen(l))} />,
  };

  const v = view === "staff" ? staffView : entriesView;

  return (
    <>
      <ReportPage
        title="Staff Loan Report"
        data={v.data}
        isLoading={isLoading}
        branchData={branchData}
        onDateSync={(d) => setFetchArgs(d)}
        toolbar={
          <Tabs
            value={view}
            onChange={setView}
            tabs={[
              { value: "entries", label: "Each loan" },
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

      {staff && <StaffSheet staff={staff} branch={branchData} money={money} range={range} onClose={() => setStaff(null)} onOpen={(l) => (setStaff(null), setOpen(l))} />}
      {open && <LoanRecord l={open} branch={branchData} money={money} onClose={() => setOpen(null)} onEdit={() => (setOpen(null), setEditing(open))} onDelete={() => remove(open, () => setOpen(null))} />}
      {editing && <LoanEditSheet l={editing} companyId={companyId} branchId={branchId} currency={currency} money={money} onClose={() => setEditing(null)} />}
    </>
  );
}
