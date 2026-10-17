"use client";
import { format, parseISO } from "date-fns";
import { Landmark, Paperclip } from "lucide-react";
import ReportPage from "@/app/components/common/ReportPage";
import useReportData from "@/app/hooks/useReportData";
import { exportDepositsToExcel, exportDepositsToPDF, exportDepositToExcel, exportDepositToPDF, shareDeposit } from "@/utils/export/exportDepositData";
import { useGetDepositEntryQuery } from "@/lib/redux/api/depositApiSlice";
import RecordSheet from "@/app/components/entry/RecordSheet";
import { COLOR, ChartCard, RankedBars } from "@/app/components/dashboard/charts/kit";
import useCurrency from "@/app/hooks/useCurrency";
import { formatMoney } from "@/lib/region/currency";
import { Skeleton } from "@/app/components/ui";

import { personName } from "@/lib/people";
const filesOf = (d) => (d.attachments?.length ? d.attachments : d.fileURL ? [d.fileURL] : []);
const bankOf = (d) => (d.bankName || "").trim() || "Bank not named";

/**
 * Cash to bank report (stored as deposits): cash from the till paid into the
 * bank over a period — the same period bar and figures as every report, how
 * much went to each bank, and each deposit as a slip to share or download.
 */
export default function DepositReport() {
  const { ready, args, setFetchArgs, branchData } = useReportData();
  const { data: deposits = [], isLoading } = useGetDepositEntryQuery(args);
  const currency = useCurrency();
  const money = (v) => formatMoney(v, currency);

  if (!ready) return <Skeleton className="m-6 h-64" rounded="rounded-2xl" />;

  return (
    <ReportPage
      title="Cash to Bank Report"
      data={deposits}
      isLoading={isLoading}
      branchData={branchData}
      onDateSync={(d) => setFetchArgs(d)}
      chartConfig={{ enabled: true, type: "bar", valueField: "amount", theme: "deposit" }}
      columns={[
        { key: "date", label: "Day", primary: true, render: (v) => (v ? format(parseISO(v), "EEE, d MMM yyyy") : "—") },
        {
          key: "bankName",
          label: "Bank",
          render: (_v, d) => (
            <span className="inline-flex items-center gap-1.5 font-medium">
              <Landmark className="size-3.5 text-info" /> {bankOf(d)}
            </span>
          ),
        },
        { key: "traceNo", label: "Trace number", hideOnMobile: true, render: (v) => v || <span className="text-subtle">—</span> },
        {
          key: "fileURL",
          label: "Slip",
          render: (_v, d) => {
            const n = filesOf(d).length;
            return n ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-info">
                <Paperclip className="size-3.5" /> {n}
              </span>
            ) : (
              <span className="text-xs text-warning">Missing</span>
            );
          },
        },
        { key: "createdBy", label: "By", hideOnMobile: true, render: (v) => <span className="text-muted">{personName(v) || "—"}</span> },
        { key: "amount", label: "Amount", align: "right", sortValue: (d) => Number(d.amount) || 0, render: (v) => <span className="font-semibold">{money(v)}</span> },
      ]}
      filterConfig={{ dateField: "date", searchFields: ["bankName", "traceNo", "createdBy.username", "createdBy.name"] }}
      exportFunctions={{ exportPDF: exportDepositsToPDF, exportExcel: exportDepositsToExcel }}
      showTotalsFooter
      searchBarShow
      searchPlaceholder="Search bank or trace number…"
      extra={(rows) => (
        <ChartCard title="By bank" subtitle="Where the cash was paid in" loading={isLoading}>
          <RankedBars
            format={money}
            color={COLOR.bank}
            rows={Object.entries(rows.reduce((m, d) => ((m[bankOf(d)] = (m[bankOf(d)] || 0) + (Number(d.amount) || 0)), m), {})).map(([name, value]) => ({ name, value }))}
            empty="No cash paid into the bank in this period"
          />
        </ChartCard>
      )}
      modalContentRenderer={(d, branch, close) => (
        <RecordSheet
          onClose={close}
          title={`Cash to bank · ${d.date ? format(parseISO(d.date), "EEEE, d MMMM yyyy") : ""}`}
          branch={branch?.name}
          amount={d.amount}
          amountLabel="Paid into the bank"
          tone="bank"
          money={money}
          rows={[
            { label: "Bank", value: d.bankName },
            { label: "Trace number", value: d.traceNo },
          ]}
          files={filesOf(d)}
          by={personName(d.createdBy)}
          at={d.createdAt}
          share={() => shareDeposit(d, branch)}
          pdf={() => exportDepositToPDF(d, branch)}
          excel={() => exportDepositToExcel(d, branch)}
        />
      )}
    />
  );
}
