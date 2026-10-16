"use client";
import { COLOR, TimeChart } from "./kit";

/**
 * Cash in hand at the end of each day, and the bank's movement so far this
 * period; the last point of each is its card's figure.
 * Rows: { date, cash, bank }.
 */
export default function BalanceTrend({ data = [], currency }) {
  return (
    <TimeChart
      data={data}
      currency={currency}
      height={220}
      zeroLine={data.some((d) => d.bank < 0 || d.cash < 0)}
      series={[
        { key: "cash", name: "Cash in hand", color: COLOR.in, kind: "area" },
        { key: "bank", name: "Bank change", color: COLOR.bank, kind: "line" },
      ]}
    />
  );
}

BalanceTrend.legend = [
  { name: "Cash in hand", color: COLOR.in, kind: "line" },
  { name: "Bank change", color: COLOR.bank, kind: "line" },
];
