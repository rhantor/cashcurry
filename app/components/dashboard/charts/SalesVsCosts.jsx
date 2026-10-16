"use client";
import { COLOR, TimeChart } from "./kit";

/** Sales (line) against all costs (bars), per day. Rows: { date, sales, costs_total }. */
export default function SalesVsCosts({ data = [], currency }) {
  return (
    <TimeChart
      data={data}
      currency={currency}
      series={[
        { key: "costs_total", name: "Costs", color: COLOR.out, kind: "bar" },
        { key: "sales", name: "Sales", color: COLOR.in, kind: "line" },
      ]}
    />
  );
}

SalesVsCosts.legend = [
  { name: "Sales", color: COLOR.in, kind: "line" },
  { name: "Costs", color: COLOR.out },
];
