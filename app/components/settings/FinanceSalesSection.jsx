/* eslint-disable react/prop-types */
import React from "react";
import { Lock } from "lucide-react"; // Make sure you have lucide-react, or use a text emoji 🔒
import SettingsSection from "./SettingsSection";
import { FieldRow, NumberField, TextField } from "./fields";
import TendersEditor from "./TendersEditor";

export default function FinanceSalesSection({ role, value, onChange }) {
  const v = value || {};
  const tax = v.tax || {};
  const deposit = v.depositDefaults || {};

  const patch = (p) => onChange({ ...v, ...p });
  const patchTax = (p) => onChange({ ...v, tax: { ...tax, ...p } });
  const patchDep = (p) =>
    onChange({ ...v, depositDefaults: { ...deposit, ...p } });

  // Permission: Only Admin and Accountant can edit Opening Balance
  const canEditBalance = role === "branchAdmin" || role === "accountant";

  return (
    <SettingsSection role={role} sectionKey="financeSales">
      {(can) => (
        <div className="space-y-8">
          {/* --- Financial Configuration Blocks --- */}
          <div className="space-y-6">
            
            {/* Core Financials */}
            <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-4">
              <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider mb-2">Core Settings</h3>
              
              <FieldRow
                label={
                  <span className="flex items-center gap-1.5">
                    Opening Cash Balance
                    {!canEditBalance && <Lock size={12} className="text-amber-500" />}
                  </span>
                }
                hint={canEditBalance ? "Starting cash in hand" : "Restricted: Admin/Accountant only"}
              >
                <div className={!canEditBalance ? "opacity-60 cursor-not-allowed" : ""}>
                  <NumberField
                    value={v.openingBalance ?? 0}
                    onChange={(val) => patch({ openingBalance: val })}
                    disabled={!canEditBalance}
                    placeholder="0.00"
                  />
                </div>
              </FieldRow>

              <FieldRow
                label={
                  <span className="flex items-center gap-1.5">
                    Opening Bank Balance
                    {!canEditBalance && <Lock size={12} className="text-amber-500" />}
                  </span>
                }
                hint={canEditBalance ? "Starting bank account balance" : "Restricted: Admin/Accountant only"}
              >
                <div className={!canEditBalance ? "opacity-60 cursor-not-allowed" : ""}>
                  <NumberField
                    value={v.openingBankBalance ?? 0}
                    onChange={(val) => patch({ openingBankBalance: val })}
                    disabled={!canEditBalance}
                    placeholder="0.00"
                  />
                </div>
              </FieldRow>

              <FieldRow label="Currency" hint="3-letter code">
                <TextField
                  value={v.currency || "MYR"}
                  onChange={(currency) => patch({ currency })}
                  disabled={!can("currency")}
                />
              </FieldRow>
            </div>

            {/* Rates & Deposits */}
            <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-4">
               <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider mb-2">Rates & Banking</h3>
               
               <div className="space-y-4">
                 <FieldRow label="Tax %" hint="Storewide">
                   <NumberField
                     value={tax.rate ?? 0}
                     onChange={(rate) => patchTax({ rate })}
                     step={0.01}
                     disabled={!can("tax")}
                   />
                 </FieldRow>

                 <FieldRow label="Service Charge %" hint="Storewide">
                   <NumberField
                     value={v.serviceCharge ?? 0}
                     onChange={(serviceCharge) => patch({ serviceCharge })}
                     step={0.01}
                     disabled={!can("serviceCharge")}
                   />
                 </FieldRow>
               </div>

               <hr className="border-slate-100 my-2" />

               <div className="space-y-4">
                 <FieldRow label="Default Bank" hint="For Deposits">
                   <TextField
                     value={deposit.bankName || ""}
                     onChange={(bankName) => patchDep({ bankName })}
                     disabled={!can("depositDefaults")}
                     placeholder="e.g. Maybank"
                   />
                 </FieldRow>

                 <FieldRow label="Account Ref">
                   <TextField
                     value={deposit.accountRef || ""}
                     onChange={(accountRef) => patchDep({ accountRef })}
                     disabled={!can("depositDefaults")}
                     placeholder="e.g. 1234..."
                   />
                 </FieldRow>
               </div>
            </div>

          </div>

          <hr className="border-slate-100" />

          {/* --- Tenders Editor --- */}
          <div>
            <h3 className="text-sm font-medium text-slate-900 mb-3">Payment Methods (Tenders)</h3>
            <TendersEditor
              value={v.tenders || []}
              onChange={(tenders) => patch({ tenders })}
              can={(field) => can(field)}
            />
          </div>
        </div>
      )}
    </SettingsSection>
  );
}