/* eslint-disable react/prop-types */
// components/settings/users/RoleBadge.jsx
"use client";
import React from "react";
import { normalizeRole } from "@/utils/roles";

const cls = (role) => {
  const r = normalizeRole(role);
  if (r === "owner") return "bg-red-100 text-red-800";
  if (r === "superadmin") return "bg-indigo-100 text-indigo-800";
  if (r === "gm" || r === "general manager") return "bg-blue-100 text-blue-800";
  if (r === "manager") return "bg-teal-100 text-teal-800"; // ⬅️ added
  if (r === "supervisor") return "bg-green-100 text-green-800";
  if (r === "accountant") return "bg-purple-100 text-purple-800";
  if (r === "branchadmin") return "bg-pink-100 text-pink-800";
  if (r === "cashier") return "bg-yellow-100 text-yellow-800";
  return "bg-gray-100 text-gray-800";
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
