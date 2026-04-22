/* eslint-disable react/prop-types */
"use client";
import React from "react";
import { useState } from "react";

const CompanyInfo = ({ company, setCompany }) => {
  const [form, setForm] = useState(company);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setCompany({ ...company, [e.target.name]: e.target.value });
  };

  return (
    <div className="p-4 border rounded-lg shadow-sm space-y-3">
      <h2 className="text-lg font-semibold">Company Info</h2>

      <input
        className="w-full border rounded p-2"
        name="name"
        placeholder="Company Name"
        value={form.name}
        onChange={handleChange}
      />
      <input
        className="w-full border rounded p-2"
        name="email"
        placeholder="Company Email"
        value={form.email}
        onChange={handleChange}
      />
      <input
        className="w-full border rounded p-2"
        name="phone"
        placeholder="Phone"
        value={form.phone}
        onChange={handleChange}
      />
    </div>
  );
};

export default CompanyInfo;
