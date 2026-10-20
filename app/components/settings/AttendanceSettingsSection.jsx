"use client";
import React, { useState, useEffect } from "react";
import SettingsSection from "./SettingsSection";
import { FieldRow, TextField, NumberField, Toggle, SectionCard } from "./fields";
import ShiftRulesSection from "./ShiftRulesSection";
import { useGetStaffListQuery, useUpdateStaffMutation } from "@/lib/redux/api/staffApiSlice";
import { registerBiometric, isBiometricAvailable } from "@/lib/attendance/biometric";
import { Fingerprint, CheckCircle2, ShieldAlert, Loader2 } from "lucide-react";
import { toast } from "@/app/components/ui/notify";

export default function AttendanceSettingsSection({ role, companyId, branchId, value, onChange }) {
  const v = value || {};
  const patch = (p) => onChange({ ...v, ...p });

  const { data: staffList = [], isLoading: loadingStaff } = useGetStaffListQuery(
    companyId && branchId ? { companyId, branchId } : { skip: true }
  );
  const [updateStaff] = useUpdateStaffMutation();

  const [biometricSupported, setBiometricSupported] = useState(false);
  const [enrollStatus, setEnrollStatus] = useState({}); // { staffId: 'idle' | 'loading' | 'success' | 'error' }

  useEffect(() => {
    isBiometricAvailable().then(setBiometricSupported);
  }, []);

  const handleEnroll = async (staff) => {
    setEnrollStatus(prev => ({ ...prev, [staff.id]: 'loading' }));
    try {
      const result = await registerBiometric(`${staff.firstName} ${staff.lastName}`, staff.id);
      
      await updateStaff({
        companyId,
        branchId,
        staffId: staff.id,
        data: {
          biometric: result,
          updatedAt: new Date().toISOString()
        }
      }).unwrap();

      setEnrollStatus(prev => ({ ...prev, [staff.id]: 'success' }));
    } catch (err) {
      console.error(err);
      setEnrollStatus(prev => ({ ...prev, [staff.id]: 'error' }));
      toast.error(err.message || "Enrollment failed. Make sure your device supports biometrics.");
    } finally {
      setTimeout(() => {
        setEnrollStatus(prev => ({ ...prev, [staff.id]: 'idle' }));
      }, 3000);
    }
  };

  return (
    <div className="space-y-8">
      <SettingsSection role={role} sectionKey="attendance">
        {(can) => (
          <div className="space-y-6">
            {/* Cycle & Reporting */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <SectionCard title="Pay Cycle & Reports" subtitle="Define your attendance periods and report styles.">
                <div className="space-y-4 mt-4">
                  <FieldRow label="Pay Period Start Date" hint="Day of the month (1-31)">
                    <NumberField
                      value={v.payPeriodStart}
                      onChange={(payPeriodStart) => patch({ payPeriodStart })}
                      disabled={!can("payPeriodStart")}
                    />
                  </FieldRow>
                  <FieldRow label="Start Day of Week">
                    <select
                      value={v.startDayOfWeek || "Monday"}
                      onChange={(e) => patch({ startDayOfWeek: e.target.value })}
                      disabled={!can("startDayOfWeek")}
                      className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-fg"
                    >
                      {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </FieldRow>
                  <FieldRow label="Hours Format">
                    <select
                      value={v.hoursFormat || "decimal"}
                      onChange={(e) => patch({ hoursFormat: e.target.value })}
                      disabled={!can("hoursFormat")}
                      className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-fg"
                    >
                      <option value="decimal">Decimal (e.g. 8.5h)</option>
                      <option value="hhmm">HH:mm (e.g. 08:30)</option>
                    </select>
                  </FieldRow>
                </div>
              </SectionCard>

              <SectionCard title="Punch Rules" subtitle="Logic for validating and processing punches.">
                <div className="space-y-4 mt-4">
                  <FieldRow label="Day Cutoff Time" hint="When the business day ends (e.g. 05:00) — also used for sales, costs and the POS">
                    <TextField
                      type="time"
                      value={v.dayCutoffTime}
                      onChange={(dayCutoffTime) => patch({ dayCutoffTime })}
                      disabled={!can("dayCutoffTime")}
                    />
                  </FieldRow>
                  <FieldRow label="Duplicate Interval (Min)" hint="Ignore punches within X minutes">
                    <NumberField
                      value={v.duplicatePunchInterval}
                      onChange={(duplicatePunchInterval) => patch({ duplicatePunchInterval })}
                      disabled={!can("duplicatePunchInterval")}
                    />
                  </FieldRow>
                  <FieldRow label="Max Work Hours / Day">
                    <NumberField
                      value={v.maxWorkHoursPerDay}
                      onChange={(maxWorkHoursPerDay) => patch({ maxWorkHoursPerDay })}
                      disabled={!can("maxWorkHoursPerDay")}
                    />
                  </FieldRow>
                </div>
              </SectionCard>
            </div>

            {/* Shift rules (opt-in; times live on each staff record) */}
            <ShiftRulesSection value={v} patch={patch} can={can} />

            {/* Kiosk Mode Toggles */}
            <SectionCard title="Kiosk Interaction" subtitle="Enable/disable verification methods.">
              <div className="flex flex-wrap gap-8 mt-4">
                <Toggle
                  label="Enable Biometric (Fingerprint)"
                  checked={v.useBiometrics}
                  onChange={(useBiometrics) => patch({ useBiometrics })}
                  disabled={!can("useBiometrics")}
                />
                <Toggle
                  label="Require Camera Snapshot"
                  checked={v.useCamera}
                  onChange={(useCamera) => patch({ useCamera })}
                  disabled={!can("useCamera")}
                />
              </div>
              {!biometricSupported && v.useBiometrics && (
                <div className="mt-4 p-3 bg-warning-soft border border-warning/30 rounded-xl flex items-center gap-3 text-warning text-sm font-medium">
                  <ShieldAlert size={18} />
                  Biometrics are enabled, but this browser/device does not seem to support them.
                </div>
              )}
            </SectionCard>
          </div>
        )}
      </SettingsSection>

      {/* Staff Biometric Enrollment */}
      <div className="bg-surface rounded-3xl border border-line overflow-hidden shadow-sm">
        <div className="p-6 border-b border-line flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-fg">Staff Biometric Enrollment</h3>
            <p className="text-sm text-muted">Supervisors: Register staff fingerprints here for kiosk use.</p>
          </div>
          <Fingerprint className="text-indigo-500" size={28} />
        </div>

        <div className="divide-y divide-line">
          {Object.values(enrollStatus).includes('loading') && (
            <div className="p-3 bg-info-soft text-info text-xs font-bold text-center animate-pulse">
              Please follow the prompt on your device to scan the fingerprint...
            </div>
          )}
          {loadingStaff ? (
            <div className="p-10 text-center text-subtle">Loading staff list...</div>
          ) : staffList.length === 0 ? (
            <div className="p-10 text-center text-subtle">No staff found in this branch.</div>
          ) : (
            staffList.map((staff) => {
              const status = enrollStatus[staff.id] || 'idle';
              const isEnrolled = !!staff.biometric?.credentialId;

              return (
                <div key={staff.id} className="p-4 flex items-center justify-between hover:bg-surface-2 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center font-bold text-muted overflow-hidden">
                      {staff.photoUrl ? (
                        <img src={staff.photoUrl} className="w-full h-full object-cover" alt="" />
                      ) : (
                        <>{staff.firstName?.[0]}{staff.lastName?.[0]}</>
                      )}
                    </div>
                    <div>
                      <div className="font-bold text-fg">{staff.firstName} {staff.lastName}</div>
                      <div className="text-xs text-subtle font-medium uppercase">{staff.role || "Staff"}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {isEnrolled ? (
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-soft text-brand text-xs font-bold border border-green-100">
                        <CheckCircle2 size={14} /> Registered
                      </div>
                    ) : (
                      <div className="text-xs text-subtle font-medium italic">Not Enrolled</div>
                    )}

                    <button
                      onClick={() => handleEnroll(staff)}
                      disabled={status === 'loading'}
                      className={`min-w-[120px] px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2
                        ${status === 'loading' ? 'bg-surface-2 text-subtle' : 
                          isEnrolled ? 'bg-info-soft text-info hover:bg-info-soft' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-200'}
                      `}
                    >
                      {status === 'loading' ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          Scanning...
                        </>
                      ) : 
                       isEnrolled ? "Re-enroll" : "Enroll Finger"}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
