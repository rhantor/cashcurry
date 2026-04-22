/* eslint-disable react/prop-types */
import React from "react";
import { FaEdit, FaSpinner, FaTrashAlt, FaUserPlus } from "react-icons/fa";

const BranchInfo = ({
  branchData,
  admins,
  branchUsers,
  updatingAdminId,
  handleUpdateBranchInfo,
  handleChange,
  hasChanges,
  isUpdatingAdmin,
  isUpdatingBranch,
  isDeletingAdmin,
  setCurrentAdmin,
  setModalType,
  formData,
  handleDeleteAdmin,
  setCurrentBranchUser,
  handleDeleteUser,
  isDeletingUser,
  onAddStaff,
}) => {
  return (
    <div className="flex-1 flex flex-col p-4 md:p-8 overflow-auto">
      <header className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
          Branch Informations
        </h1>
        <p className="text-gray-600 mt-1 md:mt-2 text-sm md:text-base">
          Manage and view information for the {branchData.name} branch.
        </p>
      </header>

      {/* Branch Info */}
      <section className="bg-white p-4 md:p-6 rounded-lg shadow mb-6">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-4">
          <h2 className="text-lg md:text-xl font-semibold text-gray-800 mb-3 md:mb-0">
            Branch Information
          </h2>
          <button
            onClick={handleUpdateBranchInfo}
            disabled={!hasChanges || isUpdatingBranch}
            className={`px-3 py-2 rounded-md font-medium text-white transition-colors duration-200 ${
              !hasChanges || isUpdatingBranch
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {isUpdatingBranch ? (
              <FaSpinner className="animate-spin" />
            ) : (
              "Save Changes"
            )}
          </button>
        </div>
        <div className="space-y-3 md:space-y-4">
          {["name", "address", "contact", "email"].map((field) => (
            <div key={field}>
              <label
                htmlFor={field}
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                {field.charAt(0).toUpperCase() + field.slice(1)}
              </label>
              <input
                id={field}
                name={field}
                type={field === "email" ? "email" : "text"}
                value={formData[field]}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm md:text-base"
              />
            </div>
          ))}
          {branchData.note && (
            <p className="text-gray-600 text-sm md:text-base mt-2">
              <strong className="text-gray-800">Note:</strong> {branchData.note}
            </p>
          )}
        </div>
      </section>

      {/* Admins */}
      <section className="bg-white p-4 md:p-6 rounded-lg shadow mb-6">
        <h2 className="text-lg md:text-xl font-semibold text-gray-800 mb-3">
          Assigned Admins
        </h2>
        {admins?.length > 0 ? (
          <ul className="space-y-3">
            {console.log(admins)}
            {admins?.map((admin) => (
              <li
                key={admin.id}
                className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-3 border border-gray-200 rounded-md bg-gray-50 hover:shadow-sm transition-shadow duration-200"
              >
                <div className="mb-2 sm:mb-0">
                  <p className="text-gray-900 font-medium">
                    {isUpdatingAdmin && updatingAdminId === admin.id
                      ? "updating..."
                      : admin.fullName}
                  </p>
                  <p className="text-gray-900 font-medium">
                    {isUpdatingAdmin && updatingAdminId === admin.id
                      ? "updating..."
                      : admin.email}
                  </p>
                  <p className="text-gray-900 font-medium">
                    {isUpdatingAdmin && updatingAdminId === admin.id
                      ? "updating..."
                      : admin.userName}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    className="text-yellow-600 hover:text-yellow-700 transition-colors"
                    onClick={() => {
                      setCurrentAdmin(admin);
                      setModalType("admin");
                    }}
                  >
                    <FaEdit size={18} />
                  </button>
                  <button
                    className="text-red-600 hover:text-red-700 transition-colors"
                    onClick={() => handleDeleteAdmin(admin.id)}
                    disabled={isDeletingAdmin}
                  >
                    {isDeletingAdmin ? (
                      <FaSpinner className="animate-spin" />
                    ) : (
                      <FaTrashAlt size={18} />
                    )}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500 text-center py-2 text-sm md:text-base">
            No admins are currently assigned to this branch.
          </p>
        )}
      </section>

      {/* Branch Users */}
      <section className="bg-white p-4 md:p-6 rounded-lg shadow mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg md:text-xl font-semibold text-gray-800">
            Branch Staff
          </h2>
          {onAddStaff && (
            <button
              onClick={onAddStaff}
              className="flex items-center gap-2 px-3 py-1.5 bg-mint-600 hover:bg-mint-700 text-white text-sm rounded-lg transition-colors"
            >
              <FaUserPlus size={14} />
              Add Staff
            </button>
          )}
        </div>
        {branchUsers?.length > 0 ? (
          <ul className="space-y-3">
            {branchUsers.map((user) => (
              <li
                key={user.id}
                className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-3 border border-gray-200 rounded-md bg-gray-50 hover:shadow-sm transition-shadow duration-200"
              >
                <div className="mb-2 sm:mb-0">
                  <p className="text-gray-900 font-medium">{user.fullName}</p>
                  <p className="text-gray-600 text-sm">{user.email}</p>
                  <p className="text-gray-600 text-sm">
                    Username: {user.userName}
                  </p>
                  <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium capitalize
                    ${user.role === "manager" ? "bg-blue-100 text-blue-700" :
                      user.role === "accountant" ? "bg-purple-100 text-purple-700" :
                      user.role === "supervisor" ? "bg-yellow-100 text-yellow-700" :
                      user.role === "cashier" ? "bg-green-100 text-green-700" :
                      "bg-gray-100 text-gray-600"}`}>
                    {user.role || "staff"}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    className="text-yellow-600 hover:text-yellow-700 transition-colors"
                    onClick={() => {
                      setCurrentBranchUser(user);
                      setModalType("user");
                    }}
                  >
                    <FaEdit size={18} />
                  </button>
                  <button
                    className="text-red-600 hover:text-red-700 transition-colors"
                    onClick={() => handleDeleteUser(user.id)}
                    disabled={isDeletingUser}
                  >
                    {isDeletingUser ? (
                      <FaSpinner className="animate-spin" />
                    ) : (
                      <FaTrashAlt size={18} />
                    )}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500 text-center py-2 text-sm md:text-base">
            No users are currently assigned to this branch.
          </p>
        )}
      </section>

      {/* Recent Activity */}
      <section className="bg-white p-4 md:p-6 rounded-lg shadow mb-6">
        <h2 className="text-lg md:text-xl font-semibold text-gray-800 mb-3">
          Recent Activity
        </h2>
        {branchData.activity?.length > 0 ? (
          <ul className="space-y-2 md:space-y-3 max-h-60 overflow-y-auto">
            {branchData.activity
              .slice(-3)
              .reverse()
              .map((log, idx) => (
                <li
                  key={idx}
                  className="p-2 md:p-3 bg-gray-50 border border-gray-200 rounded-md"
                >
                  <div className="flex justify-between text-xs md:text-sm text-gray-500 mb-1">
                    <span>{log.user}</span>
                    <span>{new Date(log.timestamp).toLocaleString()}</span>
                  </div>
                  <p className="text-gray-800 text-sm md:text-base">
                    {log.action}
                  </p>
                </li>
              ))}
          </ul>
        ) : (
          <p className="text-gray-500 text-center py-2 text-sm md:text-base">
            No recent activity logs available.
          </p>
        )}
      </section>
    </div>
  );
};
export default BranchInfo;
