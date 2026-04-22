// src/app/components/layout/Header.js
/* eslint-disable react/prop-types */
"use client";

import React from "react";
import { MdMenu } from "react-icons/md";
import Link from "next/link";
import Cookies from "js-cookie";

export default function Header({ user, onMenuClick, onLogout }) {
  const isAuthPage = ["/login", "/signup", "/reset-password"].some((path) =>
    location.pathname.startsWith(path)
  );

  const getCompanyName = () => {
    // You'll need to fetch the company name, for now, let's use a placeholder.
    // In a real app, you might get this from a Redux query or context.
    // For now, let's look for a companyId and provide a placeholder.
    const companyId = user?.companyId || Cookies.get("companyId");
    return companyId ? "XYZ Company" : "Guest Account";
  };

  if (isAuthPage) {
    return null; // Don't show header on auth pages
  }

  return (
    <header className="fixed top-0 left-0 w-full lg:ml-64 bg-white shadow-md z-40">
      <div className="flex justify-between items-center h-16 px-4 lg:px-6">
        {/* Mobile menu button */}
        <button
          onClick={onMenuClick}
          className="text-gray-600 lg:hidden focus:outline-none"
          aria-label="Open menu"
        >
          <MdMenu size={24} />
        </button>

        {/* Brand/Company Name (visible on mobile) */}
        <div className="text-lg font-bold text-mint-600 truncate lg:hidden">
          {getCompanyName()}
        </div>

        {/* User profile (visible on all screens, but on the right) */}
        <div className="flex items-center gap-3 ml-auto">
          {user?.userName || user?.username ? (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 flex items-center justify-center rounded-full bg-mint-200 text-mint-700 font-semibold">
                {user.userName?.charAt(0).toUpperCase() ||
                  user.username?.charAt(0).toUpperCase()}
              </div>
              <div className="hidden sm:block">
                <p className="font-medium text-gray-900">
                  {user.userName || user.username}
                </p>
                <p className="text-xs text-gray-500 capitalize">{user.role}</p>
              </div>
            </div>
          ) : (
            <Link
              href="/login"
              className="text-sm text-gray-600 hover:text-mint-600"
            >
              Sign In
            </Link>
          )}

          {user && (
            <button
              onClick={onLogout}
              className="hidden sm:block text-sm text-red-600 hover:text-red-800 ml-4"
              aria-label="Sign out"
            >
              Sign Out
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
