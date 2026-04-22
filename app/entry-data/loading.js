import React from "react";

export default function EntryDataLoading() {
  return (
    <div className="min-h-screen p-6 bg-slate-50">
      <div className="mx-auto max-w-4xl space-y-6 animate-pulse">
        <div className="space-y-2">
          <div className="h-7 w-64 rounded bg-slate-200" />
          <div className="h-4 w-96 rounded bg-slate-200" />
        </div>
        <div className="rounded-2xl bg-white shadow p-6 space-y-4">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-24 rounded bg-slate-200" />
              <div className="h-10 w-full rounded bg-slate-100" />
            </div>
          ))}
          <div className="h-10 w-32 rounded-lg bg-slate-200 mt-6" />
        </div>
      </div>
    </div>
  );
}
