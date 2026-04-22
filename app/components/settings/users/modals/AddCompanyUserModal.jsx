/* eslint-disable react/prop-types */
// components/settings/users/modals/AddCompanyUserModal.jsx
"use client";

import React, { useEffect, useState } from "react";

const ROLE_OPTIONS = [
  { value: "owner", label: "Owner" },
  { value: "superAdmin", label: "Super Admin" },
  { value: "gm", label: "General Manager" },
  { value: "Supervisor", label: "Supervisor" },
];

export default function AddCompanyUserModal({
  open,
  onClose,
  onCreate, // ({ userName, email, password, role }) => Promise<void>
  creating, // boolean from RTK hook
  errorMsg, // string
}) {
  const [userName, setUserName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [localErr, setLocalErr] = useState("");

  useEffect(() => {
    if (open) {
      setUserName("");
      setEmail("");
      setPassword("");
      setRole("");
      setShowPw(false);
      setLocalErr("");
    }
  }, [open]);

  if (!open) return null;

  const validate = () => {
    if (!userName.trim()) return "Username is required.";
    if (!email.trim()) return "Email is required.";
    // Basic email check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      return "Enter a valid email.";
    if (!password) return "Password is required.";
    if (password.length < 6) return "Password must be at least 6 characters.";
    if (!role) return "Role is required.";
    return "";
  };

  const canSubmit = !creating;

  const submit = async (e) => {
    e.preventDefault();
    const v = validate();
    if (v) {
      setLocalErr(v);
      return;
    }
    setLocalErr("");
    await onCreate?.({ userName, email, password, role });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-2xl p-6 relative">
        <h3 className="text-xl font-bold mb-4">Add Company User</h3>

        {(localErr || errorMsg) && (
          <div className="mb-3 text-sm text-red-600">
            {localErr || errorMsg}
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Username
            </label>
            <input
              className="w-full border rounded-lg px-3 py-2 mt-1"
              value={userName}
              onChange={(e) => setUserName(e.target.value.replace(/\s+/g, ""))}
              placeholder="e.g. antor99"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Only letters/numbers; no spaces.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              type="email"
              className="w-full border rounded-lg px-3 py-2 mt-1"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <div className="flex items-center gap-2">
              <input
                type={showPw ? "text" : "password"}
                className="w-full border rounded-lg px-3 py-2 mt-1"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 6 characters"
                required
              />
              <button
                type="button"
                onClick={() => setShowPw((s) => !s)}
                className="mt-1 px-3 py-2 text-sm border rounded-md"
              >
                {showPw ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Role
            </label>
            <select
              className="w-full border rounded-lg px-3 py-2 mt-1"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              required
            >
              <option value="">Select a role</option>
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md border"
              disabled={creating}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="px-4 py-2 rounded-md bg-gray-900 text-white disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create user"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
