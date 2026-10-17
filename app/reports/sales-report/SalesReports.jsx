"use client";
import { useState } from "react";
import { format, parseISO } from "date-fns";
import { FileText, ImageOff, Pencil } from "lucide-react";
import ReportPage from "@/app/components/common/ReportPage";
import ReportErrorState from "@/app/components/common/ReportErrorState";
import useReportData from "@/app/hooks/useReportData";
import { useGetSalesEntriesQuery } from "@/lib/redux/api/salesApiSlice";
import SalesReportModal from "./SalesReportModal";
import SalesEditModal from "./SalesEditModal";
import { exportSalesToExcel, exportSalesToPDF } from "@/utils/export/exportData";
import useCurrency from "@/app/hooks/useCurrency";
import { formatMoney } from "@/lib/region/currency";
import { Button, Skeleton } from "@/app/components/ui";

import { personName } from "@/lib/people";
/** Sales report: each day's takings over a period, the Z report beside it; a day opens as its sheet. */
export default function SalesReport() {
  const { ready, args, setFetchArgs, branchData, companyId, branchId } = useReportData();
  const { data: sales = [], isLoading, error: salesError } = useGetSalesEntriesQuery(args);
  const currency = useCurrency();
  const money = (v) => formatMoney(v, currency);
  const [editingItem, setEditingItem] = useState(null);

  if (salesError) return <ReportErrorState error={salesError} title="Couldn't load the sales" />;
  if (!ready) return <Skeleton className="m-6 h-64" rounded="rounded-2xl" />;

  return (
    <>
      <ReportPage
        title="Sales Report"
        data={sales}
        isLoading={isLoading}
        branchData={branchData}
        onDateSync={(newDates) => setFetchArgs(newDates)}
        chartConfig={{ enabled: true, type: "area", valueField: "total", theme: "sales" }}
        columns={[
          {
            key: "date",
            label: "Day",
            primary: true,
            render: (val) => (val ? format(parseISO(val), "EEE, d MMM yyyy") : "—"),
          },
          {
            key: "total",
            label: "Total",
            align: "right",
            render: (val) => <span className="font-semibold">{money(val ?? 0)}</span>,
          },
          {
            key: "zReportUrl",
            label: "Z report",
            render: (val) =>
              !val ? (
                <span className="inline-flex items-center gap-1 text-xs text-subtle">
                  <ImageOff className="size-3.5" /> None
                </span>
              ) : String(val).toLowerCase().includes(".pdf") ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-danger">
                  <FileText className="size-3.5" /> PDF
                </span>
              ) : (
                <img src={val} alt="Z report" className="size-9 rounded-lg border border-line object-cover" />
              ),
          },
          {
            key: "createdBy",
            label: "Entered by",
            render: (val) => <span className="truncate text-muted">{personName(val) || "Unknown"}</span>,
          },
          {
            key: "__actions",
            label: "",
            align: "right",
            render: (_val, row) => (
              <Button
                variant="ghost"
                size="sm"
                icon={Pencil}
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingItem(row);
                }}
              >
                Edit
              </Button>
            ),
          },
        ]}
        filterConfig={{ dateField: "date", searchFields: ["createdBy.username", "createdBy.name"] }}
        showTotalsFooter
        exportFunctions={{ exportPDF: exportSalesToPDF, exportExcel: exportSalesToExcel }}
        modalContentRenderer={(item, branchData, closeModal, monthTotal) => (
          <SalesReportModal
            item={item}
            branchData={branchData}
            monthTotal={monthTotal}
            onClose={closeModal}
            onEdit={() => {
              closeModal();
              setEditingItem(item);
            }}
          />
        )}
        searchBarShow
        searchPlaceholder="Search by who entered it"
      />

      {editingItem && (
        <SalesEditModal item={editingItem} branchData={branchData} companyId={companyId} branchId={branchId} onClose={() => setEditingItem(null)} />
      )}
    </>
  );
}
