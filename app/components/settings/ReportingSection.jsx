/* eslint-disable react/prop-types */
import React from "react";
import SettingsSection from "./SettingsSection";
import { FieldRow, TextField } from "./fields";

export default function ReportingSection({ role, value, onChange }) {
  const v = value || {};
  const patch = (p) => onChange({ ...v, ...p });

  return (
    <SettingsSection role={role} sectionKey="reporting">
      {(can) => (
        <div className="grid grid-cols-3 gap-3">
          <FieldRow label="Dashboard Mode">
            <select
              className="select select-bordered w-full"
              value={v.defaultDashboardMode || "front"}
              onChange={(e) => patch({ defaultDashboardMode: e.target.value })}
              disabled={!can("defaultDashboardMode")}
            >
              <option value="front">Front</option>
              <option value="back">Back</option>
              <option value="all">All</option>
            </select>
          </FieldRow>

          <FieldRow label="Summary Default Filter">
            <select
              className="select select-bordered w-full"
              value={v.defaultSummaryFilter || "thisMonth"}
              onChange={(e) => patch({ defaultSummaryFilter: e.target.value })}
              disabled={!can("defaultSummaryFilter")}
            >
              <option value="last7days">Last 7 Days</option>
              <option value="thisWeek">This Week</option>
              <option value="lastWeek">Last Week</option>
              <option value="thisMonth">This Month</option>
              <option value="lastMonth">Last Month</option>
              <option value="custom">Custom</option>
            </select>
          </FieldRow>

          <FieldRow label="Banked vs Cash Rule">
            <TextField
              value={v.bankedVsCashRule || "standard"}
              onChange={(bankedVsCashRule) => patch({ bankedVsCashRule })}
              disabled={!can("bankedVsCashRule")}
            />
          </FieldRow>
        </div>
      )}
    </SettingsSection>
  );
}
