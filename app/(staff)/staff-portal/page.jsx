"use client";
import React, { useEffect, useState } from "react";
import Feeds from "@/app/feeds/Feeds";

export default function StaffPortalPage() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) {
       setUser(JSON.parse(stored));
    }
  }, []);

  if (!user) return <div className="p-8 text-center text-gray-400 animate-pulse">Loading feeds...</div>;

  return (
    <div className="p-0 sm:p-6 pb-24 space-y-6">
       {/* Page Info */}
       <div className="px-4 py-6 md:px-0">
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Company Wall</h1>
          <p className="text-sm text-gray-500 font-medium">Internal announcements and updates for your branch.</p>
       </div>

       {/* Feeds View - Home page is now exclusively for company wall/feeds as requested */}
       <div className="bg-white rounded-none sm:rounded-2xl shadow-none sm:shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] overflow-hidden border-0 sm:border border-gray-100 italic">
         <Feeds />
       </div>
    </div>
  );
}
