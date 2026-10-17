"use client";

import { useMemo, useState } from "react";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { exportSummaryToExcel, exportSummaryToPDF } from "@/utils/export/exportSummary";
import { useSummaryReportLogic } from "@/hook/useSummaryReportLogic";
import PeriodBar from "@/app/components/dashboard/PeriodBar";
import { dayKeyOfFilter, presetFilter } from "@/utils/dashboard/dateFilters";
import { useBusinessToday } from "@/app/hooks/useRegion";
import { COLOR, ChartCard, TimeChart } from "@/app/components/dashboard/charts/kit";
import { Chip } from "@/app/components/entry/Choices";
import useCurrency from "@/app/hooks/useCurrency";
import { formatMoney } from "@/lib/region/currency";
import { Button, Menu, Skeleton, Tabs } from "@/app/components/ui";
import KpiCards from "./components/KpiCards";
import SummaryTable from "./components/SummaryTable";

const MODES = [
  { value: "front", label: "Till (cash)", word: "Front Office" },
  { value: "back", label: "Bank", word: "Back Office" },
  { value: "all", label: "Both", word: "All" },
];

/**
 * Summary report: the branch's cash book over a period — what came in, what
 * went out and where the money stands, for the till, the bank or both. The
 * figures come from the finance engine (useSummaryReportLogic → buildLedger);
 * this page only lays them out: the end figures, how the balance moved, and
 * every day (with its loans, deposits and notes when details are on).
 */
export default function SummaryReport() {
  const today = useBusinessToday();
  const [filter, setFilter] = useState(() => presetFilter("month", new Date(), today));
  const [mode, setMode] = useState("front");
  const [details, setDetails] = useState(true);
  const currency = useCurrency();
  const money = (v) => formatMoney(v, currency);

  // the dashboard's period as the hook's filter
  const { from, to } = dayKeyOfFilter(filter);
  const filterState = useMemo(() => ({ filterType: "range", dateRange: { from, to }, selectedMonth: "" }), [from, to]);
  const { ready, isLoading, branchName, companyName, computed, tenderDefs, commonMeta } = useSummaryReportLogic(filterState, mode);

  const rows = useMemo(() => (details ? computed.rows : computed.rows.filter((r) => r.type === "balance" || r.type === "daily")), [computed.rows, details]);
  const opening = computed.rows.find((r) => r.type === "balance");
  // "Loans given" counts loans to staff too, the same as the table's column
  const kpis = useMemo(() => {
    const toStaff = computed.rows.reduce((n, r) => n + (r.type === "daily" ? Number(r.staffLoanGiven) || 0 : 0), 0);
    return { ...computed.kpis, totalLoanGiven: (Number(computed.kpis.totalLoanGiven) || 0) + toStaff };
  }, [computed]);
  const trend = useMemo(
    () => computed.rows.filter((r) => r.type === "daily").map((r) => ({ date: r.date, cash: r.runningCash, bank: r.runningBank })),
    [computed.rows]
  );

  const hiddenCols = mode === "back" ? { cash: true, cashInHand: true } : { cash: false, cashInHand: false };
  const modeWord = MODES.find((m) => m.value === mode)?.word;
  const meta = {
    ...commonMeta,
    title: `${branchName} Summary`,
    companyName,
    branchName,
    modeLabel: modeWord,
    hiddenCols,
    showRepayCashCols: mode !== "back",
    showRepayBankCols: mode !== "front",
  };
  const exportArgs = [computed.rows, computed.kpis, computed.periodTotals, computed.periodTotalSales, computed.periodDeposits, computed.periodWithdrawals, computed.periodRepaySums, computed.tenderDefs, meta];

  const series = [
    mode !== "back" && { key: "cash", name: "Cash in hand", color: COLOR.in, kind: "area" },
    mode !== "front" && { key: "bank", name: "Bank balance", color: COLOR.bank, kind: "line" },
  ].filter(Boolean);

  if (!ready) return <Skeleton className="m-6 h-64" rounded="rounded-2xl" />;

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-5 sm:px-6 sm:py-6">
      {/* the period, and which money to look at */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-full min-w-0 sm:w-auto sm:flex-1">
          <PeriodBar filter={filter} setFilter={setFilter} busy={isLoading && computed.rows.length > 1} />
        </div>
        <Tabs value={mode} onChange={setMode} tabs={MODES} />
      </div>

      <KpiCards mode={mode} kpis={kpis} opening={{ cash: opening?.runningCash, bank: opening?.runningBank }} money={money} loading={isLoading} />

      <ChartCard
        title={mode === "front" ? "Cash in hand, day by day" : mode === "back" ? "Bank balance, day by day" : "Cash and bank, day by day"}
        subtitle="At the end of each day"
        legend={series.length > 1 ? series.map((s) => ({ name: s.name, color: s.color, kind: "line" })) : undefined}
        loading={isLoading}
      >
        <TimeChart data={trend} currency={currency} height={220} zeroLine={trend.some((d) => d.cash < 0 || d.bank < 0)} series={series} />
      </ChartCard>

      {/* the cash book */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-fg">Day by day</h2>
          <Chip on={details} onClick={() => setDetails((v) => !v)}>
            Show loans, deposits & notes
          </Chip>
        </div>
        <Menu
          align="end"
          width={190}
          trigger={(p) => (
            <Button {...p} variant="secondary" icon={Download} disabled={isLoading}>
              Export
            </Button>
          )}
          items={[
            { label: "PDF", icon: FileText, onSelect: () => exportSummaryToPDF(...exportArgs) },
            { label: "Excel", icon: FileSpreadsheet, onSelect: () => exportSummaryToExcel(...exportArgs) },
          ]}
        />
      </div>

      {isLoading ? (
        <Skeleton className="h-72" rounded="rounded-2xl" />
      ) : (
        <SummaryTable
          tenderDefs={tenderDefs}
          summaryRows={rows}
          mode={mode}
          periodTotals={computed.periodTotals}
          periodTotalSales={computed.periodTotalSales}
          periodDeposits={computed.periodDeposits}
          periodWithdrawals={computed.periodWithdrawals}
          periodRepaySums={computed.periodRepaySums}
          hiddenCols={hiddenCols}
          showRepayCashCols={mode !== "back"}
          showRepayBankCols={mode !== "front"}
        />
      )}
    </div>
  );
}
