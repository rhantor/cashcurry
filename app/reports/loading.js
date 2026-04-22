import React from "react";

export default function ReportsLoading() {
  return (
    <div className="min-h-screen p-6 bg-slate-50">
      <div className="mx-auto max-w-7xl space-y-6 animate-pulse">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="space-y-2">
            <div className="h-7 w-56 rounded bg-slate-200" />
            <div className="h-4 w-72 rounded bg-slate-200" />
          </div>
          <div className="h-10 w-64 rounded-lg bg-slate-200" />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-2xl bg-white shadow" />
          ))}
        </div>

        <div className="rounded-2xl bg-white shadow p-4 space-y-2">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-8 w-full rounded bg-slate-100" />
          ))}
        </div>
      </div>
    </div>
  );
}
