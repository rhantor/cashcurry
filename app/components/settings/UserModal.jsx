/* eslint-disable react/prop-types */
"use client";
import {React, useState, useEffect } from "react";
import { FaTimes } from "react-icons/fa";

export default function UserModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  mode,
}) {
  const [form, setForm] = useState({
    userName: "",
    email: "",
    password: "",
    role: "",
  });

  useEffect(() => {
    if (initialData) {
      setForm({
        userName: initialData.userName || "",
        email: initialData.email || "",
        password: "", // don't preload password
        role: initialData.role || "",
      });
    }
  }, [initialData]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(form);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">
            {mode === "edit" ? "Edit User" : "Add New User"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800"
          >
            <FaTimes />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            name="userName"
            placeholder="Username"
            value={form.userName}
            onChange={handleChange}
            className="w-full p-2 border rounded-lg"
            required
          />
          <input
            type="email"
            name="email"
            placeholder="Email"
            value={form.email}
            onChange={handleChange}
            className="w-full p-2 border rounded-lg"
            required
            disabled={mode === "edit"} // cannot change email
          />
          {mode === "add" && (
            <input
              type="password"
              name="password"
              placeholder="Password"
              value={form.password}
              onChange={handleChange}
              className="w-full p-2 border rounded-lg"
              required
            />
          )}
          <select
            name="role"
            value={form.role}
            onChange={handleChange}
            className="w-full p-2 border rounded-lg"
            required
          >
            <option value="">Select Role</option>
            <option value="Admin">Admin</option>
            <option value="Manager">Manager</option>
            <option value="Supervisor">Supervisor</option>
            <option value="Cashier">Cashier</option>
          </select>

          <button
            type="submit"
            className="w-full bg-mint-500 text-white py-2 rounded-lg hover:bg-mint-600 transition"
          >
            {mode === "edit" ? "Update User" : "Add User"}
          </button>
        </form>
      </div>
    </div>
  );
}
