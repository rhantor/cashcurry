"use client";
import React, { useState, useEffect, useMemo } from "react";
import {
  useGetBranchAttendanceByPeriodQuery,
  useGetOtRequestsQuery,
} from "@/lib/redux/api/attendanceApiSlice";
import { useGetStaffLoansQuery } from "@/lib/redux/api/staffLoanApiSlice";
import { useGetAdvanceEntriesQuery } from "@/lib/redux/api/AdvanceApiSlice";
import { useGetStaffListQuery } from "@/lib/redux/api/staffApiSlice";
import { useGetBranchSettingsQuery } from "@/lib/redux/api/branchSettingsApiSlice";
import { computeAttendance, toLocalDateStr } from "@/lib/attendance/computeHours";
import { shiftsEnabled } from "@/lib/attendance/shifts";
import useCurrency from "@/app/hooks/useCurrency";
import { formatMoney } from "@/utils/formatMoney";
import { skipToken } from "@reduxjs/toolkit/query";
import { auth } from "@/lib/firebase";
import { 
  User,
  MapPin,
  Clock,
  AlertCircle,
  Download, 
  LogOut, 
  CreditCard, 
  TrendingUp,
  Receipt,
  Coffee
} from "lucide-react";
import Cookies from "js-cookie";

export default function StaffProfilePage() {
  const [user, setUser] = useState(null);
  const [staffData, setStaffData] = useState(null);
  const currency = useCurrency();

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) setUser(JSON.parse(stored));
  }, []);

  // Fetch staff list to find the logged-in staff's full record
  const { data: staffList = [] } = useGetStaffListQuery(
    user?.companyId && user?.branchId ? { companyId: user.companyId, branchId: user.branchId } : { skip: true }
  );

  useEffect(() => {
    if (user && staffList.length > 0) {
      const found = staffList.find(s => s.uid === user.uid);
      if (found) setStaffData(found);
    }
  }, [user, staffList]);

  // Determine Current Period Dates
  const period = useMemo(() => {
    if (!staffData) return null;
    const now = new Date();
    const type = staffData.attendancePeriod || "monthly";
    let start;

    if (type === "weekly") {
      // Find Monday of the current week (no mutation of `now`).
      const day = now.getDay(); // 0 = Sun, 1 = Mon
      const diff = now.getDate() - (day === 0 ? 6 : day - 1);
      start = new Date(now.getFullYear(), now.getMonth(), diff);
    } else {
      // 1st of the month
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    start.setHours(0, 0, 0, 0);
    return { start, startStr: toLocalDateStr(start), type };
  }, [staffData]);

  // Queries
  const skip = !user?.companyId || !user?.branchId;

  const { data: branchSettings } = useGetBranchSettingsQuery(
    !skip ? { companyId: user.companyId, branchId: user.branchId } : skipToken
  );
  const attendanceSettings = branchSettings?.attendance || {};

  // Punches for the current period. Query from a day before the period start
  // (buffer for overnight shifts) up to today; computeAttendance re-buckets by
  // the branch day-cutoff, then we keep only days inside the period.
  const todayStr = toLocalDateStr(new Date());
  const bufStartStr = period ? toLocalDateStr(new Date(period.start.getTime() - 86400000)) : null;
  const canAttendance = !skip && !!period && !staffData?.fixedSalaryNoAttendance;
  const { data: periodPunches = [] } = useGetBranchAttendanceByPeriodQuery(
    canAttendance
      ? { companyId: user.companyId, branchId: user.branchId, startDate: bufStartStr, endDate: todayStr }
      : skipToken
  );

  // Own early-OT decisions, so displayed earnings match what payroll will pay.
  const otEnabled = canAttendance && shiftsEnabled(attendanceSettings);
  const { data: otRequests = [] } = useGetOtRequestsQuery(
    otEnabled
      ? { companyId: user.companyId, branchId: user.branchId, startDate: bufStartStr, endDate: todayStr }
      : skipToken
  );

  const myOtApprovals = useMemo(() => {
    const map = {};
    otRequests
      .filter(r => r.staffId === staffData?.id)
      .forEach(r => { if (r.date) map[r.date] = r.status; });
    return map;
  }, [otRequests, staffData?.id]);

  const { data: allLoans = [] } = useGetStaffLoansQuery(
    !skip ? { companyId: user.companyId, branchId: user.branchId } : { skip: true }
  );

  const { data: allAdvances = [] } = useGetAdvanceEntriesQuery(
    !skip ? { companyId: user.companyId, branchId: user.branchId } : { skip: true }
  );

  // Calculations — uses the shared attendance engine (same as payroll/log).
  const stats = useMemo(() => {
    const base = {
      isFixed: false, totalHours: 0, basicHours: 0, otHours: 0, earnings: 0,
      loanDebt: 0, advanceDebt: 0, lateDays: 0, lateMinutes: 0, pendingOtDays: 0,
    };
    if (!staffData) return base;

    // Financials (independent of attendance)
    const loanDebt = allLoans
      .filter(l => l.staffId === staffData.id && l.status !== "closed")
      .reduce((sum, l) => sum + (l.remainingAmount || 0), 0);
    // Only money advances count as debt — the same collection also holds the
    // staff portal's medical/annual leave requests, which carry no amount.
    // "personal" is what the staff form stores for its Salary Advance option;
    // "salary" and "emergency" come from the back-office advance entry.
    const MONEY_ADVANCE_TYPES = ["personal", "salary", "emergency"];
    const advanceDebt = allAdvances
      .filter(a => (a.staffId === staffData.id || a.createdBy?.uid === user?.uid) && a.status === "approved" && MONEY_ADVANCE_TYPES.includes(a.advanceType))
      .reduce((sum, a) => sum + (a.amount || 0), 0);

    // Fixed-salary staff: flat monthly Basic Salary, no attendance tracking.
    if (staffData.fixedSalaryNoAttendance) {
      return { ...base, isFixed: true, earnings: Number(staffData.basicSalary) || 0, loanDebt, advanceDebt };
    }

    if (!period) return { ...base, loanDebt, advanceDebt };

    const mine = periodPunches.filter(p => p.staffId === staffData.id);
    const { days } = computeAttendance({
      punches: mine,
      staff: staffData,
      settings: attendanceSettings,
      otApprovals: myOtApprovals,
    });
    const inPeriod = days.filter(d => d.date >= period.startStr);
    const basicHours = inPeriod.reduce((s, d) => s + d.basic, 0);
    const otHours = inPeriod.reduce((s, d) => s + d.ot, 0);
    const earnings =
      basicHours * (Number(staffData.basicPerHour) || 0) +
      otHours * (Number(staffData.OTPerHour) || 0);

    return {
      isFixed: false,
      totalHours: basicHours + otHours,
      basicHours,
      otHours,
      earnings,
      loanDebt,
      advanceDebt,
      lateDays: inPeriod.filter(d => d.lateMinutes > 0).length,
      lateMinutes: inPeriod.reduce((s, d) => s + d.lateMinutes, 0),
      pendingOtDays: inPeriod.filter(d => d.otApproval === "pending").length,
    };
  }, [staffData, period, periodPunches, attendanceSettings, myOtApprovals, allLoans, allAdvances, user]);

  const handleLogout = async () => {
    try {
      await auth.signOut();
      localStorage.removeItem("user");
      Cookies.remove("isLoggedIn", { path: "/" });
      Cookies.remove("role", { path: "/" });
      window.location.href = "/login";
    } catch (e) {
      console.error(e);
    }
  };

  if (!user || !staffData) return <div className="p-8 text-center text-gray-400 animate-pulse">Loading profile...</div>;

  return (
    <div className="p-4 sm:p-6 pb-24 space-y-6">
      {/* Profile Header */}
      <div className="flex items-center gap-4 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
        <div className="w-20 h-20 rounded-2xl bg-blue-50 flex items-center justify-center overflow-hidden border border-blue-100">
           {staffData.photoUrl ? (
             <img src={staffData.photoUrl} alt="Portrait" className="w-full h-full object-cover" />
           ) : (
             <User size={40} className="text-blue-200" />
           )}
        </div>
        <div className="flex-1">
           <h1 className="text-xl font-black text-gray-900 leading-tight">
             {staffData.firstName} {staffData.lastName}
           </h1>
           <p className="text-sm font-bold text-blue-600 uppercase tracking-widest">{staffData.role || "Staff"}</p>
           <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-1 font-medium">
             <MapPin size={12} /> {staffData.department || "No Department"}
           </div>
        </div>
      </div>

      {/* Attendance & OT Card */}
      <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-3xl p-6 text-white shadow-xl shadow-blue-900/10 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Clock size={100} className="rotate-12 translate-x-4 translate-y-[-10px]"/>
        </div>
        
        <div className="flex justify-between items-center mb-6">
          <span className="text-xs font-bold uppercase tracking-wider opacity-80">
            Work Period: <span className="text-white opacity-100">{period?.type}</span>
          </span>
          {staffData.hasPaidBreak && (
            <div className="flex items-center gap-1 bg-white/20 px-2 py-1 rounded-lg text-[10px] font-bold backdrop-blur-sm">
               <Coffee size={10} /> Paid Break Active
            </div>
          )}
        </div>

        {stats.isFixed ? (
          <div className="bg-white/10 rounded-2xl px-4 py-3 text-sm font-semibold">
            Fixed monthly salary — attendance is not tracked for your account.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
               <div>
                  <p className="text-xs opacity-70 mb-1 font-medium">Basic Hours</p>
                  <div className="text-2xl font-black">{stats.basicHours.toFixed(1)}<span className="text-xs font-medium opacity-50 ml-1">hrs</span></div>
               </div>
               <div>
                  <p className="text-xs opacity-70 mb-1 font-medium text-orange-200">Overtime (OT)</p>
                  <div className="text-2xl font-black text-orange-300">+{stats.otHours.toFixed(1)}<span className="text-xs font-medium opacity-50 ml-1">hrs</span></div>
               </div>
            </div>

            {(stats.pendingOtDays > 0 || stats.lateDays > 0) && (
              <div className="mt-4 flex flex-wrap gap-2">
                {stats.pendingOtDays > 0 && (
                  <span className="rounded-full bg-amber-400/20 px-3 py-1 text-[11px] font-bold text-amber-200">
                    {stats.pendingOtDays} early-OT day(s) awaiting approval
                  </span>
                )}
                {stats.lateDays > 0 && (
                  <span className="rounded-full bg-red-400/20 px-3 py-1 text-[11px] font-bold text-red-200">
                    Late {Math.round(stats.lateMinutes)} min over {stats.lateDays} day(s)
                  </span>
                )}
              </div>
            )}
          </>
        )}

        <div className="mt-6 pt-6 border-t border-white/10 flex justify-between items-end">
           <div>
             <p className="text-xs opacity-70 mb-1 font-medium uppercase tracking-tight">
               {stats.isFixed ? "Monthly Salary (Fixed)" : "Est. Instant Earnings"}
             </p>
             <div className="text-3xl font-black tracking-tighter flex items-center gap-1">
               <TrendingUp size={24} className="text-green-300" />
               {formatMoney(stats.earnings, currency)}
             </div>
           </div>
           {!stats.isFixed && (
             <div className="text-[10px] opacity-60 text-right font-medium">
                Based on {staffData.basicPerHour || 0}/hr <br/> and {staffData.OTPerHour || 0} OT rate
             </div>
           )}
        </div>
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
           <div className="flex items-center gap-2 mb-2 text-gray-500">
             <Receipt size={16} className="text-orange-500" /> 
             <span className="text-[11px] font-bold uppercase tracking-wider">Advances</span>
           </div>
           <div className="text-xl font-black text-gray-800">{formatMoney(stats.advanceDebt, currency)}</div>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
           <div className="flex items-center gap-2 mb-2 text-gray-500">
             <CreditCard size={16} className="text-red-500" /> 
             <span className="text-[11px] font-bold uppercase tracking-wider">Loan Bal.</span>
           </div>
           <div className="text-xl font-black text-gray-800">{formatMoney(stats.loanDebt, currency)}</div>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-3">
         <h3 className="text-xs font-extrabold text-gray-400 uppercase tracking-widest px-2">Quick Actions</h3>
         <div className="grid grid-cols-2 gap-3">
            <button className="bg-white border border-gray-200 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 group hover:border-blue-400 transition-all">
               <div className="p-3 bg-red-50 text-red-500 rounded-full group-hover:bg-red-500 group-hover:text-white transition-all">
                  <AlertCircle size={24} />
               </div>
               <span className="text-sm font-bold text-gray-700">Running Late?</span>
            </button>
            <button className="bg-white border border-gray-200 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 group hover:border-blue-400 transition-all">
               <div className="p-3 bg-blue-50 text-blue-500 rounded-full group-hover:bg-blue-500 group-hover:text-white transition-all">
                  <Download size={24} />
               </div>
               <span className="text-sm font-bold text-gray-700">Salary Slip</span>
            </button>
         </div>
      </div>

      {/* Footer / Account */}
      <div className="pt-4">
        <button 
          onClick={handleLogout}
          className="w-full py-4 rounded-2xl flex items-center justify-center gap-3 bg-red-50 text-red-600 font-bold hover:bg-red-100 transition-all"
        >
           <LogOut size={20} /> Sign Out
        </button>
      </div>
    </div>
  );
}
