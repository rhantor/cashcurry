/* eslint-disable react/prop-types */
"use client";
import React from "react";
import useCurrency from "@/app/hooks/useCurrency";
export default function BranchLeaderboard({ data, limit = 10 }) {
  const currency = useCurrency();
  // expects: [{ name, sales, costs, net, opMarginPct }, ...] sorted desc by net
  const top = data.slice(0, limit);
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-gray-100 text-left">
            <th className="p-2">Branch</th>
            <th className="p-2">Sales</th>
            <th className="p-2">Costs</th>
            <th className="p-2">Net</th>
            <th className="p-2">Op Margin %</th>
          </tr>
        </thead>
        <tbody>
          {top.map((r) => {
            const tone = r.net >= 0 ? "text-green-700" : "text-red-700";
            return (
              <tr key={r.branchId} className="border-b">
                <td className="p-2">{r.name}</td>
                <td className="p-2">{currency} {Number(r.sales).toFixed(2)}</td>
                <td className="p-2">{currency} {Number(r.costs).toFixed(2)}</td>
                <td className={`p-2 font-semibold ${tone}`}>
                  {currency} {Number(r.net).toFixed(2)}
                </td>
                <td className="p-2">{Number(r.opMarginPct).toFixed(1)}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
