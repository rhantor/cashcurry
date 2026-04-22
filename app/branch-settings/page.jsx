"use client";
import React, { useState } from "react";
import { FaBuilding, FaMoneyBillWave, FaUserCog, FaCogs, FaMoneyCheckAlt } from "react-icons/fa";

import BasicInfoSection from "@/app/components/settings/BasicInfoSection";
import FinanceSalesSection from "@/app/components/settings/FinanceSalesSection";
import StaffRolesSection from "@/app/components/settings/StaffRolesSection";
import LoansFinanceSection from "@/app/components/settings/LoansFinanceSection";
import OtherSection from "@/app/components/settings/OtherSection";
import PayrollSettingsSection from "@/app/components/settings/PayrollSettingsSection";
import useBranchSettingsForm from "./useBranchSettingsForm";

const TABS = [
  { id: "general",    label: "General",          icon: FaBuilding },
  { id: "finance",    label: "Finance & Sales",   icon: FaMoneyBillWave },
  { id: "operations", label: "Operations & Staff", icon: FaUserCog },
  { id: "payroll",    label: "Payroll",            icon: FaMoneyCheckAlt },
  { id: "advanced",   label: "Advanced",           icon: FaCogs },
];

export default function BranchSettingsPage() {
  const { role, form, setForm, save, saving, isDirty } = useBranchSettingsForm();
  const [activeTab, setActiveTab] = useState("general");

  if (!form) return <div className="p-6 text-slate-500 animate-pulse">Loading settings...</div>;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto pb-24">
      {/* Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Branch Settings</h1>
          <p className="text-slate-500 text-sm mt-1">Configure your POS, branch details, and team operations.</p>
        </div>
        
        <button
          onClick={save}
          disabled={saving || !isDirty}
          className={`font-bold py-2 px-6 rounded-xl transition-all shadow-sm ${
            saving || !isDirty
              ? "bg-slate-100 text-slate-400 cursor-not-allowed" 
              : "bg-mint-600 hover:bg-mint-700 text-white shadow-mint-500/20 shadow-md"
          }`}
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>

      {/* Tabs / Content Layout */}
      <div className="flex flex-col md:flex-row gap-8">
        
        {/* Sidebar Tabs */}
        <div className="md:w-64 shrink-0 flex overflow-x-auto md:flex-col gap-2 pb-2 md:pb-0 hide-scrollbar border-b md:border-b-0 border-slate-200">
          {TABS.map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-all whitespace-nowrap
                  ${isActive 
                    ? "bg-mint-500 text-white shadow-md shadow-mint-500/20" 
                    : "text-slate-600 hover:bg-slate-100"
                  }`}
              >
                <Icon size={16} />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content Area */}
        <div className="flex-1 bg-white p-6 rounded-3xl shadow-sm border border-slate-100 min-h-[500px]">
          {activeTab === "general" && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h2 className="text-lg font-bold text-slate-800 mb-6">General Information</h2>
              <BasicInfoSection
                role={role}
                value={form.basic}
                onChange={(v) => setForm((prev) => ({ ...prev, basic: v }))}
              />
            </div>
          )}

          {activeTab === "finance" && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h2 className="text-lg font-bold text-slate-800 mb-6">Finance & Sales Settings</h2>
              <FinanceSalesSection
                role={role}
                value={form.financeSales}
                onChange={(v) => setForm((prev) => ({ ...prev, financeSales: v }))}
              />
            </div>
          )}

          {activeTab === "operations" && (
             <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-12">
               <div>
                  <h2 className="text-lg font-bold text-slate-800 mb-6">Staff & Roles</h2>
                  <StaffRolesSection
                    role={role}
                    value={form.staffRoles}
                    onChange={(v) => setForm((prev) => ({ ...prev, staffRoles: v }))}
                  />
               </div>
               <hr className="border-slate-100" />
               <div>
                  <h2 className="text-lg font-bold text-slate-800 mb-6">Loans & Cash Advances</h2>
                  <LoansFinanceSection
                    role={role}
                    value={form.loansFinance}
                    onChange={(v) => setForm((prev) => ({ ...prev, loansFinance: v }))}
                  />
               </div>
             </div>
          )}

          {activeTab === "payroll" && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h2 className="text-lg font-bold text-slate-800 mb-2">Payroll Settings</h2>
              <p className="text-sm text-slate-500 mb-6">
                Configure default pay mode, multipliers, and statutory deductions for your country.
                These apply to all staff unless overridden per individual.
              </p>
              <PayrollSettingsSection form={form} setForm={setForm} />
            </div>
          )}

          {activeTab === "advanced" && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h2 className="text-lg font-bold text-slate-800 mb-6">Advanced Configurations</h2>
              <OtherSection
                role={role}
                value={form.other}
                onChange={(v) => setForm((prev) => ({ ...prev, other: v }))}
              />
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
