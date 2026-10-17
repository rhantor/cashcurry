// components/settings/users/RoleBadge.jsx
"use client";
import React from "react";
import { normalizeRole } from "@/utils/roles";

const cls = (role) => {
  const r = normalizeRole(role);
  if (r === "owner") return "bg-danger-soft text-red-800";
  if (r === "superadmin") return "bg-info-soft text-info";
  if (r === "gm" || r === "general manager") return "bg-info-soft text-info";
  if (r === "manager") return "bg-teal-100 text-teal-800"; // ⬅️ added
  if (r === "supervisor") return "bg-brand-soft text-brand";
  if (r === "accountant") return "bg-warning-soft text-warning";
  if (r === "branchadmin") return "bg-pink-100 text-pink-800";
  if (r === "cashier") return "bg-warning-soft text-warning";
  return "bg-surface-2 text-fg";
};

export default function RoleBadge({ role }) {
  return (
    <span
      className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cls(role)}`}
    >
      {role || "-"}
    </span>
  );
}
