"use client";
import React from "react";
import { useState } from "react";

const AdminModal = ({ admin, onClose, onSave, isLoading }) => {
  const [name, setName] = useState(admin?.name || "");
  const [email, setEmail] = useState(admin?.email || "");
  const [username, setUsername] = useState(admin?.username || "");

  const handleSave = () => {
    if (!name.trim() || !email.trim() || !username.trim()) return;
    onSave({ id: admin?.id, name, email, username });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50">
      <div className="bg-surface rounded-lg p-6 w-full max-w-md">
        <h2 className="text-lg font-bold mb-4">
          {admin ? "Edit Admin" : "Add Admin"}
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-fg mb-1">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border p-2 rounded-md border-line bg-surface focus:ring-[var(--cc-ring)] focus:border-brand"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-fg mb-1">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full border p-2 rounded-md border-line bg-surface focus:ring-[var(--cc-ring)] focus:border-brand"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-fg mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border p-2 rounded-md border-line bg-surface focus:ring-[var(--cc-ring)] focus:border-brand"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-surface-2 rounded-md hover:brightness-95"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-brand text-brand-fg rounded-md hover:brightness-105"
          >
            {isLoading ? "Saving..." : "Save  "}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminModal;
