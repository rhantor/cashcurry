"use client";
import React, { useState, useEffect, useMemo } from "react";
import { Clock, LogIn, LogOut, Calendar, ChevronLeft, ChevronRight, Camera, Download, List, LayoutGrid } from "lucide-react";
import { useGetBranchAttendanceTokensQuery, useGetBranchAttendanceByPeriodQuery } from "@/lib/redux/api/attendanceApiSlice";
import { useGetStaffListQuery } from "@/lib/redux/api/staffApiSlice";
import * as XLSX from "xlsx";
import Cookies from "js-cookie";

export default function AttendanceLogPage() {
  const [user, setUser] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [viewMode, setViewMode] = useState("daily"); // "daily" or "monthly"
  const [photoModal, setPhotoModal] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) setUser(JSON.parse(stored));
  }, []);

  const companyId = user?.companyId;
  const cookieKey = companyId ? `activeBranch_${companyId}` : "activeBranch";
  const branchId =
    user?.role === "owner" || user?.role === "gm" || user?.role === "superAdmin"
      ? (typeof window !== "undefined" ? Cookies.get(cookieKey) : null)
      : user?.branchId;

  const skip = !companyId || !branchId;
  
  // Daily Punches
  const { data: punches = [], isLoading: isLoadingDaily } = useGetBranchAttendanceTokensQuery(
    !skip ? { companyId, branchId, date: selectedDate } : { skip: true }
  );

  // Monthly Punches for Export and Summary
  const currentMonthStart = selectedDate.substring(0, 7) + "-01";
  const currentMonthEnd = selectedDate.substring(0, 7) + "-31";
  const { data: monthlyPunches = [], isLoading: isLoadingMonthly } = useGetBranchAttendanceByPeriodQuery(
    !skip ? { companyId, branchId, startDate: currentMonthStart, endDate: currentMonthEnd } : { skip: true }
  );

  const { data: staffList = [] } = useGetStaffListQuery(
    !skip ? { companyId, branchId } : { skip: true }
  );

  const [isExporting, setIsExporting] = useState(false);

  const formatTime = (ts) => {
    if (!ts?.seconds) return "—";
    return new Date(ts.seconds * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      if (!monthlyPunches.length) {
        alert("No data to export for this month");
        return;
      }

      const reportData = [];

      staffList.forEach(staff => {
         const myPunches = monthlyPunches.filter(p => p.staffId === staff.id);
         if (myPunches.length === 0) return;

         const dailyGroups = {};
         myPunches.forEach(p => {
            if (!dailyGroups[p.date]) dailyGroups[p.date] = [];
            dailyGroups[p.date].push(p);
         });

         const dailyLimit = Number(staff.basicHoursPerDay) || 8;
         const isFullTime = staff.employmentType !== "part-time";

         Object.keys(dailyGroups).sort().forEach(date => {
            const dayPunches = dailyGroups[date].sort((a,b) => (a.timestamp?.seconds||0) - (b.timestamp?.seconds||0));
            let clockedMillis = 0;
            const punchTimes = { in1: "—", out1: "—", in2: "—", out2: "—", in3: "—", out3: "—" };
            
            let pairIdx = 1;
            for (let i = 0; i < dayPunches.length - 1; i++) {
              if (dayPunches[i].type === "in" && dayPunches[i+1].type === "out") {
                clockedMillis += (dayPunches[i+1].timestamp.seconds - dayPunches[i].timestamp.seconds) * 1000;
                
                if (pairIdx <= 3) {
                  punchTimes[`in${pairIdx}`] = formatTime(dayPunches[i].timestamp);
                  punchTimes[`out${pairIdx}`] = formatTime(dayPunches[i+1].timestamp);
                  pairIdx++;
                }
                i++;
              }
            }

            let actualHours = clockedMillis / (1000 * 60 * 60);
            let dayBasic = actualHours;
            let dayOT = 0;

            if (isFullTime) {
              dayBasic = Math.min(actualHours, dailyLimit);
              dayOT = Math.max(0, actualHours - dailyLimit);
            }

            let bonus = 0;
            if (staff.hasPaidBreak) {
              const meetsStrict = !staff.requireFullShiftForBreak || actualHours >= (Number(staff.fullShiftHours) || 7.5);
              if (meetsStrict) bonus = 1;
            }

            reportData.push({
               "Date": date,
               "Name": staff.firstName + " " + staff.lastName,
               "In 1": punchTimes.in1,
               "Out 1": punchTimes.out1,
               "In 2": punchTimes.in2,
               "Out 2": punchTimes.out2,
               "In 3": punchTimes.in3,
               "Out 3": punchTimes.out3,
               "Worked Hrs": actualHours.toFixed(2),
               "Basic Hrs": (dayBasic + (bonus && dayBasic < dailyLimit ? 1 : 0)).toFixed(2),
               "OT Hrs": (dayOT + (bonus && dayBasic >= dailyLimit ? 1 : 0)).toFixed(2),
               "Bonus": bonus ? "1.00" : "0.00",
               "Total": (dayBasic + dayOT + bonus).toFixed(2),
               "EST Earnings": ((dayBasic + dayOT + bonus) * (Number(staff.basicPerHour) || 0)).toFixed(2)
            });
         });
      });

      const ws = XLSX.utils.json_to_sheet(reportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Time Card");
      XLSX.writeFile(wb, `TimeCard_${selectedDate.substring(0, 7)}.xlsx`);
    } catch (e) {
      console.error(e);
      alert("Export failed");
    } finally {
      setIsExporting(false);
    }
  };

  // Monthly Summary Calculation
  const monthlySummaries = useMemo(() => {
    if (!monthlyPunches.length || !staffList.length) return [];

    return staffList.map(staff => {
      const myPunches = monthlyPunches.filter(p => p.staffId === staff.id);
      if (myPunches.length === 0) return null;

      const dailyGroups = {};
      myPunches.forEach(p => {
        if (!dailyGroups[p.date]) dailyGroups[p.date] = [];
        dailyGroups[p.date].push(p);
      });

      let totalBasic = 0;
      let totalOT = 0;
      let totalWorked = 0;
      let daysWorked = 0;

      const dailyLimit = Number(staff.basicHoursPerDay) || 8;
      const isFullTime = staff.employmentType !== "part-time";

      Object.keys(dailyGroups).forEach(date => {
        const dayPunches = dailyGroups[date].sort((a,b) => (a.timestamp?.seconds||0) - (b.timestamp?.seconds||0));
        let clockedMillis = 0;
        for (let i = 0; i < dayPunches.length - 1; i++) {
          if (dayPunches[i].type === "in" && dayPunches[i+1].type === "out") {
            clockedMillis += (dayPunches[i+1].timestamp.seconds - dayPunches[i].timestamp.seconds) * 1000;
            i++;
          }
        }

        let actualHours = clockedMillis / (1000 * 60 * 60);
        if (actualHours > 0) {
          daysWorked++;
          totalWorked += actualHours;
          
          let dayBasic = actualHours;
          let dayOT = 0;
          if (isFullTime) {
            dayBasic = Math.min(actualHours, dailyLimit);
            dayOT = Math.max(0, actualHours - dailyLimit);
          }

          if (staff.hasPaidBreak) {
            const meetsStrict = !staff.requireFullShiftForBreak || actualHours >= (Number(staff.fullShiftHours) || 7.5);
            if (meetsStrict) {
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
        }
      });

      return {
        id: staff.id,
        name: staff.firstName + " " + staff.lastName,
        dept: staff.department || "N/A",
        days: daysWorked,
        worked: totalWorked,
        basic: totalBasic,
        ot: totalOT
      };
    }).filter(s => s !== null);
  }, [monthlyPunches, staffList]);

  const sortedDaily = [...punches].sort((a, b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0));

  const shiftDate = (days) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split("T")[0]);
  };

  if (!user) return <div className="p-8 text-center text-gray-400">Loading...</div>;

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <Clock size={28} className="text-blue-600" />
            Attendance Log
          </h1>
          <p className="text-sm text-gray-500 mt-1 font-medium">Professional time tracking and reporting</p>
        </div>

        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-200">
            <button 
              onClick={() => setViewMode("daily")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === "daily" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              <List size={14} /> Daily
            </button>
            <button 
              onClick={() => setViewMode("monthly")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === "monthly" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              <LayoutGrid size={14} /> Monthly
            </button>
          </div>

          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-2 bg-gray-900 hover:bg-black text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-gray-200 transition-all disabled:opacity-50"
          >
            {isExporting ? <span className="animate-spin text-lg">◌</span> : <Download size={18} />}
            Time Card (.xlsx)
          </button>
        </div>
      </div>

      {/* Date Navigator & Quick Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
        <div className="lg:col-span-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
          <button onClick={() => shiftDate(-1)} className="p-2 rounded-xl hover:bg-gray-100 transition text-gray-600">
            <ChevronLeft size={20} />
          </button>
          <div className="flex flex-col items-center">
             <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Select Date</span>
             <input
               type="date"
               value={selectedDate}
               onChange={(e) => setSelectedDate(e.target.value)}
               className="border-none bg-transparent text-lg font-black text-gray-900 outline-none text-center"
             />
          </div>
          <button
            onClick={() => shiftDate(1)}
            disabled={selectedDate === new Date().toISOString().split("T")[0]}
            className="p-2 rounded-xl hover:bg-gray-100 transition text-gray-600 disabled:opacity-30"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="lg:col-span-8 grid grid-cols-3 gap-4">
           {[
             { label: "Active Today", val: new Set(sortedDaily.map(p => p.staffId)).size, color: "text-blue-600" },
             { label: "Punch Ins", val: sortedDaily.filter(p => p.type === "in").length, color: "text-green-600" },
             { label: "Total Punches", val: sortedDaily.length, color: "text-gray-400" }
           ].map((s, i) => (
             <div key={i} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm text-center">
                <div className={`text-2xl font-black ${s.color}`}>{s.val}</div>
                <div className="text-[10px] text-gray-500 font-bold uppercase mt-1 tracking-tight">{s.label}</div>
             </div>
           ))}
        </div>
      </div>

      {/* Main Content Area */}
      {viewMode === "daily" ? (
        // DAILY LOG VIEW
        isLoadingDaily ? (
          <div className="text-center py-20 text-gray-400 animate-pulse font-bold">Loading daily records...</div>
        ) : sortedDaily.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
            <Clock size={48} className="mx-auto text-gray-200 mb-4" />
            <p className="text-gray-400 font-bold">No attendance records for this date</p>
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-50">
              <div className="col-span-4">Staff Member</div>
              <div className="col-span-2">Type</div>
              <div className="col-span-3">Time</div>
              <div className="col-span-3">Photo Verification</div>
            </div>

            <div className="divide-y divide-gray-50">
              {sortedDaily.map((punch) => (
                <div key={punch.id} className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-gray-50/50 transition">
                  <div className="col-span-4 font-black text-gray-900 truncate tracking-tight">{punch.staffName}</div>
                  <div className="col-span-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black border ${
                      punch.type === "in"
                        ? "bg-green-50 text-green-600 border-green-100"
                        : "bg-orange-50 text-orange-600 border-orange-100"
                    }`}>
                      {punch.type === "in" ? <LogIn size={10} /> : <LogOut size={10} />}
                      {punch.type.toUpperCase()}
                    </span>
                  </div>
                  <div className="col-span-3 text-gray-600 font-black tabular-nums">{formatTime(punch.timestamp)}</div>
                  <div className="col-span-3">
                    {punch.photoBase64 ? (
                      <button
                        onClick={() => setPhotoModal(punch)}
                        className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 text-xs font-black"
                      >
                        <Camera size={14} /> VIEW SNAPSHOT
                      </button>
                    ) : (
                      <span className="text-gray-300 text-[10px] font-bold italic">No photo attached</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      ) : (
        // MONTHLY SUMMARY VIEW
        isLoadingMonthly ? (
          <div className="text-center py-20 text-gray-400 animate-pulse font-bold">Aggregating monthly data...</div>
        ) : monthlySummaries.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
             <LayoutGrid size={48} className="mx-auto text-gray-200 mb-4" />
             <p className="text-gray-400 font-bold">No data found for {selectedDate.substring(0, 7)}</p>
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-gray-900 text-[10px] font-black text-gray-400 uppercase tracking-widest">
              <div className="col-span-3 text-white">Staff Member</div>
              <div className="col-span-2">Dept</div>
              <div className="col-span-1 text-center font-black">Days</div>
              <div className="col-span-2 text-right">Worked (H)</div>
              <div className="col-span-2 text-right">Basic (H)</div>
              <div className="col-span-2 text-right text-orange-400">OT (H)</div>
            </div>
            <div className="divide-y divide-gray-50">
               {monthlySummaries.map(s => (
                 <div key={s.id} className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-blue-50/30 transition text-sm">
                    <div className="col-span-3 font-black text-gray-900">{s.name}</div>
                    <div className="col-span-2 text-xs text-gray-400 font-bold uppercase">{s.dept}</div>
                    <div className="col-span-1 text-center font-black text-gray-900">{s.days}</div>
                    <div className="col-span-2 text-right font-bold text-gray-600">{s.worked.toFixed(1)}</div>
                    <div className="col-span-2 text-right font-black text-blue-600">{s.basic.toFixed(1)}</div>
                    <div className="col-span-2 text-right font-black text-orange-500">{s.ot.toFixed(1)}</div>
                 </div>
               ))}
            </div>
          </div>
        )
      )}

      {/* Photo Modal */}
      {photoModal && (
        <div
          className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setPhotoModal(null)}
        >
          <div className="bg-white rounded-[32px] overflow-hidden max-w-sm w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b flex justify-between items-center">
              <div>
                <h3 className="font-black text-gray-900 leading-tight">{photoModal.staffName}</h3>
                <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mt-1">
                  PUNCHED {photoModal.type.toUpperCase()} • {formatTime(photoModal.timestamp)}
                </p>
              </div>
              <button onClick={() => setPhotoModal(null)} className="bg-gray-100 hover:bg-gray-200 text-gray-500 p-2 rounded-full transition-all">✕</button>
            </div>
            <img src={photoModal.photoBase64} alt="Punch verification" className="w-full aspect-[4/3] object-cover" />
            <div className="p-4 bg-gray-50 text-center">
               <span className="text-[10px] text-green-600 font-black border border-green-200 bg-green-100 rounded-full px-3 py-1 uppercase">✓ VERIFIED AT SOURCE</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
