/* eslint-disable react/prop-types */
// app/components/common/ConfirmDeleteModal.jsx
"use client";
import React, { useState } from "react";
import { format } from "date-fns";

export default function ConfirmDeleteModal({
  visible,
  onClose,
  onConfirm,
  date,
}) {
  const [typed, setTyped] = useState("");
  if (!visible) return null;

  let target = "";
  try {
    target =
      typeof date === "string"
        ? format(new Date(date), "yyyy-MM-dd")
        : format(date, "yyyy-MM-dd");
  } catch {
    target = String(date ?? "");
  }

  const canDelete = typed.trim() === target;

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold mb-2">Confirm Delete</h2>
        <p className="text-sm text-gray-700 mb-4">
          Type the date to confirm:
          <span className="font-mono font-semibold ml-2">{target}</span>
        </p>
        <input
          type="text"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={target}
          className="w-full rounded-lg border p-2 text-sm"
        />
        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700"
          >
            Cancel
          </button>
          <button
            disabled={!canDelete}
            onClick={async () => {
              if (!canDelete) return;
              await onConfirm();
              onClose();
            }}
            className={`px-4 py-2 rounded-lg text-white ${
              canDelete
                ? "bg-red-600 hover:bg-red-700"
                : "bg-red-300 cursor-not-allowed"
            }`}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
