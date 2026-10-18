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
              <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 space-y-3 text-left">
                <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5"><Building className="w-4 h-4 text-mint-600" /> Employer Details (Letterhead)</h3>
                
                {/* Logo Upload */}
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Company Logo</label>
                  {logo ? (
                    <div className="flex items-center gap-3 p-2 bg-white border border-slate-100 rounded-lg">
                      
                      <img src={logo} alt="Logo" className="h-10 w-16 object-contain border rounded bg-slate-50" />
                      <button 
                        onClick={() => setLogo(null)}
                        className="text-xs font-semibold text-red-500 hover:text-red-600 flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Remove Logo
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center border border-dashed border-slate-200 bg-white rounded-xl p-3 hover:bg-slate-50 transition-colors cursor-pointer group">
                      <Upload className="w-4.5 h-4.5 text-slate-400 group-hover:text-mint-600 mb-1" />
                      <span className="text-xs font-medium text-slate-600">Upload corporate logo</span>
                      <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                    </label>
                  )}
                </div>

                <input 
                  type="text" 
                  className="w-full text-xs font-medium border border-slate-200 p-2.5 rounded-lg text-black bg-white focus:ring-2 focus:ring-mint-500/10 focus:border-mint-500 outline-none" 
                  placeholder="Company Name" 
                  value={companyDetails.name} 
                  onChange={(e) => setCompanyDetails({...companyDetails, name: e.target.value})} 
                />
                <input 
                  type="text" 
                  className="w-full text-xs font-medium border border-slate-200 p-2.5 rounded-lg text-black bg-white focus:ring-2 focus:ring-mint-500/10 focus:border-mint-500 outline-none" 
                  placeholder="Registration No." 
                  value={companyDetails.registrationNo} 
                  onChange={(e) => setCompanyDetails({...companyDetails, registrationNo: e.target.value})} 
                />
                <input 
                  type="text" 
                  className="w-full text-xs font-medium border border-slate-200 p-2.5 rounded-lg text-black bg-white focus:ring-2 focus:ring-mint-500/10 focus:border-mint-500 outline-none" 
                  placeholder="Address Line 1" 
                  value={companyDetails.addressLine1} 
                  onChange={(e) => setCompanyDetails({...companyDetails, addressLine1: e.target.value})} 
                />
                <input 
                  type="text" 
                  className="w-full text-xs font-medium border border-slate-200 p-2.5 rounded-lg text-black bg-white focus:ring-2 focus:ring-mint-500/10 focus:border-mint-500 outline-none" 
                  placeholder="Address Line 2" 
                  value={companyDetails.addressLine2} 
                  onChange={(e) => setCompanyDetails({...companyDetails, addressLine2: e.target.value})} 
                />
                <input 
                  type="text" 
                  className="w-full text-xs font-medium border border-slate-200 p-2.5 rounded-lg text-black bg-white focus:ring-2 focus:ring-mint-500/10 focus:border-mint-500 outline-none" 
                  placeholder="Contact details" 
                  value={companyDetails.phoneEmail} 
                  onChange={(e) => setCompanyDetails({...companyDetails, phoneEmail: e.target.value})} 
                />
              </div>

              {/* Employee Details Card */}
              <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 space-y-3 text-left">
                <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5"><User className="w-4 h-4 text-mint-600" /> Employee / Candidate Details</h3>
                <input 
                  type="text" 
                  className="w-full text-xs font-medium border border-slate-200 p-2.5 rounded-lg text-black bg-white focus:ring-2 focus:ring-mint-500/10 focus:border-mint-500 outline-none" 
                  placeholder="Full Name (as per IC / Passport)" 
                  value={employeeDetails.name} 
                  onChange={(e) => setEmployeeDetails({...employeeDetails, name: e.target.value})} 
                />
                <input 
                  type="text" 
                  className="w-full text-xs font-medium border border-slate-200 p-2.5 rounded-lg text-black bg-white focus:ring-2 focus:ring-mint-500/10 focus:border-mint-500 outline-none" 
                  placeholder="IC / Passport Number" 
                  value={employeeDetails.icPassport} 
                  onChange={(e) => setEmployeeDetails({...employeeDetails, icPassport: e.target.value})} 
                />
                <input 
                  type="text" 
                  className="w-full text-xs font-medium border border-slate-200 p-2.5 rounded-lg text-black bg-white focus:ring-2 focus:ring-mint-500/10 focus:border-mint-500 outline-none" 
                  placeholder="Residential Address Line 1" 
                  value={employeeDetails.addressLine1} 
                  onChange={(e) => setEmployeeDetails({...employeeDetails, addressLine1: e.target.value})} 
                />
                <input 
                  type="text" 
                  className="w-full text-xs font-medium border border-slate-200 p-2.5 rounded-lg text-black bg-white focus:ring-2 focus:ring-mint-500/10 focus:border-mint-500 outline-none" 
                  placeholder="Residential Address Line 2" 
                  value={employeeDetails.addressLine2} 
                  onChange={(e) => setEmployeeDetails({...employeeDetails, addressLine2: e.target.value})} 
                />
              </div>

              {/* Meta information */}
              <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 grid grid-cols-2 gap-3 text-left">
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Ref Number</label>
                  <input 
                    type="text" 
                    className="w-full text-xs font-medium border border-slate-200 p-2.5 rounded-lg text-black bg-white focus:ring-2 focus:ring-mint-500/10" 
                    value={letterMeta.refNo} 
                    onChange={(e) => setLetterMeta({...letterMeta, refNo: e.target.value})} 
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Letter Date</label>
                  <input 
                    type="text" 
                    className="w-full text-xs font-medium border border-slate-200 p-2.5 rounded-lg text-black bg-white focus:ring-2 focus:ring-mint-500/10" 
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
