"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Plus, Trash2, Download, Building2, CheckSquare, Square, Wallet, Calculator, Check } from "lucide-react";
import { format } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useGetBranchesBasicQuery } from "@/lib/redux/api/branchApiSlice";
import { useSummaryReportLogic } from "@/hook/useSummaryReportLogic";
import useCurrency from "@/app/hooks/useCurrency";
import { 
  useGetCompanyDeductionsQuery, 
  useAddCompanyDeductionMutation, 
  useDeleteCompanyDeductionMutation 
} from "@/lib/redux/api/companyDeductionsApiSlice";

// --- Subcomponent to load branch cash ---
const BranchCashLoader = ({ branch, onUpdate }) => {
  const [filterState] = useState({ filterType: "last7days" });
  const { ready, computed } = useSummaryReportLogic(filterState, "front", branch.id);

  useEffect(() => {
    if (ready && computed?.kpis?.handInCash !== undefined) {
      onUpdate(branch.id, computed.kpis.handInCash);
    }
  }, [ready, computed?.kpis?.handInCash, branch.id, onUpdate]);

  return null; 
};

const ALLOWED_ROLES = new Set(["owner", "gm", "superadmin"]);

export default function DailyCashTracker() {
  const currency = useCurrency();
  const [user, setUser] = useState(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (raw) {
      const u = JSON.parse(raw);
      setUser(u);
    }
    setIsAuthChecking(false);
  }, []);

  const companyId = user?.companyId;
  const { data: branches = [], isLoading: branchesLoading } = useGetBranchesBasicQuery(companyId || "", {
    skip: !companyId,
  });

  const { data: deductions = [] } = useGetCompanyDeductionsQuery(companyId || "", {
    skip: !companyId,
  });
  const [addDeductionMutation] = useAddCompanyDeductionMutation();
  const [deleteDeductionMutation] = useDeleteCompanyDeductionMutation();

  const [branchBalances, setBranchBalances] = useState({});
  const [selectedBranches, setSelectedBranches] = useState({});
  
  // Manual deductions form state
  const [descInput, setDescInput] = useState("");
  const [amountInput, setAmountInput] = useState("");

  const handleUpdateBalance = useCallback((branchId, cash) => {
    setBranchBalances((prev) => {
      if (prev[branchId] === cash) return prev;
      return { ...prev, [branchId]: cash };
    });
  }, []);

  // Initialize selection when branches load
  useEffect(() => {
    if (branches.length > 0 && Object.keys(selectedBranches).length === 0) {
      const initialSelection = {};
      branches.forEach(b => initialSelection[b.id] = true);
      setSelectedBranches(initialSelection);
    }
  }, [branches]); // removed selectedBranches from deps to only run once when loaded

  const toggleBranch = (id) => {
    setSelectedBranches(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleAll = () => {
    const allSelected = branches.every(b => selectedBranches[b.id]);
    const next = {};
    branches.forEach(b => next[b.id] = !allSelected);
    setSelectedBranches(next);
  };

  const addDeduction = async (e) => {
    e.preventDefault();
    if (!companyId) return;
    if (!descInput.trim() || !amountInput) return;
    const amt = parseFloat(amountInput);
    if (isNaN(amt) || amt <= 0) return;

    await addDeductionMutation({
      companyId,
      data: {
        description: descInput.trim(),
        amount: amt
      }
    });
    setDescInput("");
    setAmountInput("");
  };

  const removeDeduction = async (id) => {
    if (!companyId) return;
    await deleteDeductionMutation({ companyId, deductionId: id });
  };

  const totalSelectedCash = useMemo(() => {
    return branches.reduce((sum, b) => {
      if (selectedBranches[b.id]) {
        return sum + (branchBalances[b.id] || 0);
      }
      return sum;
    }, 0);
  }, [branches, selectedBranches, branchBalances]);

  const totalDeductions = useMemo(() => {
    return deductions.reduce((sum, d) => sum + d.amount, 0);
  }, [deductions]);

  const finalCash = totalSelectedCash - totalDeductions;

  const exportPDF = () => {
    const doc = new jsPDF();
    const dateStr = format(new Date(), "dd MMM yyyy");
    
    // Header
    doc.setFontSize(18);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text("Daily Cash Tracker", 14, 22);
    
    doc.setFontSize(11);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(`Date: ${dateStr}`, 14, 30);
    
    let yPos = 40;

    // Table 1: Branches
    const branchRows = branches
      .filter(b => selectedBranches[b.id])
      .map(b => [
        b.name, 
        `${currency} ${(branchBalances[b.id] || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      ]);

    autoTable(doc, {
      startY: yPos,
      head: [["Selected Branch", "Cash in Hand"]],
      body: branchRows,
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129] }, // emerald-500
      styles: { fontSize: 10 },
      margin: { left: 14, right: 14 },
    });

    yPos = doc.lastAutoTable.finalY + 15;

    // Table 2: Deductions
    if (deductions.length > 0) {
      const deductionRows = deductions.map(d => [
        d.description,
        `${currency} ${d.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [["Manual Deduction (Description)", "Amount"]],
        body: deductionRows,
        theme: 'grid',
        headStyles: { fillColor: [244, 63, 94] }, // rose-500
        styles: { fontSize: 10 },
        margin: { left: 14, right: 14 },
      });
      
      yPos = doc.lastAutoTable.finalY + 15;
    }

    // Summary Section
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    
    const fmt = (val) => `${currency} ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    
    doc.text(`Total Branch Cash:`, 14, yPos);
    doc.text(fmt(totalSelectedCash), 196, yPos, { align: "right" });
    yPos += 8;
    
    doc.text(`Total Deductions:`, 14, yPos);
    doc.text(`- ${fmt(totalDeductions)}`, 196, yPos, { align: "right" });
    yPos += 8;
    
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text(`Final Cash in Hand:`, 14, yPos);
    doc.text(fmt(finalCash), 196, yPos, { align: "right" });

    doc.save(`Cash_Tracker_${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  if (isAuthChecking) return <div className="p-8 text-slate-500">Checking access...</div>;
  if (!user || !ALLOWED_ROLES.has(user.role?.toLowerCase())) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="bg-rose-50 text-rose-600 p-6 rounded-2xl max-w-md text-center border border-rose-100 shadow-sm">
          <h2 className="text-xl font-bold mb-2">Unauthorized Access</h2>
          <p className="text-sm">You do not have permission to view the Daily Cash Tracker. Only Top-Level Management can access this page.</p>
        </div>
      </div>
    );
  }

  const isSuperAdmin = user?.role?.toLowerCase() === "superadmin";
  const allSelected = branches.length > 0 && branches.every(b => selectedBranches[b.id]);

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 pb-24">
      {/* Hidden loaders to fetch cash for each branch */}
      {branches.map(b => (
        <BranchCashLoader key={`loader-${b.id}`} branch={b} onUpdate={handleUpdateBalance} />
      ))}

      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Daily Cash Tracker</h1>
          <p className="text-slate-500 mt-1">{format(new Date(), "EEEE, dd MMMM yyyy")}</p>
        </div>
        <button 
          onClick={exportPDF}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all font-medium shadow-sm hover:shadow active:scale-95"
        >
          <Download size={18} />
          <span>Export to PDF</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Branches */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h2 className="font-bold text-slate-800 flex items-center gap-2 text-lg">
                <Building2 size={20} className="text-emerald-600" /> 
                Branch Cash in Hand
              </h2>
              <button 
                onClick={toggleAll}
                className="text-sm font-medium text-emerald-700 hover:text-emerald-800 transition-colors flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-lg"
              >
                {allSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                {allSelected ? "Deselect All" : "Select All"}
              </button>
            </div>
            
            <div className="divide-y divide-slate-100">
              {branchesLoading && <div className="p-8 text-center text-slate-400">Loading branches...</div>}
              {!branchesLoading && branches.length === 0 && <div className="p-8 text-center text-slate-400">No branches found.</div>}
              
              {branches.map(branch => {
                const isSelected = selectedBranches[branch.id];
                const cash = branchBalances[branch.id];
                const cashFmt = cash !== undefined 
                  ? `${currency} ${cash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` 
                  : "Calculating...";
                
                return (
                  <label 
                    key={branch.id} 
                    className={`flex items-center justify-between p-4 sm:p-5 cursor-pointer transition-colors hover:bg-slate-50 ${isSelected ? 'bg-emerald-50/30' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`flex items-center justify-center w-5 h-5 rounded border transition-colors ${isSelected ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 bg-white'}`}>
                        {isSelected && <Check size={14} strokeWidth={3} />}
                      </div>
                      <span className={`font-medium ${isSelected ? 'text-slate-800' : 'text-slate-600'}`}>
                        {branch.name}
                      </span>
                    </div>
                    <div className={`font-semibold ${isSelected ? 'text-emerald-700' : 'text-slate-400'}`}>
                      {cashFmt}
                    </div>
                    {/* Checkbox visually hidden but functional */}
                    <input 
                      type="checkbox" 
                      className="hidden" 
                      checked={!!isSelected} 
                      onChange={() => toggleBranch(branch.id)} 
                    />
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Deductions & Summary */}
        <div className="space-y-6">
          
          {/* Summary Card */}
          <div className="bg-slate-900 rounded-2xl shadow-lg border border-slate-800 text-white overflow-hidden relative">
            <div className="absolute top-0 right-0 p-32 bg-emerald-500 rounded-full blur-[100px] opacity-20 -mr-20 -mt-20 pointer-events-none"></div>
            
            <div className="p-5 sm:p-6 relative z-10">
              <h2 className="font-bold text-slate-300 flex items-center gap-2 mb-6">
                <Calculator size={20} className="text-emerald-400" />
                Final Calculation
              </h2>
              
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <span className="text-slate-400 text-sm">Selected Cash</span>
                  <span className="font-medium text-slate-200">
                    {currency} {totalSelectedCash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                
                <div className="flex justify-between items-end">
                  <span className="text-slate-400 text-sm">Manual Deductions</span>
                  <span className="font-medium text-rose-400">
                    - {currency} {totalDeductions.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                
                <div className="pt-4 border-t border-slate-700">
                  <span className="block text-slate-400 text-sm mb-1">Final Cash in Hand</span>
                  <div className="text-3xl font-bold tracking-tight text-white">
                    {currency} {finalCash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Deductions Form */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50">
              <h2 className="font-bold text-slate-800 flex items-center gap-2 text-lg">
                <Wallet size={20} className="text-rose-500" /> 
                Manual Deductions
              </h2>
            </div>
            
            <div className="p-4 sm:p-5">
              {isSuperAdmin && (
                <form onSubmit={addDeduction} className="space-y-4 mb-6">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Description</label>
                    <input 
                      type="text" 
                      value={descInput}
                      onChange={e => setDescInput(e.target.value)}
                      placeholder="e.g. Paid Person A"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Amount ({currency})</label>
                    <input 
                      type="number" 
                      step="0.01"
                      min="0"
                      value={amountInput}
                      onChange={e => setAmountInput(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all sm:text-sm"
                    />
                  </div>
                  <button 
                    type="submit"
                    disabled={!descInput.trim() || !amountInput}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus size={18} />
                    <span>Add Deduction</span>
                  </button>
                </form>
              )}

              <div className="space-y-2">
                {deductions.length === 0 ? (
                  <p className="text-center text-sm text-slate-400 italic">No deductions added yet.</p>
                ) : (
                  deductions.map(d => (
                    <div key={d.id} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl shadow-sm hover:border-slate-200 transition-colors">
                      <div className="min-w-0 flex-1 pr-3">
                        <p className="text-sm font-medium text-slate-800 truncate">{d.description}</p>
                        <p className="text-xs text-rose-500 font-medium mt-0.5">
                          {currency} {d.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                      {isSuperAdmin && (
                        <button 
                          onClick={() => removeDeduction(d.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors shrink-0 flex-none"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
