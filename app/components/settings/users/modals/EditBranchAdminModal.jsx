"use client";
import React, { useEffect, useState } from "react";
import { roleOptions, BRANCH_ASSIGNABLE } from "@/lib/authz/permissions";

export default function EditBranchAdminModal({
  open,
  admin,
  onClose,
  onSave,
  saving,
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  // a branch admin can be given another branch role (15 Nov)
  const [role, setRole] = useState("branchAdmin");

  useEffect(() => {
    if (open && admin) {
      setFullName(admin.fullName || admin.username || "");
      setEmail(admin.email || "");
      setRole("branchAdmin");
    }
  }, [open, admin]);

  if (!open) return null;

  const canSubmit = !saving && fullName.trim();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSave?.({
      fullName: fullName.trim(),
      email: email.trim(),
      role,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-md bg-surface rounded-xl shadow-2xl p-6 relative">
        <h3 className="text-xl font-bold mb-4">Edit Branch Admin</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-fg">
              Name
            </label>
            <input
              className="w-full border rounded-lg px-3 py-2 mt-1"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-fg">
              Email
            </label>
            <input
              type="email"
              className="w-full border rounded-lg px-3 py-2 mt-1"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="optional"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-fg">
              Role
            </label>
            <select
              className="w-full border rounded-lg px-3 py-2 mt-1"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              {roleOptions(BRANCH_ASSIGNABLE, "branchAdmin").map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            {role !== "branchAdmin" && (
              <p className="mt-1 text-xs text-muted">They sign in again and get the new role&apos;s menu.</p>
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
              className="px-4 py-2 rounded-md bg-brand text-brand-fg disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
