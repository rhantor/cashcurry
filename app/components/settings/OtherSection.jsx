/* eslint-disable react/prop-types */
import React from "react";  
import SettingsSection from "./SettingsSection";
import { FieldRow, TextField, Toggle } from "./fields";

export default function OtherSection({ role, value, onChange }) {
  const v = value || {};
  const theme = v.theme || {};
  const patch = (p) => onChange({ ...v, ...p });
  const patchTheme = (p) => onChange({ ...v, theme: { ...theme, ...p } });

  return (
    <SettingsSection role={role} sectionKey="other">
      {(can) => (
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-3">
            <FieldRow label="Notes">
              <textarea
                className="textarea textarea-bordered w-full"
                rows={3}
                value={v.notes || ""}
                onChange={(e) => patch({ notes: e.target.value })}
                disabled={!can("notes")}
              />
            </FieldRow>
          </div>
          <FieldRow label="Theme Primary">
            <TextField
              value={theme.primary || "#0ea5e9"}
              onChange={(primary) => patchTheme({ primary })}
              disabled={!can("theme")}
            />
          </FieldRow>
          <FieldRow label="Enable Branch">
            <Toggle
              checked={!!v.enabled}
              onChange={(enabled) => patch({ enabled })}
              disabled={!can("enabled")}
            />
          </FieldRow>
        </div>
      )}
    </SettingsSection>
  );
}
