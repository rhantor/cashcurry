// components/settings/users/UserManagement.jsx
"use client";

import React, { useMemo, useState } from "react";
import { useAddBranchUserMutation } from "@/lib/redux/api/branchApiSlice";
import AddBranchUserModal from "./modals/AddBranchUserModal";

// ⬇️ NEW: import create-company-user hook + modal
import {
  useGetCompaniesUsersQuery,
  useUpdateCompanyUserMutation,
  useDeleteCompanyUserMutation,
  useAddCompanyUserMutation, // <-- NEW
} from "@/lib/redux/api/authApiSlice";

import {
  useGetBranchesQuery,
  useUpdateBranchAdminMutation,
  useDeleteAdminMutation,
  useUpdateBranchUserMutation,
  useDeleteBranchUserMutation,
} from "@/lib/redux/api/branchApiSlice";

// Child views
import CompanyUsersTable from "./CompanyUsersTable";
import BranchUsersPanel from "./BranchUsersPanel";

// Modals
import EditCompanyUserModal from "./modals/EditCompanyUserModal";
import EditBranchAdminModal from "./modals/EditBranchAdminModal";
import EditBranchUserModal from "./modals/EditBranchUserModal";
import AddCompanyUserModal from "./modals/AddCompanyUserModal"; // <-- NEW

// Helpers
import { can } from "@/lib/authz/permissions";
import { sanitizeUpdates, normalizeRole } from "@/lib/format/sanitize";
import { getSessionUser } from "@/lib/session";
import { toast, confirmDialog } from "@/app/components/ui/notify";
import { Skeleton, Tabs } from "@/app/components/ui";

export default function UserManagement() {
  // state for add modals
  const [addingBranchId, setAddingBranchId] = useState(null);
  const [addingCompanyUserOpen, setAddingCompanyUserOpen] = useState(false); // <-- NEW
  const [companyAddErr, setCompanyAddErr] = useState(""); // <-- NEW

  const currentUser = getSessionUser();

  const companyId = currentUser?.companyId;
  const userRole = currentUser?.role;

  // Queries
  const {
    data: companyUsers = [],
    isLoading: loadingCompany,
    error: errCompany,
  } = useGetCompaniesUsersQuery(companyId, { skip: !companyId });

  const {
    data: branches = [],
    isLoading: loadingBranches,
    error: errBranches,
  } = useGetBranchesQuery(companyId, { skip: !companyId });

  // Mutations
  const [updateCompanyUser, { isLoading: savingCompanyUser }] =
    useUpdateCompanyUserMutation();
  const [deleteCompanyUser] = useDeleteCompanyUserMutation();
  const [addCompanyUser, { isLoading: creatingCompanyUser }] =
    useAddCompanyUserMutation(); // <-- NEW

  const [updateBranchAdmin, { isLoading: savingAdmin }] =
    useUpdateBranchAdminMutation();
  const [deleteAdmin] = useDeleteAdminMutation();

  const [updateBranchUser, { isLoading: savingBranchUser }] =
    useUpdateBranchUserMutation();

  const [deleteBranchUser] = useDeleteBranchUserMutation();
  const [addBranchUser, { isLoading: creatingBranchUser }] =
    useAddBranchUserMutation();

  // UI state
  const [tab, setTab] = useState("company"); // 'company' | 'branches'
  const [errorMsg, setErrorMsg] = useState("");

  const [editingCompanyUser, setEditingCompanyUser] = useState(null);
  const [editingAdmin, setEditingAdmin] = useState({
    branchId: null,
    admin: null,
  });
  const [editingBranchUser, setEditingBranchUser] = useState({
    branchId: null,
    user: null,
  });

  const branchBlocks = useMemo(
    () =>
      (branches || []).map((b) => ({
        id: b.id,
        name: b.name,
        admins: b.admins || [],
        users: b.users || [],
      })),
    [branches]
  );

  const loading = loadingCompany || loadingBranches;
  // adding, changing and removing users: owner and superAdmin (roles matrix, company.manage)
  const hasManageAll = can(userRole, "company.manage");

  // ----- Company users -----
  const openEditCompanyUser = (u) => setEditingCompanyUser(u);
  const closeEditCompanyUser = () => setEditingCompanyUser(null);

  const handleSaveCompanyUser = async (payload) => {
    if (!editingCompanyUser) return;
    try {
      const updates = sanitizeUpdates({
        userName: payload.userName,
        role: payload.role,
      });
      if (!Object.keys(updates).length) {
        closeEditCompanyUser();
        return;
      }
      await updateCompanyUser({
        companyId,
        uid: editingCompanyUser.id,
        ...updates,
      }).unwrap();
      closeEditCompanyUser();
    } catch (e) {
      console.error(e);
      toast.error("Failed to save company user.");
    }
  };

  const handleDeleteCompanyUser = async (u) => {
    if (normalizeRole(u.role) === "owner") return toast.warning("Cannot delete owner.");
    if (!(await confirmDialog({ title: `Delete ${u.userName}?`, message: "This company user will no longer be able to sign in.", danger: true }))) return;
    try {
      await deleteCompanyUser({ companyId, uid: u.id }).unwrap();
    } catch (e) {
      console.error(e);
      toast.error("Failed to delete user.");
    }
  };

  // ⬇️ NEW: create company user
  const openAddCompanyUser = () => {
    setCompanyAddErr("");
    setAddingCompanyUserOpen(true);
  };
  const closeAddCompanyUser = () => setAddingCompanyUserOpen(false);

  const handleCreateCompanyUser = async ({
    userName,
    email,
    password,
    role,
  }) => {
    setCompanyAddErr("");
    try {
      await addCompanyUser({
        companyId,
        userName: userName.trim(),
        email: email.trim(),
        password,
        role,
      }).unwrap();
      closeAddCompanyUser();
    } catch (err) {
      // RTK Query returns either {status:"USERNAME_TAKEN"} or {status:"CUSTOM_ERROR"}
      const status = err?.status || err?.data?.status;
      if (status === "USERNAME_TAKEN") {
        setCompanyAddErr(
          "This username is already taken. Please choose another."
        );
      } else {
        setCompanyAddErr(err?.error || "Failed to create company user.");
      }
    }
  };

  // ----- Branch admins -----
  const openEditAdmin = (branchId, admin) =>
    setEditingAdmin({ branchId, admin });
  const closeEditAdmin = () => setEditingAdmin({ branchId: null, admin: null });

  const handleSaveAdmin = async (payload) => {
    const { branchId, admin } = editingAdmin || {};
    if (!branchId || !admin) return;
    try {
      const updates = sanitizeUpdates({
        fullName: payload.fullName,
        email: payload.email,
        role: "branchAdmin",
      });
      if (!Object.keys(updates).length) {
        closeEditAdmin();
        return;
      }
      await updateBranchAdmin({
        companyId,
        branchId,
        adminId: admin.id,
        updates,
      }).unwrap();
      closeEditAdmin();
    } catch (e) {
      console.error(e);
      toast.error("Failed to save branch admin.");
    }
  };

  const handleDeleteAdmin = async (branchId, a) => {
    if (!(await confirmDialog({ title: `Delete ${a.name || a.username || a.id}?`, message: "This branch admin will no longer be able to sign in.", danger: true }))) return;
    try {
      await deleteAdmin({ companyId, branchId, adminId: a.id }).unwrap();
    } catch (e) {
      console.error(e);
      toast.error("Failed to delete admin.");
    }
  };

  // ----- Branch users -----
  const openEditBranchUser = (branchId, user) =>
    setEditingBranchUser({ branchId, user });
  const closeEditBranchUser = () =>
    setEditingBranchUser({ branchId: null, user: null });

  const handleSaveBranchUser = async (payload) => {
    const { branchId, user } = editingBranchUser || {};
    if (!branchId || !user) return;
    try {
      const updates = sanitizeUpdates({
        fullName: payload.fullName,
        email: payload.email,
        role: payload.role,
      });
      if (!Object.keys(updates).length) {
        closeEditBranchUser();
        return;
      }
      await updateBranchUser({
        companyId,
        branchId,
        userId: user.id,
        updates,
      }).unwrap();
      closeEditBranchUser();
    } catch (e) {
      console.error(e);
      toast.error("Failed to save branch user.");
    }
  };

  const handleDeleteBranchUser = async (branchId, u) => {
    if (!(await confirmDialog({ title: `Delete ${u.fullName || u.userName || u.id}?`, message: "This user will no longer be able to sign in.", danger: true }))) return;
    try {
      await deleteBranchUser({
        companyId,
        branchId,
        userId: u.id,
        userName: u.userName,
      }).unwrap();
    } catch (e) {
      console.error(e);
      toast.error("Failed to delete user.");
    }
  };

  const addingBranchName = useMemo(
    () => (branches || []).find((b) => b.id === addingBranchId)?.name || "",
    [addingBranchId, branches]
  );

  const openAddBranchUser = (branchId) => setAddingBranchId(branchId);
  const closeAddBranchUser = () => setAddingBranchId(null);

  const handleCreateBranchUser = async ({
    fullName,
    userName,
    email,
    password,
    role,
  }) => {
    setErrorMsg("");
    try {
      await addBranchUser({
        companyId,
        branchId: addingBranchId,
        fullName,
        userName,
        email,
        password,
        role,
      }).unwrap();
      closeAddBranchUser();
    } catch (err) {
      console.log("Failed to assign admin:", err);
      if (err.status === "USERNAME_TAKEN") {
        setErrorMsg("This username is already taken. Please choose another.");
      } else if (err.status === "EMAIL_TAKEN") {
        setErrorMsg("This email is already in use by another account.");
      } else if (err.status === "MAX_ADMINS_REACHED") {
        setErrorMsg(
          "This branch already has the maximum of 2 admins assigned."
        );
      } else {
        setErrorMsg("Failed to assign admin. Please try again.");
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* company users / branch users */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "company", label: `Company (${companyUsers.length})` },
            { value: "branches", label: `Branches (${branches?.length || 0})` },
          ]}
        />
        <span className="text-xs text-muted">{hasManageAll ? "You can add and change users in every branch" : "Only the owner or a super admin can change users"}</span>
      </div>

      {/* Content */}
      {(loadingCompany || loadingBranches) && (
        <Skeleton className="h-48" rounded="rounded-2xl" />
      )}

      {!loading && (errCompany || errBranches) && (
        <div className="bg-surface rounded-lg shadow p-6 text-danger">
          Failed to load data.
        </div>
      )}

      {!loading &&
        !errCompany &&
        !errBranches &&
        (tab === "company" ? (
          <CompanyUsersTable
            users={companyUsers}
            currentUserRole={userRole}
            onEditUser={hasManageAll ? openEditCompanyUser : undefined}
            onDeleteUser={hasManageAll ? handleDeleteCompanyUser : undefined}
            onAddNew={hasManageAll ? openAddCompanyUser : undefined} // <-- NEW
          />
        ) : (
          <BranchUsersPanel
            branches={branchBlocks}
            currentUserRole={userRole}
            onAddUser={hasManageAll ? openAddBranchUser : undefined}
            onEditAdmin={hasManageAll ? openEditAdmin : undefined}
            onDeleteAdmin={hasManageAll ? handleDeleteAdmin : undefined}
            onEditUser={hasManageAll ? openEditBranchUser : undefined}
            onDeleteUser={hasManageAll ? handleDeleteBranchUser : undefined}
          />
        ))}

      {/* Branch Add Modal */}
      <AddBranchUserModal
        open={!!addingBranchId}
        branchName={addingBranchName}
        onClose={closeAddBranchUser}
        onCreate={handleCreateBranchUser}
        creating={creatingBranchUser}
        errorMsg={errorMsg}
      />

      {/* Company Edit Modal */}
      <EditCompanyUserModal
        open={!!editingCompanyUser}
        user={editingCompanyUser}
        onClose={closeEditCompanyUser}
        onSave={handleSaveCompanyUser}
        saving={savingCompanyUser}
      />

      {/* Branch Edit Modals */}
      <EditBranchAdminModal
        open={!!editingAdmin.admin}
        admin={editingAdmin.admin}
        onClose={closeEditAdmin}
        onSave={handleSaveAdmin}
        saving={savingAdmin}
      />
      <EditBranchUserModal
        open={!!editingBranchUser.user}
        user={editingBranchUser.user}
        onClose={closeEditBranchUser}
        onSave={handleSaveBranchUser}
        saving={savingBranchUser}
      />

      {/* ⬇️ NEW: Company Add Modal */}
      <AddCompanyUserModal
        open={addingCompanyUserOpen}
        onClose={closeAddCompanyUser}
        onCreate={handleCreateCompanyUser}
        creating={creatingCompanyUser}
        errorMsg={companyAddErr}
      />
    </div>
  );
}
