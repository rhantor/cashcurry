import React from "react";

export default function CompanyDashboardLoading() {
  return (
    <div className="min-h-screen p-6 bg-gradient-to-br from-[#f2edff] via-[#ffe1e1] to-[#ffd1f1]">
      <div className="mx-auto max-w-7xl space-y-6 animate-pulse">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="space-y-2">
            <div className="h-7 w-56 rounded bg-white/60" />
            <div className="h-4 w-80 rounded bg-white/60" />
          </div>
          <div className="h-10 w-64 rounded-lg bg-white/60" />
        </div>

        {[0, 1].map((row) => (
          <div key={row} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-2xl bg-white/70 shadow" />
            ))}
          </div>
        ))}

        {[0, 1, 2, 3].map((row) => (
          <div key={row} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-64 rounded-2xl bg-white/70 shadow" />
            <div className="h-64 rounded-2xl bg-white/70 shadow" />
          </div>
        ))}
      </div>
    </div>
  );
}
