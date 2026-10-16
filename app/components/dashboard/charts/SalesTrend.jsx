"use client";
import { COLOR, TimeChart } from "./kit";

/**
 * Sales per day this period (filled line) against the same days of the
 * previous period (dashed). `compareData` rows: { label, current, previous,
 * currentDate, prevDate }; without it, `data` rows { date, total }.
 */
export default function SalesTrend({ data = [], compareData, currency }) {
  const rows = compareData ?? data.map((d) => ({ label: d.date, current: d.total, previous: null, currentDate: d.date }));
  const compare = Array.isArray(compareData) && compareData.some((d) => d.previous > 0);
  return (
    <TimeChart
      data={rows}
      xKey="label"
      currency={currency}
      labelOf={(row, label) => row?.currentDate ?? label}
      series={[
        ...(compare ? [{ key: "previous", name: "Previous period", color: COLOR.prior, kind: "line", dashed: true }] : []),
        { key: "current", name: "This period", color: COLOR.in, kind: "area" },
      ]}
    />
  );
}

SalesTrend.legend = (compare = true) => [
  { name: "This period", color: COLOR.in, kind: "line" },
  ...(compare ? [{ name: "Previous period", color: COLOR.prior, dashed: true }] : []),
];
