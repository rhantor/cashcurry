"use client";
import { COLOR, TimeChart } from "./kit";

/** Money going to the bank against costs paid from the bank, per day. Rows: { date, bankedSales, backCosts }. */
export default function BankedVsBackCost({ data = [], currency }) {
  return (
    <TimeChart
      data={data}
      currency={currency}
      series={[
        { key: "bankedSales", name: "To bank", color: COLOR.bank, kind: "line" },
        { key: "backCosts", name: "Paid from bank", color: COLOR.out, kind: "line" },
      ]}
    />
  );
}

BankedVsBackCost.legend = [
  { name: "To bank", color: COLOR.bank, kind: "line" },
  { name: "Paid from bank", color: COLOR.out, kind: "line" },
];
