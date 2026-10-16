"use client";
import { format, parseISO } from "date-fns";
import { CalendarCheck, Sparkles, TrendingUp } from "lucide-react";
import { Card, CountUp, Skeleton } from "@/app/components/ui";
import { formatMoney } from "@/lib/region/currency";
import { COLOR, Delta, Legend, TimeChart } from "./kit";

const day = (k) => (k ? format(parseISO(k), "EEE d MMM") : "");
const span = (a, b) => (a && b ? `${format(parseISO(a), "d MMM")} – ${format(parseISO(b), "d MMM")}` : "");

/**
 * The headline: this period's sales, how it compares with the period before,
 * three quick facts, and the day-by-day chart against the previous period.
 * compareData rows: { label, current, previous, currentDate, prevDate };
 * rows without a `previous` field (e.g. company-wide) skip the comparison.
 */
export default function SalesHero({ total = 0, compareData = [], currency, loading, title = "Sales this period" }) {
  const money = (v) => formatMoney(v, currency);
  const days = compareData.filter((d) => d.currentDate);
  const prevDays = compareData.filter((d) => d.prevDate);
  const before = prevDays.reduce((n, d) => n + (Number(d.previous) || 0), 0);
  const best = days.reduce((b, d) => (Number(d.current) > (Number(b?.current) || 0) ? d : b), null);
  const selling = days.filter((d) => Number(d.current) > 0).length;
  const avg = days.length ? total / days.length : 0;
  const compare = before > 0;
  const comparable = compareData.some((d) => "previous" in d);
  // Days at the end with nothing yet (today, before the sales are entered)
  // stop the line instead of dropping it to zero.
  let last = compareData.length - 1;
  while (last >= 0 && compareData[last].currentDate && !Number(compareData[last].current)) last--;
  const rows = compareData.map((d, i) => (i > last && d.currentDate ? { ...d, current: null } : d));

  if (loading) {
    return (
      <Card className="p-4 sm:p-6">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-3 h-9 w-48" />
        <div className="mt-5 grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-12" rounded="rounded-xl" />
          ))}
        </div>
        <Skeleton className="mt-5 h-64 w-full" rounded="rounded-xl" />
      </Card>
    );
  }

  const facts = [
    { icon: TrendingUp, label: "Daily average", value: money(avg) },
    { icon: Sparkles, label: "Best day", value: best?.current ? money(best.current) : "—", note: best?.current ? day(best.currentDate) : "" },
    { icon: CalendarCheck, label: "Days with sales", value: `${selling} of ${days.length}` },
  ];

  return (
    <Card className="overflow-hidden p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle">{title}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            <CountUp value={total} format={money} className="text-3xl font-bold tracking-tight text-fg sm:text-4xl" />
            <Delta now={total} before={before} />
          </div>
          {comparable && <p className="mt-1 text-xs text-muted">
            {compare ? (
              <>
                vs <span className="font-semibold text-fg">{money(before)}</span> in {span(prevDays[0]?.prevDate, prevDays.at(-1)?.prevDate)}
              </>
            ) : (
              "No sales in the period before to compare with"
            )}
          </p>}
        </div>
        <Legend
          items={[
            { name: "This period", color: COLOR.in, kind: "line" },
            ...(compare ? [{ name: "Period before", color: COLOR.prior, dashed: true }] : []),
          ]}
        />
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
        {facts.map((f) => (
          <div key={f.label} className="min-w-0 rounded-xl bg-surface-2/70 px-2.5 py-2 sm:px-3.5 sm:py-2.5">
            <dt className="flex items-center gap-1 text-[11px] font-medium text-muted">
              <f.icon className="hidden size-3.5 shrink-0 sm:block" />
              <span className="truncate">{f.label}</span>
            </dt>
            <dd className="mt-0.5 truncate text-sm font-bold tabular-nums text-fg sm:text-base">{f.value}</dd>
            {f.note && <dd className="truncate text-[11px] text-subtle">{f.note}</dd>}
          </div>
        ))}
      </dl>

      <div className="mt-5">
        <TimeChart
          data={rows}
          xKey="label"
          mark={best?.current ? { x: best.label, y: best.current, label: "Best day", color: COLOR.in } : undefined}
          currency={currency}
          height={260}
          labelOf={(row, label) => (row?.currentDate ? day(row.currentDate) : label)}
          series={[
            ...(compare ? [{ key: "previous", name: "Period before", color: COLOR.prior, kind: "line", dashed: true }] : []),
            { key: "current", name: "This period", color: COLOR.in, kind: "area" },
          ]}
        />
      </div>
    </Card>
  );
}
