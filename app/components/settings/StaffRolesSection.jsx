/* eslint-disable react/prop-types */
import React from "react";
import SettingsSection from "./SettingsSection";
import { FieldRow, TextField } from "./fields";

export default function StaffRolesSection({ role, value, onChange }) {
  const v = value || {};
  const patch = (p) => onChange({ ...v, ...p });

  return (
    <SettingsSection role={role} sectionKey="staffRoles">
      {(can) => (
        <div className="grid grid-cols-2 gap-3">
          <FieldRow label="Manager User ID">
            <TextField
              value={v.managerUserId || ""}
              onChange={(managerUserId) => patch({ managerUserId })}
              disabled={!can("managerUserId")}
            />
          </FieldRow>
          <FieldRow label="Allowed Roles (comma)">
            <TextField
              value={(v.allowedRoles || []).join(", ")}
              onChange={(s) =>
                patch({
                  allowedRoles: s
                    .split(",")
                    .map((x) => x.trim())
                    .filter(Boolean),
                })
              }
              disabled={!can("allowedRoles")}
            />
          </FieldRow>
        </div>
      )}
    </SettingsSection>
  );
}
