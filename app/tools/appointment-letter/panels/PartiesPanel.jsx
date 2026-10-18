"use client";

import React from "react";
import { Upload, Trash2, Building, User } from "lucide-react";
import { useLetter } from "../LetterContext";

export default function PartiesPanel() {
  const { activeTab, logo, setLogo, companyDetails, setCompanyDetails, letterMeta, setLetterMeta, employeeDetails, setEmployeeDetails, handleLogoUpload } = useLetter();
  return (
    <>
          {/* TAB: PARTIES */}
          {activeTab === "parties" && (
            <div className="space-y-4">
              {/* Company Details Card */}
              <div className="bg-surface-2/60/50 p-4 rounded-xl border border-line space-y-3 text-left">
                <h3 className="text-xs font-bold text-fg flex items-center gap-1.5"><Building className="w-4 h-4 text-brand" /> Employer Details (Letterhead)</h3>
                
                {/* Logo Upload */}
                <div>
                  <label className="block text-[9px] font-bold text-subtle uppercase mb-1">Company Logo</label>
                  {logo ? (
                    <div className="flex items-center gap-3 p-2 bg-surface border border-line rounded-lg">
                      
                      <img src={logo} alt="Logo" className="h-10 w-16 object-contain border rounded bg-surface-2/60" />
                      <button 
                        onClick={() => setLogo(null)}
                        className="text-xs font-semibold text-danger hover:text-danger flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Remove Logo
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center border border-dashed border-line bg-surface rounded-xl p-3 hover:bg-surface-2 transition-colors cursor-pointer group">
                      <Upload className="w-4.5 h-4.5 text-subtle group-hover:text-brand mb-1" />
                      <span className="text-xs font-medium text-muted">Upload corporate logo</span>
                      <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                    </label>
                  )}
                </div>

                <input 
                  type="text" 
                  className="w-full text-xs font-medium border border-line p-2.5 rounded-lg text-fg bg-surface focus:ring-2 focus:ring-[var(--cc-ring)]/10 focus:border-brand outline-none" 
                  placeholder="Company Name" 
                  value={companyDetails.name} 
                  onChange={(e) => setCompanyDetails({...companyDetails, name: e.target.value})} 
                />
                <input 
                  type="text" 
                  className="w-full text-xs font-medium border border-line p-2.5 rounded-lg text-fg bg-surface focus:ring-2 focus:ring-[var(--cc-ring)]/10 focus:border-brand outline-none" 
                  placeholder="Registration No." 
                  value={companyDetails.registrationNo} 
                  onChange={(e) => setCompanyDetails({...companyDetails, registrationNo: e.target.value})} 
                />
                <input 
                  type="text" 
                  className="w-full text-xs font-medium border border-line p-2.5 rounded-lg text-fg bg-surface focus:ring-2 focus:ring-[var(--cc-ring)]/10 focus:border-brand outline-none" 
                  placeholder="Address Line 1" 
                  value={companyDetails.addressLine1} 
                  onChange={(e) => setCompanyDetails({...companyDetails, addressLine1: e.target.value})} 
                />
                <input 
                  type="text" 
                  className="w-full text-xs font-medium border border-line p-2.5 rounded-lg text-fg bg-surface focus:ring-2 focus:ring-[var(--cc-ring)]/10 focus:border-brand outline-none" 
                  placeholder="Address Line 2" 
                  value={companyDetails.addressLine2} 
                  onChange={(e) => setCompanyDetails({...companyDetails, addressLine2: e.target.value})} 
                />
                <input 
                  type="text" 
                  className="w-full text-xs font-medium border border-line p-2.5 rounded-lg text-fg bg-surface focus:ring-2 focus:ring-[var(--cc-ring)]/10 focus:border-brand outline-none" 
                  placeholder="Contact details" 
                  value={companyDetails.phoneEmail} 
                  onChange={(e) => setCompanyDetails({...companyDetails, phoneEmail: e.target.value})} 
                />
              </div>

              {/* Employee Details Card */}
              <div className="bg-surface-2/60/50 p-4 rounded-xl border border-line space-y-3 text-left">
                <h3 className="text-xs font-bold text-fg flex items-center gap-1.5"><User className="w-4 h-4 text-brand" /> Employee / Candidate Details</h3>
                <input 
                  type="text" 
                  className="w-full text-xs font-medium border border-line p-2.5 rounded-lg text-fg bg-surface focus:ring-2 focus:ring-[var(--cc-ring)]/10 focus:border-brand outline-none" 
                  placeholder="Full Name (as per IC / Passport)" 
                  value={employeeDetails.name} 
                  onChange={(e) => setEmployeeDetails({...employeeDetails, name: e.target.value})} 
                />
                <input 
                  type="text" 
                  className="w-full text-xs font-medium border border-line p-2.5 rounded-lg text-fg bg-surface focus:ring-2 focus:ring-[var(--cc-ring)]/10 focus:border-brand outline-none" 
                  placeholder="IC / Passport Number" 
                  value={employeeDetails.icPassport} 
                  onChange={(e) => setEmployeeDetails({...employeeDetails, icPassport: e.target.value})} 
                />
                <input 
                  type="text" 
                  className="w-full text-xs font-medium border border-line p-2.5 rounded-lg text-fg bg-surface focus:ring-2 focus:ring-[var(--cc-ring)]/10 focus:border-brand outline-none" 
                  placeholder="Residential Address Line 1" 
                  value={employeeDetails.addressLine1} 
                  onChange={(e) => setEmployeeDetails({...employeeDetails, addressLine1: e.target.value})} 
                />
                <input 
                  type="text" 
                  className="w-full text-xs font-medium border border-line p-2.5 rounded-lg text-fg bg-surface focus:ring-2 focus:ring-[var(--cc-ring)]/10 focus:border-brand outline-none" 
                  placeholder="Residential Address Line 2" 
                  value={employeeDetails.addressLine2} 
                  onChange={(e) => setEmployeeDetails({...employeeDetails, addressLine2: e.target.value})} 
                />
              </div>

              {/* Meta information */}
              <div className="bg-surface-2/60/50 p-4 rounded-xl border border-line grid grid-cols-2 gap-3 text-left">
                <div>
                  <label className="block text-[9px] font-bold text-subtle uppercase mb-1">Ref Number</label>
                  <input 
                    type="text" 
                    className="w-full text-xs font-medium border border-line p-2.5 rounded-lg text-fg bg-surface focus:ring-2 focus:ring-[var(--cc-ring)]/10" 
                    value={letterMeta.refNo} 
                    onChange={(e) => setLetterMeta({...letterMeta, refNo: e.target.value})} 
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-subtle uppercase mb-1">Letter Date</label>
                  <input 
                    type="text" 
                    className="w-full text-xs font-medium border border-line p-2.5 rounded-lg text-fg bg-surface focus:ring-2 focus:ring-[var(--cc-ring)]/10" 
                    value={letterMeta.date} 
                    onChange={(e) => setLetterMeta({...letterMeta, date: e.target.value})} 
                  />
                </div>
              </div>
            </div>
          )}
    </>
  );
}
