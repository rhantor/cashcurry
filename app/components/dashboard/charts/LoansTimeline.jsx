"use client";
import { COLOR, TimeChart } from "./kit";

/**
 * Loans between branches, per day, from this branch's side.
 * Rows: { date, borrowed, lent, repayReceived, repayPaid }.
 */
export default function LoansTimeline({ data = [], currency }) {
  return (
    <TimeChart
      data={data}
      currency={currency}
      series={[
        { key: "borrowed", name: "Borrowed", color: COLOR.in, kind: "bar" },
        { key: "lent", name: "Lent", color: COLOR.out, kind: "bar" },
        { key: "repayReceived", name: "Repaid to us", color: COLOR.bank, kind: "bar" },
        { key: "repayPaid", name: "We repaid", color: COLOR.other, kind: "bar" },
      ]}
    />
  );
}

LoansTimeline.legend = [
  { name: "Borrowed", color: COLOR.in },
  { name: "Lent", color: COLOR.out },
  { name: "Repaid to us", color: COLOR.bank },
  { name: "We repaid", color: COLOR.other },
];
