/* eslint-disable react/prop-types */
"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Cookies from "js-cookie";
import { sidebarItems } from "@/utils/dummyData";
import {
  MdAppRegistration,
  MdAttachMoney,
  MdOutlineAccountBalanceWallet,
  MdOutlineAttachMoney,
  MdOutlineBarChart,
  MdOutlineDynamicFeed,
  MdOutlineRequestPage,
  MdOutlineSupportAgent,
  MdOutlineSpaceDashboard,
  MdOutlineMoneyOffCsred,
  MdOutlineCalendarMonth,
  MdOutlineInsights,
  MdShoppingCart,
  MdOutlineManageSearch,
} from "react-icons/md";
import { GrTransaction } from "react-icons/gr";
import { SiRedhatopenshift } from "react-icons/si";
import { FcSalesPerformance } from "react-icons/fc";
import { IoSettingsSharp } from "react-icons/io5";
import { useGetBranchesQuery, useGetSingleBranchQuery } from "@/lib/redux/api/branchApiSlice";
import { useGetCompanyDetailsQuery } from "@/lib/redux/api/authApiSlice";
import { skipToken } from "@reduxjs/toolkit/query";

const iconMap = {
  MdAppRegistration: <MdAppRegistration size={20} />,
  GrTransaction: <GrTransaction size={20} />,
  SiRedhatopenshift: <SiRedhatopenshift size={20} />,
  FcSalesPerformance: <FcSalesPerformance size={20} />,
  IoSettingsSharp: <IoSettingsSharp size={20} />,
  MdOutlineSupportAgent: <MdOutlineSupportAgent size={20} />,
  MdOutlineAttachMoney: <MdOutlineAttachMoney size={20} />,
  MdOutlineAccountBalanceWallet: <MdOutlineAccountBalanceWallet size={20} />,
  MdOutlineBarChart: <MdOutlineBarChart size={20} />,
  MdOutlineRequestPage: <MdOutlineRequestPage size={20} />,
  MdOutlineDynamicFeed: <MdOutlineDynamicFeed size={20} />,
  MdAttachMoney: <MdAttachMoney size={20} />,
  MdOutlineSpaceDashboard: <MdOutlineSpaceDashboard size={20} />,
  MdOutlineMoneyOffCsred: <MdOutlineMoneyOffCsred size={20} />,
  MdOutlineCalendarMonth: <MdOutlineCalendarMonth size={20} />,
  MdOutlineInsights: <MdOutlineInsights size={20} />,
  MdShoppingCart: <MdShoppingCart size={20} />,
  MdOutlineManageSearch: <MdOutlineManageSearch size={20} />,
};
export default function Sidebar({ onLogout, onNavigate }) {
  const pathname = usePathname();

  // Guard against JSON parse crash
  let currentUser = {};
  if (typeof window !== "undefined") {
    try {
      currentUser = JSON.parse(localStorage.getItem("user") || "null") || {};
    } catch {
      currentUser = {};
    }
  }

  const { companyId, role, userName, username, branchId: userBranchId } = currentUser;
  const isCompany = role === "owner" || role === "gm" || role === "superAdmin";

  const cookieKey = companyId ? `activeBranch_${companyId}` : "activeBranch";
  const [activeBranch, setActiveBranch] = useState(
    isCompany ? (typeof window !== "undefined" ? Cookies.get(cookieKey) || "" : "") : userBranchId || ""
  );

  const branchId = activeBranch || userBranchId;

  const { data: getBranches, isLoading: isGettingBranches } =
    useGetBranchesQuery(companyId, { skip: !companyId });


  const { data: singleBranch } = useGetSingleBranchQuery(
    companyId && branchId ? { companyId, branchId } : null,
    { skip: !companyId || !branchId }
  );
  
  const { data: company } = useGetCompanyDetailsQuery(companyId ?? skipToken);

  const [branches, setBranches] = useState([]);

  // For non-company roles, force cookie = user's branch (prevents bleed from previous sessions)
  useEffect(() => {
    if (!isCompany && userBranchId) {
      Cookies.set(cookieKey, userBranchId, { path: "/" });
      setActiveBranch(userBranchId);
    }
  }, [isCompany, userBranchId, cookieKey]);

  useEffect(() => {
    if (!isGettingBranches && getBranches) {
      const formatted = getBranches.map((b) => ({
        id: b.id,
        name: b.name,
        address: b.address,
        contact: b.contact,
      }));
      setBranches(formatted);

      // Only for company roles: set a default cookie if missing and branches exist
      if (isCompany && !Cookies.get(cookieKey) && formatted.length > 0) {
        Cookies.set(cookieKey, formatted[0].id, { path: "/" });
        setActiveBranch(formatted[0].id);
      }
    }
  }, [isGettingBranches, getBranches, isCompany, cookieKey]);

  const handleBranchChange = (e) => {
    const id = e.target.value;
    setActiveBranch(id);
    Cookies.set(cookieKey, id, { path: "/" });
    // If you want instant updates without reload, broadcast an event instead.
    window.location.reload();
  };

  const handleLogout = () => {
    try {
      const removeCookie = (name) => {
        const opts = { path: "/" };
        Cookies.remove(name, opts);
        const host = window.location.hostname;
        Cookies.remove(name, { ...opts, domain: host });
        if (!host.startsWith(".")) {
          Cookies.remove(name, { ...opts, domain: `.${host}` });
        }
      };

      ["isLoggedIn", "role", "companyId", "branchId", "activeBranch"].forEach(
        removeCookie
      );

      Object.keys(Cookies.get()).forEach((k) => {
        if (k === "activeBranch" || k.startsWith("activeBranch_")) {
          removeCookie(k);
        }
      });

      localStorage.removeItem("user");
      window.dispatchEvent(new Event("storage"));
    } catch (error) {
      console.error("Logout error:", error);
    }

    try {
      onLogout?.();
    } finally {
      if (window.location.pathname !== "/login") {
        window.location.replace("/login");
      }
    }
  };

  const menu = isCompany ? sidebarItems.company : sidebarItems.branchUser;

  // Header branch name logic
  let headerTitle = "";
  if (
    role === "branchAdmin" ||
    role === "accountant" ||
    role === "manager" ||
    role === "supervisor"
  ) {
    headerTitle = singleBranch?.name || branchId || "Branch";
  } else if (role === "owner") {
    headerTitle = userName || "Owner Control";
  } else if (role === "gm") {
    headerTitle = userName || "General Manager";
  } else if (role === "superAdmin") {
    headerTitle = userName || "Super Admin";
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header / “Logo” bar */}
      <div className="h-20 flex flex-col justify-center px-4 border-b border-mint-50">
        <p className="text-[10px] font-bold text-mint-600 uppercase tracking-[0.2em] mb-0.5">
          {company?.name || "Company"}
        </p>
        <span className="font-bold text-gray-800 truncate tracking-tight text-lg">
          {headerTitle}
        </span>
      </div>

      {/* Profile Section */}
      <div className="min-h-20 flex py-3 items-start px-4 border-b border-mint-50 bg-mint-50/30 flex-col justify-center gap-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-mint-100 text-mint-700 font-bold shadow-sm">
            {userName?.charAt(0).toUpperCase() || username?.charAt(0).toUpperCase() || "G"}
          </div>

          <div className="w-auto">
            <p className="font-semibold text-gray-800 text-sm">
              {userName || username || "Guest"}
            </p>
            <p className="text-xs font-medium text-mint-600 capitalize">{role || "role"}</p>
          </div>
        </div>

        {/* Company roles: Branch selector OR Create Branch CTA */}
        {isCompany && (
          <>
            {!isGettingBranches && branches.length > 0 ? (
              <select
                value={activeBranch}
                onChange={handleBranchChange}
                className="mt-2 w-full text-xs font-medium border border-mint-100 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:ring-2 focus:ring-mint-500/20 focus:border-mint-500 outline-none transition-all"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            ) : (
              // ✅ NEW: Show create branch button when there is no branch
              <Link
                href="/branches/branch-management" 
                onClick={onNavigate}
                className="mt-2 w-full text-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg bg-mint-600 text-white hover:bg-mint-700 transition-colors shadow-sm"
              >
                + Create Branch
              </Link>
            )}
          </>
        )}

        {(role === "branchAdmin" ||
          role === "accountant" ||
          role === "manager" ||
          role === "supervisor") && (
          <p className="text-[10px] font-semibold text-gray-400 mt-2 uppercase tracking-wider">
            Branch: {singleBranch?.name || "N/A"}
          </p>
        )}
      </div>

      {/* Menu */}
      <ul className="py-3 px-2 space-y-1 flex-1 overflow-y-auto overflow-x-hidden styled-scrollbar">
        {menu
          .filter((item) =>
            role ? item.allowedRoles?.includes(role) ?? true : true
          )
          .map((item) =>
            item.children ? (
               <DropdownItem
                 key={item.label}
                 item={item}
                 role={role}
                 pathname={pathname}
                 onNavigate={onNavigate}
               />
            ) : (
              <li key={item.path}>
                <Link
                  href={item.path}
                  onClick={onNavigate}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 ${
                    pathname === item.path
                      ? "bg-mint-50 text-mint-700 shadow-sm border border-mint-100"
                      : "hover:bg-gray-50 text-gray-600 hover:text-gray-900 border border-transparent"
                  }`}
                >
                  <span className={`${pathname === item.path ? 'text-mint-600' : 'text-gray-400'}`}>
                    {iconMap[item.icon]}
                  </span>
                  <span className="capitalize tracking-tight">{item.label}</span>
                </Link>
              </li>
            )
          )}
      </ul>

      {/* Logout */}
      <div className="p-4 border-t border-gray-100 bg-gray-50/50">
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 rounded-xl transition-colors cursor-pointer"
        >
          <span className="text-base">🚪</span>
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
}

/** Dropdown */
function DropdownItem({ item, role, pathname, onNavigate }) {
  const [open, setOpen] = useState(false);
  const activeChild = item.children?.some((child) => child.path === pathname);

  return (
    <li className="mb-1">
      <button
        onClick={() => setOpen(!open)}
        className={`w-full flex justify-between items-center px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 ${
          activeChild
            ? "bg-mint-50 text-mint-700 shadow-sm border border-mint-100"
            : "hover:bg-gray-50 text-gray-600 hover:text-gray-900 border border-transparent"
        }`}
      >
        <span className="flex items-center gap-3">
          <span className={`${activeChild ? 'text-mint-600' : 'text-gray-400'}`}>
            {iconMap[item.icon]}
          </span>
          <span className="capitalize tracking-tight">{item.label}</span>
        </span>
        <span className={`text-[10px] transition-transform duration-200 ${open ? "rotate-180" : ""}`}>▼</span>
      </button>

      {open && (
        <ul className="ml-9 mt-1 space-y-1 relative before:absolute before:left-[-12px] before:top-2 before:bottom-2 before:w-px before:bg-mint-100">
          {item.children
            .filter((child) =>
              role ? child.allowedRoles?.includes(role) ?? true : true
            )
            .map((child) => (
              <li
                key={child.path}
                className="relative before:absolute before:left-[-12px] before:top-[15px] before:w-2 before:h-px before:bg-mint-100"
              >
                <Link
                  href={child.path}
                  onClick={onNavigate}
                  className={`block px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${
                    pathname === child.path
                      ? "text-mint-700 bg-mint-50/50"
                      : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                  }`}
                >
                  {child.label}
                </Link>
              </li>
            ))}
        </ul>
      )}
    </li>
  );
}