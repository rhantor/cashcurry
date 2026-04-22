/* eslint-disable react/prop-types */
"use client";
import { byDateKey, RM } from "@/utils/dashboard/utils";
import React from "react";

export default function RecentActivity({ rows }) {
  return (
    <div className="rounded-2xl bg-white/80 backdrop-blur-sm shadow p-4">
      <div className="font-semibold mb-2">Recent Activity</div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left">
              <th className="py-2">Date</th>
              <th className="py-2">Type</th>
              <th className="py-2">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-black/10">
                <td className="py-2">{byDateKey(r.ts || r.date)}</td>
                <td className="py-2">{r.type}</td>
                <td className="py-2 font-medium">{RM(r.amount)}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={3} className="py-6 text-center text-slate-500">
                  No activity in selected range
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
