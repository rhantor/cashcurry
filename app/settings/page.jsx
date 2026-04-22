// app/settings/page.jsx
"use client";
import { React, useState } from "react";
import {
  FaUsers,
  FaBuilding,
  FaPalette,
  FaShieldAlt,
  FaBars,
  FaTimes,
} from "react-icons/fa";
import BranchManagement from "../components/settings/BranchManagement";
import UserManagement from "../components/settings/users/UserMangement";

const sections = [
  { id: "users", name: "User Management", icon: FaUsers },
  { id: "company", name: "Company Profile", icon: FaBuilding },
  { id: "branch", name: "Branch Management", icon: FaBuilding },
  { id: "theme", name: "Theme & Branding", icon: FaPalette },
  { id: "security", name: "Security", icon: FaShieldAlt },
];

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState("users");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex flex-col md:flex-row bg-gray-50 h-screen overflow-hidden">
      {/* Mobile Toggle Button */}
      <div className="md:hidden flex justify-between items-center p-4 bg-white shadow">
        <h2 className="text-lg font-bold text-mint-500">Settings</h2>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="text-gray-700 text-2xl"
        >
          {sidebarOpen ? <FaTimes /> : <FaBars />}
        </button>
      </div>

      {/* Sidebar */}
      <aside
        className={`
          ${sidebarOpen ? "block" : "hidden"}
          md:block w-full md:w-64 bg-white shadow-lg p-4
          md:sticky md:top-0 md:h-screen
          ${sidebarOpen ? "fixed" : "md:relative"} 
          top-0 left-0 h-full z-20 md:z-auto
        `}
      >
        <h2 className="text-lg font-bold text-mint-500 mb-4 hidden md:block">
          Settings
        </h2>
        <nav className="space-y-2">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                onClick={() => {
                  setActiveSection(section.id);
                  setSidebarOpen(false); // close on mobile
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition ${
                  activeSection === section.id
                    ? "bg-mint-100 text-mint-600 font-semibold"
                    : "hover:bg-gray-100 text-gray-700"
                }`}
              >
                <Icon />
                {section.name}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 overflow-y-auto h-screen">
        {activeSection === "users" && (
          <div>
            <h3 className="text-xl font-bold mb-4">User Management</h3>
            <p className="text-gray-600">
              Here you can add, remove, and manage user roles.
            </p>
            <div className="mt-4">
              <UserManagement />
            </div>
          </div>
        )}

        {activeSection === "company" && (
          <div>
            <h3 className="text-xl font-bold mb-4">Company Profile</h3>
            <p className="text-gray-600">
              Manage company details, logo, and tax information.
            </p>
          </div>
        )}

        {activeSection === "branch" && (
          <div>
            <h3 className="text-xl font-bold mb-4">Branch Management</h3>
            <p className="text-gray-600">
              Manage branch details, location, and contact information.
            </p>
            <div className="mt-4">
              <BranchManagement />
            </div>
          </div>
        )}

        {activeSection === "theme" && (
          <div>
            <h3 className="text-xl font-bold mb-4">Theme & Branding</h3>
            <p className="text-gray-600">
              Change theme colors, dark/light mode, and branding.
            </p>
          </div>
        )}

        {activeSection === "security" && (
          <div>
            <h3 className="text-xl font-bold mb-4">Security</h3>
            <p className="text-gray-600">
              Manage login security, session timeout, and 2FA.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
