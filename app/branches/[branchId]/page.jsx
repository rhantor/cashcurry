"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { getUserFromLocalStorage } from "@/lib/getUserFromLocalStorage";
import {
  useGetBranchesQuery,
  useUpdateBranchMutation,
  useDeleteAdminMutation,
  useUpdateBranchAdminMutation,
  useUpdateBranchUserMutation,
  useDeleteBranchUserMutation,
  useAddBranchUserMutation,
} from "@/lib/redux/api/branchApiSlice";
import { FaSpinner } from "react-icons/fa";
import Sidebar from "./Sidebar";
import AdminModal from "./AdminModal";
import BranchInfo from "./BranchInfo";
import Settings from "./Settings";
import UserModal from "./UserModal";
import AddBranchUserModal from "@/app/components/settings/users/modals/AddBranchUserModal";

const BranchDetailsPage = () => {
  const user = getUserFromLocalStorage();
  const { branchId } = useParams();
  const {
    data: branches,
    isLoading,
    error,
  } = useGetBranchesQuery(user?.companyId, { skip: !user?.companyId });

  const [updateBranch, { isLoading: isUpdatingBranch }] =
    useUpdateBranchMutation();
  const [deleteAdmin, { isLoading: isDeletingAdmin }] =
    useDeleteAdminMutation();
  const [updateBranchAdmin, { isLoading: isUpdatingAdmin }] =
    useUpdateBranchAdminMutation();
  const [updateBranchUser, { isLoading: isUpdatingUser }] =
    useUpdateBranchUserMutation();
  const [deleteBranchUser, { isLoading: isDeletingUser }] =
    useDeleteBranchUserMutation();
  const [addBranchUser, { isLoading: isAddingUser }] =
    useAddBranchUserMutation();
  const branchData = branches?.find((b) => b.id === branchId);
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    contact: "",
    email: "",
  });
  const [modalType, setModalType] = useState(null); // 'admin' | 'user' | 'addStaff' | null
  const [addStaffError, setAddStaffError] = useState("");
  const [currentAdmin, setCurrentAdmin] = useState(null);
  const [currentBranchUser, setCurrentBranchUser] = useState(null);
  const [updatingAdminId, setUpdatingAdminId] = useState(null);
  const [admins, setAdmins] = useState([]);
  const [branchUsers, setBranchUsers] = useState([]);
  const [selectedPage, setSelectedPage] = useState("branch info");

  useEffect(() => {
    if (branchData) {
      setFormData({
        name: branchData.name,
        address: branchData.address,
        contact: branchData.contact,
        email: branchData.email,
      });
      setAdmins(branchData.admins || []); // sync local state with branch admins
      setBranchUsers(branchData.users || []); //sync local state with branch users
    }
  }, [branchData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({ ...prevData, [name]: value }));
  };

  const handleUpdateBranchInfo = async () => {
    if (
      formData.name === branchData.name &&
      formData.address === branchData.address &&
      formData.contact === branchData.contact &&
      formData.email === branchData.email
    )
      return;

    try {
      await updateBranch({
        companyId: user?.companyId,
        branchId,
        updates: formData,
      }).unwrap();
    } catch (err) {
      console.error("Failed to update branch info:", err);
    }
  };

  const handleUpdateBranchAdmin = async (updatedAdmin) => {
    setUpdatingAdminId(updatedAdmin.id); // mark as updating
    try {
      await updateBranchAdmin({
        companyId: user?.companyId,
        branchId,
        adminId: updatedAdmin.id,
        updates: {
          name: updatedAdmin.name,
          email: updatedAdmin.email,
          username:
            updatedAdmin.username ||
            updatedAdmin.name.toLowerCase().replace(/\s+/g, "_"),
          role: "branchAdmin",
        },
      }).unwrap();

      // Update local state
      setAdmins((prev) =>
        prev.map((adm) => (adm.id === updatedAdmin.id ? updatedAdmin : adm))
      );
    } catch (err) {
      console.error("Failed to update admin:", err);
    } finally {
      setUpdatingAdminId(null); // clear updating flag
      setModalType(null);
      setCurrentAdmin(null);
    }
  };

  const handleUpdateBranchUser = async (updateUser) => {
    // setUpdatingAdminId(updatedAdmin.id); // mark as updating
    try {
      await updateBranchUser({
        companyId: user?.companyId,
        branchId,
        userId: updateUser.id,
        updates: {
          fullName: updateUser.name,
          email: updateUser.email,
          userName:
            updateUser.username ||
            updateUser.name.toLowerCase().replace(/\s+/g, "_"),
          role: updateUser.role,
        },
      }).unwrap();

      // Update local state
      setBranchUsers((prev) =>
        prev.map((adm) => (adm.id === updateUser.id ? updateUser : adm))
      );
    } catch (err) {
      console.error("Failed to update user:", err);
    } finally {
      setUpdatingAdminId(null); // clear updating flag
      setModalType(null);
      setCurrentAdmin(null);
    }
  };

  const handleDeleteAdmin = async (adminId) => {
    if (!window.confirm("Are you sure you want to remove this admin?")) return;
    try {
      await deleteAdmin({
        companyId: user?.companyId,
        branchId,
        adminId,
      }).unwrap();
    } catch (err) {
      console.error("Failed to delete admin:", err);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm("Are you sure you want to remove this user?")) return;
    try {
      await deleteBranchUser({
        companyId: user?.companyId,
        branchId,
        userId,
      }).unwrap();
    } catch (err) {
      console.error("Failed to delete user:", err);
    }
  };

  const handleAddStaff = async ({ fullName, userName, email, password, role }) => {
    setAddStaffError("");
    try {
      const res = await addBranchUser({
        companyId: user?.companyId,
        branchId,
        fullName,
        userName,
        email,
        password,
        role,
      }).unwrap();
      // Optimistically add new user to local list
      setBranchUsers((prev) => [
        ...prev,
        { id: res.uid, fullName, userName, email, role },
      ]);
      setModalType(null);
    } catch (err) {
      setAddStaffError(err?.error || err?.message || "Failed to create user.");
    }
  };

  if (isLoading)
    return (
      <div className="flex justify-center items-center h-screen bg-gray-100">
        <FaSpinner className="animate-spin text-4xl text-blue-600" />
        <p className="ml-4 text-xl text-gray-700">Loading branch details...</p>
      </div>
    );

  if (error)
    return (
      <div className="flex justify-center items-center h-screen bg-gray-100">
        <p className="text-xl text-red-600">
          Error: Could not load branch data.
        </p>
      </div>
    );

  if (!branchData)
    return (
      <div className="flex justify-center items-center h-screen bg-gray-100">
        <p className="text-xl text-gray-700">Branch not found.</p>
      </div>
    );

  const hasChanges =
    formData.name !== branchData.name ||
    formData.address !== branchData.address ||
    formData.contact !== branchData.contact ||
    formData.email !== branchData.email;

  return (
    <div className="flex flex-col md:flex-row relative h-screen bg-gray-100 font-sans">
      {/* Sidebar */}
      <Sidebar setSelectedPage={setSelectedPage} selectedPage={selectedPage} />

      {/* Main content */}
      {selectedPage === "branch info" && (
        <BranchInfo
          admins={admins}
          branchUsers={branchUsers}
          branchData={branchData}
          handleChange={handleChange}
          handleUpdateBranchInfo={handleUpdateBranchInfo}
          hasChanges={hasChanges}
          isDeletingAdmin={isDeletingAdmin}
          isUpdatingAdmin={isUpdatingAdmin}
          isUpdatingBranch={isUpdatingBranch}
          setCurrentAdmin={setCurrentAdmin}
          setModalType={setModalType}
          updatingAdminId={updatingAdminId}
          formData={formData}
          handleDeleteAdmin={handleDeleteAdmin}
          handleDeleteUser={handleDeleteUser}
          isDeletingUser={isDeletingUser}
          setCurrentBranchUser={setCurrentBranchUser}
          onAddStaff={() => { setAddStaffError(""); setModalType("addStaff"); }}
        />
      )}
      {selectedPage === "reports" && (
        <div className="flex-1 p-4 md:p-8 overflow-auto">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6">
            Reports
          </h1>{" "}
        </div>
      )}
      {selectedPage === "settings" && (
        <div className="flex-1 p-4 md:p-8 overflow-auto">
          <Settings />
        </div>
      )}

      {/* Admin Modal */}
      {modalType === "admin" && (
        <AdminModal
          admin={currentAdmin}
          onClose={() => {
            setModalType(null);
            setCurrentAdmin(null);
          }}
          isLoading={isUpdatingAdmin}
          onSave={handleUpdateBranchAdmin}
        />
      )}
      {/* User Modal */}
      {modalType === "user" && (
        <UserModal
          user={currentBranchUser}
          isLoading={isUpdatingUser}
          onClose={() => {
            setModalType(null);
            setCurrentBranchUser(null);
          }}
          onSave={handleUpdateBranchUser}
        />
      )}

      {/* Add Staff Modal */}
      <AddBranchUserModal
        open={modalType === "addStaff"}
        branchName={branchData?.name}
        onClose={() => { setModalType(null); setAddStaffError(""); }}
        onCreate={handleAddStaff}
        creating={isAddingUser}
        errorMsg={addStaffError}
      />
    </div>
  );
};

export default BranchDetailsPage;
