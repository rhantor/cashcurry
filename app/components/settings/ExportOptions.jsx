/* eslint-disable react/prop-types */
import React from "react";

export default function ExportOptions({ exportOpts, setExportOpts }) {
  return (
    <div className="p-4 border rounded-lg shadow-sm space-y-4">
      <h2 className="text-lg font-semibold">Export Options</h2>
      {["pdf", "excel", "csv", "charts"].map((key) => (
        <label
          key={key}
          className="flex items-center justify-between cursor-pointer"
        >
          <span className="capitalize">{key}</span>
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={exportOpts[key]}
            onChange={(e) =>
              setExportOpts({ ...exportOpts, [key]: e.target.checked })
            }
          />
        </label>
      ))}
    </div>
  );
}
