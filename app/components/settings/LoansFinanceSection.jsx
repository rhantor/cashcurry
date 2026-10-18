import React from "react";
import SettingsSection from "./SettingsSection";
import { FieldRow, NumberField, Toggle } from "./fields";
import { isCompanyRole } from "@/lib/authz/permissions";

export default function LoansFinanceSection({ role, value, onChange, requests, onRequestsChange }) {
  const v = value || {};
  const patch = (p) => onChange({ ...v, ...p });

  return (
    <SettingsSection role={role} sectionKey="loansFinance">
      {(can) => (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <FieldRow label="Inter-Branch Loans">
            <Toggle
              checked={!!v.allowInterBranchLoans}
              onChange={(allowInterBranchLoans) =>
                patch({ allowInterBranchLoans })
              }
              disabled={!can("allowInterBranchLoans")}
            />
          </FieldRow>
          <FieldRow label="Max Loan Limit (RM)">
            <NumberField
              value={v.maxLoanLimit ?? 0}
              onChange={(maxLoanLimit) => patch({ maxLoanLimit })}
              disabled={!can("maxLoanLimit")}
            />
          </FieldRow>
          <FieldRow label="Salary Advance Limit %">
            <NumberField
              value={v.salaryAdvanceLimitPercent ?? 0}
              onChange={(salaryAdvanceLimitPercent) =>
                patch({ salaryAdvanceLimitPercent })
              }
              disabled={!can("salaryAdvanceLimitPercent")}
            />
          </FieldRow>
          {/* the requests engine (lib/requests/model.js): over this, an advance or
              staff loan needs the owner's approval after the branch's. Only a
              company role may change it (firestore.rules keepsApprovalLimit). */}
          <FieldRow label="Owner approves above" hint="0 = branch approval is enough">
            <NumberField
              value={requests?.ownerApprovalAbove ?? 0}
              onChange={(ownerApprovalAbove) => onRequestsChange?.({ ...(requests || {}), ownerApprovalAbove: Math.max(0, ownerApprovalAbove || 0) })}
              disabled={!isCompanyRole(role) || !onRequestsChange}
            />
          </FieldRow>
        </div>
      )}
    </SettingsSection>
  );
}
