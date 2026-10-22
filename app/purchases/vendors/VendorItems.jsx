"use client";
// What we buy from a supplier at this branch and at what price: the last
// price and how it moved from the one before (lib/purchases/vendors.js
// itemPrices), from the item lines on their bills.
import React, { useMemo } from "react";
import { Package, TrendingDown, TrendingUp } from "lucide-react";
import { useGetVendorBillsQuery } from "@/lib/redux/api/vendorBillsApiSlice";
import { formatMoney } from "@/lib/region/currency";
import useCurrency from "@/app/hooks/useCurrency";
import { itemPrices } from "@/lib/purchases/vendors";
import { ListHead, RowList, niceDate } from "./parts";

export default function VendorItems({ companyId, branchId, vendorId }) {
  const currency = useCurrency();
  const money = (v) => formatMoney(Number(v ?? 0), currency);
  const { data: bills = [], isLoading } = useGetVendorBillsQuery(companyId && branchId ? { companyId, branchId, vendorId } : undefined, { skip: !companyId || !branchId });
  const items = useMemo(() => itemPrices(bills), [bills]);
  const up = items.filter((i) => i.change > 0).length;

  return (
    <section>
      <ListHead label="Items bought here" value={items.length}>
        {up > 0 && <span className="text-xs font-semibold text-warning">{up} got dearer</span>}
      </ListHead>
      <RowList
        loading={isLoading}
        rows={items}
        empty={{ icon: Package, title: "No items yet", description: "Bills made from purchase orders list their items — they show here with their prices." }}
      >
        {items.map((i) => (
          <li key={i.key} className="flex items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-fg">{i.name}</p>
              <p className="truncate text-[11px] text-muted">
                Bought {i.times}× · {i.qty} {i.unit} · last {niceDate(i.last.date)}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-bold tabular-nums text-fg">
                {money(i.last.price)}
                {i.unit && <span className="text-[11px] font-medium text-muted"> /{i.unit}</span>}
              </p>
              {i.change != null && (
                <p className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${i.change > 0 ? "text-warning" : "text-success"}`} title={`Was ${money(i.prev.price)} on ${niceDate(i.prev.date)}`}>
                  {i.change > 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                  {i.change > 0 ? "+" : ""}
                  {i.change}% · was {money(i.prev.price)}
                </p>
              )}
            </div>
          </li>
        ))}
      </RowList>
    </section>
  );
}
