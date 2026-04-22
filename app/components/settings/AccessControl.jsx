"use client";
import React from "react";
import { useState } from "react";
import PropTypes from "prop-types";

const AccessControl = ({ users, setUsers }) => {
  const [newUser, setNewUser] = useState({ name: "", role: "viewer" });

  const addUser = () => {
    setUsers([...users, newUser]);
    setNewUser({ name: "", role: "viewer" });
  };

  return (
    <div className="p-4 border rounded-lg shadow-sm space-y-3">
      <h2 className="text-lg font-semibold">Access Control</h2>

      {users?.map((u, i) => (
        <div
          key={i}
          className="p-2 border rounded bg-gray-50 flex justify-between"
        >
          <span>
            {u.name} - {u.role}
          </span>
        </div>
      ))}

      <input
        className="w-full border rounded p-2"
        placeholder="User Name"
        value={newUser.name}
        onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
      />
      <select
        className="w-full border rounded p-2"
        value={newUser.role}
        onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
      >
        <option value="viewer">Viewer</option>
        <option value="supervisor">Supervisor</option>
        <option value="manager">Manager</option>
        <option value="admin">Admin</option>
      </select>

      <button
        onClick={addUser}
        className="px-4 py-2 bg-green-500 text-white rounded"
      >
        Add User
      </button>
    </div>
  );
};

export default AccessControl;
AccessControl.propTypes = {
  users: PropTypes.object.isRequired,
  setUsers: PropTypes.func.isRequired,
};
