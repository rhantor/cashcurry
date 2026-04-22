// components/settings/users/CompanyUsersTable.jsx
/* eslint-disable react/prop-types */
"use client";
import React from "react";
import RoleBadge from "./RoleBadge";
import IconButton from "./IconButton";
import { FaEdit, FaTrash, FaUserPlus } from "react-icons/fa";

const canShowActions = (role) => {
  const r = String(role || "").toLowerCase();
  return r === "owner" || r === "gm" || r === "superadmin";
};

export default function CompanyUsersTable({
  users = [],
  currentUserRole,
  onEditUser,
  onDeleteUser,
  onAddNew, // <-- NEW
}) {
  const canManage = canShowActions(currentUserRole);

  return (
    <>
      {/* Top toolbar */}
      <div className="bg-white rounded-lg shadow p-3 mb-3 flex items-center justify-between">
        <div className="font-semibold text-gray-800">Company Users</div>
        {canManage && (
          <button
            onClick={onAddNew}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-gray-900 text-white hover:bg-gray-800 text-sm"
          >
            <FaUserPlus className="h-4 w-4" />
            Add User
          </button>
        )}
      </div>

      {/* Empty state */}
      {!users.length && (
        <div className="bg-white rounded-lg shadow p-6 text-gray-500 flex items-center justify-between">
          <span>No company users found.</span>
          {canManage && (
            <button
              onClick={onAddNew}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-gray-900 text-white hover:bg-gray-800 text-sm"
            >
              <FaUserPlus className="h-4 w-4" />
              Add User
            </button>
          )}
        </div>
      )}

      {!!users.length && (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto bg-white shadow rounded-lg">
            <table className="w-full text-sm text-left text-gray-600">
              <thead className="bg-gray-100 text-gray-700 uppercase text-xs">
                <tr>
                  <th className="px-6 py-3">Username</th>
                  <th className="px-6 py-3">Email</th>
                  <th className="px-6 py-3">Role</th>
                  {canManage && (
                    <th className="px-6 py-3 text-right">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isOwnerRow =
                    String(u.role || "").toLowerCase() === "owner";
                  return (
                    <tr key={u.id} className="border-t hover:bg-gray-50">
                      <td className="px-6 py-3 font-medium text-gray-900">
                        {u.userName}
                      </td>
                      <td className="px-6 py-3">{u.email || "-"}</td>
                      <td className="px-6 py-3">
                        <RoleBadge role={u.role} />
                      </td>
                      {canManage && (
                        <td className="px-6 py-3">
                          <div className="flex justify-end gap-2">
                            <IconButton
                              onClick={() => onEditUser?.(u)}
                              title="Edit"
                              disabled={isOwnerRow}
                              className="text-blue-600 hover:text-blue-700"
                            >
                              <FaEdit className="h-4 w-4" />
                            </IconButton>
                            <IconButton
                              onClick={() => onDeleteUser?.(u)}
                              title="Delete"
                              disabled={isOwnerRow}
                              className="text-red-600 hover:text-red-700"
                            >
                              <FaTrash className="h-4 w-4" />
                            </IconButton>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {users.map((u) => {
              const isOwnerRow = String(u.role || "").toLowerCase() === "owner";
              return (
                <div key={u.id} className="bg-white rounded-lg shadow p-4">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-gray-900">
                      {u.userName}
                    </div>
                    <RoleBadge role={u.role} />
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    {u.email || <span className="text-gray-400">No email</span>}
                  </div>

                  {canManage && (
                    <div className="flex justify-end gap-2 mt-3">
                      <IconButton
                        onClick={() => onEditUser?.(u)}
                        title="Edit"
                        disabled={isOwnerRow}
                        className="text-blue-600 hover:text-blue-700"
                      >
                        <FaEdit className="h-4 w-4" />
                      </IconButton>
                      <IconButton
                        onClick={() => onDeleteUser?.(u)}
                        title="Delete"
                        disabled={isOwnerRow}
                        className="text-red-600 hover:text-red-700"
                      >
                        <FaTrash className="h-4 w-4" />
                      </IconButton>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
