"use client";

import React from "react";
import { Upload, Trash2, Building, User, PenTool, FileCheck } from "lucide-react";
import { useLetter } from "../LetterContext";

export default function SignaturesPanel() {
  const { activeTab, stamp, setStamp, signatory, setSignatory, signatorySignature, setSignatorySignature, employeeSignature, setEmployeeSignature, handleStampUpload, openSignaturePad } = useLetter();
  return (
    <>
          {/* TAB: SIGNATURES & STAMP */}
          {activeTab === "signatures" && (
            <div className="space-y-4">
              
              {/* Authorized Signatory Details */}
              <div className="bg-surface-2/60/50 p-4 rounded-xl border border-line space-y-3 text-left">
                <h3 className="text-xs font-bold text-fg flex items-center gap-1.5"><FileCheck className="w-4 h-4 text-brand" /> Employer Sign-Off Details</h3>
                
                <input 
                  type="text" 
                  className="w-full text-xs font-medium border border-line p-2.5 rounded-lg text-fg bg-surface focus:ring-2" 
                  placeholder="Manager's Full Name" 
                  value={signatory.name} 
                  onChange={(e) => setSignatory({...signatory, name: e.target.value})} 
                />
                <input 
                  type="text" 
                  className="w-full text-xs font-medium border border-line p-2.5 rounded-lg text-fg bg-surface focus:ring-2" 
                  placeholder="Designation (e.g. HR Director)" 
                  value={signatory.title} 
                  onChange={(e) => setSignatory({...signatory, title: e.target.value})} 
                />

                {/* Draw Signatory Signature */}
                <div className="pt-2">
                  <label className="block text-[9px] font-bold text-subtle uppercase mb-1">Employer Signature (Digital)</label>
                  {signatorySignature ? (
                    <div className="flex items-center gap-3 p-2 bg-surface border border-line rounded-lg">
                      
                      <img src={signatorySignature} alt="Employer Sign" className="h-10 w-24 object-contain border rounded bg-surface-2/60" />
                      <button 
                        onClick={() => setSignatorySignature(null)}
                        className="text-xs font-semibold text-danger hover:text-danger flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Remove
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => openSignaturePad("signatory")}
                      className="w-full py-2 bg-surface border border-dashed border-line hover:bg-brand-soft hover:text-brand text-muted text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <PenTool className="w-4 h-4" /> Draw Digital Signature
                    </button>
                  )}
                </div>
              </div>

              {/* Employee Signature Details */}
              <div className="bg-surface-2/60/50 p-4 rounded-xl border border-line space-y-3 text-left">
                <h3 className="text-xs font-bold text-fg flex items-center gap-1.5"><User className="w-4 h-4 text-brand" /> Employee Signature (Digital)</h3>
                <p className="text-[10px] text-subtle font-medium leading-normal">
                  If the candidate is signing in person (e.g. at a branch kiosk), they can sign directly on screen to be embedded into the contract immediately.
                </p>
                
                {employeeSignature ? (
                  <div className="flex items-center gap-3 p-2 bg-surface border border-line rounded-lg">
                    
                    <img src={employeeSignature} alt="Employee Sign" className="h-10 w-24 object-contain border rounded bg-surface-2/60" />
                    <button 
                      onClick={() => setEmployeeSignature(null)}
                      className="text-xs font-semibold text-danger hover:text-danger flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Remove
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => openSignaturePad("employee")}
                    className="w-full py-2 bg-surface border border-dashed border-line hover:bg-brand-soft hover:text-brand text-muted text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <PenTool className="w-4 h-4" /> Candidate Sign Here
                  </button>
                )}
              </div>

              {/* Corporate Stamp / Seal Upload */}
              <div className="bg-surface-2/60/50 p-4 rounded-xl border border-line space-y-3 text-left">
                <h3 className="text-xs font-bold text-fg flex items-center gap-1.5"><Building className="w-4 h-4 text-brand" /> Official Corporate Stamp / Seal</h3>
                <p className="text-[10px] text-subtle font-medium leading-normal">
                  Upload a transparent PNG stamp or seal image. It will be stamped over the employer signature block with a realistic offset.
                </p>

                {stamp ? (
                  <div className="flex items-center gap-3 p-2 bg-surface border border-line rounded-lg">
                    
                    <img src={stamp} alt="Corporate Stamp" className="h-12 w-12 object-contain border rounded bg-surface-2/60" />
                    <button 
                      onClick={() => setStamp(null)}
                      className="text-xs font-semibold text-danger hover:text-danger flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Remove Stamp
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center border border-dashed border-line bg-surface rounded-xl p-3 hover:bg-surface-2 transition-colors cursor-pointer group">
                    <Upload className="w-4.5 h-4.5 text-subtle group-hover:text-brand mb-1" />
                    <span className="text-xs font-medium text-muted">Upload corporate stamp image</span>
                    <input type="file" accept="image/*" onChange={handleStampUpload} className="hidden" />
                  </label>
                )}
              </div>
            </div>
          )}
    </>
  );
}
