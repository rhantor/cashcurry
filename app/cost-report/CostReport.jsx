/* eslint-disable react/react-in-jsx-scope */
// app/cost-report/page.js
"use client";
import { useState } from "react";
import useCurrency from "@/app/hooks/useCurrency";

export default function CostReportPage() {
  const currency = useCurrency();
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Dummy data for UI
  const costs = [
    {
      id: 1,
      date: "2025-08-10",
      amount: 250.5,
      description:
        "• Office supplies\n• Printing paper\n1. Toner cartridge\n**Urgent purchase**",
      fileUrl: "#",
      fileName: "invoice1.pdf",
    },
    {
      id: 2,
      date: "2025-08-12",
      amount: 120,
      description: "• Maintenance fee\n• Aircon service",
      fileUrl: "#",
      fileName: "invoice2.jpg",
    },
  ];

  // Filter logic (simple demo)
  const filteredCosts = costs.filter((c) => {
    const matchesSearch = search
      ? c.description.toLowerCase().includes(search.toLowerCase())
      : true;
    const matchesFrom = fromDate ? c.date >= fromDate : true;
    const matchesTo = toDate ? c.date <= toDate : true;
    return matchesSearch && matchesFrom && matchesTo;
  });

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <h1 className="text-xl font-bold text-mint-500 mb-4">Cost Report</h1>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow mb-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <input
          type="text"
          placeholder="Search description..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border p-2"
        />
        <label htmlFor="from date" className="md:hidden">
          {" "}
          From Date{" "}
        </label>
        <input
          id="from date"
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="rounded-lg border p-2"
          placeholder="From Date"
        />
        <label htmlFor="to date" className="md:hidden">
          {" "}
          To Date{" "}
        </label>
        <input
          id="to date"
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="rounded-lg border p-2"
          placeholder="To Date"
        />
        <button
          className="bg-mint-500 text-white rounded-lg px-4 py-2 hover:bg-mint-600"
          onClick={() => {
            setSearch("");
            setFromDate("");
            setToDate("");
          }}
        >
          Reset
        </button>
      </div>

      {/* Table for large screens */}
      <div className="hidden md:block bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 text-left">Date</th>
              <th className="p-3 text-left">Amount ({currency})</th>
              <th className="p-3 text-left">Description</th>
              <th className="p-3 text-left">Invoice</th>
            </tr>
          </thead>
          <tbody>
            {filteredCosts.map((cost) => (
              <tr key={cost.id} className="border-t">
                <td className="p-3">{cost.date}</td>
                <td className="p-3">{cost.amount.toFixed(2)}</td>
                <td className="p-3 whitespace-pre-line">{cost.description}</td>
                <td className="p-3">
                  <a
                    href={cost.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 underline"
                  >
                    {cost.fileName}
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-4">
        {filteredCosts.map((cost) => (
          <div
            key={cost.id}
            className="bg-white rounded-lg shadow p-4 space-y-2"
          >
            <div className="text-sm text-gray-600">{cost.date}</div>
            <div className="font-bold text-lg">{currency} {cost.amount.toFixed(2)}</div>
            <div className="whitespace-pre-line">{cost.description}</div>
            <a
              href={cost.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 underline text-sm"
            >
              {cost.fileName}
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
