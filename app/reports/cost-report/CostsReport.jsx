"use client";
import { useCallback, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Landmark, Paperclip, Wallet, X } from "lucide-react";
import ReportPage from "@/app/components/common/ReportPage";
import useReportData from "@/app/hooks/useReportData";
import { useDeleteCostEntryMutation, useGetCostEntriesQuery } from "@/lib/redux/api/costApiSlice";
import { exportCostsToExcel, exportCostsToPDF, exportCostToExcel, exportCostToPDF, handleCostShare } from "@/utils/export/exportCostData";
import EditCostModal from "@/app/components/reports/costs/EditCostModal";
import RecordSheet from "@/app/components/entry/RecordSheet";
import { Chip } from "@/app/components/entry/Choices";
import { COLOR, ChartCard, RankedBars } from "@/app/components/dashboard/charts/kit";
import { categoryLabel } from "@/app/entry-data/cost-entry/logic/constants";
import useCurrency from "@/app/hooks/useCurrency";
import { formatMoney } from "@/lib/region/currency";
import { Badge, Select, Skeleton, confirmDialog, toast } from "@/app/components/ui";

const METHODS = { cash: "Cash", card: "Card", qr: "QR", online: "Online", bank_transfer: "Bank transfer" };

// derive safe fields for old documents
const paidFrom = (c) => (c?.paidFromOffice === "front" || c?.paidFromOffice === "back" ? c.paidFromOffice : c?.paidMethod && c.paidMethod !== "cash" ? "back" : "front");
const paidMethod = (c) => c?.paidMethod || (paidFrom(c) === "front" ? "cash" : "");
const categoryOf = (c) => (c.category || "Uncategorized").trim();
const filesOf = (c) => (c.attachments?.length ? c.attachments : c.fileURL ? [c.fileURL] : []);
// Paying a vendor in Purchases writes this cost; it is changed there, so the two never disagree.
const fromPurchases = (c) => c?.meta?.type === "vendor_payment";

/**
 * Cost report: costs over a period with the same period bar and figures as
 * every report, narrowed by category, till or bank and method; where the
 * money went by category and by how it was paid (tap a category to filter);
 * each cost opens as a slip to share, change or delete.
 */
export default function CostsReport() {
  const { ready, args, setFetchArgs, branchData, companyId, branchId } = useReportData();
  const { data: costs = [], isLoading } = useGetCostEntriesQuery(args);
  const [deleteCostEntry] = useDeleteCostEntryMutation();
  const currency = useCurrency();
  const money = (v) => formatMoney(v, currency);

  const [category, setCategory] = useState("");
  const [office, setOffice] = useState("");
  const [method, setMethod] = useState("");
  const [editing, setEditing] = useState(null);

  const categories = useMemo(() => [...new Set(costs.map(categoryOf))].sort(), [costs]);
  const customFilters = useCallback(
    (rows) =>
      rows.filter((c) => (!category || categoryOf(c) === category) && (!office || paidFrom(c) === office) && (!method || paidMethod(c) === method)),
    [category, office, method]
  );
  const anyFilter = category || office || method;

  const remove = async (cost, close) => {
    const ok = await confirmDialog({
      title: "Delete this cost?",
      message: `${categoryLabel(categoryOf(cost))} · ${money(cost.amount)} on ${format(parseISO(cost.date), "d MMM yyyy")}. This can't be undone.`,
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteCostEntry({ companyId, branchId, costId: cost.id }).unwrap();
      close();
      toast.success("Cost deleted");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't delete the cost");
    }
  };

  if (!ready) return <Skeleton className="m-6 h-64" rounded="rounded-2xl" />;

  return (
    <>
      <ReportPage
        title="Cost Report"
        data={costs}
        isLoading={isLoading}
        branchData={branchData}
        onDateSync={(d) => setFetchArgs(d)}
        chartConfig={{ enabled: true, type: "bar", valueField: "amount", theme: "cost" }}
        columns={[
          { key: "date", label: "Day", primary: true, render: (v) => (v ? format(parseISO(v), "EEE, d MMM yyyy") : "—") },
          {
            key: "category",
            label: "What for",
            render: (_v, c) => (
              <span className="block max-w-[16rem]">
                <span className="block font-medium">{categoryLabel(categoryOf(c))}</span>
                {c.description && <span className="block truncate text-xs text-muted">{c.description}</span>}
              </span>
            ),
          },
          {
            key: "paidFromOffice",
            label: "Paid from",
            render: (_v, c) =>
              paidFrom(c) === "front" ? (
                <Badge tone="brand">
                  <Wallet className="size-3" /> Till
                </Badge>
              ) : (
                <Badge tone="info">
                  <Landmark className="size-3" /> {METHODS[paidMethod(c)] || "Bank"}
                </Badge>
              ),
          },
          {
            key: "fileURL",
            label: "Files",
            render: (_v, c) => {
              const n = filesOf(c).length;
              return n ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-info">
                  <Paperclip className="size-3.5" /> {n}
                </span>
              ) : (
                <span className="text-xs text-subtle">—</span>
              );
            },
          },
          { key: "amount", label: "Amount", align: "right", sortValue: (c) => Number(c.amount) || 0, render: (v) => <span className="font-semibold">{money(v)}</span> },
        ]}
        filterConfig={{ dateField: "date", searchFields: ["description", "category", "paidMethod", "paidFromOffice", "meta.vendorName"], customFilters }}
        exportFunctions={{ exportPDF: exportCostsToPDF, exportExcel: exportCostsToExcel }}
        showTotalsFooter
        searchBarShow
        searchPlaceholder="Search note, category, vendor…"
        extra={(rows) => (
          <>
            {/* narrow it down */}
            <div className="flex flex-wrap items-center gap-2">
              <Select className="h-9 w-auto min-w-40" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
                <option value="">All categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {categoryLabel(c)}
                  </option>
                ))}
              </Select>
              <Chip on={office === "front"} onClick={() => (setOffice(office === "front" ? "" : "front"), setMethod(""))}>
                Till
              </Chip>
              <Chip on={office === "back"} onClick={() => (setOffice(office === "back" ? "" : "back"), setMethod(""))}>
                Bank
              </Chip>
              {office === "back" &&
                ["card", "qr", "online", "bank_transfer"].map((m) => (
                  <Chip key={m} on={method === m} onClick={() => setMethod(method === m ? "" : m)}>
                    {METHODS[m]}
                  </Chip>
                ))}
              {anyFilter && (
                <button
                  type="button"
                  onClick={() => (setCategory(""), setOffice(""), setMethod(""))}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-muted hover:text-fg"
                >
                  <X className="size-3.5" /> Clear
                </button>
              )}
            </div>

            {/* where it went */}
            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard title="By category" subtitle="Tap one to see only those" loading={isLoading}>
                <RankedBars
                  format={money}
                  color={COLOR.out}
                  rows={Object.entries(rows.reduce((m, c) => ((m[categoryOf(c)] = (m[categoryOf(c)] || 0) + (Number(c.amount) || 0)), m), {})).map(([key, value]) => ({ key, name: categoryLabel(key), value }))}
                  onPick={(r) => setCategory(r.key)}
                  empty="No costs in this period"
                />
              </ChartCard>
              <ChartCard title="How it was paid" subtitle="From the till, or from the bank by…" loading={isLoading}>
                <RankedBars
                  format={money}
                  color={COLOR.bank}
                  rows={Object.entries(
                    rows.reduce((m, c) => {
                      const k = paidFrom(c) === "front" ? "Till (cash)" : `Bank · ${METHODS[paidMethod(c)] || "other"}`;
                      m[k] = (m[k] || 0) + (Number(c.amount) || 0);
                      return m;
                    }, {})
                  ).map(([name, value]) => ({ name, value }))}
                  empty="No costs in this period"
                />
              </ChartCard>
            </div>
          </>
        )}
        modalContentRenderer={(c, branch, close) => {
          const locked = fromPurchases(c);
          return (
            <RecordSheet
              onClose={close}
              title={`Cost · ${format(parseISO(c.date), "EEEE, d MMMM yyyy")}`}
              branch={branch?.name}
              amount={c.amount}
              amountLabel={categoryLabel(categoryOf(c))}
              tone="out"
              money={money}
              note={locked ? `Paid to ${c.meta?.vendorName || "a vendor"} from Purchases — change or undo it there.` : undefined}
              rows={[
                { label: "Paid from", value: paidFrom(c) === "front" ? "Till (cash)" : `Bank · ${METHODS[paidMethod(c)] || "—"}` },
                { label: "Vendor", value: c.meta?.vendorName },
                { label: "Note", value: c.description },
              ]}
              files={filesOf(c)}
              by={c.createdBy?.username || c.createdBy?.userName}
              at={c.createdAt}
              share={() => handleCostShare(c, branch)}
              pdf={() => exportCostToPDF(c, branch)}
              excel={() => exportCostToExcel(c, branch)}
              onEdit={
                locked
                  ? undefined
                  : () => {
                      close();
                      setEditing(c);
                    }
              }
              onDelete={locked ? undefined : () => remove(c, close)}
            >
              {c.meta?.allocations?.length > 0 && (
                <div className="mt-4 rounded-2xl border border-line p-3">
                  <p className="mb-2 text-xs font-semibold text-muted">Bills paid ({c.meta.allocations.length})</p>
                  <ul className="space-y-1 text-sm">
                    {c.meta.allocations.map((a, i) => (
                      <li key={i} className="flex justify-between gap-3">
                        <span className="truncate text-fg">{a.billNo || a.invoiceNo || a.billId || `Bill ${i + 1}`}</span>
                        <span className="shrink-0 font-semibold tabular-nums text-fg">{money(a.amount ?? a.applied ?? 0)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </RecordSheet>
          );
        }}
      />

      {editing && <EditCostModal cost={editing} onClose={() => setEditing(null)} onSuccess={() => setEditing(null)} />}
    </>
  );
}
