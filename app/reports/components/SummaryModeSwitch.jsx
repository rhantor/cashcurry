/* eslint-disable react/prop-types */
import React from "react";

export default function SummaryModeSwitch({ modes, value, onChange }) {
  return (
    <div className="inline-flex rounded-xl overflow-hidden border">
      {modes.map((m) => (
        <button
          key={m.id}
          onClick={() => onChange(m.id)}
          className={`px-3 py-2 text-sm font-medium transition ${
            value === m.id
              ? "bg-mint-500 text-white"
              : "bg-white hover:bg-mint-50 text-gray-700"
          }`}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
