"use client";

import { useMemo, useState } from "react";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { exportSummaryToExcel, exportSummaryToPDF } from "@/app/export/exportSummary";
import { useSummaryReportLogic } from "@/app/hooks/useSummaryReportLogic";
import PeriodBar from "@/app/components/dashboard/PeriodBar";
import { dayKeyOfFilter, presetFilter } from "@/app/hooks/dashboard/dateFilters";
import { useBusinessToday } from "@/app/hooks/useRegion";
import { ChartCard } from "@/app/components/dashboard/charts/kit";
import { Chip } from "@/app/components/entry/Choices";
import useCurrency from "@/app/hooks/useCurrency";
import { formatMoney } from "@/lib/region/currency";
import { Button, Menu, Skeleton, Tabs } from "@/app/components/ui";
import { Answer, DayList, HowItGotThere, SalesSplit } from "./components/MoneyStory";
import SummaryTable from "./components/SummaryTable";

const MODES = [
  { value: "front", label: "Till", word: "Front Office" },
  { value: "back", label: "Bank", word: "Back Office" },
  { value: "all", label: "Both", word: "All" },
];

/**
 * Summary report: the branch's money over a period, told plainly — where it
 * stands now (in the till, the bank, or both), how it got there from the
 * start, what was sold and where each kind of sale goes, and then each day.
 * The full cash-book table is one tap away for whoever wants every column.
 * Figures: useSummaryReportLogic → buildLedger (the finance engine); this
 * page only lays them out.
 */
export default function SummaryReport() {
  const today = useBusinessToday();
  const [filter, setFilter] = useState(() => presetFilter("month", new Date(), today));
  const [mode, setMode] = useState("front");
  const [layout, setLayout] = useState("simple"); // "simple" | "table"
  const [details, setDetails] = useState(true);
  const currency = useCurrency();
  const money = (v) => formatMoney(v, currency);

  // the dashboard's period as the hook's filter
  const { from, to } = dayKeyOfFilter(filter);
  const filterState = useMemo(() => ({ filterType: "range", dateRange: { from, to }, selectedMonth: "" }), [from, to]);
  const { ready, isLoading, branchName, companyName, computed, ledger, tenderDefs, commonMeta } = useSummaryReportLogic(filterState, mode);

  const tableRows = useMemo(() => (details ? computed.rows : computed.rows.filter((r) => r.type === "balance" || r.type === "daily")), [computed.rows, details]);
  const hiddenCols = mode === "back" ? { cash: true, cashInHand: true } : { cash: false, cashInHand: false };
  const meta = {
    ...commonMeta,
    title: `${branchName} Summary`,
    companyName,
    branchName,
    modeLabel: MODES.find((m) => m.value === mode)?.word,
    hiddenCols,
    showRepayCashCols: mode !== "back",
    showRepayBankCols: mode !== "front",
  };
  const exportArgs = [computed.rows, computed.kpis, computed.periodTotals, computed.periodTotalSales, computed.periodDeposits, computed.periodWithdrawals, computed.periodRepaySums, computed.tenderDefs, meta];

  if (!ready) return <Skeleton className="m-6 h-64" rounded="rounded-2xl" />;

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-5 sm:px-6 sm:py-6">
      {/* the period, and which money to look at */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-full min-w-0 sm:w-auto sm:flex-1">
          <PeriodBar filter={filter} setFilter={setFilter} busy={isLoading && computed.rows.length > 1} />
        </div>
        <Tabs value={mode} onChange={setMode} tabs={MODES} />
      </div>

      {isLoading ? (
        <>
          <Skeleton className="h-44" rounded="rounded-3xl" />
          <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
            <Skeleton className="h-80" rounded="rounded-2xl" />
            <Skeleton className="h-80" rounded="rounded-2xl" />
          </div>
        </>
      ) : (
        <>
          {/* 1. where the money stands */}
          <Answer ledger={ledger} mode={mode} money={money} />

          {/* 2. how it got there, and what was sold */}
          <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
            <ChartCard title="How it got there" subtitle="From the start of the period, what added money and what took it away">
              <HowItGotThere ledger={ledger} mode={mode} currency={currency} />
            </ChartCard>
            <ChartCard title="Sales" subtitle="Every way customers paid, and where that money goes">
              <SalesSplit ledger={ledger} money={money} />
            </ChartCard>
          </div>

          {/* 3. each day */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-fg">Day by day</h2>
              <Tabs
                size="sm"
                value={layout}
                onChange={setLayout}
                tabs={[
                  { value: "simple", label: "Simple" },
                  { value: "table", label: "Full table" },
                ]}
              />
              {layout === "table" && (
                <Chip on={details} onClick={() => setDetails((v) => !v)}>
                  Loans, deposits & notes
                </Chip>
              )}
            </div>
            <Menu
              align="end"
              width={190}
              trigger={(p) => (
                <Button {...p} variant="secondary" icon={Download}>
                  Export
                </Button>
              )}
              items={[
                { label: "PDF", icon: FileText, onSelect: () => exportSummaryToPDF(...exportArgs) },
                { label: "Excel", icon: FileSpreadsheet, onSelect: () => exportSummaryToExcel(...exportArgs) },
              ]}
            />
          </div>

          {layout === "simple" ? (
            <DayList ledger={ledger} rows={computed.rows} mode={mode} money={money} />
          ) : (
            <SummaryTable
              tenderDefs={tenderDefs}
              summaryRows={tableRows}
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
        </>
      )}
    </div>
  );
}
