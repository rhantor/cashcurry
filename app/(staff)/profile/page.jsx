"use client";
import React, { useState, useEffect, useMemo } from "react";
import { useGetBranchAttendanceTokensQuery } from "@/lib/redux/api/attendanceApiSlice";
import { useGetStaffLoansQuery } from "@/lib/redux/api/staffLoanApiSlice";
import { useGetAdvanceEntriesQuery } from "@/lib/redux/api/AdvanceApiSlice";
import { useGetStaffListQuery } from "@/lib/redux/api/staffApiSlice";
import { auth } from "@/lib/firebase";
import { 
  User, 
  MapPin, 
  Clock, 
  DollarSign, 
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
    let start = new Date();
    
    if (type === "weekly") {
      // Find Monday of the current week
      const day = now.getDay(); // 0 is Sun, 1 is Mon
      const diff = now.getDate() - (day === 0 ? 6 : day - 1);
      start = new Date(now.setDate(diff));
    } else {
      // 1st of the month
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    
    start.setHours(0, 0, 0, 0);
    return { start, end: new Date(), type };
  }, [staffData]);

  // Queries
  const skip = !user?.companyId || !user?.branchId;
  const { data: allAttendance = [], isLoading: loadingAttendance } = useGetBranchAttendanceTokensQuery(
    !skip ? { companyId: user.companyId, branchId: user.branchId } : { skip: true }
  );

  const { data: allLoans = [] } = useGetStaffLoansQuery(
    !skip ? { companyId: user.companyId, branchId: user.branchId } : { skip: true }
  );

  const { data: allAdvances = [] } = useGetAdvanceEntriesQuery(
    !skip ? { companyId: user.companyId, branchId: user.branchId } : { skip: true }
  );

  // Calculations
  const stats = useMemo(() => {
    if (!staffData || !period || allAttendance.length === 0) {
      return { totalHours: 0, basicHours: 0, otHours: 0, earnings: 0, loanDebt: 0, advanceDebt: 0 };
    }

    const myAttendance = allAttendance.filter(a => 
      a.staffId === staffData.id && 
      new Date(a.timestamp?.seconds * 1000) >= period.start
    );

    // Group by Date for Break & OT Calculation
    const dailyTotals = {};
    
    const sorted = [...myAttendance].sort((a, b) => a.timestamp?.seconds - b.timestamp?.seconds);
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i].type === "in" && sorted[i+1].type === "out") {
        const dateKey = new Date(sorted[i].timestamp.seconds * 1000).toDateString();
        const diff = (sorted[i+1].timestamp.seconds - sorted[i].timestamp.seconds) * 1000;
        dailyTotals[dateKey] = (dailyTotals[dateKey] || 0) + diff;
        i++; 
      }
    }

    let totalBasic = 0;
    let totalOT = 0;
    const dailyLimit = Number(staffData.basicHoursPerDay) || 8;
    const isFullTime = staffData.employmentType !== "part-time";

    Object.keys(dailyTotals).forEach(date => {
      let dayHours = dailyTotals[date] / (1000 * 60 * 60);
      
      // Calculate OT per day
      let dayBasic = dayHours;
      let dayOT = 0;

      if (isFullTime) {
        dayBasic = Math.min(dayHours, dailyLimit);
        dayOT = Math.max(0, dayHours - dailyLimit);
      }

      // Add Paid Break (+1 hour per day if eligible)
      if (staffData.hasPaidBreak) {
        const meetsStrict = !staffData.requireFullShiftForBreak || dayHours >= (Number(staffData.fullShiftHours) || 7.5);
        if (meetsStrict) {
           // Add to OT if basic is already full, otherwise add to basic
           if (dayBasic < dailyLimit && isFullTime) {
             const space = dailyLimit - dayBasic;
             const toAdd = Math.min(1, space);
             dayBasic += toAdd;
             if (toAdd < 1) dayOT += (1 - toAdd);
           } else {
             dayOT += 1;
           }
        }
      }

      totalBasic += dayBasic;
      totalOT += dayOT;
    });

    const basicRate = Number(staffData.basicPerHour) || 0;
    const otRate = Number(staffData.OTPerHour) || 0;
    const earnings = (totalBasic * basicRate) + (totalOT * otRate);

    // Financials
    const myLoanDebt = allLoans
      .filter(l => l.staffId === staffData.id && l.status !== "closed")
      .reduce((sum, l) => sum + (l.remainingAmount || 0), 0);
    
    const myAdvanceDebt = allAdvances
      .filter(a => (a.staffId === staffData.id || a.createdBy?.uid === user.uid) && a.status === "approved" && a.advanceType === "personal")
      .reduce((sum, a) => sum + (a.amount || 0), 0);

    return { 
      totalHours: totalBasic + totalOT, 
      basicHours: totalBasic, 
      otHours: totalOT, 
      earnings, 
      loanDebt: myLoanDebt, 
      advanceDebt: myAdvanceDebt 
    };
  }, [staffData, period, allAttendance, allLoans, allAdvances, user]);

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

        <div className="mt-6 pt-6 border-t border-white/10 flex justify-between items-end">
           <div>
             <p className="text-xs opacity-70 mb-1 font-medium uppercase tracking-tight">Est. Instant Earnings</p>
             <div className="text-3xl font-black tracking-tighter flex items-center gap-1">
               <TrendingUp size={24} className="text-green-300" />
               <DollarSign size={20} className="text-white/60 -mr-1" />
               {stats.earnings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
             </div>
           </div>
           <div className="text-[10px] opacity-60 text-right font-medium">
              Based on {staffData.basicPerHour || 0}/hr <br/> and {staffData.OTPerHour || 0} OT rate
           </div>
        </div>
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
           <div className="flex items-center gap-2 mb-2 text-gray-500">
             <Receipt size={16} className="text-orange-500" /> 
             <span className="text-[11px] font-bold uppercase tracking-wider">Advances</span>
           </div>
           <div className="text-xl font-black text-gray-800">${stats.advanceDebt.toFixed(2)}</div>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
           <div className="flex items-center gap-2 mb-2 text-gray-500">
             <CreditCard size={16} className="text-red-500" /> 
             <span className="text-[11px] font-bold uppercase tracking-wider">Loan Bal.</span>
           </div>
           <div className="text-xl font-black text-gray-800">${stats.loanDebt.toFixed(2)}</div>
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
