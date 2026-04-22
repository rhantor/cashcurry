/* eslint-disable react/prop-types */
// BranchForm.jsx
import React from "react";

const BranchForm = ({
  handleCreateBranch,
  form,
  handleChange,
  // editingBranch,
  branches,
  disableForm,
  isAddingBranch,
}) => {
  const isMaxBranches = branches?.length >= 5;

  return (
    <div>
      <form
        onSubmit={handleCreateBranch}
        className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 bg-white p-4 rounded-lg shadow"
      >
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Branch Name
          </label>
          <input
            type="text"
            name="name"
            value={form.name || ""}
            onChange={handleChange}
            placeholder="e.g. KLCC Outlet"
            className="border px-3 py-2 rounded w-full"
            required
            disabled={disableForm || isMaxBranches}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Contact Number
          </label>
          <input
            type="text"
            name="contact"
            value={form.contact || ""}
            onChange={handleChange}
            placeholder="+60 123 456 789"
            className="border px-3 py-2 rounded w-full"
            required
            disabled={disableForm || isMaxBranches}
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700">
            Address
          </label>
          <input
            type="text"
            name="address"
            value={form.address || ""}
            onChange={handleChange}
            placeholder="123 Main Street, Kuala Lumpur"
            className="border px-3 py-2 rounded w-full"
            required
            disabled={disableForm || isMaxBranches}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            type="email"
            name="email"
            value={form.email || ""}
            onChange={handleChange}
            placeholder="branch@email.com"
            className="border px-3 py-2 rounded w-full"
            disabled={disableForm || isMaxBranches}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Note (Optional)
          </label>
          <input
            type="text"
            name="note"
            value={form.note || ""}
            onChange={handleChange}
            placeholder="Remarks..."
            className="border px-3 py-2 rounded w-full"
            disabled={disableForm || isMaxBranches}
          />
        </div>

        <div className="md:col-span-2 flex justify-end">
          <button
            type="submit"
            className={`px-6 py-2 rounded text-white ${
              disableForm || isMaxBranches
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-mint-600 hover:bg-mint-700"
            }`}
            disabled={disableForm || isMaxBranches || isAddingBranch}
          >
            {isAddingBranch ? "adding branch.." : "Add Branch"}
          </button>
        </div>

        {isMaxBranches && (
          <p className="text-red-500 text-sm md:col-span-2">
            ⚠️ Maximum 5 branches allowed per company.
          </p>
        )}
      </form>
    </div>
  );
};

export default BranchForm;
