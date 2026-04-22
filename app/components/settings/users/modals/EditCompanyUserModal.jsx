/* eslint-disable react/prop-types */
"use client";
import React, { useEffect, useState } from "react";
import { normalizeRole } from "@/utils/sanitize";

const ROLE_OPTIONS = [
  { value: "owner", label: "Owner" },
  { value: "superAdmin", label: "Super Admin" },
  { value: "gm", label: "General Manager" },
  { value: "Supervisor", label: "Supervisor" },
];

export default function EditCompanyUserModal({
  open,
  user,
  onClose,
  onSave,
  saving,
}) {
  const [userName, setUserName] = useState("");
  const [role, setRole] = useState("");

  const isOwner = normalizeRole(user?.role) === "owner";

  useEffect(() => {
    if (open && user) {
      setUserName(user.userName || "");
      setRole(user.role || "");
    }
  }, [open, user]);

  if (!open) return null;

  const canSubmit = !saving && userName.trim() && role.trim();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSave?.({ userName: userName.trim(), role });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-2xl p-6 relative">
        <h3 className="text-xl font-bold mb-4">Edit Company User</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Username
            </label>
            <input
              className="w-full border rounded-lg px-3 py-2 mt-1"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              disabled={isOwner}
              required
            />
            {isOwner && (
              <p className="text-xs text-red-500 mt-1">
                Owner username cannot be changed.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Role
            </label>
            <select
              className="w-full border rounded-lg px-3 py-2 mt-1"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              disabled={isOwner}
              required
            >
              <option value="">Select a role</option>
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            {isOwner && (
              <p className="text-xs text-red-500 mt-1">
                Owner role cannot be changed.
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md border"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="px-4 py-2 rounded-md bg-blue-600 text-white disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
