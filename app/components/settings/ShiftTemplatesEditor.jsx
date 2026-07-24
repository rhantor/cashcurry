/* eslint-disable react/prop-types */
"use client";
import React from "react";
import { Plus, Trash2, MoonStar, Clock } from "lucide-react";
import { FieldRow, NumberField, SectionCard, Toggle } from "./fields";
import {
  DEFAULT_EARLY_LEAVE_GRACE_MIN,
  DEFAULT_EARLY_OT_MIN,
  isOvernight,
  newShiftId,
  shiftWindow,
} from "@/lib/attendance/shifts";

// Branch-level shift templates. Staff pick one as their default shift in
// Staff Management → Attendance. Nothing here affects payroll until the
// "Enable Shift Templates" toggle is on.
export default function ShiftTemplatesEditor({ value, patch, can }) {
  const v = value || {};
  const shifts = Array.isArray(v.shifts) ? v.shifts : [];
  const editable = can("shifts");

  const setShifts = (next) => patch({ shifts: next });

  const updateShift = (id, changes) =>
    setShifts(shifts.map((s) => (s.id === id ? { ...s, ...changes } : s)));

  const addShift = () =>
    setShifts([
      ...shifts,
      {
        id: newShiftId(),
        name: `Shift ${shifts.length + 1}`,
        start: "09:00",
        end: "18:00",
        breakMinutes: 0,
        expectedHours: "",
      },
    ]);

  const removeShift = (id) => {
    if (!confirm("Remove this shift? Staff assigned to it fall back to their flat daily hours.")) return;
    setShifts(shifts.filter((s) => s.id !== id));
  };

  return (
    <SectionCard
      title="Shift Templates"
      subtitle="Named shifts (overnight supported). Lateness and OT are measured against the staff member's shift instead of a flat daily limit."
    >
      <div className="space-y-5">
        <Toggle
          label="Enable Shift Templates"
          checked={v.shiftsEnabled}
          onChange={(shiftsEnabled) => patch({ shiftsEnabled })}
          disabled={!can("shiftsEnabled")}
        />

        {v.shiftsEnabled && shifts.length === 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-700">
            Shift templates are on but no shift is defined yet — attendance still uses each staff
            member&apos;s Basic Hours Per Day until you add one.
          </div>
        )}

        <div className="space-y-3">
          {shifts.map((s) => {
            const win = shiftWindow("2000-01-01", s);
            const overnight = isOvernight(s);
            return (
              <div
                key={s.id}
                className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4"
              >
                <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                  <div className="md:col-span-2">
                    <FieldRow label="Shift Name">
                      <input
                        type="text"
                        value={s.name ?? ""}
                        onChange={(e) => updateShift(s.id, { name: e.target.value })}
                        disabled={!editable}
                        placeholder="Evening"
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-800 disabled:bg-slate-100"
                      />
                    </FieldRow>
                  </div>
                  <FieldRow label="Start">
                    <input
                      type="time"
                      value={s.start ?? ""}
                      onChange={(e) => updateShift(s.id, { start: e.target.value })}
                      disabled={!editable}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-800 disabled:bg-slate-100"
                    />
                  </FieldRow>
                  <FieldRow label="End">
                    <input
                      type="time"
                      value={s.end ?? ""}
                      onChange={(e) => updateShift(s.id, { end: e.target.value })}
                      disabled={!editable}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-800 disabled:bg-slate-100"
                    />
                  </FieldRow>
                  <div className="flex items-end justify-end">
                    <button
                      type="button"
                      onClick={() => removeShift(s.id)}
                      disabled={!editable}
                      className="mb-1 inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-40"
                    >
                      <Trash2 size={14} /> Remove
                    </button>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                  <FieldRow label="Unpaid Break (Min)" hint="Deducted from the shift length">
                    <NumberField
                      value={s.breakMinutes}
                      onChange={(breakMinutes) => updateShift(s.id, { breakMinutes })}
                      disabled={!editable}
                    />
                  </FieldRow>
                  <FieldRow label="Paid Hours Override" hint="Blank = shift length − break">
                    <NumberField
                      step={0.25}
                      value={s.expectedHours}
                      onChange={(expectedHours) => updateShift(s.id, { expectedHours })}
                      disabled={!editable}
                    />
                  </FieldRow>
                  <div className="flex items-end">
                    <div className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">
                      <Clock size={14} className="text-sky-500" />
                      {win ? (
                        <span>
                          {win.hours.toFixed(2)}h paid
                          {overnight && (
                            <span className="ml-2 inline-flex items-center gap-1 text-indigo-600">
                              <MoonStar size={13} /> overnight
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-red-500">Invalid times</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={addShift}
          disabled={!editable}
          className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-sky-700 disabled:opacity-40"
        >
          <Plus size={16} /> Add Shift
        </button>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h4 className="mb-3 text-sm font-bold text-slate-700">Grace &amp; Approval Rules</h4>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FieldRow
              label="Early-OT Threshold (Min)"
              hint={`Default ${DEFAULT_EARLY_OT_MIN}`}
            >
              <NumberField
                value={v.earlyOtMinutes}
                onChange={(earlyOtMinutes) => patch({ earlyOtMinutes })}
                disabled={!can("earlyOtMinutes")}
                placeholder={String(DEFAULT_EARLY_OT_MIN)}
              />
            </FieldRow>
            <FieldRow
              label="Early-Leave Grace (Min)"
              hint={`Default ${DEFAULT_EARLY_LEAVE_GRACE_MIN}`}
            >
              <NumberField
                value={v.earlyLeaveGraceMinutes}
                onChange={(earlyLeaveGraceMinutes) => patch({ earlyLeaveGraceMinutes })}
                disabled={!can("earlyLeaveGraceMinutes")}
                placeholder={String(DEFAULT_EARLY_LEAVE_GRACE_MIN)}
              />
            </FieldRow>
          </div>
          <ul className="mt-4 space-y-1.5 text-xs font-medium text-slate-500">
            <li>• Arriving less than the threshold early → paid from shift start (no OT, not late).</li>
            <li>• Arriving at or beyond it → a pending Early-OT request in the Requested Panel; approved pays from the actual punch-in.</li>
            <li>• Arriving after shift start → paid from the actual punch-in and flagged late.</li>
            <li>• Leaving within the grace window → still paid the full shift; earlier than that → paid actual hours.</li>
            <li>• Staying past shift end → automatic OT, no approval needed.</li>
          </ul>
        </div>
      </div>
    </SectionCard>
  );
}
