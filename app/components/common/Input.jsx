/* eslint-disable react/prop-types */
"use client";
import React from "react";

export default function Input({
  label,
  className = "",
  type = "text",
  value,
  onChange,
  autoFocus,
  placeholder,
}) {
  return (
    <label className={`text-sm ${className}`}>
      <div className="text-gray-600 mb-1">{label}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border rounded-lg p-2"
        autoFocus={autoFocus}
      />
    </label>
  );
}
