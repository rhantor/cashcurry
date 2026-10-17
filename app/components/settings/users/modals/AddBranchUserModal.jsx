// components/settings/users/modals/AddBranchUserModal.jsx
"use client";
import React, { useEffect, useState } from "react";

const ROLE_OPTIONS = ["manager", "accountant", "supervisor", "cashier"];

export default function AddBranchUserModal({
  open,
  branchName,
  onClose,
  onCreate, // ({ fullName, userName, email, password, role }) => void
  creating = false,
  errorMsg = "",
}) {
  const [fullName, setFullName] = useState("");
  const [userName, setUserName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("");

  useEffect(() => {
    if (open) {
      setFullName("");
      setUserName("");
      setEmail("");
      setPassword("");
      setRole("");
    }
  }, [open]);

  const canSubmit =
    !creating &&
    fullName.trim() &&
    userName.trim() &&
    email.trim() &&
    password.trim() &&
    role.trim();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    onCreate?.({
      fullName: fullName.trim(),
      userName: userName.trim(),
      email: email.trim(),
      password: password,
      role, // keep exact casing as requested
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-md bg-surface rounded-xl shadow-2xl p-6 relative">
        <h3 className="text-xl font-bold mb-1">Add Branch User</h3>
        <p className="text-sm text-muted mb-4">
          {branchName ? `Branch: ${branchName}` : null}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-fg">
              Full name
            </label>
            <input
              className="w-full border rounded-lg px-3 py-2 mt-1"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                // if username empty, suggest from fullName
                if (!userName) {
                  const suggestion = e.target.value
                    .toLowerCase()
                    .replace(/\s+/g, "_");
                  setUserName(suggestion);
                }
              }}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-fg">
              Username
            </label>
            <input
              className="w-full border rounded-lg px-3 py-2 mt-1"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="unique id (used for login)"
              required
            />
            <p className="text-xs text-subtle mt-1">
              Must be unique across the system.
            </p>
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
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-fg">
              Password
            </label>
            <input
              type="password"
              className="w-full border rounded-lg px-3 py-2 mt-1"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
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
              required
            >
              <option value="">Select a role</option>
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
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
              className="px-4 py-2 rounded-md bg-brand text-white disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create user"}
            </button>
          </div>{" "}
          {errorMsg ? (
            <p className="text-sm text-danger mt-2">{errorMsg}</p>
          ) : null}
        </form>
      </div>
    </div>
  );
}
