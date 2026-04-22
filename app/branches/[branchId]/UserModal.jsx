/* eslint-disable react/prop-types */
"use client";
import React, { useState, useEffect } from "react";

const UserModal = ({ user, onClose, onSave, isLoading }) => {
  const [name, setName] = useState(user?.fullName);
  const [userName, setUserName] = useState(user?.userName || "");
  const [email, setEmail] = useState(user?.email || "");
  const [role, setRole] = useState(user?.role); // default role

  // Sync with props when editing
  useEffect(() => {
    if (user) {
      setName(user.fullName || "");
      setUserName(user.userName || "");
      setEmail(user.email || "");
      setRole(user.role);
    }
  }, [user]);

  const handleSave = () => {
    if (!name.trim() || !userName.trim() || !email.trim() || !role.trim())
      return;

    onSave({
      id: user?.id,
      name,
      userName,
      email,
      role,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-lg font-bold mb-4">
          {user ? "Edit User" : "Add User"}
        </h2>

        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border p-2 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* userName */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              userName
            </label>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="w-full border p-2 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border p-2 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full border p-2 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="cashier">Cashier</option>
              <option value="supervisor">Supervisor</option>
              <option value="manager">Manager</option>
            </select>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 rounded-md hover:bg-gray-400"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            {isLoading ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserModal;
