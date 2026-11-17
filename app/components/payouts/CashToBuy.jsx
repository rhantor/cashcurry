"use client";
// Pay-outs → "To buy with cash" (17 Nov 2026): the market's orders (a vendor bought
// with cash from many shops) still waiting for money, for whoever hands out
// pay-outs — the cashier among them, who doesn't open Purchase Orders.
// "Give cash" opens Hand out money on that order.

import { useMemo } from "react";
import { HandCoins, ShoppingBasket } from "lucide-react";
import { skipToken } from "@reduxjs/toolkit/query";
import { Button, Card } from "@/app/components/ui";
import { useGetRequisitionsQuery } from "@/lib/redux/api/requisitionsApiSlice";
import { useGetVendorsQuery } from "@/lib/redux/api/vendorsApiSlice";
import { useGetBranchSettingsQuery } from "@/lib/redux/api/branchSettingsApiSlice";
import { canGiveCash, isMarket } from "@/lib/purchases/countAndOrder";
import { needsApproval } from "@/lib/purchases/orders";

export function useMarketOrders(companyId, branchId) {
  const args = companyId && branchId ? { companyId, branchId } : skipToken;
  const { data: orders = [], refetch } = useGetRequisitionsQuery(args, { refetchOnMountOrArgChange: true });
  const { data: vendors = [] } = useGetVendorsQuery(companyId ? { companyId } : skipToken);
  const { data: settings } = useGetBranchSettingsQuery(args);
  const requireApproval = settings?.purchases?.requirePoApproval === true;
  const list = useMemo(() => {
    const market = new Set(vendors.filter(isMarket).map((v) => v.id));
    return orders
      .filter((o) => market.has(o.vendorId) && canGiveCash(o, { needsApproval: needsApproval(o, requireApproval) }))
      .sort((a, b) => String(b.poNo || "").localeCompare(String(a.poNo || "")));
  }, [orders, vendors, requireApproval]);
  return { list, refetch };
}

export default function CashToBuy({ list = [], money, onGive }) {
  if (!list.length) return null;
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <ShoppingBasket className="size-4 text-brand" />
        <p className="text-sm font-semibold text-fg">To buy with cash ({list.length})</p>
      </div>
      <ul className="divide-y divide-line">
        {list.map((o) => (
          <li key={o.id} className="flex flex-wrap items-center gap-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-fg">{o.poNo || "Order"} · {o.vendorName}</p>
              <p className="text-xs text-muted">
                {(o.items || []).length} item{(o.items || []).length === 1 ? "" : "s"}
                {Number(o.totalEst) > 0 ? ` · about ${money(o.totalEst)}` : ""}
                {o.createdByName ? ` · by ${o.createdByName}` : ""}
              </p>
            </div>
            <Button size="sm" icon={HandCoins} onClick={() => onGive(o)}>Give cash</Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
