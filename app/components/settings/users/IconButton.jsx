// components/settings/users/IconButton.jsx
"use client";
import React from "react";

export default function IconButton({
  onClick,
  title,
  disabled,
  className = "",
  children,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`inline-flex p-2 rounded-md hover:bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {children}
    </button>
  );
}
