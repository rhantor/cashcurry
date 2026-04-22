/* eslint-disable react/prop-types */
"use client";
import React from "react";

export default function Modal({ title, children, onClose, maxWidth="max-w-md" }) {
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
      <div className={`w-full ${maxWidth} bg-white rounded-2xl shadow p-4`}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  );
}
