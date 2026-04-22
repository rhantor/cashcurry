import React from "react";

export default function ReportErrorState({
  error,
  title = "Failed to load data",
}) {
  if (!error) return null;

  return (
    <div className="p-6 m-4 rounded-xl bg-red-50 border border-red-200 text-red-700">
      <strong className="block font-semibold mb-1">{title}</strong>
      <p className="text-sm">{error?.message || JSON.stringify(error)}</p>
    </div>
  );
}
