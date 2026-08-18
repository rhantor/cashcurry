/* eslint-disable react/prop-types */
import React from "react";
import SettingsSection from "./SettingsSection";
import { FieldRow, Toggle } from "./fields";

export default function PurchasesSection({ role, value, onChange }) {
  const v = value || {};
  const patch = (p) => onChange({ ...v, ...p });

  return (
    <SettingsSection role={role} sectionKey="purchases">
      {(can) => (
        <div className="space-y-4">
          <FieldRow
            label="Require approval before sending a purchase order"
            hint="Owner, branch admin and manager can approve"
          >
            <Toggle
              checked={!!v.requirePoApproval}
              onChange={(requirePoApproval) => patch({ requirePoApproval })}
              disabled={!can("requirePoApproval")}
              label={v.requirePoApproval ? "On" : "Off"}
            />
          </FieldRow>

          <p className="text-sm text-slate-500 max-w-prose">
            {v.requirePoApproval
              ? "Orders are raised as Pending and must be approved before they can be sent to the vendor. Editing an approved order sends it back for approval."
              : "Orders can be sent to the vendor as soon as they are raised. Turn this on to add an Approve / Reject step in between."}
          </p>
        </div>
      )}
    </SettingsSection>
  );
}
