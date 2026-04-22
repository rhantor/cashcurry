"use client";
import React from "react";
import { useState } from "react";
import CompanyInfo from "@/app/components/settings/CompanyInfo";
import ExportOptions from "@/app/components/settings/ExportOptions";
import ReportPreferences from "@/app/components/settings/ReportPreferences";
import LogoUploader from "@/app/components/settings/LogoUploader";
import NotificationsSettings from "@/app/components/settings/NotificationSettings";
import AccessControl from "@/app/components/settings/AccessControl";

export default function Settings() {
  const [company, setCompany] = useState({
    name: "",
    address: "",
    logo: "",
  });

  const [reportPrefs, setReportPrefs] = useState({
    currency: "RM",
    dateRange: "This Month",
    timezone: "Asia/Kuala_Lumpur",
  });

  const [exportOpts, setExportOpts] = useState({
    pdf: true,
    excel: true,
    csv: false,
    charts: true,
  });

  const handleSave = () => {
    console.log({ company, reportPrefs, exportOpts });
    alert("✅ Settings saved (later connect to Firestore)");
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <CompanyInfo company={company} setCompany={setCompany} />
      <ReportPreferences
        reportPrefs={reportPrefs}
        setReportPrefs={setReportPrefs}
      />
      <ExportOptions exportOpts={exportOpts} setExportOpts={setExportOpts} />
      <LogoUploader />
      <NotificationsSettings />
      <AccessControl />
      <button
        onClick={handleSave}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Save Settings
      </button>
    </div>
  );
}
