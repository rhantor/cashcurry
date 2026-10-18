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
import { Clock, LogIn, LogOut, ChevronLeft, ChevronRight, Camera, Download, List, LayoutGrid, Plus, Trash2, Save, UserX } from "lucide-react";
import { addMonths, format, parseISO } from "date-fns";
import { Avatar, Badge, Button, Card, DataTable, DatePicker, EmptyState, Field, Input, Select, Sheet, Skeleton, Tabs, cn } from "@/app/components/ui";
import { ChoiceCards } from "@/app/components/entry/Choices";
import StatTiles from "@/app/components/purchases/StatTiles";
import StatusScreen from "@/app/components/common/StatusScreen";
import * as XLSX from "xlsx";
import Cookies from "js-cookie";
import { computeAttendance, formatHours as fmtHours, toLocalDateStr } from "@/lib/attendance/computeHours";
import { shiftsEnabled } from "@/lib/attendance/shifts";
import { getSessionUser } from "@/lib/session";
import { toast, confirmDialog } from "@/app/components/ui/notify";

export default function AttendanceLogPage() {
  const [user, setUser] = useState(null);
  const [selectedDate, setSelectedDate] = useState(toLocalDateStr(new Date()));
  const [viewMode, setViewMode] = useState("daily"); // "daily" or "monthly"
  const [editModal, setEditModal] = useState(null); // { punch: null, mode: 'add' | 'edit' }
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const stored = getSessionUser();
    if (stored) setUser(stored);
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
        toast.warning("No data to export for this month");
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
      toast.error("Export failed");
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
    const d = parseISO(selectedDate); // local day — new Date("yyyy-MM-dd") is UTC
    d.setDate(d.getDate() + days);
    setSelectedDate(toLocalDateStr(d));
  };

  if (!user) return <Skeleton className="m-6 h-64" rounded="rounded-2xl" />;
  if (!branchId) {
    return <StatusScreen full={false} icon={Clock} tone="warning" title="Pick a branch first" message="Attendance is kept per branch — choose one from the top bar." />;
  }

  const today = toLocalDateStr(new Date());
  const month = selectedDate.substring(0, 7);
  const niceDay = format(parseISO(selectedDate), "EEEE, d MMM yyyy");
  const niceMonth = format(parseISO(`${month}-01`), "MMMM yyyy");
  const shiftMonth = (n) => setSelectedDate(toLocalDateStr(addMonths(parseISO(`${month}-01`), n)));

  // the day's punches by person, in time order; whoever's last punch is "in" is still here
  const byStaff = Object.values(
    sortedDaily.reduce((acc, p) => {
      (acc[p.staffId] = acc[p.staffId] || { staffId: p.staffId, name: p.staffName || "Unknown", punches: [] }).punches.push(p);
      return acc;
    }, {})
  ).map((g) => ({ ...g, inNow: g.punches[g.punches.length - 1]?.type === "in" }));
  const hereNow = byStaff.filter((g) => g.inNow).length;
  const notIn = staffList.filter((s) => !byStaff.some((g) => g.staffId === s.id));

  const openAdd = (staffId = "") => {
    const s = staffList.find((x) => x.id === staffId);
    setEditModal({ mode: "add", punch: { date: selectedDate, type: "in", staffId, staffName: s ? `${s.firstName} ${s.lastName}` : "" } });
  };

  const removePunch = async (punch) => {
    const ok = await confirmDialog({
      title: "Delete this punch?",
      message: `${punch.staffName}'s ${punch.type === "in" ? "punch in" : "punch out"} at ${formatTime(punch.timestamp)} is removed, and their hours worked change to match.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return false;
    try {
      await deletePunch({ companyId, branchId, punchId: punch.id }).unwrap();
      toast.success("Punch deleted");
      return true;
    } catch (e) {
      toast.error(e?.message ? `Couldn't delete it: ${e.message}` : "Couldn't delete it.");
      return false;
    }
  };

  const savePunch = async () => {
    const p = editModal.punch;
    setIsSaving(true);
    try {
      const timeStr = p.time || formatTime(p.timestamp);
      const [h, m] = timeStr.split(":").map(Number);
      const tsDate = parseISO(p.date); // the day on this device's clock, not UTC
      tsDate.setHours(h, m, 0, 0);
      const payload = { staffId: p.staffId, staffName: p.staffName, type: p.type, date: p.date, timestamp: tsDate.toISOString(), isManual: true };
      if (editModal.mode === "add") await addPunch({ companyId, branchId, data: payload }).unwrap();
      else await updatePunch({ companyId, branchId, punchId: p.id, data: payload }).unwrap();
      toast.success(editModal.mode === "add" ? "Punch added" : "Punch saved");
      setEditModal(null);
    } catch (e) {
      toast.error(e?.message ? `Couldn't save: ${e.message}` : "Couldn't save the punch.");
    } finally {
      setIsSaving(false);
    }
  };

  const monthColumns = [
    {
      key: "name",
      label: "Staff",
      primary: true,
      sortable: true,
      render: (s) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-fg">{s.name}</p>
          <p className="truncate text-[11px] font-normal text-muted">
            {s.dept}
            {shiftsOn && s.pendingOtDays > 0 && <span className="text-warning"> · {s.pendingOtDays} early OT waiting</span>}
          </p>
        </div>
      ),
    },
    { key: "days", label: "Days", align: "right", sortable: true },
    { key: "worked", label: "Worked", align: "right", sortable: true, render: (s) => formatHours(s.worked) },
    { key: "basic", label: "Normal", align: "right", sortable: true, render: (s) => formatHours(s.basic) },
    { key: "ot", label: "OT", align: "right", aside: true, sortable: true, render: (s) => <span className={cn(s.ot > 0 && "font-semibold text-warning")}>{formatHours(s.ot)} OT</span> },
    ...(shiftsOn
      ? [
          {
            key: "late",
            label: "Late",
            align: "right",
            sortValue: (s) => s.lateMinutes,
            render: (s) => (s.lateDays > 0 ? <span className="text-danger">{Math.round(s.lateMinutes)} min · {s.lateDays}d</span> : <span className="text-subtle">—</span>),
          },
        ]
      : []),
  ];

  const p = editModal?.punch;

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-fg">Attendance</h1>
          <p className="text-sm text-muted">Who punched in and out, and the hours that go to payroll.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" icon={Download} loading={isExporting} onClick={handleExport}>
            Time card
          </Button>
          <Button icon={Plus} onClick={() => openAdd()}>
            Add a punch
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs
          value={viewMode}
          onChange={setViewMode}
          tabs={[
            { value: "daily", label: "Day", icon: List },
            { value: "monthly", label: "Month", icon: LayoutGrid },
          ]}
        />
        <div className="flex items-center gap-1 rounded-xl border border-line bg-surface p-1 shadow-card">
          <Button size="icon" variant="ghost" className="size-9" aria-label={viewMode === "daily" ? "Day before" : "Month before"} onClick={() => (viewMode === "daily" ? shiftDate(-1) : shiftMonth(-1))}>
            <ChevronLeft className="size-4" />
          </Button>
          {viewMode === "daily" ? (
            <DatePicker value={selectedDate} onChange={(v) => v && setSelectedDate(v)} max={today} className="[&_button]:h-9 [&_button]:border-0 [&_button]:shadow-none" />
          ) : (
            <span className="min-w-[8.5rem] text-center text-sm font-semibold text-fg">{niceMonth}</span>
          )}
          <Button
            size="icon"
            variant="ghost"
            className="size-9"
            aria-label={viewMode === "daily" ? "Next day" : "Next month"}
            disabled={viewMode === "daily" ? selectedDate >= today : month >= today.substring(0, 7)}
            onClick={() => (viewMode === "daily" ? shiftDate(1) : shiftMonth(1))}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {viewMode === "daily" ? (
        <>
          <StatTiles
            loading={isLoadingDaily}
            tiles={[
              { label: selectedDate === today ? "In now" : "Still in at the end", value: `${hereNow}`, note: `${byStaff.length} came in ${selectedDate === today ? "today" : "that day"}`, icon: LogIn, tone: "bg-success-soft text-success" },
              { label: "Didn't punch in", value: `${notIn.length}`, note: notIn.length ? notIn.slice(0, 3).map((s) => s.firstName).join(", ") + (notIn.length > 3 ? "…" : "") : "Everyone came", icon: UserX, tone: notIn.length ? "bg-warning-soft text-warning" : "bg-surface-2 text-muted" },
              { label: "Punches", value: `${sortedDaily.length}`, note: `${sortedDaily.filter((x) => x.isManual).length} added by hand`, icon: Clock, tone: "bg-surface-2 text-muted" },
            ]}
          />

          {isLoadingDaily ? (
            <div className="space-y-2">
              <Skeleton className="h-16" rounded="rounded-2xl" />
              <Skeleton className="h-16" rounded="rounded-2xl" />
            </div>
          ) : byStaff.length === 0 ? (
            <Card>
              <EmptyState icon={Clock} title={`No punches on ${niceDay}`} description="Punches from the kiosk show here as staff come and go. Add one by hand if someone forgot." action={<Button icon={Plus} onClick={() => openAdd()}>Add a punch</Button>} />
            </Card>
          ) : (
            <Card className="divide-y divide-line overflow-hidden p-0">
              {byStaff.map((g) => (
                <div key={g.staffId} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-4 sm:p-4">
                  <div className="flex min-w-0 items-center gap-3 sm:w-56">
                    <Avatar name={g.name} size="md" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-fg">{g.name}</p>
                      {g.inNow ? <Badge tone="success" dot pulse={selectedDate === today}>In</Badge> : <Badge>Left</Badge>}
                    </div>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                    {g.punches.map((x) => (
                      <button
                        key={x.id}
                        type="button"
                        onClick={() => setEditModal({ mode: "edit", punch: x })}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold tabular-nums transition-colors hover:brightness-95",
                          x.type === "in" ? "border-success/30 bg-success-soft text-success" : "border-warning/30 bg-warning-soft text-warning"
                        )}
                      >
                        {x.type === "in" ? <LogIn className="size-3" /> : <LogOut className="size-3" />}
                        {formatTime(x.timestamp)}
                        {x.photoBase64 && <Camera className="size-3 opacity-70" />}
                        {x.isManual && <span className="text-[10px] font-medium opacity-70">by hand</span>}
                      </button>
                    ))}
                    <button type="button" onClick={() => openAdd(g.staffId)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-muted hover:bg-surface-2 hover:text-fg" aria-label={`Add a punch for ${g.name}`}>
                      <Plus className="size-3" /> Add
                    </button>
                  </div>
                </div>
              ))}
            </Card>
          )}
        </>
      ) : (
        <DataTable
          columns={monthColumns}
          rows={monthlySummaries}
          loading={isLoadingMonthly}
          pageSize={0}
          defaultSort={{ key: "name", dir: "asc" }}
          empty={{ icon: LayoutGrid, title: `No punches in ${niceMonth}`, description: "The month's hours show here once staff punch in." }}
          footer={
            monthlySummaries.length
              ? {
                  name: "Total",
                  days: monthlySummaries.reduce((n, s) => n + s.days, 0),
                  worked: formatHours(monthlySummaries.reduce((n, s) => n + s.worked, 0)),
                  ot: `${formatHours(monthlySummaries.reduce((n, s) => n + s.ot, 0))} OT`,
                }
              : null
          }
        />
      )}

      {/* add or change a punch */}
      <Sheet
        open={!!editModal}
        onClose={() => setEditModal(null)}
        title={editModal?.mode === "add" ? "Add a punch" : `${p?.staffName || "Punch"}`}
        description={editModal?.mode === "add" ? "For when someone forgot to punch at the kiosk." : `${p?.type === "in" ? "Punch in" : "Punch out"} · ${p ? formatTime(p.timestamp) : ""}${p?.method ? ` · ${p.method}` : ""}`}
        footer={
          <div className="flex items-center justify-between gap-2">
            {editModal?.mode === "edit" ? (
              <Button
                variant="ghost"
                icon={Trash2}
                className="text-danger hover:bg-danger-soft"
                onClick={async () => {
                  if (await removePunch(p)) setEditModal(null);
                }}
              >
                Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setEditModal(null)}>
                Cancel
              </Button>
              <Button icon={Save} loading={isSaving} disabled={!p?.staffId || (!p?.time && !p?.timestamp)} onClick={savePunch}>
                Save
              </Button>
            </div>
          </div>
        }
      >
        {p && (
          <div className="space-y-4">
            {p.photoBase64 && (
              <img src={p.photoBase64} alt={`${p.staffName} at the kiosk`} className="mx-auto max-h-64 rounded-2xl object-contain" />
            )}
            <Field label="Staff member">
              {({ id }) => (
                <Select
                  id={id}
                  value={p.staffId}
                  disabled={editModal.mode === "edit"}
                  onChange={(e) => {
                    const s = staffList.find((x) => x.id === e.target.value);
                    setEditModal((prev) => ({ ...prev, punch: { ...prev.punch, staffId: e.target.value, staffName: s ? `${s.firstName} ${s.lastName}` : "" } }));
                  }}
                >
                  <option value="">Choose…</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.firstName} {s.lastName}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Day">{() => <DatePicker value={p.date} max={today} onChange={(v) => setEditModal((prev) => ({ ...prev, punch: { ...prev.punch, date: v } }))} />}</Field>
              <Field label="Time">
                {({ id }) => (
                  <Input
                    id={id}
                    type="time"
                    value={p.time || (p.timestamp?.seconds ? formatTime(p.timestamp) : "")}
                    onChange={(e) => setEditModal((prev) => ({ ...prev, punch: { ...prev.punch, time: e.target.value } }))}
                  />
                )}
              </Field>
            </div>
            <Field label="In or out">
              {() => (
                <ChoiceCards
                  value={p.type}
                  onChange={(t) => setEditModal((prev) => ({ ...prev, punch: { ...prev.punch, type: t } }))}
                  className="grid-cols-2"
                  options={[
                    { value: "in", title: "Punch in", note: "Started work", icon: LogIn, tone: "brand" },
                    { value: "out", title: "Punch out", note: "Finished or a break", icon: LogOut, tone: "warning" },
                  ]}
                />
              )}
            </Field>
          </div>
        )}
      </Sheet>
    </div>
  );
}
