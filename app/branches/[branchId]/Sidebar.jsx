/* eslint-disable react/prop-types */
import React, { useState } from "react";

const Sidebar = ({ setSelectedPage, selectedPage }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Mobile top bar */}
      <div className="bg-slate-800 text-white p-4 flex justify-between items-center md:hidden">
        <h2 className="text-xl font-bold">Branch Dashboard</h2>
        <button onClick={() => setIsOpen(true)} aria-label="Open sidebar menu">
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
      </div>

      {/* Sidebar */}
      <aside
        className={`
          bg-slate-800 text-white p-4 shadow-lg
          fixed top-0 left-0 h-screen z-40
          transform transition-transform duration-300 ease-in-out
          w-4/5 max-w-xs md:w-64 md:sticky md:top-0 md:translate-x-0
          ${isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
      >
        {/* Mobile close button */}
        <div className="flex justify-between items-center mb-6 md:hidden">
          <h2 className="text-xl font-bold">Branch Dashboard</h2>
          <button
            onClick={() => setIsOpen(false)}
            aria-label="Close sidebar menu"
          >
            <svg
              className="w-6 h-6 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Desktop title */}
        <h2 className="text-xl font-bold mb-6 hidden md:block">
          Branch Dashboard
        </h2>

        <ul>
          <li
            className={`mb-3 py-2 px-3 rounded-lg transition-colors duration-200 ${
              selectedPage === "branch info"
                ? "bg-slate-700 font-semibold"
                : "hover:bg-slate-700"
            }`}
            onClick={() => setSelectedPage("branch info")}
          >
            Branch Info
          </li>
          <li
            className={`mb-3 py-2 px-3 rounded-lg transition-colors duration-200 ${
              selectedPage === "reports"
                ? "bg-slate-700 font-semibold"
                : "hover:bg-slate-700"
            }`}
            onClick={() => setSelectedPage("reports")}
          >
            Reports
          </li>
          <li
            className={`mb-3 py-2 px-3 rounded-lg transition-colors duration-200 ${
              selectedPage === "settings"
                ? "bg-slate-700 font-semibold"
                : "hover:bg-slate-700"
            }`}
            onClick={() => setSelectedPage("settings")}
          >
            Settings
          </li>
        </ul>
      </aside>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-30 md:hidden"
          onClick={() => setIsOpen(false)}
        ></div>
      )}
    </>
  );
};

export default Sidebar;
