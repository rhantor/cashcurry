"use client";
// Data for the staff app's screens (roadmap 4.6): the signed-in person's own
// staff record (live, so a new photo or number shows at once), their private
// half, this pay period's hours and pay so far, what they owe, and their
// payslips. The rules let staff read only their own.
import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { skipToken } from "@reduxjs/toolkit/query";
import { db } from "@/lib/firebase";
import { useGetBranchAttendanceByPeriodQuery, useGetOtRequestsQuery } from "@/lib/redux/api/attendanceApiSlice";
import { useGetStaffLoansQuery } from "@/lib/redux/api/staffLoanApiSlice";
import { useGetAdvanceEntriesQuery } from "@/lib/redux/api/AdvanceApiSlice";
import { useGetBranchSettingsQuery } from "@/lib/redux/api/branchSettingsApiSlice";
import { computeAttendance, toLocalDateStr } from "@/lib/attendance/computeHours";
import { shiftsEnabled } from "@/lib/attendance/shifts";
import { byPeriodDesc } from "@/lib/payroll/payslipCopy";

/** { staff, priv, loading } — the person's staff record and its private half. */
export function useMyStaff(user) {
  const [staff, setStaff] = useState(null);
  const [priv, setPriv] = useState(null);
  const [loading, setLoading] = useState(true);
  const { uid, companyId, branchId } = user || {};

  useEffect(() => {
    if (!uid || !companyId || !branchId) return;
    const q = query(collection(db, "companies", companyId, "branches", branchId, "staff"), where("uid", "==", uid));
    return onSnapshot(
      q,
      (snap) => {
        const d = snap.docs[0];
        setStaff(d ? { id: d.id, ...d.data() } : null);
        setLoading(false);
      },
      () => setLoading(false)
    );
  }, [uid, companyId, branchId]);

  const staffId = user?.staffId || staff?.id;
  useEffect(() => {
    if (!staffId || !companyId || !branchId) return;
    return onSnapshot(
      doc(db, "companies", companyId, "branches", branchId, "staffPrivate", staffId),
      (snap) => setPriv(snap.exists() ? snap.data() : {}),
      () => setPriv({})
    );
  }, [staffId, companyId, branchId]);

  return { staff, priv, loading };
}

/** Their payslips, newest first (copies written when payroll is finalized). */
export function useMyPayslips(user, staffId) {
  const [slips, setSlips] = useState(null);
  const { companyId, branchId } = user || {};
  useEffect(() => {
    if (!staffId || !companyId || !branchId) return;
    return onSnapshot(
      collection(db, "companies", companyId, "branches", branchId, "staffPrivate", staffId, "payslips"),
      (snap) => setSlips(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort(byPeriodDesc)),
      () => setSlips([])
    );
  }, [staffId, companyId, branchId]);
  return { slips: slips || [], loading: slips === null };
}

// Only money advances count as owed — leave used to live in the same
// collection. "personal" is the staff form's salary advance; "salary" and
// "emergency" come from the office.
const MONEY_ADVANCE_TYPES = ["personal", "salary", "emergency"];

/**
 * This pay period so far: hours, OT, pay earned (or the fixed salary), lateness,
 * early OT waiting for approval — the same engine as payroll — and what they owe.
 */
export function useMyWork(user, publicStaff, priv) {
  // Pay rates live in the private half (lib/staff/private.js)
  const staff = useMemo(() => (publicStaff ? { ...publicStaff, ...(priv || {}) } : null), [publicStaff, priv]);
  const period = useMemo(() => {
    if (!staff) return null;
    const now = new Date();
    const type = staff.attendancePeriod || "monthly";
    let start;
    if (type === "weekly") {
      const day = now.getDay(); // 0 = Sun
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (day === 0 ? 6 : day - 1));
    } else {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    start.setHours(0, 0, 0, 0);
    return { start, startStr: toLocalDateStr(start), type };
  }, [staff]);

  const skip = !user?.companyId || !user?.branchId;
  const where_ = skip ? null : { companyId: user.companyId, branchId: user.branchId };
  const staffId = user?.staffId || staff?.id;

  const { data: branchSettings } = useGetBranchSettingsQuery(where_ || skipToken);
  const attendanceSettings = useMemo(() => branchSettings?.attendance || {}, [branchSettings]);

  // From a day before the period (overnight shifts) up to today
  const todayStr = toLocalDateStr(new Date());
  const bufStartStr = period ? toLocalDateStr(new Date(period.start.getTime() - 86400000)) : null;
  const canAttendance = !skip && !!period && !!user?.staffId && !staff?.fixedSalaryNoAttendance;
  const { data: punches = [], isLoading: punchesLoading } = useGetBranchAttendanceByPeriodQuery(
    canAttendance ? { ...where_, staffId: user.staffId, startDate: bufStartStr, endDate: todayStr } : skipToken
  );
  const otEnabled = canAttendance && shiftsEnabled(attendanceSettings);
  const { data: otRequests = [] } = useGetOtRequestsQuery(
    otEnabled ? { ...where_, staffId: user.staffId, startDate: bufStartStr, endDate: todayStr } : skipToken
  );

  const mine = { uid: user?.uid, staffId };
  const { data: loans = [] } = useGetStaffLoansQuery(where_ ? { ...where_, mine } : skipToken);
  const { data: advances = [] } = useGetAdvanceEntriesQuery(where_ ? { ...where_, mine } : skipToken);

  const stats = useMemo(() => {
    const base = { isFixed: false, basicHours: 0, otHours: 0, earnings: 0, loanDebt: 0, advanceDebt: 0, lateDays: 0, lateMinutes: 0, pendingOtDays: 0, daysWorked: 0 };
    if (!staff) return base;
    const loanDebt = loans.filter((l) => l.staffId === staff.id && l.status !== "closed").reduce((s, l) => s + (l.remainingAmount || 0), 0);
    const advanceDebt = advances
      .filter((a) => (a.staffId === staff.id || a.createdBy?.uid === user?.uid) && a.status === "approved" && MONEY_ADVANCE_TYPES.includes(a.advanceType))
      .reduce((s, a) => s + (a.remainingAmount ?? a.amount ?? 0), 0);
    if (staff.fixedSalaryNoAttendance) return { ...base, isFixed: true, earnings: Number(staff.basicSalary) || 0, loanDebt, advanceDebt };
    if (!period) return { ...base, loanDebt, advanceDebt };

    const otApprovals = {};
    otRequests.filter((r) => r.staffId === staff.id).forEach((r) => { if (r.date) otApprovals[r.date] = r.status; });
    const { days } = computeAttendance({ punches: punches.filter((p) => p.staffId === staff.id), staff, settings: attendanceSettings, otApprovals });
    const inPeriod = days.filter((d) => d.date >= period.startStr);
    const basicHours = inPeriod.reduce((s, d) => s + d.basic, 0);
    const otHours = inPeriod.reduce((s, d) => s + d.ot, 0);
    return {
      isFixed: false,
      basicHours,
      otHours,
      earnings: basicHours * (Number(staff.basicPerHour) || 0) + otHours * (Number(staff.OTPerHour) || 0),
      loanDebt,
      advanceDebt,
      daysWorked: inPeriod.filter((d) => d.basic + d.ot > 0).length,
      lateDays: inPeriod.filter((d) => d.lateMinutes > 0).length,
      lateMinutes: inPeriod.reduce((s, d) => s + d.lateMinutes, 0),
      pendingOtDays: inPeriod.filter((d) => d.otApproval === "pending").length,
    };
  }, [staff, period, punches, attendanceSettings, otRequests, loans, advances, user?.uid]);

  return { period, stats, loading: !staff || (canAttendance && punchesLoading) };
}
