// components/settings/users/CompanyUsersTable.jsx
"use client";
import React from "react";
import RoleBadge from "./RoleBadge";
import IconButton from "./IconButton";
import { Pencil, Trash2, UserPlus } from "lucide-react";

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
      <div className="bg-surface rounded-lg shadow p-3 mb-3 flex items-center justify-between">
        <div className="font-semibold text-fg">Company Users</div>
        {canManage && (
          <button
            onClick={onAddNew}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-brand text-brand-fg hover:brightness-105 text-sm"
          >
            <UserPlus className="h-4 w-4" />
            Add User
          </button>
        )}
      </div>

      {/* Empty state */}
      {!users.length && (
        <div className="bg-surface rounded-lg shadow p-6 text-muted flex items-center justify-between">
          <span>No company users found.</span>
          {canManage && (
            <button
              onClick={onAddNew}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-brand text-brand-fg hover:brightness-105 text-sm"
            >
              <UserPlus className="h-4 w-4" />
              Add User
            </button>
          )}
        </div>
      )}

      {!!users.length && (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto bg-surface shadow rounded-lg">
            <table className="w-full text-sm text-left text-muted">
              <thead className="bg-surface-2 text-fg uppercase text-xs">
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
                    <tr key={u.id} className="border-t hover:bg-surface-2">
                      <td className="px-6 py-3 font-medium text-fg">
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
                              className="text-info hover:text-info"
                            >
                              <Pencil className="h-4 w-4" />
                            </IconButton>
                            <IconButton
                              onClick={() => onDeleteUser?.(u)}
                              title="Delete"
                              disabled={isOwnerRow}
                              className="text-danger hover:text-danger"
                            >
                              <Trash2 className="h-4 w-4" />
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
                <div key={u.id} className="bg-surface rounded-lg shadow p-4">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-fg">
                      {u.userName}
                    </div>
                    <RoleBadge role={u.role} />
                  </div>
                  <div className="text-sm text-muted mt-1">
                    {u.email || <span className="text-subtle">No email</span>}
                  </div>

                  {canManage && (
                    <div className="flex justify-end gap-2 mt-3">
                      <IconButton
                        onClick={() => onEditUser?.(u)}
                        title="Edit"
                        disabled={isOwnerRow}
                        className="text-info hover:text-info"
                      >
                        <Pencil className="h-4 w-4" />
                      </IconButton>
                      <IconButton
                        onClick={() => onDeleteUser?.(u)}
                        title="Delete"
                        disabled={isOwnerRow}
                        className="text-danger hover:text-danger"
                      >
                        <Trash2 className="h-4 w-4" />
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
