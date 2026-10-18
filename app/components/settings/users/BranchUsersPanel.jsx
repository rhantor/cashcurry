// components/settings/users/BranchUsersPanel.jsx
"use client";
import React from "react";
import RoleBadge from "./RoleBadge";
import IconButton from "./IconButton";
import { can } from "@/lib/authz/permissions";
import { Pencil, Trash2, Plus } from "lucide-react";

// changing users: owner and super admin (roles matrix, company.manage — the database rule says the same)
const canShowActions = (role) => can(role, "company.manage");

export default function BranchUsersPanel({
  branches = [],
  currentUserRole, // role string (to decide permissions)
  onEditAdmin, // (branchId, admin) => void
  onDeleteAdmin, // (branchId, admin) => void
  onEditUser, // (branchId, user) => void
  onAddUser, // (branchId) => void
  onDeleteUser, // (branchId, user) => void
}) {
  const canManage = canShowActions(currentUserRole);

  if (!branches.length) {
    return (
      <div className="bg-surface rounded-lg shadow p-6 text-muted">
        No branches found.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {branches.map((b) => (
        <div key={b.id} className="bg-surface shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b flex items-center justify-between">
            <h4 className="text-lg font-bold text-fg">
              {b.name || "Unnamed Branch"}
            </h4>
            <span className="text-sm text-muted">
              {b.admins?.length || 0} admin(s) • {b.users?.length || 0} user(s)
            </span>
          </div>

          {/* Admins – Desktop table */}
          <div className="px-4 py-4 hidden md:block">
            <h5 className="font-semibold text-fg mb-2">Admins</h5>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-muted">
                <thead className="bg-surface-2 text-fg uppercase text-xs">
                  <tr>
                    <th className="px-4 py-2">Name</th>
                    <th className="px-4 py-2">Email</th>
                    <th className="px-4 py-2">Role</th>
                    {canManage && (
                      <th className="px-4 py-2 text-right">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {(b.admins || []).map((a) => (
                    <tr key={a.id} className="border-t hover:bg-surface-2">
                      <td className="px-4 py-2 font-medium text-fg">
                        {a.fullName || a.userName || "-"}
                      </td>
                      <td className="px-4 py-2">{a.email || "-"}</td>
                      <td className="px-4 py-2">
                        <RoleBadge role={a.role || "branchAdmin"} />
                      </td>
                      {canManage && (
                        <td className="px-4 py-2">
                          <div className="flex justify-end gap-2">
                            <IconButton
                              onClick={() => onEditAdmin?.(b.id, a)}
                              title="Edit admin"
                              className="text-info hover:text-info"
                            >
                              <Pencil className="h-4 w-4" />
                            </IconButton>
                            <IconButton
                              onClick={() => onDeleteAdmin?.(b.id, a)}
                              title="Delete admin"
                              className="text-danger hover:text-danger"
                            >
                              <Trash2 className="h-4 w-4" />
                            </IconButton>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                  {!b.admins?.length && (
                    <tr>
                      <td
                        className="px-4 py-3 text-subtle italic"
                        colSpan={canManage ? 4 : 3}
                      >
                        No admins yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Admins – Mobile cards */}
          <div className="px-4 py-4 space-y-3 md:hidden">
            <h5 className="font-semibold text-fg mb-2">Admins</h5>
            {(b.admins || []).map((a) => (
              <div key={a.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-fg">
                    {a.fullName || a.userName || "-"}
                  </div>
                  <RoleBadge role={a.role || "branchAdmin"} />
                </div>
                <div className="text-sm text-muted mt-1">
                  {a.email || <span className="text-subtle">No email</span>}
                </div>
                {canManage && (
                  <div className="flex justify-end gap-2 mt-3">
                    <IconButton
                      onClick={() => onEditAdmin?.(b.id, a)}
                      title="Edit admin"
                      className="text-info hover:text-info"
                    >
                      <Pencil className="h-4 w-4" />
                    </IconButton>
                    <IconButton
                      onClick={() => onDeleteAdmin?.(b.id, a)}
                      title="Delete admin"
                      className="text-danger hover:text-danger"
                    >
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  </div>
                )}
              </div>
            ))}
            {!b.admins?.length && (
              <div className="text-subtle italic">No admins yet.</div>
            )}
          </div>

          {/* Users – Desktop table */}
          <div className="px-4 pb-5 hidden md:block">
            <div className="flex items-center justify-between mb-2">
              <h5 className="font-semibold text-fg">Users</h5>
              {canManage && (
                <button
                  onClick={() => onAddUser?.(b.id)}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-brand text-white hover:brightness-105"
                >
                  <Plus className="h-3 w-3" /> Add User
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-muted">
                <thead className="bg-surface-2 text-fg uppercase text-xs">
                  <tr>
                    <th className="px-4 py-2">Name</th>
                    <th className="px-4 py-2">Email</th>
                    <th className="px-4 py-2">Role</th>
                    {canManage && (
                      <th className="px-4 py-2 text-right">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {(b.users || []).map((u) => (
                    <tr key={u.id} className="border-t hover:bg-surface-2">
                      <td className="px-4 py-2 font-medium text-fg">
                        {u.fullName || u.name || u.userName || "-"}
                      </td>
                      <td className="px-4 py-2">{u.email || "-"}</td>
                      <td className="px-4 py-2">
                        <RoleBadge role={u.role} />
                      </td>
                      {canManage && (
                        <td className="px-4 py-2">
                          <div className="flex justify-end gap-2">
                            <IconButton
                              onClick={() => onEditUser?.(b.id, u)}
                              title="Edit user"
                              className="text-info hover:text-info"
                            >
                              <Pencil className="h-4 w-4" />
                            </IconButton>
                            <IconButton
                              onClick={() => onDeleteUser?.(b.id, u)}
                              title="Delete user"
                              className="text-danger hover:text-danger"
                            >
                              <Trash2 className="h-4 w-4" />
                            </IconButton>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                  {!b.users?.length && (
                    <tr>
                      <td
                        className="px-4 py-3 text-subtle italic"
                        colSpan={canManage ? 4 : 3}
                      >
                        No users yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Users – Mobile cards */}
          <div className="px-4 pb-5 space-y-3 md:hidden">
            <div className="flex items-center justify-between mb-2">
              <h5 className="font-semibold text-fg">Users</h5>
              {canManage && (
                <button
                  onClick={() => onAddUser?.(b.id)}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-brand text-white hover:brightness-105"
                >
                  <Plus className="h-3 w-3" /> Add
                </button>
              )}
            </div>
            {(b.users || []).map((u) => (
              <div key={u.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-fg">
                    {u.fullName || u.name || u.userName || "-"}
                  </div>
                  <RoleBadge role={u.role} />
                </div>
                <div className="text-sm text-muted mt-1">
                  {u.email || <span className="text-subtle">No email</span>}
                </div>
                {canManage && (
                  <div className="flex justify-end gap-2 mt-3">
                    <IconButton
                      onClick={() => onEditUser?.(b.id, u)}
                      title="Edit user"
                      className="text-info hover:text-info"
                    >
                      <Pencil className="h-4 w-4" />
                    </IconButton>
                    <IconButton
                      onClick={() => onDeleteUser?.(b.id, u)}
                      title="Delete user"
                      className="text-danger hover:text-danger"
                    >
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  </div>
                )}
              </div>
            ))}
            {!b.users?.length && (
              <div className="text-subtle italic">No users yet.</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
