/* eslint-disable react/prop-types */
"use client";
import React from "react";

export default function Modal({ title, children, onClose, maxWidth="max-w-md" }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-2 sm:p-4 z-50 backdrop-blur-sm">
      <div className={`w-[95vw] sm:w-full ${maxWidth} bg-white rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-white/20`}>
        <div className="flex items-center justify-between p-5 border-b border-gray-50">
          <h2 className="text-xl font-black text-gray-900 tracking-tight">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-all"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
}
