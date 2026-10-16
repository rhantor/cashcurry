"use client";
import { COLOR, TimeChart } from "./kit";

/** Cash taken against costs paid in cash, per day. Rows: { date, cashSales, cashCosts }. */
export default function CashVsCost({ data = [], currency }) {
  return (
    <TimeChart
      data={data}
      currency={currency}
      series={[
        { key: "cashSales", name: "Cash sales", color: COLOR.in, kind: "line" },
        { key: "cashCosts", name: "Cash costs", color: COLOR.out, kind: "line" },
      ]}
    />
  );
}

CashVsCost.legend = [
  { name: "Cash sales", color: COLOR.in, kind: "line" },
  { name: "Cash costs", color: COLOR.out, kind: "line" },
];
