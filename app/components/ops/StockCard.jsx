"use client";
// Stock on Ops (8 Nov): on the count day, which suppliers' goods are still to
// count; any day, what is running low. Only once the branch keeps stock, and
// only for those who count it (inventory.count). Nothing shows otherwise.
import Link from "next/link";
import { ChevronRight, ClipboardCheck, PackageMinus } from "lucide-react";
import { cn } from "@/app/components/ui";
import { useInventory } from "@/lib/inventory/client";
import { DAY_NAMES, weekday } from "@/lib/inventory/model";

export default function StockCard({ companyId, branchId, today }) {
  const { data } = useInventory(companyId, branchId, today);
  if (!data?.started) return null;
  const toCount = (data.groups || []).filter((g) => g.vendorId && g.items.length);
  const left = toCount.filter((g) => !g.countedToday);
  const countDay = weekday(today) === data.countDay;
  const low = Object.values(data.stock || {}).filter((r) => r.low);
  if (!(countDay && toCount.length) && !low.length) return null;

  return (
    <Link href="/purchases/inventory" className={cn("flex items-center gap-3 rounded-2xl border px-4 py-3.5", countDay && left.length ? "border-warning/30 bg-warning-soft" : "border-line bg-surface hover:bg-surface-2")}>
      {countDay && left.length ? <ClipboardCheck className="size-5 shrink-0 text-warning" /> : <PackageMinus className="size-5 shrink-0 text-danger" />}
      <span className="min-w-0 flex-1">
        {countDay && toCount.length > 0 && (
          <span className="block font-semibold text-fg">
            {left.length ? `${DAY_NAMES[data.countDay]} count: ${left.length} of ${toCount.length} suppliers left` : `${DAY_NAMES[data.countDay]} count done`}
          </span>
        )}
        {countDay && left.length > 0 && <span className="block truncate text-xs text-muted">{left.map((g) => g.vendorName).join(", ")}</span>}
        {low.length > 0 && (
          <span className={cn("block truncate text-xs", countDay && toCount.length ? "text-danger" : "font-semibold text-danger")}>
            Running low: {low.slice(0, 4).map((r) => r.name).join(", ")}
            {low.length > 4 ? ` +${low.length - 4}` : ""}
          </span>
        )}
      </span>
      <ChevronRight className="size-4 shrink-0 text-subtle" />
    </Link>
  );
}
