"use client";
import { useMemo, useState } from "react";
import { format, isValid, parseISO } from "date-fns";
import { skipToken } from "@reduxjs/toolkit/query";
import { AlertTriangle, FileText } from "lucide-react";
import { useGetSalaryEntriesQuery } from "@/lib/redux/api/salaryApiSlice";
import ReportPage from "@/app/components/common/ReportPage";
import ReportErrorState from "@/app/components/common/ReportErrorState";
import useReportData from "@/app/hooks/useReportData";
import { exportSalariesToExcel, exportSalariesToPDF } from "@/app/export/exportSalary";
import { splitSalaryMonth } from "@/lib/payroll/splitSalaryMonth";
import { COLOR, ChartCard, RankedBars } from "@/app/components/dashboard/charts/kit";
import useCurrency from "@/app/hooks/useCurrency";
import { formatMoney } from "@/lib/region/currency";
import { hasRole, ALLOWED_EDIT_ROLES } from "@/lib/authz/roles";
import { getSessionUser } from "@/lib/session";
import { Badge, Skeleton, Tabs } from "@/app/components/ui";
import { SalaryEditSheet, SalaryRecord, amountOf, fromPayroll, monthText, useDeleteSalary } from "./SalarySheets";

const day = (v) => {
  const d = v ? parseISO(v) : null;
  return d && isValid(d) ? format(d, "d MMM yyyy") : "—";
};

/**
 * Salary report: salaries over a period, counted either by the month they are
 * for or by the day they were paid. Payroll writes one record per staff member;
 * salaries entered by hand are one total for the month. Shows the months side
 * by side, warns when a month has both (counted twice), and opens each record
 * as a slip — payroll ones with their pay breakdown.
 */
export default function SalaryReport() {
  const [mode, setMode] = useState("salary"); // "salary" (month it is for) | "payment" (day paid)
  const [editing, setEditing] = useState(null);
  const currency = useCurrency();
  const money = (v) => formatMoney(v, currency);
  const { ready, args: baseArgs, setFetchArgs, branchData, companyId, branchId } = useReportData();
  const canEdit = hasRole(getSessionUser(), ALLOWED_EDIT_ROLES);
  const remove = useDeleteSalary({ companyId, branchId, money });

  const args = baseArgs === skipToken ? skipToken : { ...baseArgs, dateField: mode === "salary" ? "month" : "paymentDate" };
  const { data: entries = [], isLoading, error } = useGetSalaryEntriesQuery(args);

  // The day each record counts on in this view. By month, a month that starts
  // before the period (e.g. "7 days" inside it) is placed on the period's first day.
  const from = baseArgs === skipToken ? "" : baseArgs.startDate || "";
  const rows = useMemo(
    () =>
      entries.map((e) => {
        const monthDay = e.month ? `${e.month.slice(0, 7)}-01` : e.monthStart || "";
        return { ...e, dateForFilter: mode === "salary" ? (from && monthDay && monthDay < from ? from : monthDay) : e.paymentDate || "" };
      }),
    [entries, mode, from]
  );

  if (error) return <ReportErrorState error={error} title="Couldn't load the salaries" />;
  if (!ready) return <Skeleton className="m-6 h-64" rounded="rounded-2xl" />;

  const byMonth = (list) => {
    const m = new Map();
    for (const s of list) if (s.month) m.set(s.month.slice(0, 7), [...(m.get(s.month.slice(0, 7)) || []), s]);
    return [...m].sort(([a], [b]) => b.localeCompare(a));
  };

  return (
    <>
      <ReportPage
        title="Salary Report"
        data={rows}
        isLoading={isLoading}
        branchData={branchData}
        onDateSync={(d) => setFetchArgs(d)}
        toolbar={
          <Tabs
            value={mode}
            onChange={setMode}
            tabs={[
              { value: "salary", label: "By salary month" },
              { value: "payment", label: "By day paid" },
            ]}
          />
        }
        chartConfig={{ enabled: mode === "payment", type: "bar", valueField: "totalSalary", theme: "cost" }}
        columns={[
          {
            key: "staffName",
            label: "Who",
            primary: true,
            render: (v, s) => (
              <span className="block max-w-[16rem]">
                <span className="block font-medium">{fromPayroll(s) ? v || "Staff" : v || "Salaries"}</span>
                <span className="block truncate text-xs text-muted">{fromPayroll(s) ? "Payroll" : ["Entered by hand", s.notes].filter(Boolean).join(" · ")}</span>
              </span>
            ),
          },
          { key: "month", label: "Salary month", render: (v) => <Badge tone="brand">{monthText(v, "MMM yyyy") || "—"}</Badge> },
          { key: "paymentDate", label: "Paid on", render: (v) => <span className="text-muted">{day(v)}</span> },
          {
            key: "pdfUrl",
            label: "Sheet",
            hideOnMobile: true,
            render: (v) =>
              v ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-danger">
                  <FileText className="size-3.5" /> PDF
                </span>
              ) : (
                <span className="text-xs text-subtle">—</span>
              ),
          },
          { key: "totalSalary", label: "Amount", align: "right", aside: true, sortValue: amountOf, render: (_v, s) => <span className="font-semibold">{money(amountOf(s))}</span> },
        ]}
        filterConfig={{ dateField: "dateForFilter", searchFields: ["staffName", "notes", "createdBy.username", "createdBy.name"] }}
        exportFunctions={{
          exportPDF: (data, branch, type, range, month, q) => exportSalariesToPDF(data, branch, { dateMode: mode, filterType: type, range, selectedMonth: month, q }),
          exportExcel: (data, branch, type, range, month, q) => exportSalariesToExcel(data, branch, { dateMode: mode, filterType: type, range, selectedMonth: month, q }),
        }}
        showTotalsFooter
        searchBarShow
        searchPlaceholder="Search staff or note…"
        extra={(list) => {
          const months = byMonth(list);
          const twice = months.filter(([, l]) => {
            const s = splitSalaryMonth(l);
            return s.payroll.count > 0 && s.byHand.length > 0;
          });
          return (
            <>
              {twice.length > 0 && (
                <p className="flex gap-2 rounded-2xl border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-fg">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
                  <span>
                    <b>{twice.map(([m]) => monthText(m)).join(", ")}</b> {twice.length > 1 ? "have" : "has"} salaries from Payroll <b>and</b> entered by hand — the same
                    pay may be counted twice. Check and delete the extra entry.
                  </span>
                </p>
              )}
              <div className="grid gap-4 lg:grid-cols-2">
                <ChartCard title="By salary month" subtitle="What each month's salaries came to" loading={isLoading}>
                  <RankedBars
                    format={money}
                    color={COLOR.out}
                    showShare={false}
                    rows={months.map(([m, l]) => ({ name: monthText(m), value: l.reduce((n, s) => n + amountOf(s), 0) }))}
                    empty="No salaries in this period"
                  />
                </ChartCard>
                <ChartCard title="Highest paid" subtitle="From payroll, in this period" loading={isLoading}>
                  <RankedBars
                    format={money}
                    color={COLOR.bank}
                    showShare={false}
                    rows={Object.entries(list.filter(fromPayroll).reduce((m, s) => ((m[s.staffName || "Staff"] = (m[s.staffName || "Staff"] || 0) + amountOf(s)), m), {})).map(([name, value]) => ({ name, value }))}
                    empty="No payroll salaries in this period"
                  />
                </ChartCard>
              </div>
            </>
          );
        }}
        modalContentRenderer={(s, branch, close) => (
          <SalaryRecord s={s} branch={branch} money={money} canEdit={canEdit} onClose={close} onEdit={() => (close(), setEditing(s))} onDelete={() => remove(s, close)} />
        )}
      />

      {editing && <SalaryEditSheet s={editing} companyId={companyId} branchId={branchId} currency={currency} money={money} onClose={() => setEditing(null)} />}
    </>
  );
}
