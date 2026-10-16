"use client";
import { formatMoney } from "@/lib/region/currency";
import { COLOR, TimeChart } from "./kit";

/**
 * What each day kept: sales minus that day's costs, a bar above the line for
 * a good day and below it for a day that spent more than it sold.
 * Rows: { date, sales, costs_total }.
 */
export default function DailyNet({ data = [], currency }) {
  const rows = data.map((d) => ({ date: d.date, net: (Number(d.sales) || 0) - (Number(d.costs_total) || 0) }));
  return (
    <TimeChart
      data={rows}
      currency={currency}
      height={220}
      zeroLine
      series={[{ key: "net", name: "Sales − costs", color: COLOR.in, kind: "bar", colorOf: (r) => (r.net < 0 ? COLOR.out : COLOR.in) }]}
    />
  );
}

/** The card's headline: kept in total, as a share of sales, and the losing days. */
DailyNet.summary = (data = [], currency) => {
  const sales = data.reduce((n, d) => n + (Number(d.sales) || 0), 0);
  const costs = data.reduce((n, d) => n + (Number(d.costs_total) || 0), 0);
  const losing = data.filter((d) => (Number(d.sales) || 0) < (Number(d.costs_total) || 0)).length;
  return {
    kept: formatMoney(sales - costs, currency),
    share: sales ? `${Math.round(((sales - costs) / sales) * 100)}%` : "—",
    losing,
  };
};

DailyNet.legend = [
  { name: "Made money", color: COLOR.in },
  { name: "Spent more than sold", color: COLOR.out },
];
