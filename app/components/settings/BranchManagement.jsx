"use client";
import React from "react";
import { useState } from "react";
import {
  useGetBranchesQuery,
  useAddBranchMutation,
  useUpdateBranchMutation,
  useDeleteBranchMutation,
  useAssignBranchAdminMutation,
  useAddBranchUserMutation,
} from "@/lib/redux/api/branchApiSlice";
import AssignBranchAdminForm from "./BranchAdminForm";
import BranchForm from "./BranchForm";
import BranchList from "./BranchList";
import { getUserFromLocalStorage } from "@/lib/getUserFromLocalStorage";
import AssignBranchUserForm from "./BranchUserForm";

export default function BranchManagement() {
  const user = getUserFromLocalStorage();

  const { data: branches = [] } = useGetBranchesQuery(user?.companyId, {
    skip: !user?.companyId,
  });

  const [addBranch, { isLoading: isAddingBranch }] = useAddBranchMutation();
  const [updateBranch] = useUpdateBranchMutation();
  const [deleteBranch] = useDeleteBranchMutation();
  const [assignBranchAdmin, { isLoading: isAssigningBranchAdmin }] =
    useAssignBranchAdminMutation();
  const [addBranchUser, { isLoading: isAssigningBranchUser }] =
    useAddBranchUserMutation();

  // --- Branch form state ---
  const [form, setForm] = useState({
    name: "",
    address: "",
    contact: "",
    email: "",
    note: "",
  });
  const [editingBranch, setEditingBranch] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  // --- Branch Admin form state ---
  const [adminForm, setAdminForm] = useState({
    branchId: "",
    adminName: "",
    adminEmail: "",
    adminUserName: "",
    adminPassword: "",
  });
  // --- Branch User form state ---
  const [userForm, setUserForm] = useState({
    branchId: "",
    name: "", // full name
    username: "", // unique username
    email: "",
    role: "",
    password: "",
  });

  // handle input changes for branch user form
  const handleUserChange = (e) => {
    setUserForm({ ...userForm, [e.target.name]: e.target.value });
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleAdminChange = (e) => {
    setAdminForm({ ...adminForm, [e.target.name]: e.target.value });
  };

  const handleCreateBranch = async (e) => {
    e.preventDefault();
    if (!user?.companyId) return;

    if (editingBranch) {
      await updateBranch({
        companyId: user.companyId,
        branchId: editingBranch,
        updates: form,
      }).unwrap();
      setEditingBranch(null);
    } else {
      await addBranch({ companyId: user.companyId, ...form }).unwrap();
    }

    setForm({ name: "", address: "", contact: "", email: "", note: "" });
  };

  const handleDeleteBranch = async (id) => {
    if (!user?.companyId) return;
    await deleteBranch({ companyId: user.companyId, branchId: id }).unwrap();
  };

  const handleEditBranch = (branch) => {
    setForm({
      name: branch.name,
      address: branch.address,
      contact: branch.contact,
      email: branch.email,
      note: branch.note,
    });
    setEditingBranch(branch.id);
  };

  const handleAssignAdmin = async (e) => {
    e.preventDefault();
    if (!user?.companyId || !adminForm.branchId) return;
    setErrorMsg(""); // Clear previous errors

    try {
      await assignBranchAdmin({
        companyId: user.companyId,
        branchId: adminForm.branchId,
        adminName: adminForm.adminName,
        adminEmail: adminForm.adminEmail,
        adminUserName: adminForm.adminUserName,
        adminPassword: adminForm.adminPassword,
      }).unwrap();

      setAdminForm({
        branchId: "",
        adminName: "",
        adminEmail: "",
        adminPassword: "",
      });
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

  // ... (pass errorMsg and setErrorMsg to the component)
  // handle assign user submit
  const handleAssignUser = async (e) => {
    e.preventDefault();
    if (!user?.companyId || !userForm.branchId) return;

    try {
      await addBranchUser({
        companyId: user.companyId,
        branchId: userForm.branchId,
        userName: userForm.username, // ✅ username
        email: userForm.email, // ✅ email
        password: userForm.password, // ✅ password
        role: userForm.role, // ✅ role
        fullName: userForm.name, // ✅ extra if you want to store full name
      }).unwrap();

      // ✅ reset form after success
      setUserForm({
        branchId: "",
        name: "",
        username: "",
        email: "",
        role: "",
        password: "",
      });
    } catch (err) {
      alert(err?.error || err?.message || "Failed to assign user");
    }
  };

  return (
    <div className="p-6">
      {/* <h2 className="text-xl font-semibold mb-4">Branch Management</h2> */}

      {/* Create/Edit Branch Form */}
      <h1 className="mb-4 font-bold text-xl">Add Branches</h1>
      <BranchForm
        handleChange={handleChange}
        handleCreateBranch={handleCreateBranch}
        form={form}
        editingBranch={editingBranch}
        disableForm={!!editingBranch} // Disable form if editing
        isAddingBranch={isAddingBranch}
      />

      {/* Assign Branch Admin Form */}
      <h1 className="mb-4 font-bold text-xl">Assign Branch Admins</h1>
      <AssignBranchAdminForm
        branches={branches}
        adminForm={adminForm}
        handleAdminChange={handleAdminChange}
        handleAssignAdmin={handleAssignAdmin}
        isAssigningBranchAdmin={isAssigningBranchAdmin}
        errorMsg={errorMsg}
      />
      <h1 className="mb-4 font-bold text-xl">Assign Branch Users</h1>
      {/* Assign Branch user form */}
      <AssignBranchUserForm
        branches={branches}
        handleAssignUser={handleAssignUser}
        handleUserChange={handleUserChange}
        userForm={userForm}
        isAssigningBranchUser={isAssigningBranchUser}
      />
      {/* Branch List */}
      <BranchList
        branches={branches}
        handleDeleteBranch={handleDeleteBranch}
        handleEditBranch={handleEditBranch}
      />
    </div>
  );
}
