"use client";
import { format, parseISO } from "date-fns";
import { Paperclip } from "lucide-react";
import ReportPage from "@/app/components/common/ReportPage";
import useReportData from "@/app/hooks/useReportData";
import { useGetWithdrawEntriesQuery } from "@/lib/redux/api/cashWithdrawApiSlice";
import { exportWithdrawalsToExcel, exportWithdrawalsToPDF, exportWithdrawalToExcel, exportWithdrawalToPDF, shareWithdrawal } from "@/utils/export/exportWithdrawData";
import RecordSheet from "@/app/components/entry/RecordSheet";
import { COLOR, ChartCard, RankedBars } from "@/app/components/dashboard/charts/kit";
import useCurrency from "@/app/hooks/useCurrency";
import { formatMoney } from "@/lib/region/currency";
import { Badge, Skeleton } from "@/app/components/ui";

import { personName } from "@/lib/people";
const filesOf = (w) => (w.receiptUrls?.length ? w.receiptUrls : w.receiptUrl ? [w.receiptUrl] : []);
const forOf = (w) => (w.category || "").trim() || "Other";
const sumBy = (rows, keyOf) =>
  Object.entries(rows.reduce((m, r) => ((m[keyOf(r)] = (m[keyOf(r)] || 0) + (Number(r.amount) || 0)), m), {})).map(([name, value]) => ({ name, value }));

/**
 * Bank to cash report (stored as withdrawals): money taken out of the bank
 * into the till over a period — the same period bar and figures as every
 * report, what it was for and how it was taken out, and each one as a slip
 * to share or download.
 */
export default function WithdrawalReport() {
  const { ready, args, setFetchArgs, branchData } = useReportData();
  const { data: withdrawals = [], isLoading } = useGetWithdrawEntriesQuery(args);
  const currency = useCurrency();
  const money = (v) => formatMoney(v, currency);

  if (!ready) return <Skeleton className="m-6 h-64" rounded="rounded-2xl" />;

  return (
    <ReportPage
      title="Bank to Cash Report"
      data={withdrawals}
      isLoading={isLoading}
      branchData={branchData}
      onDateSync={(d) => setFetchArgs(d)}
      chartConfig={{ enabled: true, type: "bar", valueField: "amount", theme: "deposit" }}
      columns={[
        { key: "date", label: "Day", primary: true, render: (v) => (v ? format(parseISO(v), "EEE, d MMM yyyy") : "—") },
        {
          key: "category",
          label: "For",
          render: (_v, w) => (
            <span className="block max-w-[16rem]">
              <span className="block font-medium">{forOf(w)}</span>
              {w.notes && <span className="block truncate text-xs text-muted">{w.notes}</span>}
            </span>
          ),
        },
        { key: "method", label: "How", render: (v) => (v ? <Badge tone="info">{v}</Badge> : <span className="text-subtle">—</span>) },
        { key: "reference", label: "Reference", hideOnMobile: true, render: (v) => v || <span className="text-subtle">—</span> },
        {
          key: "receiptUrl",
          label: "Receipt",
          render: (_v, w) => {
            const n = filesOf(w).length;
            return n ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-info">
                <Paperclip className="size-3.5" /> {n}
              </span>
            ) : (
              <span className="text-xs text-subtle">—</span>
            );
          },
        },
        { key: "amount", label: "Amount", align: "right", sortValue: (w) => Number(w.amount) || 0, render: (v) => <span className="font-semibold">{money(v)}</span> },
      ]}
      filterConfig={{ dateField: "date", searchFields: ["category", "method", "reference", "notes", "createdBy.username", "createdBy.name"] }}
      exportFunctions={{ exportPDF: exportWithdrawalsToPDF, exportExcel: exportWithdrawalsToExcel }}
      showTotalsFooter
      searchBarShow
      searchPlaceholder="Search what for, how, reference…"
      extra={(rows) => (
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="What it was for" subtitle="Cash taken out of the bank, by use" loading={isLoading}>
            <RankedBars format={money} color={COLOR.bank} rows={sumBy(rows, forOf)} empty="No money taken out of the bank in this period" />
          </ChartCard>
          <ChartCard title="How it was taken out" loading={isLoading}>
            <RankedBars format={money} color={COLOR.other} rows={sumBy(rows, (w) => w.method || "Not given")} empty="No money taken out of the bank in this period" />
          </ChartCard>
        </div>
      )}
      modalContentRenderer={(w, branch, close) => (
        <RecordSheet
          onClose={close}
          title={`Bank to cash · ${w.date ? format(parseISO(w.date), "EEEE, d MMMM yyyy") : ""}`}
          branch={branch?.name}
          amount={w.amount}
          amountLabel="Bank to till"
          tone="bank"
          money={money}
          rows={[
            { label: "For", value: w.category },
            { label: "How", value: w.method },
            { label: "Reference", value: w.reference },
            { label: "Note", value: w.notes },
          ]}
          files={filesOf(w)}
          by={personName(w.createdBy)}
          at={w.createdAt}
          share={() => shareWithdrawal(w, branch)}
          pdf={() => exportWithdrawalToPDF(w, branch)}
          excel={() => exportWithdrawalToExcel(w, branch)}
        />
      )}
    />
  );
}
