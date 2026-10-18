// components/settings/users/RoleBadge.jsx
"use client";
import React from "react";
import { Badge } from "@/app/components/ui";
import { normalizeRole, roleLabel, isCompanyRole } from "@/lib/authz/permissions";

/** A user's role as a small label: company roles in blue, branch roles in green. */
export default function RoleBadge({ role }) {
  const r = normalizeRole(role);
  if (!r) return <Badge>—</Badge>;
  return <Badge tone={r === "owner" ? "danger" : isCompanyRole(r) ? "info" : r === "staff" ? "neutral" : "brand"}>{roleLabel(r)}</Badge>;
}
