/* eslint-disable react/prop-types */
import React from 'react';
import { format } from "date-fns";

export default function DailyTable({ dailyRows, totals }) {
  return (
    <div className="overflow-x-auto bg-white rounded-lg shadow mb-6">
      <table className="min-w-full border-collapse text-sm">
        <thead className="bg-mint-100">
          <tr>
            <th className="p-2 border">Date</th>
            <th className="p-2 border">Cash</th>
            <th className="p-2 border">Card</th>
            <th className="p-2 border">Cheque</th>
            <th className="p-2 border">Online</th>
            <th className="p-2 border">QR</th>
            <th className="p-2 border">Grab</th>
            <th className="p-2 border">Food-Panda</th>
            <th className="p-2 border">Promotion</th>
            <th className="p-2 border">Advance</th>
            <th className="p-2 border">Cost</th>
            <th className="p-2 border">Total Sales</th>
          </tr>
        </thead>
        <tbody>
          {dailyRows.map((row, idx) => (
            <tr key={idx} className="text-center">
              <td className="p-2 border">
                {format(new Date(row.date), "dd-MMM")}
              </td>
              <td className="p-2 border">{row.cash.toFixed(2)}</td>
              <td className="p-2 border">{row.card.toFixed(2)}</td>
              <td className="p-2 border">{row.cheque.toFixed(2)}</td>
              <td className="p-2 border">{row.online.toFixed(2)}</td>
              <td className="p-2 border">{row.qr.toFixed(2)}</td>
              <td className="p-2 border">{row.grab.toFixed(2)}</td>
              <td className="p-2 border">{row.foodpanda.toFixed(2)}</td>
              <td className="p-2 border">{row.promotion.toFixed(2)}</td>
              <td className="p-2 border text-mint-600">
                {row.advance.toFixed(2)}
              </td>
              <td className="p-2 border text-red-600">{row.cost.toFixed(2)}</td>
              <td className="p-2 border">{row.totalSales.toFixed(2)}</td>
            </tr>
          ))}

          {/* Totals Row */}
          <tr className="bg-gray-200 font-bold text-center">
            <td className="p-2 border">Total</td>
            <td className="p-2 border">{totals.cash.toFixed(2)}</td>
            <td className="p-2 border">{totals.card.toFixed(2)}</td>
            <td className="p-2 border">{totals.cheque.toFixed(2)}</td>
            <td className="p-2 border">{totals.online.toFixed(2)}</td>
            <td className="p-2 border">{totals.qr.toFixed(2)}</td>
            <td className="p-2 border">{totals.grab.toFixed(2)}</td>
            <td className="p-2 border">{totals.foodpanda.toFixed(2)}</td>
            <td className="p-2 border">{totals.promotion.toFixed(2)}</td>
            <td className="p-2 border">{totals.advance.toFixed(2)}</td>
            <td className="p-2 border">{totals.cost.toFixed(2)}</td>
            <td className="p-2 border">{totals.totalSales.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
