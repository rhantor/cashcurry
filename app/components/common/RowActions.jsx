/* eslint-disable react/prop-types */
// app/components/common/RowActions.jsx
"use client";
import React from "react";

export default function RowActions({ onEdit, onDelete, disabled, compact }) {
  return (
    <div className={`flex gap-2 ${compact ? "text-xs" : "text-sm"}`}>
      {onEdit && (
        <button
          onClick={onEdit}
          disabled={disabled}
          className={`px-3 py-1 rounded ${disabled ? "bg-blue-200" : "bg-blue-100 hover:bg-blue-200"} text-blue-700`}
        >
          Edit
        </button>
      )}
      {onDelete && (
        <button
          onClick={onDelete}
          disabled={disabled}
          className={`px-3 py-1 rounded ${disabled ? "bg-red-200" : "bg-red-100 hover:bg-red-200"} text-red-700`}
        >
          Delete
        </button>
      )}
    </div>
  );
}
