"use client";
import { COLOR, TimeChart } from "./kit";

/** Money going to the bank (card, QR, online…) against withdrawals, per day. Rows: { date, bankedSales, withdrawals }. */
export default function BankedVsWithdrawals({ data = [], currency }) {
  return (
    <TimeChart
      data={data}
      currency={currency}
      series={[
        { key: "bankedSales", name: "To bank", color: COLOR.bank, kind: "bar" },
        { key: "withdrawals", name: "Withdrawals", color: COLOR.other, kind: "bar" },
      ]}
    />
  );
}

BankedVsWithdrawals.legend = [
  { name: "To bank", color: COLOR.bank },
  { name: "Withdrawals", color: COLOR.other },
];
