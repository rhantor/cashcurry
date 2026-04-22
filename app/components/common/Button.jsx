/* eslint-disable react/prop-types */
"use client";
import React from "react";

export default function Button({
  children,
  onClick,
  disabled,
  variant = "primary",
  className = "",
}) {
  const base = "px-4 py-2 rounded-lg disabled:opacity-60";
  const styles =
    variant === "ghost"
      ? "bg-gray-100 hover:bg-gray-200"
      : "bg-mint-500 text-white hover:bg-mint-600";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${styles} ${className}`}
    >
      {children}
    </button>
  );
}
