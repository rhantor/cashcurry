"use client";

import React from "react";
import { Trash2, Plus, Briefcase, DollarSign } from "lucide-react";
import { useLetter } from "../LetterContext";
import { ROLES } from "@/app/staff-management/lib/constants";

export default function TermsPanel() {
  const { activeTab, templateType, jobTerms, setJobTerms, allowances, handleAllowanceChange, addAllowance, removeAllowance } = useLetter();
  return (
    <>
          {/* TAB: TERMS & SALARY */}
          {activeTab === "terms" && (
            <div className="space-y-4">
              
              {/* Job Terms Card */}
              <div className="bg-surface-2/60/50 p-4 rounded-xl border border-line space-y-3 text-left">
                <h3 className="text-xs font-bold text-fg flex items-center gap-1.5"><Briefcase className="w-4 h-4 text-brand" /> Position & Service Details</h3>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9px] font-bold text-subtle uppercase mb-1">Job Title</label>
                    {/* the restaurant's jobs (as in Staff management) to pick, or any title typed in */}
                    <input 
                      type="text" 
                      list="letter-job-titles"
                      autoComplete="off"
                      className="w-full text-xs font-medium border border-line p-2.5 rounded-lg text-fg bg-surface focus:ring-2" 
                      value={jobTerms.title} 
                      onChange={(e) => setJobTerms({...jobTerms, title: e.target.value})} 
                    />
                    <datalist id="letter-job-titles">
                      {ROLES.filter((r) => r.value && r.value !== "staff").map((r) => <option key={r.value} value={r.label} />)}
                    </datalist>
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-subtle uppercase mb-1">Branch / Dept</label>
                    <input 
                      type="text" 
                      className="w-full text-xs font-medium border border-line p-2.5 rounded-lg text-fg bg-surface focus:ring-2" 
                      value={jobTerms.department} 
                      onChange={(e) => setJobTerms({...jobTerms, department: e.target.value})} 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9px] font-bold text-subtle uppercase mb-1">Start Date</label>
                    <input 
                      type="text" 
                      className="w-full text-xs font-medium border border-line p-2.5 rounded-lg text-fg bg-surface focus:ring-2" 
                      value={jobTerms.commencementDate} 
                      onChange={(e) => setJobTerms({...jobTerms, commencementDate: e.target.value})} 
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-subtle uppercase mb-1">{jobTerms.durationLabel || "Duration"}</label>
                    <input 
                      type="text" 
                      className="w-full text-xs font-medium border border-line p-2.5 rounded-lg text-fg bg-surface focus:ring-2" 
                      placeholder="e.g. 3 months" 
                      value={jobTerms.probationPeriod} 
                      onChange={(e) => setJobTerms({...jobTerms, probationPeriod: e.target.value})} 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9px] font-bold text-subtle uppercase mb-1">{jobTerms.salaryLabel || "Salary"} (RM)</label>
                    <input 
                      type="number" 
                      className="w-full text-xs font-medium border border-line p-2.5 rounded-lg text-fg bg-surface focus:ring-2" 
                      value={jobTerms.basicSalary} 
                      onChange={(e) => setJobTerms({...jobTerms, basicSalary: e.target.value})} 
                    />
                  </div>
                  {templateType !== "internship" && templateType !== "contractor" && (
                    <div>
                      <label className="block text-[9px] font-bold text-subtle uppercase mb-1">Probation Basic (RM)</label>
                      <input 
                        type="number" 
                        className="w-full text-xs font-medium border border-line p-2.5 rounded-lg text-fg bg-surface focus:ring-2" 
                        value={jobTerms.probationSalary} 
                        onChange={(e) => setJobTerms({...jobTerms, probationSalary: e.target.value})} 
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-subtle uppercase mb-1">Working Hours Details</label>
                  <input 
                    type="text" 
                    className="w-full text-xs font-medium border border-line p-2.5 rounded-lg text-fg bg-surface focus:ring-2" 
                    value={jobTerms.workingHours} 
                    onChange={(e) => setJobTerms({...jobTerms, workingHours: e.target.value})} 
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-line">
                  <div>
                    <label className="block text-[9px] font-bold text-subtle uppercase mb-1">Notice (Trial / Prob.)</label>
                    <input 
                      type="text" 
                      className="w-full text-xs font-medium border border-line p-2.5 rounded-lg text-fg bg-surface focus:ring-2" 
                      value={jobTerms.noticeProbation} 
                      onChange={(e) => setJobTerms({...jobTerms, noticeProbation: e.target.value})} 
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-subtle uppercase mb-1">Notice (Confirmed / Term)</label>
                    <input 
                      type="text" 
                      className="w-full text-xs font-medium border border-line p-2.5 rounded-lg text-fg bg-surface focus:ring-2" 
                      value={jobTerms.noticeConfirmed} 
                      onChange={(e) => setJobTerms({...jobTerms, noticeConfirmed: e.target.value})} 
                    />
                  </div>
                </div>
              </div>

              {/* Allowances Card */}
              {templateType !== "internship" && templateType !== "contractor" && (
                <div className="bg-surface-2/60/50 p-4 rounded-xl border border-line space-y-3 text-left">
                  <h3 className="text-xs font-bold text-fg flex items-center justify-between">
                    <span className="flex items-center gap-1.5"><DollarSign className="w-4 h-4 text-brand" /> Monthly Allowances</span>
                    <button 
                      onClick={addAllowance} 
                      className="bg-brand hover:brightness-105 text-brand-fg text-[10px] font-bold px-2 py-1 rounded flex items-center gap-0.5 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3 h-3" /> Add
                    </button>
                  </h3>

                  {allowances.length > 0 ? (
                    <div className="space-y-2">
                      {allowances.map((al, idx) => (
                        <div key={idx} className="flex gap-2 items-center bg-surface p-2 rounded-lg border border-line">
                          <input 
                            type="text" 
                            className="w-3/5 text-xs font-medium border border-line p-2 rounded-lg text-fg outline-none focus:border-brand" 
                            placeholder="e.g. Travel" 
                            value={al.name} 
                            onChange={(e) => handleAllowanceChange(idx, "name", e.target.value)} 
                          />
                          <input 
                            type="number" 
                            className="w-2/5 text-xs font-medium border border-line p-2 rounded-lg text-fg outline-none focus:border-brand" 
                            placeholder="RM" 
                            value={al.amount} 
                            onChange={(e) => handleAllowanceChange(idx, "amount", e.target.value)} 
                          />
                          <button 
                            onClick={() => removeAllowance(idx)} 
                            className="text-subtle hover:text-danger p-1 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-subtle font-medium italic text-center py-2 bg-surface rounded-lg border border-dashed border-line">
                      No allowances added yet. Click Add to insert one.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
    </>
  );
}
