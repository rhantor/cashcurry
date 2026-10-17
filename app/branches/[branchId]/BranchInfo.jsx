import React from "react";
import { Pencil, LoaderCircle, Trash2, UserPlus } from "lucide-react";

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
        <h1 className="text-2xl md:text-3xl font-bold text-fg">
          Branch Informations
        </h1>
        <p className="text-muted mt-1 md:mt-2 text-sm md:text-base">
          Manage and view information for the {branchData.name} branch.
        </p>
      </header>

      {/* Branch Info */}
      <section className="bg-surface p-4 md:p-6 rounded-lg shadow mb-6">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-4">
          <h2 className="text-lg md:text-xl font-semibold text-fg mb-3 md:mb-0">
            Branch Information
          </h2>
          <button
            onClick={handleUpdateBranchInfo}
            disabled={!hasChanges || isUpdatingBranch}
            className={`px-3 py-2 rounded-md font-medium text-white transition-colors duration-200 ${
              !hasChanges || isUpdatingBranch
                ? "bg-surface-2 text-subtle cursor-not-allowed"
                : "bg-brand hover:brightness-105"
            }`}
          >
            {isUpdatingBranch ? (
              <LoaderCircle size="1em" className="animate-spin" />
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
                className="block text-sm font-medium text-fg mb-1"
              >
                {field.charAt(0).toUpperCase() + field.slice(1)}
              </label>
              <input
                id={field}
                name={field}
                type={field === "email" ? "email" : "text"}
                value={formData[field]}
                onChange={handleChange}
                className="w-full p-2 border border-line rounded-md border-line bg-surface focus:ring-[var(--cc-ring)] focus:border-brand transition-colors text-sm md:text-base"
              />
            </div>
          ))}
          {branchData.note && (
            <p className="text-muted text-sm md:text-base mt-2">
              <strong className="text-fg">Note:</strong> {branchData.note}
            </p>
          )}
        </div>
      </section>

      {/* Admins */}
      <section className="bg-surface p-4 md:p-6 rounded-lg shadow mb-6">
        <h2 className="text-lg md:text-xl font-semibold text-fg mb-3">
          Assigned Admins
        </h2>
        {admins?.length > 0 ? (
          <ul className="space-y-3">
            {console.log(admins)}
            {admins?.map((admin) => (
              <li
                key={admin.id}
                className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-3 border border-line rounded-md bg-surface-2/60 hover:shadow-sm transition-shadow duration-200"
              >
                <div className="mb-2 sm:mb-0">
                  <p className="text-fg font-medium">
                    {isUpdatingAdmin && updatingAdminId === admin.id
                      ? "updating..."
                      : admin.fullName}
                  </p>
                  <p className="text-fg font-medium">
                    {isUpdatingAdmin && updatingAdminId === admin.id
                      ? "updating..."
                      : admin.email}
                  </p>
                  <p className="text-fg font-medium">
                    {isUpdatingAdmin && updatingAdminId === admin.id
                      ? "updating..."
                      : admin.userName}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    className="text-warning hover:text-warning transition-colors"
                    onClick={() => {
                      setCurrentAdmin(admin);
                      setModalType("admin");
                    }}
                  >
                    <Pencil size={18} />
                  </button>
                  <button
                    className="text-danger hover:text-danger transition-colors"
                    onClick={() => handleDeleteAdmin(admin.id)}
                    disabled={isDeletingAdmin}
                  >
                    {isDeletingAdmin ? (
                      <LoaderCircle size="1em" className="animate-spin" />
                    ) : (
                      <Trash2 size={18} />
                    )}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted text-center py-2 text-sm md:text-base">
            No admins are currently assigned to this branch.
          </p>
        )}
      </section>

      {/* Branch Users */}
      <section className="bg-surface p-4 md:p-6 rounded-lg shadow mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg md:text-xl font-semibold text-fg">
            Branch Staff
          </h2>
          {onAddStaff && (
            <button
              onClick={onAddStaff}
              className="flex items-center gap-2 px-3 py-1.5 bg-brand hover:brightness-105 text-white text-sm rounded-lg transition-colors"
            >
              <UserPlus size={14} />
              Add Staff
            </button>
          )}
        </div>
        {branchUsers?.length > 0 ? (
          <ul className="space-y-3">
            {branchUsers.map((user) => (
              <li
                key={user.id}
                className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-3 border border-line rounded-md bg-surface-2/60 hover:shadow-sm transition-shadow duration-200"
              >
                <div className="mb-2 sm:mb-0">
                  <p className="text-fg font-medium">{user.fullName}</p>
                  <p className="text-muted text-sm">{user.email}</p>
                  <p className="text-muted text-sm">
                    Username: {user.userName}
                  </p>
                  <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium capitalize
                    ${user.role === "manager" ? "bg-info-soft text-info" :
                      user.role === "accountant" ? "bg-warning-soft text-warning" :
                      user.role === "supervisor" ? "bg-warning-soft text-warning" :
                      user.role === "cashier" ? "bg-brand-soft text-brand" :
                      "bg-surface-2 text-muted"}`}>
                    {user.role || "staff"}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    className="text-warning hover:text-warning transition-colors"
                    onClick={() => {
                      setCurrentBranchUser(user);
                      setModalType("user");
                    }}
                  >
                    <Pencil size={18} />
                  </button>
                  <button
                    className="text-danger hover:text-danger transition-colors"
                    onClick={() => handleDeleteUser(user.id)}
                    disabled={isDeletingUser}
                  >
                    {isDeletingUser ? (
                      <LoaderCircle size="1em" className="animate-spin" />
                    ) : (
                      <Trash2 size={18} />
                    )}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted text-center py-2 text-sm md:text-base">
            No users are currently assigned to this branch.
          </p>
        )}
      </section>

      {/* Recent Activity */}
      <section className="bg-surface p-4 md:p-6 rounded-lg shadow mb-6">
        <h2 className="text-lg md:text-xl font-semibold text-fg mb-3">
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
                  className="p-2 md:p-3 bg-surface-2/60 border border-line rounded-md"
                >
                  <div className="flex justify-between text-xs md:text-sm text-muted mb-1">
                    <span>{log.user}</span>
                    <span>{new Date(log.timestamp).toLocaleString()}</span>
                  </div>
                  <p className="text-fg text-sm md:text-base">
                    {log.action}
                  </p>
                </li>
              ))}
          </ul>
        ) : (
          <p className="text-muted text-center py-2 text-sm md:text-base">
            No recent activity logs available.
          </p>
        )}
      </section>
    </div>
  );
};
export default BranchInfo;
