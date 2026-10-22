"use client";
// A supplier's statement at this branch for a period: what was owed at the
// start, each bill and payment with the running balance, what is owed at the
// end (lib/purchases/vendors.js statement) — to check against the supplier's
// own statement each month. On screen and as a PDF.
import React, { useMemo, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format, startOfMonth } from "date-fns";
import { Download, ScrollText } from "lucide-react";
import { Button, DateRangePicker, cn, toast } from "@/app/components/ui";
import { useGetVendorBillsQuery } from "@/lib/redux/api/vendorBillsApiSlice";
import { useGetSingleBranchQuery } from "@/lib/redux/api/branchApiSlice";
import { formatMoney } from "@/lib/region/currency";
import { businessToday } from "@/lib/region";
import useCurrency from "@/app/hooks/useCurrency";
import { statement } from "@/lib/purchases/vendors";
import { RowList, niceDate } from "./parts";

export default function VendorStatement({ companyId, branchId, vendor }) {
  const currency = useCurrency();
  const money = (v) => formatMoney(Number(v ?? 0), currency);
  const plain = (v) => formatMoney(Number(v ?? 0), currency, { plain: true }); // PDF fonts have no ৳
  const today = businessToday();
  const [range, setRange] = useState(() => ({ from: format(startOfMonth(new Date(`${today}T12:00:00`)), "yyyy-MM-dd"), to: today }));
  const args = companyId && branchId ? { companyId, branchId } : undefined;
  const { data: bills = [], isLoading } = useGetVendorBillsQuery(args && { ...args, vendorId: vendor.id }, { skip: !args });
  const { data: branch } = useGetSingleBranchQuery(args, { skip: !args });
  const s = useMemo(() => statement(bills, range.from, range.to), [bills, range.from, range.to]);

  const pdf = () => {
    try {
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.text(`Statement — ${vendor.name}`, 14, 18);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text([branch?.name ? `Branch: ${branch.name}` : "", `${niceDate(range.from)} to ${niceDate(range.to)}`, `Made ${niceDate(today)}`].filter(Boolean), 14, 25);
      doc.setTextColor(20);
      autoTable(doc, {
        startY: 40,
        head: [["Date", "Bill / payment", "Billed", "Paid", "Balance"]],
        body: [
          ["", "Owed at the start", "", "", plain(s.opening)],
          ...s.rows.map((r) => [niceDate(r.date), r.ref, r.debit ? plain(r.debit) : "", r.credit ? plain(r.credit) : "", plain(r.balance)]),
        ],
        foot: [["", "Totals · owed at the end", plain(s.billed), plain(s.paid), plain(s.closing)]],
        styles: { fontSize: 8.5, cellPadding: 2 },
        headStyles: { fillColor: [34, 160, 130] },
        footStyles: { fillColor: [241, 245, 249], textColor: 20, fontStyle: "bold" },
        columnStyles: { 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } },
      });
      doc.save(`Statement_${String(vendor.name || "vendor").replace(/[^\w-]+/g, "_")}_${range.from}_${range.to}.pdf`);
    } catch (e) {
      console.error(e);
      toast.error("Couldn't make the PDF.");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="w-full sm:w-64">
          <DateRangePicker value={range} max={today} onChange={({ from, to }) => setRange({ from, to: to || from })} />
        </div>
        <Button size="sm" variant="secondary" icon={Download} onClick={pdf} disabled={isLoading}>
          PDF
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-4">
        {[
          ["Owed at the start", s.opening],
          ["Billed", s.billed],
          ["Paid", s.paid, "text-success"],
          ["Owed at the end", s.closing, s.closing > 0 ? "text-danger" : "text-success"],
        ].map(([label, v, tone]) => (
          <div key={label} className="bg-surface p-3">
            <p className="text-[11px] font-semibold text-muted">{label}</p>
            <p className={cn("mt-0.5 text-base font-bold tabular-nums", tone || "text-fg")}>{money(v)}</p>
          </div>
        ))}
      </div>

      <RowList loading={isLoading} rows={s.rows} empty={{ icon: ScrollText, title: "Nothing in these dates", description: "No bills or payments with this supplier at this branch." }}>
        {s.rows.map((r, i) => (
          <li key={`${r.date}-${r.ref}-${i}`} className="flex items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-fg">{r.ref}</p>
              <p className="truncate text-[11px] text-muted">
                {niceDate(r.date)} · {r.kind === "bill" ? "bill" : "payment"}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className={cn("text-sm font-bold tabular-nums", r.kind === "bill" ? "text-fg" : "text-success")}>
                {r.kind === "bill" ? `+${money(r.debit)}` : `−${money(r.credit)}`}
              </p>
              <p className="text-[11px] tabular-nums text-muted">owed {money(r.balance)}</p>
            </div>
          </li>
        ))}
      </RowList>
    </div>
  );
}
