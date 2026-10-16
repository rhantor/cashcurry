"use client";
// The dashboards' chart kit: one look for every chart.
//
// Colour follows the money, the same on every chart (tokens in globals.css,
// validated for colour-blind separation in light and dark):
//   in   — sales, money coming in        (series 1, mint)
//   out  — costs, money going out        (series 2, orange)
//   bank — the bank                       (series 3, blue)
//   other— withdrawals, repayments paid… (series 4, magenta)
//   prior— the previous period            (muted, dashed)
// Thin lines, round-topped bars with a gap, a quiet grid, one y-axis, a
// legend above, and a tooltip on hover/tap.
import { format, parseISO } from "date-fns";
import { motion } from "framer-motion";
import { Bar, CartesianGrid, Cell, ComposedChart, Line, Area, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownRight, ArrowUpRight, BarChart3, ChevronRight } from "lucide-react";
import { Card, Skeleton, cn } from "@/app/components/ui";
import { formatMoney } from "@/lib/region/currency";

export const COLOR = {
  in: "var(--cc-series-1)",
  out: "var(--cc-series-2)",
  bank: "var(--cc-series-3)",
  other: "var(--cc-series-4)",
  prior: "var(--cc-subtle)",
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const tickDate = (v) => (DATE.test(String(v)) ? format(parseISO(v), "d MMM") : v);
const compact = (v) => {
  const n = Number(v) || 0;
  const a = Math.abs(n);
  if (a >= 1e6) return `${(n / 1e6).toFixed(a >= 1e7 ? 0 : 1)}m`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(a >= 1e4 ? 0 : 1)}k`;
  return String(Math.round(n));
};

/** A chart's frame: title, a one-line explanation, the legend, the chart. */
export function ChartCard({ title, subtitle, legend, loading, children, className }) {
  return (
    <Card className={cn("p-4 sm:p-5", className)}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-fg">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
        </div>
        {legend && !loading && <Legend items={legend} />}
      </div>
      {loading ? <Skeleton className="h-56 w-full sm:h-64" rounded="rounded-xl" /> : children}
    </Card>
  );
}

/** Swatch + name per series, above the chart (identity never by colour alone). */
export function Legend({ items }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {items.map((it) => (
        <li key={it.name} className="inline-flex items-center gap-1.5 text-xs text-muted">
          {it.dashed ? (
            <span className="h-0 w-3.5 border-t-2 border-dashed" style={{ borderColor: it.color }} />
          ) : (
            <span className={cn("inline-block", it.kind === "line" ? "h-0.5 w-3.5 rounded-full" : "size-2.5 rounded-[3px]")} style={{ background: it.color }} />
          )}
          {it.name}
        </li>
      ))}
    </ul>
  );
}

/**
 * Up or down against a previous figure: arrow + percentage (never colour
 * alone). `good` says which direction is good news (costs going up is not).
 */
export function Delta({ now, before, good = "up", className }) {
  if (!before) return null;
  const pct = ((now - before) / Math.abs(before)) * 100;
  const up = pct >= 0;
  const happy = up === (good === "up");
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
        happy ? "bg-brand-soft text-brand" : "bg-warning-soft text-warning",
        className
      )}
    >
      <Icon className="size-3.5" />
      {Math.abs(pct) >= 1000 ? ">999" : Math.abs(pct).toFixed(1)}%
    </span>
  );
}

/**
 * A ranked list with a bar per row: easier to read than a pie. Rows past
 * `limit` fold into "Other". rows: [{ name, value, tag? }]. With `onPick(row)`
 * each row is tappable (e.g. to split it by branch).
 */
export function RankedBars({ rows = [], format, color = COLOR.in, limit = 6, showShare = true, empty = "Nothing in this period", onPick }) {
  const sorted = [...rows].filter((r) => r.value).sort((a, b) => b.value - a.value);
  const shown = sorted.length > limit ? [...sorted.slice(0, limit - 1), { name: "Other", value: sorted.slice(limit - 1).reduce((n, r) => n + r.value, 0), other: true }] : sorted;
  const total = sorted.reduce((n, r) => n + r.value, 0);
  const max = Math.max(1, ...shown.map((r) => r.value));
  if (!shown.length) {
    return (
      <div className="flex h-40 flex-col items-center justify-center rounded-xl bg-surface-2/50 text-center">
        <BarChart3 className="mb-2 size-6 text-subtle" />
        <p className="text-sm font-medium text-muted">{empty}</p>
      </div>
    );
  }
  return (
    <ul className="space-y-3.5">
      {shown.map((r, i) => {
        const pick = onPick && !r.other;
        const Row = pick ? "button" : "div";
        return (
        <li key={r.name}>
          <Row
            {...(pick ? { type: "button", onClick: () => onPick(r) } : {})}
            className={cn("block w-full text-left", pick && "-mx-2 rounded-xl px-2 py-1 transition-colors hover:bg-surface-2 active:bg-surface-2")}
            style={pick ? { width: "calc(100% + 1rem)" } : undefined}
          >
          <div className="mb-1.5 flex items-baseline gap-2 text-sm">
            <span className={cn("min-w-0 truncate font-medium", r.other ? "text-muted" : "text-fg")}>{r.name}</span>
            {r.tag && <span className="shrink-0 rounded-md bg-surface-2 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-muted">{r.tag}</span>}
            <span className="ml-auto shrink-0 font-semibold tabular-nums text-fg">{format(r.value)}</span>
            {showShare && <span className="w-11 shrink-0 text-right text-xs tabular-nums text-subtle">{total ? Math.round((r.value / total) * 100) : 0}%</span>}
            {pick && <ChevronRight className="size-3.5 shrink-0 self-center text-subtle" />}
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2">
            <motion.div
              className="h-full rounded-full"
              style={{ background: r.other ? COLOR.prior : color }}
              initial={{ width: 0 }}
              animate={{ width: `${(r.value / max) * 100}%` }}
              transition={{ duration: 0.7, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
          </Row>
        </li>
        );
      })}
    </ul>
  );
}

/** The hover/tap box: the day, then each series' amount. */
function TipBox({ active, payload, label, money, labelOf }) {
  if (!active || !payload?.length) return null;
  const rows = payload.filter((p) => p.value != null);
  if (!rows.length) return null;
  return (
    <div className="min-w-44 rounded-xl border border-line bg-surface px-3 py-2.5 text-xs shadow-float">
      <p className="mb-1.5 font-semibold text-fg">{labelOf ? labelOf(rows[0].payload, label) : tickDate(label)}</p>
      <ul className="space-y-1">
        {rows.map((p) => (
          <li key={p.dataKey} className="flex items-center justify-between gap-5">
            <span className="inline-flex items-center gap-1.5 text-muted">
              <span className="size-2 rounded-full" style={{ background: p.color || p.stroke || p.fill }} />
              {p.name}
            </span>
            <span className="font-semibold tabular-nums text-fg">{money(p.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * A chart over days. `series`: [{ key, name, color, kind: "line"|"bar"|"area", dashed?, colorOf? }].
 * A bar's `colorOf(row)` colours each bar by its own value (e.g. by sign);
 * `zeroLine` draws the 0 line for figures that go negative; `mark` = { x, y,
 * label, color } pins one labelled point (e.g. the best day).
 * One y-axis, always. Empty data shows a short message instead of a blank grid.
 */
export function TimeChart({ data = [], xKey = "date", series, currency, height = 256, labelOf, zeroLine = false, mark }) {
  const money = (v) => formatMoney(v, currency);
  const hasBars = series.some((s) => s.kind === "bar");
  const empty = !data.length || data.every((d) => series.every((s) => !Number(d[s.key])));

  if (empty) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl bg-surface-2/50 text-center" style={{ height }}>
        <BarChart3 className="mb-2 size-6 text-subtle" />
        <p className="text-sm font-medium text-muted">No data for this period</p>
      </div>
    );
  }

  return (
    <div style={{ height }}>
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: mark ? 26 : 6, right: 6, left: -8, bottom: 0 }} barGap={2} barCategoryGap="22%">
          <defs>
            {series
              .filter((s) => s.kind === "area")
              .map((s) => (
                <linearGradient key={s.key} id={`fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                </linearGradient>
              ))}
          </defs>
          <CartesianGrid vertical={false} stroke="var(--cc-line)" strokeDasharray="3 4" />
          <XAxis
            dataKey={xKey}
            tickFormatter={tickDate}
            tick={{ fontSize: 11, fill: "var(--cc-subtle)" }}
            tickLine={false}
            axisLine={false}
            minTickGap={18}
            tickMargin={8}
          />
          <YAxis tickFormatter={compact} tick={{ fontSize: 11, fill: "var(--cc-subtle)" }} tickLine={false} axisLine={false} width={44} />
          <Tooltip
            content={(p) => <TipBox {...p} money={money} labelOf={labelOf} />}
            cursor={hasBars ? { fill: "var(--cc-surface-2)", opacity: 0.7 } : { stroke: "var(--cc-line)", strokeWidth: 1 }}
          />
          {zeroLine && <ReferenceLine y={0} stroke="var(--cc-subtle)" strokeOpacity={0.6} />}
          {series.map((s) => {
            const common = { dataKey: s.key, name: s.name, animationDuration: 700, animationEasing: "ease-out" };
            if (s.kind === "bar")
              return (
                <Bar key={s.key} {...common} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={22}>
                  {s.colorOf && data.map((row, i) => <Cell key={i} fill={s.colorOf(row)} radius={Number(row[s.key]) < 0 ? [0, 0, 4, 4] : [4, 4, 0, 0]} />)}
                </Bar>
              );
            if (s.kind === "area")
              return (
                <Area
                  key={s.key}
                  {...common}
                  type="monotone"
                  stroke={s.color}
                  strokeWidth={2}
                  fill={`url(#fill-${s.key})`}
                  dot={false}
                  activeDot={{ r: 4, fill: s.color, stroke: "var(--cc-surface)", strokeWidth: 2 }}
                />
              );
            return (
              <Line
                key={s.key}
                {...common}
                type="monotone"
                stroke={s.color}
                strokeWidth={2}
                strokeDasharray={s.dashed ? "5 4" : undefined}
                dot={false}
                activeDot={{ r: 4, fill: s.color, stroke: "var(--cc-surface)", strokeWidth: 2 }}
              />
            );
          })}
          {mark && (
            <ReferenceDot
              x={mark.x}
              y={mark.y}
              r={5}
              fill={mark.color}
              stroke="var(--cc-surface)"
              strokeWidth={2}
              ifOverflow="visible"
              label={{ value: mark.label, position: "top", offset: 10, fontSize: 11, fontWeight: 600, fill: "var(--cc-fg)" }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
