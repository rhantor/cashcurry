/* eslint-disable react/prop-types */
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { sidebarItems } from "@/utils/dummyData";
import {
  MdOutlineSpaceDashboard,
  MdOutlineBarChart,
  MdAttachMoney,
  MdOutlineInsights,
  MdOutlineSupportAgent,
  MdOutlineDynamicFeed,
  MdOutlineRequestPage,
  MdOutlineAccountBalanceWallet,
  MdOutlineMoneyOffCsred,
  MdOutlineCalendarMonth,
  MdOutlineAttachMoney as MdOutlineAttachMoney2,
  MdOutlineSettings,
  MdOutlinePeople,
} from "react-icons/md";
import { GrTransaction } from "react-icons/gr";
import { IoSettingsSharp } from "react-icons/io5";

const ICONS = {
  MdOutlineSpaceDashboard,
  MdOutlineBarChart,
  MdAttachMoney,
  MdOutlineInsights,
  MdOutlineSupportAgent,
  MdOutlineDynamicFeed,
  MdOutlineRequestPage,
  MdOutlineAccountBalanceWallet,
  MdOutlineMoneyOffCsred,
  MdOutlineCalendarMonth,
  IoSettingsSharp,
  GrTransaction,
  MdOutlineAttachMoney2,
  MdOutlineSettings,
  MdOutlinePeople,
};

// Card accent colours — cycles through these for visual variety
const CARD_ACCENTS = [
  { bg: "bg-indigo-50",   border: "border-indigo-200",  icon: "bg-indigo-500",   text: "text-indigo-700"  },
  { bg: "bg-emerald-50",  border: "border-emerald-200", icon: "bg-emerald-500",  text: "text-emerald-700" },
  { bg: "bg-amber-50",    border: "border-amber-200",   icon: "bg-amber-500",    text: "text-amber-700"   },
  { bg: "bg-blue-50",     border: "border-blue-200",    icon: "bg-blue-500",     text: "text-blue-700"    },
  { bg: "bg-rose-50",     border: "border-rose-200",    icon: "bg-rose-500",     text: "text-rose-700"    },
  { bg: "bg-violet-50",   border: "border-violet-200",  icon: "bg-violet-500",   text: "text-violet-700"  },
  { bg: "bg-teal-50",     border: "border-teal-200",    icon: "bg-teal-500",     text: "text-teal-700"    },
  { bg: "bg-orange-50",   border: "border-orange-200",  icon: "bg-orange-500",   text: "text-orange-700"  },
];

/* ─── greeting based on time of day ─── */
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/* ─── read user from localStorage ─── */
function useUser() {
  const [user, setUser] = useState(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("user");
      if (raw) setUser(JSON.parse(raw));
      else {
        const role = localStorage.getItem("role");
        if (role) setUser({ role });
      }
    } catch { /* ignore */ }
  }, []);
  return user;
}

/* ─── role helpers ─── */
function pickMenuByRole(role) {
  return ["gm", "superAdmin", "owner"].includes(role) ? "company" : "branchUser";
}

function isAllowed(item, role) {
  if (!item) return false;
  if (!item.allowedRoles?.length) return true;
  return item.allowedRoles.includes(role);
}

function firstPathFor(item) {
  if (item?.path) return item.path;
  return item?.children?.[0]?.path ?? null;
}

function buildCards(menuItems, role) {
  return (menuItems || [])
    .filter((item) => isAllowed(item, role))
    .map((item) => ({
      label:    item.label,
      path:     firstPathFor(item),
      iconName: item.icon,
      children: (item.children || []).filter((c) => isAllowed(c, role)),
    }))
    .filter((c) => c.path);
}

/* ─── role display name ─── */
function roleLabel(role) {
  const map = {
    owner:      "Owner",
    gm:         "General Manager",
    superAdmin: "Super Admin",
    branchAdmin:"Branch Admin",
    manager:    "Manager",
    accountant: "Accountant",
    cashier:    "Cashier",
    supervisor: "Supervisor",
  };
  return map[role] || role || "User";
}

/* ─── skeleton loader ─── */
const Skeleton = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} className="h-36 rounded-2xl border border-slate-100 bg-slate-50 animate-pulse" />
    ))}
  </div>
);

/* ─── sub-page modal ─── */
function SubPageModal({ card, accent, onClose }) {
  const Icon = ICONS[card.iconName] || MdOutlineSpaceDashboard;

  // close on backdrop click
  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  // close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={handleBackdrop}
    >
      <div className={`w-full max-w-sm rounded-2xl border ${accent.border} bg-white shadow-2xl overflow-hidden`}>
        {/* Header */}
        <div className={`flex items-center gap-3 px-5 py-4 ${accent.bg}`}>
          <div className={`inline-flex items-center justify-center h-9 w-9 rounded-xl ${accent.icon} shadow`}>
            <Icon className="h-4 w-4 text-white" aria-hidden />
          </div>
          <div className="flex-1 min-w-0">
            <p className={`font-semibold text-sm ${accent.text}`}>{card.label}</p>
            <p className="text-[11px] text-slate-500">Select a page to open</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-white/60"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Sub-page list */}
        <ul className="divide-y divide-slate-100">
          {card.children.map((c) => (
            <li key={c.path}>
              <Link
                href={c.path}
                onClick={onClose}
                className={`flex items-center gap-3 px-5 py-3.5 text-sm text-slate-700 hover:${accent.bg} hover:${accent.text} transition-colors`}
              >
                <span className={`inline-block h-1.5 w-1.5 rounded-full ${accent.icon} opacity-70 flex-shrink-0`} />
                {c.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ─── nav card ─── */
function NavCard({ label, path, iconName, children, accent }) {
  const Icon = ICONS[iconName] || MdOutlineSpaceDashboard;
  const hasMultiple = children?.length > 1;
  const [open, setOpen] = useState(false);

  if (hasMultiple) {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          className={`group relative flex flex-col w-full text-left rounded-2xl border ${accent.border} ${accent.bg} p-5 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5`}
        >
          {/* Icon */}
          <div className={`inline-flex items-center justify-center h-10 w-10 rounded-xl ${accent.icon} shadow mb-3`}>
            <Icon className="h-5 w-5 text-white" aria-hidden />
          </div>

          {/* Label */}
          <h3 className={`font-semibold text-sm ${accent.text} mb-1`}>{label}</h3>

          {/* Sub-pages preview */}
          <ul className="mt-1 space-y-0.5">
            {children.slice(0, 3).map((c) => (
              <li key={c.path} className="text-[11px] text-slate-500 flex items-center gap-1.5">
                <span className={`inline-block h-1 w-1 rounded-full ${accent.icon} opacity-60`} />
                {c.label}
              </li>
            ))}
            {children.length > 3 && (
              <li className="text-[11px] text-slate-400">+{children.length - 3} more</li>
            )}
          </ul>

          {/* Expand indicator */}
          <div className={`absolute top-4 right-4 text-xs ${accent.text} opacity-0 group-hover:opacity-100 transition-opacity`}>
            ⊞
          </div>
        </button>

        {open && (
          <SubPageModal
            card={{ label, iconName, children }}
            accent={accent}
            onClose={() => setOpen(false)}
          />
        )}
      </>
    );
  }

  return (
    <Link
      href={path}
      className={`group relative flex flex-col rounded-2xl border ${accent.border} ${accent.bg} p-5 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5`}
    >
      {/* Icon */}
      <div className={`inline-flex items-center justify-center h-10 w-10 rounded-xl ${accent.icon} shadow mb-3`}>
        <Icon className="h-5 w-5 text-white" aria-hidden />
      </div>

      {/* Label */}
      <h3 className={`font-semibold text-sm ${accent.text} mb-1`}>{label}</h3>

      {/* Single child label if any */}
      {children?.length === 1 && (
        <p className="text-[11px] text-slate-500 mt-1">{children[0].label}</p>
      )}

      {/* Arrow */}
      <div className={`absolute top-4 right-4 text-xs ${accent.text} opacity-0 group-hover:opacity-100 transition-opacity`}>
        →
      </div>
    </Link>
  );
}

/* ─── main page ─── */
export default function HomePage() {
  const user = useUser();
  const role = user?.role ?? null;
  const displayName = user?.name || user?.fullName || user?.username || user?.userName || roleLabel(role);

  const { menuKey, cards } = useMemo(() => {
    if (!role) return { menuKey: null, cards: [] };
    const key   = pickMenuByRole(role);
    const items = sidebarItems?.[key] || [];
    return { menuKey: key, cards: buildCards(items, role) };
  }, [role]);

  const greeting = getGreeting();
  const today    = new Date().toLocaleDateString(undefined, {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-8 space-y-8">

        {/* ── Hero header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4
                        bg-white rounded-2xl border border-slate-100 shadow-sm px-6 py-5">
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-widest mb-0.5">{today}</p>
            <h1 className="text-2xl font-bold text-slate-800">
              {greeting}{displayName && displayName !== roleLabel(role) ? `, ${displayName}` : ""}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {role ? `Logged in as ${roleLabel(role)}` : "Loading your workspace…"}
            </p>
          </div>

          {role && (
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 text-sm font-medium self-start sm:self-auto">
              <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
              {menuKey === "company" ? "Company Panel" : "Branch Panel"}
            </span>
          )}
        </div>

        {/* ── Loading skeleton ── */}
        {!role && <Skeleton />}

        {/* ── Navigation cards ── */}
        {role && cards.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3 px-1">
              Quick Access
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {cards.map((card, i) => (
                <NavCard
                  key={card.label}
                  {...card}
                  accent={CARD_ACCENTS[i % CARD_ACCENTS.length]}
                />
              ))}
            </div>
          </div>
        )}

        {role && cards.length === 0 && (
          <div className="text-center py-16 text-slate-400 text-sm">
            No shortcuts available for your role.
          </div>
        )}

        {/* ── Footer note ── */}
        <p className="text-center text-xs text-slate-300 pb-4">
          Cash Curry — Internal Management System
        </p>
      </main>
    </div>
  );
}
