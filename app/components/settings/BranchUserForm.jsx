/* eslint-disable react/prop-types */
"use client";
import React from "react";
import { useState } from "react";
import { AiOutlineEye, AiOutlineEyeInvisible } from "react-icons/ai";

const AssignBranchUserForm = ({
  branches,
  userForm,
  handleUserChange,
  handleAssignUser,
  isAssigningBranchUser,
}) => {
  const [showPassword, setShowPassword] = useState(false);

  const isFormValid =
    userForm.branchId &&
    userForm.name &&
    userForm.username &&
    userForm.email &&
    userForm.password?.length >= 6 &&
    userForm.role;

  return (
    <form
      onSubmit={handleAssignUser}
      className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 bg-white p-4 rounded-lg shadow"
    >
      {/* Branch Selection */}
      <div className="col-span-2 md:col-span-1">
        <label className="block text-sm font-medium text-gray-700">
          Select Branch
        </label>
        <select
          name="branchId"
          value={userForm.branchId}
          onChange={handleUserChange}
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

      {/* Name */}
      <div className="md:col-span-1">
        <label className="block text-sm font-medium text-gray-700">
          Full Name
        </label>
        <input
          type="text"
          name="name"
          value={userForm.name || ""}
          onChange={handleUserChange}
          placeholder="John Doe"
          className="border px-3 py-2 rounded w-full"
          required
        />
      </div>

      {/* Username */}
      <div className="md:col-span-1">
        <label className="block text-sm font-medium text-gray-700">
          Username
        </label>
        <input
          type="text"
          name="username"
          value={userForm.username || ""}
          onChange={handleUserChange}
          placeholder="johndoe123"
          className="border px-3 py-2 rounded w-full"
          required
        />
        <p className="text-xs text-gray-500 mt-1">Must be unique per branch.</p>
      </div>

      {/* Email */}
      <div className="md:col-span-1">
        <label className="block text-sm font-medium text-gray-700">Email</label>
        <input
          type="email"
          name="email"
          value={userForm.email || ""}
          onChange={handleUserChange}
          placeholder="user@email.com"
          className="border px-3 py-2 rounded w-full"
          required
        />
      </div>

      {/* Role Selection */}
      <div className="md:col-span-1">
        <label className="block text-sm font-medium text-gray-700">Role</label>
        <select
          name="role"
          value={userForm.role || ""}
          onChange={handleUserChange}
          className="border px-3 py-2 rounded w-full"
          required
        >
          <option value="">-- Select Role --</option>
          <option value="manager">Manager</option>
          <option value="accountant">Accountant</option>
          <option value="supervisor">Supervisor</option>
          <option value="cashier">Cashier</option>
        </select>
      </div>

      {/* Password */}
      <div className="md:col-span-1 relative">
        <label className="block text-sm font-medium text-gray-700">
          Password
        </label>
        <input
          type={showPassword ? "text" : "password"}
          name="password"
          value={userForm.password || ""}
          onChange={handleUserChange}
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
          Minimum 6 characters. User can reset password later.
        </p>
      </div>

      {/* Submit */}
      <div className="md:col-span-2 flex justify-end">
        <button
          type="submit"
          disabled={!isFormValid || isAssigningBranchUser}
          className={`px-6 py-2 rounded text-white ${
            isFormValid
              ? "bg-blue-600 hover:bg-blue-700"
              : "bg-gray-400 cursor-not-allowed"
          }`}
        >
          {isAssigningBranchUser ? "asigning..." : "Assign Branch User"}
        </button>
      </div>
    </form>
  );
};

export default AssignBranchUserForm;
