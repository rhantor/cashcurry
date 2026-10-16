"use client";
import { format } from "date-fns";
import { CalendarRange } from "lucide-react";
import { DateRangePicker, Tabs } from "@/app/components/ui";
import { useBusinessToday } from "@/app/hooks/useRegion";
import { dayKeyOfFilter, filterFromInput, filterToInput, presetFilter } from "@/utils/dashboard/dateFilters";

const PRESETS = [
  { value: "month", label: "This month" },
  { value: "week", label: "7 days" },
  { value: "days30", label: "30 days" },
  { value: "custom", label: "Custom" },
];

/**
 * Which period a dashboard shows. Presets end on today's business day
 * (branch clock + cut-off); Custom opens a date range picker.
 * filter = { from: Date, to: Date, preset } as the dashboard hooks expect.
 */
export default function PeriodBar({ filter, setFilter, busy = false }) {
  const today = useBusinessToday();
  const range = dayKeyOfFilter(filter);
  const active = filter.preset === "custom" ? "custom" : PRESETS.find((p) => p.value === filter.preset)?.value || "month";

  const pick = (value) => {
    if (value === "custom") return setFilter((f) => ({ ...f, preset: "custom" }));
    setFilter(presetFilter(value, new Date(), today));
  };

  const label =
    range.from && range.to
      ? range.from.slice(0, 7) === range.to.slice(0, 7)
        ? `${format(filter.from, "d")} – ${format(filter.to, "d MMM yyyy")}`
        : `${format(filter.from, "d MMM")} – ${format(filter.to, "d MMM yyyy")}`
      : "";

  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
      <div className="-mx-1 max-w-full overflow-x-auto px-1">
        <Tabs size="sm" tabs={PRESETS} value={active} onChange={pick} />
      </div>
      {active === "custom" ? (
        <div className="w-full sm:w-64">
          <DateRangePicker
            value={range}
            max={today}
            onChange={({ from, to }) => setFilter({ from: filterFromInput(from), to: filterToInput(to), preset: "custom" })}
          />
        </div>
      ) : (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted">
          <CalendarRange className="size-3.5" />
          {label}
        </span>
      )}
      {busy && (
        <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-medium text-subtle">
          <span className="size-1.5 animate-pulse rounded-full bg-brand" />
          Updating
        </span>
      )}
    </div>
  );
}
