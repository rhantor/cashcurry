"use client";
import React, { useState, useEffect, useMemo } from "react";
import {
  useGetBranchAttendanceTokensQuery,
  useGetBranchAttendanceByPeriodQuery,
  useGetOtRequestsQuery,
  useAddAttendancePunchMutation,
  useUpdateAttendancePunchMutation,
  useDeleteAttendancePunchMutation
} from "@/lib/redux/api/attendanceApiSlice";
import { useGetStaffListQuery } from "@/lib/redux/api/staffApiSlice";
import { useGetBranchSettingsQuery } from "@/lib/redux/api/branchSettingsApiSlice";
import { 
  Clock, LogIn, LogOut, ChevronLeft, ChevronRight,
  Camera, Download, List, LayoutGrid, Plus, Edit2, Trash2, Save, X as CloseIcon, Loader2
} from "lucide-react";
import * as XLSX from "xlsx";
import Cookies from "js-cookie";
import { computeAttendance, formatHours as fmtHours, toLocalDateStr } from "@/lib/attendance/computeHours";
import { shiftsEnabled } from "@/lib/attendance/shifts";

export default function AttendanceLogPage() {
  const [user, setUser] = useState(null);
  const [selectedDate, setSelectedDate] = useState(toLocalDateStr(new Date()));
  const [viewMode, setViewMode] = useState("daily"); // "daily" or "monthly"
  const [photoModal, setPhotoModal] = useState(null);
  const [editModal, setEditModal] = useState(null); // { punch: null, mode: 'add' | 'edit' }
  const [isSaving, setIsSaving] = useState(false);

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

  const { data: settings } = useGetBranchSettingsQuery(
    !skip ? { companyId, branchId } : { skip: true }
  );
  const attendanceSettings = settings?.attendance || {};
  const shiftsOn = shiftsEnabled(attendanceSettings);

  // Early-OT decisions for the month — they change how the engine pays an early
  // punch-in, so the log must agree with what the approver decided.
  const { data: otRequests = [] } = useGetOtRequestsQuery(
    !skip && shiftsOn
      ? { companyId, branchId, startDate: currentMonthStart, endDate: currentMonthEnd }
      : { skip: true },
    { skip: skip || !shiftsOn }
  );

  // { [staffId]: { [date]: status } }
  const otApprovalsByStaff = useMemo(() => {
    const map = {};
    otRequests.forEach((r) => {
      if (!r.staffId || !r.date) return;
      (map[r.staffId] = map[r.staffId] || {})[r.date] = r.status;
    });
    return map;
  }, [otRequests]);

  const [addPunch] = useAddAttendancePunchMutation();
  const [updatePunch] = useUpdateAttendancePunchMutation();
  const [deletePunch] = useDeleteAttendancePunchMutation();

  const [isExporting, setIsExporting] = useState(false);

  const formatTime = (ts) => {
    if (!ts?.seconds) return "—";
    return new Date(ts.seconds * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  };

  const formatHours = (hours) => fmtHours(hours, attendanceSettings);

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

         const { days } = computeAttendance({
            punches: myPunches,
            staff,
            settings: attendanceSettings,
            otApprovals: otApprovalsByStaff[staff.id]
         });

         days.forEach(day => {
            const [p1, p2, p3] = day.pairs;
            reportData.push({
               "Date": day.date,
               "Name": staff.firstName + " " + staff.lastName,
               ...(shiftsOn ? { "Shift": day.shift || "—" } : {}),
               "In 1": p1?.in || "—",
               "Out 1": p1?.out || "—",
               "In 2": p2?.in || "—",
               "Out 2": p2?.out || "—",
               "In 3": p3?.in || "—",
               "Out 3": p3?.out || "—",
               "Worked Hrs": formatHours(day.worked),
               "Basic Hrs": formatHours(day.basic),
               "OT Hrs": formatHours(day.ot),
               "Bonus": day.bonus ? "1.00" : "0.00",
               "Total": formatHours(day.total),
               "EST Earnings": (day.total * (Number(staff.basicPerHour) || 0)).toFixed(2),
               ...(shiftsOn
                 ? {
                     "Late (Min)": Math.round(day.lateMinutes),
                     "Left Early (Min)": Math.round(day.earlyLeaveMinutes),
                     "Early OT": day.otApproval === "none" ? "—" : day.otApproval,
                     "Notes": day.notes.join("; ")
                   }
                 : {})
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

  // Monthly Summary Calculation (shared engine)
  const monthlySummaries = useMemo(() => {
    if (!monthlyPunches.length || !staffList.length) return [];

    return staffList.map(staff => {
      const myPunches = monthlyPunches.filter(p => p.staffId === staff.id);
      if (myPunches.length === 0) return null;

      const { totals } = computeAttendance({
        punches: myPunches,
        staff,
        settings: attendanceSettings,
        otApprovals: otApprovalsByStaff[staff.id]
      });

      return {
        id: staff.id,
        name: staff.firstName + " " + staff.lastName,
        dept: staff.department || "N/A",
        days: totals.daysWorked,
        worked: totals.worked,
        basic: totals.basic,
        ot: totals.ot,
        lateDays: totals.lateDays,
        lateMinutes: totals.lateMinutes,
        pendingOtDays: totals.pendingOtDays
      };
    }).filter(s => s !== null);
  }, [monthlyPunches, staffList, attendanceSettings, otApprovalsByStaff]);

  const sortedDaily = [...punches].sort((a, b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0));

  const shiftDate = (days) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(toLocalDateStr(d));
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
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-emerald-200 transition-all disabled:opacity-50"
          >
            {isExporting ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
            Time Card (.xlsx)
          </button>

          <button
            onClick={() => setEditModal({ mode: "add", punch: { date: selectedDate, type: "in", staffId: "" } })}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-blue-200 transition-all"
          >
            <Plus size={18} /> Add Manual
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
            disabled={selectedDate === toLocalDateStr(new Date())}
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
                  <div className="col-span-3 text-gray-600 font-black tabular-nums flex items-center gap-2">
                    {formatTime(punch.timestamp)}
                    {punch.isManual && <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">MANUAL</span>}
                  </div>
                  <div className="col-span-3 flex items-center gap-4">
                    {punch.photoBase64 ? (
                      <button
                        onClick={() => setPhotoModal(punch)}
                        className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 text-xs font-black"
                      >
                        <Camera size={14} /> SNAP
                      </button>
                    ) : (
                      <span className="text-gray-300 text-[10px] font-bold italic">No photo</span>
                    )}

                    <div className="flex items-center gap-2 ml-auto">
                      <button 
                        onClick={() => setEditModal({ mode: "edit", punch })}
                        className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-blue-600 transition-colors"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button 
                        onClick={() => {
                          if (confirm("Delete this punch record?")) {
                            deletePunch({ companyId, branchId, punchId: punch.id });
                          }
                        }}
                        className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
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
              <div className={`${shiftsOn ? "col-span-3" : "col-span-3"} text-white`}>Staff Member</div>
              <div className={shiftsOn ? "col-span-1" : "col-span-2"}>Dept</div>
              <div className="col-span-1 text-center font-black">Days</div>
              <div className="col-span-2 text-right">Worked (H)</div>
              <div className="col-span-2 text-right">Basic (H)</div>
              <div className={`${shiftsOn ? "col-span-1" : "col-span-2"} text-right text-orange-400`}>OT (H)</div>
              {shiftsOn && <div className="col-span-2 text-right text-red-400">Late</div>}
            </div>
            <div className="divide-y divide-gray-50">
               {monthlySummaries.map(s => (
                 <div key={s.id} className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-blue-50/30 transition text-sm">
                    <div className="col-span-3 font-black text-gray-900">
                      {s.name}
                      {shiftsOn && s.pendingOtDays > 0 && (
                        <span className="ml-2 inline-block px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-black align-middle">
                          {s.pendingOtDays} OT pending
                        </span>
                      )}
                    </div>
                    <div className={`${shiftsOn ? "col-span-1" : "col-span-2"} text-xs text-gray-400 font-bold uppercase truncate`}>{s.dept}</div>
                    <div className="col-span-1 text-center font-black text-gray-900">{s.days}</div>
                    <div className="col-span-2 text-right font-bold text-gray-600">{formatHours(s.worked)}</div>
                    <div className="col-span-2 text-right font-black text-blue-600">{formatHours(s.basic)}</div>
                    <div className={`${shiftsOn ? "col-span-1" : "col-span-2"} text-right font-black text-orange-500`}>{formatHours(s.ot)}</div>
                    {shiftsOn && (
                      <div className="col-span-2 text-right">
                        {s.lateDays > 0 ? (
                          <span className="font-black text-red-600">
                            {Math.round(s.lateMinutes)} min
                            <span className="ml-1 text-[10px] font-bold text-red-400">
                              ({s.lateDays}d)
                            </span>
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-gray-300">—</span>
                        )}
                      </div>
                    )}
                 </div>
               ))}
            </div>
          </div>
        )
      )}

      {/* Edit/Add Modal */}
      {editModal && (
        <div className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b flex justify-between items-center bg-gray-50">
              <h3 className="text-lg font-black text-gray-900">{editModal.mode === "add" ? "Add Manual Punch" : "Edit Punch Record"}</h3>
              <button onClick={() => setEditModal(null)} className="text-gray-400 hover:text-gray-600 p-2"><CloseIcon size={20} /></button>
            </div>
            
            <div className="p-6 space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase">Staff Member</label>
                <select 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                  value={editModal.punch.staffId}
                  disabled={editModal.mode === "edit"}
                  onChange={(e) => {
                    const s = staffList.find(x => x.id === e.target.value);
                    setEditModal(prev => ({ ...prev, punch: { ...prev.punch, staffId: e.target.value, staffName: s ? `${s.firstName} ${s.lastName}` : "" } }))
                  }}
                >
                  <option value="">Select Staff...</option>
                  {staffList.map(s => <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase">Date</label>
                  <input 
                    type="date" 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800"
                    value={editModal.punch.date}
                    onChange={(e) => setEditModal(prev => ({ ...prev, punch: { ...prev.punch, date: e.target.value } }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase">Time</label>
                  <input 
                    type="time" 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800"
                    value={editModal.punch.time || (editModal.punch.timestamp?.seconds ? formatTime(editModal.punch.timestamp) : "")}
                    onChange={(e) => setEditModal(prev => ({ ...prev, punch: { ...prev.punch, time: e.target.value } }))}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase">Punch Type</label>
                <div className="flex gap-2">
                  {["in", "out"].map(t => (
                    <button
                      key={t}
                      onClick={() => setEditModal(prev => ({ ...prev, punch: { ...prev.punch, type: t } }))}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest border transition-all ${
                        editModal.punch.type === t 
                          ? (t === "in" ? "bg-green-600 border-green-600 text-white shadow-lg shadow-green-100" : "bg-orange-600 border-orange-600 text-white shadow-lg shadow-orange-100")
                          : "bg-white border-slate-200 text-slate-400 hover:border-slate-300"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t flex gap-3">
              <button 
                onClick={() => setEditModal(null)}
                className="flex-1 py-3 rounded-xl bg-white border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button 
                disabled={isSaving || !editModal.punch.staffId || !editModal.punch.time && !editModal.punch.timestamp}
                onClick={async () => {
                  setIsSaving(true);
                  try {
                    const timeStr = editModal.punch.time || formatTime(editModal.punch.timestamp);
                    const [h, m] = timeStr.split(":").map(Number);
                    const tsDate = new Date(editModal.punch.date);
                    tsDate.setHours(h, m, 0, 0);
                    
                    const payload = {
                      staffId: editModal.punch.staffId,
                      staffName: editModal.punch.staffName,
                      type: editModal.punch.type,
                      date: editModal.punch.date,
                      timestamp: tsDate.toISOString(),
                      isManual: true
                    };

                    if (editModal.mode === "add") {
                      await addPunch({ companyId, branchId, data: payload }).unwrap();
                    } else {
                      await updatePunch({ companyId, branchId, punchId: editModal.punch.id, data: payload }).unwrap();
                    }
                    setEditModal(null);
                  } catch {
                    alert("Save failed");
                  } finally {
                    setIsSaving(false);
                  }
                }}
                className="flex-1 py-3 rounded-xl bg-gray-900 text-white font-bold hover:bg-black transition-all flex items-center justify-center gap-2"
              >
                {isSaving ? <Loader2 className="animate-spin" size={18} /> : <><Save size={18} /> Save Changes</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo / Snapshot Modal */}
      {photoModal && (
        <div
          className="fixed inset-0 z-[160] bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setPhotoModal(null)}
        >
          <div
            className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <div>
                <h3 className="text-base font-black text-gray-900">{photoModal.staffName}</h3>
                <p className="text-xs text-gray-500 font-semibold flex items-center gap-2">
                  <span className={photoModal.type === "in" ? "text-green-600" : "text-orange-600"}>
                    {photoModal.type === "in" ? "Punch IN" : "Punch OUT"}
                  </span>
                  · {formatTime(photoModal.timestamp)}
                  {photoModal.method && (
                    <span className="uppercase bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded text-[9px] font-bold">
                      {photoModal.method}
                    </span>
                  )}
                </p>
              </div>
              <button onClick={() => setPhotoModal(null)} className="text-gray-400 hover:text-gray-600 p-2">
                <CloseIcon size={20} />
              </button>
            </div>
            <div className="bg-gray-900 flex items-center justify-center">
              <img
                src={photoModal.photoBase64}
                alt={`${photoModal.staffName} snapshot`}
                className="w-full h-auto object-contain max-h-[70vh]"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
