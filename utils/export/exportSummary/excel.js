// exportSummary: the excel part (moved from exportSummary.js unchanged).
 
import * as XLSX from "xlsx";
import { toast } from "@/app/components/ui/notify";
import { addLedgerToExcel, buildDetailColumnSpec, buildDetailRow, buildPeriodTotalsRow, buildSummaryColumnSpec, buildSummaryRow, dashOrComma, deriveModeKpis, normMode, safeFilePart } from "./helpers";

/* ================= Excel ================= */
export const exportSummaryToExcel = (
  rows,
  _kpis,
  periodTotals,
  _periodTotalSales,
  periodDeposits,
  periodWithdrawals,
  periodRepaySums,
  tenderDefs,
  meta = {}
) => {
  try {
    if (!rows?.length) return toast.warning("No data!");

    meta = { ...meta, externalKpis: _kpis };

    const spec = buildSummaryColumnSpec(tenderDefs, meta);
    const wb = XLSX.utils.book_new();
    const includeDetailRows = meta.includeDetailRows !== false;

    // --- Summary sheet ---
    const summaryData = [spec.headers];
    rows.map((r) => buildSummaryRow(r, spec)).filter(Boolean).forEach((arr) => summaryData.push(arr));

    // Period Totals row (all modes)
    summaryData.push(
      buildPeriodTotalsRow(rows, spec, periodTotals, periodDeposits, periodWithdrawals, periodRepaySums)
    );

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    wsSummary["!cols"] = spec.headers.map((h) => {
      if (h === "Date") return { wch: 22 };
      if (h === "Sales Notes") return { wch: 60 };
      return { wch: 14 };
    });
    XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

    // --- Details sheet ---
    if (includeDetailRows) {
      const detailSpec = buildDetailColumnSpec();
      const detailRows = rows.map((r) => buildDetailRow(r, detailSpec)).filter(Boolean);
      if (detailRows.length > 0) {
        const wsDetail = XLSX.utils.aoa_to_sheet([detailSpec.headers, ...detailRows]);
        wsDetail["!cols"] = [{ wch: 12 }, { wch: 28 }, { wch: 40 }, { wch: 18 }];
        XLSX.utils.book_append_sheet(wb, wsDetail, "Details");
      }
    }

    // --- KPIs sheet ---
    const kpis = deriveModeKpis(rows, periodTotals, periodDeposits, periodWithdrawals, periodRepaySums, tenderDefs, meta);
    const wsKpi = XLSX.utils.aoa_to_sheet([
      ["Label", "Value"],
      ...kpis.map((k) => [k.label, dashOrComma(k.value)]),
    ]);
    wsKpi["!cols"] = [{ wch: 40 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, wsKpi, "KPIs");

    // --- Ledger sheet(s) ---
    addLedgerToExcel(wb, rows, tenderDefs, meta, normMode(meta));

    const safeName = safeFilePart(meta.filterText || "summary");
    XLSX.writeFile(wb, `summary_${safeName}.xlsx`);
  } catch (err) {
    console.error("Export failed:", err);
    toast.error("Failed to export. Please try again.");
  }
};
