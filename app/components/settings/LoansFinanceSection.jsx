import React from "react";
import SettingsSection from "./SettingsSection";
import { FieldRow, NumberField, Toggle } from "./fields";

export default function LoansFinanceSection({ role, value, onChange }) {
  const v = value || {};
  const patch = (p) => onChange({ ...v, ...p });

  return (
    <SettingsSection role={role} sectionKey="loansFinance">
      {(can) => (
        <div className="grid gap-3 sm:grid-cols-3">
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
        </div>
      )}
    </SettingsSection>
  );
}
