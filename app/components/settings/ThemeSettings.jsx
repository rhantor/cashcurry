"use client";
import React from "react";
import PropTypes from "prop-types";

const ThemeSettings = ({ theme, setTheme }) => {
  return (
    <div className="p-4 border rounded-lg shadow-sm space-y-3">
      <h2 className="text-lg font-semibold">Theme & Appearance</h2>

      <label className="block text-sm">Theme Mode</label>
      <select
        className="w-full border rounded p-2"
        value={theme.mode}
        onChange={(e) => setTheme({ ...theme, mode: e.target.value })}
      >
        <option value="light">Light</option>
        <option value="dark">Dark</option>
        <option value="system">System</option>
      </select>

      <label className="block text-sm">Primary Color</label>
      <input
        type="color"
        value={theme.primaryColor}
        onChange={(e) => setTheme({ ...theme, primaryColor: e.target.value })}
        className="w-16 h-10 border rounded"
      />
    </div>
  );
};

export default ThemeSettings;

ThemeSettings.propTypes = {
  theme: PropTypes.object.isRequired,
  setTheme: PropTypes.func.isRequired,
};
