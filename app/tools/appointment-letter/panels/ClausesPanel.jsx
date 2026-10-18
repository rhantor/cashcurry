"use client";

import React from "react";
import { Info } from "lucide-react";
import { useLetter } from "../LetterContext";

export default function ClausesPanel() {
  const { activeTab, clauses, setClauses } = useLetter();
  return (
    <>
          {/* TAB: CLAUSES */}
          {activeTab === "clauses" && (
            <div className="space-y-4 text-left">
              <div className="flex items-center gap-2 text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-100">
                <Info className="w-5 h-5 text-mint-600 shrink-0" />
                <p className="text-[10px] font-medium leading-normal">
                  These paragraphs form the core of the contract body. You can modify their texts below to fit your company policies.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Introduction Clause</label>
                  <textarea 
                    className="w-full text-xs font-medium border border-slate-200 p-2 rounded-lg text-black bg-white focus:ring-2 outline-none focus:border-mint-500" 
                    rows={3} 
                    value={clauses.intro} 
                    onChange={(e) => setClauses({...clauses, intro: e.target.value})} 
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Duties & Performance Clause</label>
                  <textarea 
                    className="w-full text-xs font-medium border border-slate-200 p-2 rounded-lg text-black bg-white focus:ring-2 outline-none focus:border-mint-500" 
                    rows={4} 
                    value={clauses.duties} 
                    onChange={(e) => setClauses({...clauses, duties: e.target.value})} 
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Confidentiality Clause</label>
                  <textarea 
                    className="w-full text-xs font-medium border border-slate-200 p-2 rounded-lg text-black bg-white focus:ring-2 outline-none focus:border-mint-500" 
                    rows={4} 
                    value={clauses.confidentiality} 
                    onChange={(e) => setClauses({...clauses, confidentiality: e.target.value})} 
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Rules & Guidelines Compliance</label>
                  <textarea 
                    className="w-full text-xs font-medium border border-slate-200 p-2 rounded-lg text-black bg-white focus:ring-2 outline-none focus:border-mint-500" 
                    rows={3} 
                    value={clauses.compliance} 
                    onChange={(e) => setClauses({...clauses, compliance: e.target.value})} 
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Acceptance Closing Block</label>
                  <textarea 
                    className="w-full text-xs font-medium border border-slate-200 p-2 rounded-lg text-black bg-white focus:ring-2 outline-none focus:border-mint-500" 
                    rows={3} 
                    value={clauses.closing} 
                    onChange={(e) => setClauses({...clauses, closing: e.target.value})} 
                  />
                </div>
              </div>
            </div>
          )}
    </>
  );
}
