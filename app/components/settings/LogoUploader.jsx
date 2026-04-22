"use client";
import React from "react";
import { useState } from "react";
import PropTypes, { any } from "prop-types";

const LogoUploader = ({ company, setCompany }) => {
  const [preview, setPreview] = useState(company?.logo || "");

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setPreview(url);
      setCompany({ ...company, logo: url });
    }
  };

  return (
    <div className="p-4 border rounded-lg shadow-sm space-y-3">
      <h2 className="text-lg font-semibold">Company Logo</h2>
      {preview && (
        <img src={preview} alt="logo" className="w-20 h-20 rounded border" />
      )}
      <input type="file" accept="image/*" onChange={handleFileChange} />
    </div>
  );
};

LogoUploader.propTypes = {
  company: any,
  setCompany: PropTypes.func.isRequired,
};

export default LogoUploader;
