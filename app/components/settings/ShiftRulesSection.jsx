/* eslint-disable react/prop-types */
"use client";
import React from "react";
import { FieldRow, NumberField, SectionCard, Toggle } from "./fields";
import {
  DEFAULT_EARLY_LEAVE_GRACE_MIN,
  DEFAULT_EARLY_OT_MIN,
} from "@/lib/attendance/shifts";

// Branch-level shift policy. The shift TIMES live on each staff record
// (Staff Management → Attendance); only the master switch and the grace
// thresholds are set here, because they apply to everyone.
export default function ShiftRulesSection({ value, patch, can }) {
  const v = value || {};

  return (
    <SectionCard
      title="Shift Rules"
      subtitle="Measure lateness and OT against each staff member's shift instead of a flat daily limit. Set a person's start and end times on their staff record."
    >
      <div className="space-y-5">
        <Toggle
          label="Enable Shift Times"
          checked={v.shiftsEnabled}
          onChange={(shiftsEnabled) => patch({ shiftsEnabled })}
          disabled={!can("shiftsEnabled")}
        />

        {v.shiftsEnabled && (
          <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm font-medium text-sky-800">
            Shift times are on. Set each person&apos;s Shift Start and Shift End in Staff
            Management → edit staff → Attendance. Anyone left blank keeps using their Basic
            Hours Per Day.
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FieldRow label="Early-OT Threshold (Min)" hint={`Default ${DEFAULT_EARLY_OT_MIN}`}>
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

        <ul className="space-y-1.5 text-xs font-medium text-slate-500">
          <li>• Arriving less than the threshold early → paid from shift start (no OT, not late).</li>
          <li>• Arriving at or beyond it → a pending Early-OT request in the Requested Panel; approved pays from the actual punch-in.</li>
          <li>• Arriving after shift start → paid from the actual punch-in and flagged late.</li>
          <li>• Leaving within the grace window → still paid the full shift; earlier than that → paid actual hours.</li>
          <li>• Staying past shift end → automatic OT, no approval needed.</li>
          <li>• A shift ending before it starts (e.g. 14:00 → 02:00) crosses midnight; set Day Cutoff Time above it.</li>
        </ul>
      </div>
    </SectionCard>
  );
}
