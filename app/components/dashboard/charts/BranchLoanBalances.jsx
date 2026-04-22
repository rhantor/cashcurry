/* eslint-disable react/prop-types */
"use client";
import React from "react";
import useCurrency from "@/app/hooks/useCurrency";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export default function BranchLoanBalances({ data }) {
  const currency = useCurrency();
  // expects: [{ name, net }], net>0 means owed to branch; net<0 means branch owes
  return (
    <div className="w-full h-80">
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" />
          <YAxis type="category" dataKey="name" width={120} />
          <Tooltip formatter={(v) => `${currency} ${Number(v).toFixed(2)}`} />
          <ReferenceLine x={0} />
          <Bar dataKey="net" name="Net Balance" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
