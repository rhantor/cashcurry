"use client";
import React from "react";

export default function CompanyDashboardError({ error, reset }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-rose-50 via-orange-50 to-amber-50 p-6">
      <div className="max-w-md w-full text-center space-y-5 bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-8">
        <div className="flex justify-center">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-rose-500 to-orange-500 shadow flex items-center justify-center">
            <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.008v.008H12v-.008z" />
            </svg>
          </div>
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Owner dashboard couldn&apos;t load</h1>
          <p className="mt-2 text-sm text-slate-500 leading-relaxed">
            Something went wrong while aggregating company-wide data. Please retry.
          </p>
          {error?.message && (
            <p className="mt-3 text-xs text-slate-400 font-mono break-all">
              {error.message}
            </p>
          )}
        </div>
        <div className="flex gap-2 justify-center">
          <button
            onClick={() => reset()}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm shadow"
          >
            Try again
          </button>
          <a
            href="/"
            className="px-4 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}
