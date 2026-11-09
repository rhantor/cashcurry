"use client";
// Advance report, "By salary month": what comes off one month's salary, even
// when it was given after the month ended. Meaning: lib/payroll/advanceMonth.js
import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { skipToken } from "@reduxjs/toolkit/query";
import { CalendarPlus, ChevronLeft, ChevronRight, Download, FileSpreadsheet, FileText, HandCoins, Hourglass, Users } from "lucide-react";
import { useGetAdvanceEntriesQuery } from "@/lib/redux/api/AdvanceApiSlice";
import { useBusinessToday } from "@/app/hooks/useRegion";
import { Avatar, Badge, Button, Card, Menu, Skeleton } from "@/app/components/ui";
import ReportErrorState from "@/app/components/common/ReportErrorState";
import StatTiles from "@/app/components/purchases/StatTiles";
import { salaryMonthReport } from "@/lib/payroll/advanceMonth";
import { shiftMonth } from "@/lib/payroll/deductionMonths";
import { exportSalaryMonthToExcel, exportSalaryMonthToPDF } from "@/app/export/exportAdvanceData";
import { ADVANCE_TYPES } from "./AdvanceSheets";

const monthName = (m) => format(parseISO(`${m}-01`), "MMMM yyyy");
const shortMonth = (m) => format(parseISO(`${m}-01`), "MMM");
const dayText = (d) => (d ? format(parseISO(d), "d MMM yyyy") : "—");

export default function SalaryMonthView({ companyId, branchId, branchData, money, toolbar, onOpen }) {
  const today = useBusinessToday();
  // salaries are paid after the month ends, so last month is the one usually asked about
  const [picked, setPicked] = useState(null);
  const month = picked || shiftMonth(String(today).slice(0, 7), -1);
  const { data = [], isLoading, error } = useGetAdvanceEntriesQuery(companyId && branchId ? { companyId, branchId } : skipToken);
  const report = useMemo(() => salaryMonthReport(data, month), [data, month]);

  if (error) return <ReportErrorState error={error} title="Couldn't load the advances" />;
  const name = shortMonth(month);

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-5 sm:px-6 sm:py-6">
      <div className="flex flex-wrap items-center gap-3">
        {toolbar}
        <div className="flex items-center gap-1 rounded-xl border border-line bg-surface p-1 shadow-card">
          <Button size="icon" variant="ghost" className="size-9" aria-label="Previous month" onClick={() => setPicked(shiftMonth(month, -1))}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-[8.5rem] text-center text-sm font-semibold text-fg">{monthName(month)}</span>
          <Button size="icon" variant="ghost" className="size-9" aria-label="Next month" onClick={() => setPicked(shiftMonth(month, 1))}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <div className="ml-auto">
          <Menu
            align="end"
            width={200}
            trigger={(p) => (
              <Button {...p} variant="secondary" icon={Download} disabled={!report.rows.length}>
                Export
              </Button>
            )}
            items={[
              { label: "PDF", icon: FileText, onSelect: () => exportSalaryMonthToPDF(report, branchData, monthName(month)) },
              { label: "Excel", icon: FileSpreadsheet, onSelect: () => exportSalaryMonthToExcel(report, branchData, monthName(month)) },
            ]}
          />
        </div>
      </div>

      <StatTiles
        loading={isLoading}
        tiles={[
          { label: `From ${name} salary`, value: money(report.total), note: `${report.rows.length} advance${report.rows.length === 1 ? "" : "s"}`, icon: HandCoins, tone: "bg-brand-soft text-brand" },
          { label: "Still to take", value: money(report.toTake), note: report.taken > 0 ? `${money(report.taken)} already taken` : "Payroll hasn't taken any yet", icon: Hourglass, tone: "bg-warning-soft text-warning" },
          { label: `Given after ${name} ended`, value: money(report.givenLater), note: `${report.staff.length} staff in all`, icon: CalendarPlus, tone: "bg-info-soft text-info" },
        ]}
      />

      {report.waiting.length > 0 && (
        <p className="rounded-xl bg-warning-soft px-3 py-2 text-xs text-fg">
          {report.waiting.length} approved but not handed over yet: {report.waiting.map((r) => `${r.staffName} ${money(r.amount)}`).join(", ")}. Payroll won&apos;t take these until they are paid out, so they aren&apos;t counted here.
        </p>
      )}

      {isLoading ? (
        <Skeleton className="h-48" rounded="rounded-2xl" />
      ) : report.staff.length === 0 ? (
        <Card className="p-8 text-center">
          <Users className="mx-auto mb-2 size-6 text-subtle" />
          <p className="font-semibold text-fg">No advances come off the {name} salary</p>
          <p className="mt-1 text-sm text-muted">Pick another month with the arrows above.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {report.staff.map((s) => (
            <Card key={s.staffName} className="overflow-hidden">
              <div className="flex items-center gap-3 border-b border-line bg-surface-2/50 px-4 py-3">
                <Avatar name={s.staffName} size="sm" />
                <p className="min-w-0 flex-1 truncate font-semibold text-fg">{s.staffName}</p>
                <p className="font-bold tabular-nums text-fg">{money(s.amount)}</p>
              </div>
              {s.rows.map((r) => (
                <button key={r.id} type="button" onClick={() => onOpen(r.a)} className="flex w-full items-center gap-3 border-b border-line px-4 py-2.5 text-left last:border-b-0 hover:bg-surface-2/60">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-fg">
                      Given {dayText(r.date)}
                      {r.givenLater && <span className="ml-2 text-xs font-medium text-info">after {name} ended</span>}
                    </span>
                    <span className="block truncate text-xs text-muted">{[ADVANCE_TYPES[r.advanceType] || r.advanceType, r.reason].filter(Boolean).join(" · ") || "Advance"}</span>
                  </span>
                  <Badge tone={r.taken ? "info" : "brand"}>{r.taken ? "Taken" : "To take"}</Badge>
                  <span className="w-24 shrink-0 text-right text-sm font-semibold tabular-nums text-fg">{money(r.amount)}</span>
                </button>
              ))}
            </Card>
          ))}
          <div className="flex items-center justify-between rounded-2xl bg-brand-soft px-4 py-3 font-bold text-fg">
            <span>Total from {name} salary</span>
            <span className="tabular-nums">{money(report.total)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
