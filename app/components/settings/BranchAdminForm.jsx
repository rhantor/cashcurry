/* eslint-disable react/prop-types */
import React, { useState } from "react";
import { AiOutlineEye, AiOutlineEyeInvisible } from "react-icons/ai";

const AssignBranchAdminForm = ({
  branches,
  adminForm,
  handleAdminChange,
  handleAssignAdmin,
  isAssigningBranchAdmin,
  errorMsg,
}) => {
  const [showPassword, setShowPassword] = useState(false);

  const isFormValid =
    adminForm.branchId &&
    adminForm.adminName &&
    adminForm.adminUserName &&
    adminForm.adminEmail &&
    adminForm.adminPassword?.length >= 6;

  return (
    <form
      onSubmit={handleAssignAdmin}
      className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 bg-white p-4 rounded-lg shadow"
    >
      {/* Branch Selection */}
      <div className="col-span-2 md:col-span-1">
        <label className="block text-sm font-medium text-gray-700">
          Select Branch
        </label>
        <select
          name="branchId"
          value={adminForm.branchId}
          onChange={handleAdminChange}
          className="border px-3 py-2 rounded w-full"
          required
        >
          <option value="">-- Choose Branch --</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      {/* Admin Name */}
      <div className="md:col-span-1">
        <label className="block text-sm font-medium text-gray-700">
          Admin Name
        </label>
        <input
          type="text"
          name="adminName"
          value={adminForm.adminName || ""}
          onChange={handleAdminChange}
          placeholder="John Doe"
          className="border px-3 py-2 rounded w-full"
          required
        />
      </div>

      {/* Admin Username */}
      <div className="md:col-span-1">
        <label className="block text-sm font-medium text-gray-700">
          Admin Username
        </label>
        <input
          type="text"
          name="adminUserName"
          value={adminForm.adminUserName || ""}
          onChange={handleAdminChange}
          placeholder="johndoe123"
          className={`border px-3 py-2 rounded w-full ${
            errorMsg ? "border-red-500" : ""
          }`}
          required
        />
        {errorMsg ===
          "This username is already taken. Please choose another." && (
          <p className="text-xs text-red-500 mt-1">{errorMsg}</p>
        )}
        <p className="text-xs text-gray-500 mt-1">Must be unique per branch.</p>
      </div>

      {/* Admin Email */}
      <div className="md:col-span-1">
        <label className="block text-sm font-medium text-gray-700">
          Admin Email
        </label>
        <input
          type="email"
          name="adminEmail"
          value={adminForm.adminEmail || ""}
          onChange={handleAdminChange}
          placeholder="admin@email.com"
          className="border px-3 py-2 rounded w-full"
          required
        />
        {errorMsg === "This email is already in use by another account." && (
          <p className="text-xs text-red-500 mt-1">{errorMsg}</p>
        )}
        <p className="text-xs text-gray-500 mt-1">Must be unique per branch.</p>
      </div>

      {/* Admin Password */}
      <div className="md:col-span-1 relative">
        <label className="block text-sm font-medium text-gray-700">
          Password
        </label>
        <input
          type={showPassword ? "text" : "password"}
          name="adminPassword"
          value={adminForm.adminPassword || ""}
          onChange={handleAdminChange}
          placeholder="••••••••"
          className="border px-3 py-2 rounded w-full pr-10"
          required
          minLength={6}
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-9 text-gray-500 hover:text-gray-700"
        >
          {showPassword ? (
            <AiOutlineEyeInvisible size={20} />
          ) : (
            <AiOutlineEye size={20} />
          )}
        </button>
        <p className="text-xs text-gray-500 mt-1">
          Minimum 6 characters. Admin can reset password later.
        </p>
      </div>

      {errorMsg ===
        "This branch already has the maximum of 2 admins assigned." && (
        <p className="text-xs text-red-500 mt-1">{errorMsg}</p>
      )}
      {/* Submit */}
      <div className="md:col-span-2 flex justify-end">
        <button
          type="submit"
          disabled={!isFormValid}
          className={`px-6 py-2 rounded text-white ${
            isFormValid
              ? "bg-blue-600 hover:bg-blue-700"
              : "bg-gray-400 cursor-not-allowed"
          }`}
        >
          {isAssigningBranchAdmin
            ? "Assigning branch admin..."
            : "Assign Branch Admin"}
        </button>
      </div>
    </form>
  );
};

export default AssignBranchAdminForm;
