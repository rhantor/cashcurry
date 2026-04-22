"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useGetAdvanceEntriesQuery } from "@/lib/redux/api/AdvanceApiSlice";
import { useGetStaffLoansQuery } from "@/lib/redux/api/staffLoanApiSlice";
import { format } from "date-fns";
import { Wallet, Landmark, Clock, CheckCircle2, XCircle } from "lucide-react";

export default function SupervisorPanel() {
  const [companyId, setCompanyId] = useState(null);
  const [branchId, setBranchId] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      const parsed = JSON.parse(storedUser);
      setCompanyId(parsed.companyId);
      setBranchId(parsed.branchId);
      setUser(parsed);
    }
  }, []);

  const { data: advances = [], isLoading: advLoading } = useGetAdvanceEntriesQuery(
    { companyId, branchId },
    { skip: !companyId || !branchId }
  );

  const { data: loans = [], isLoading: loanLoading } = useGetStaffLoansQuery(
    { companyId, branchId },
    { skip: !companyId || !branchId }
  );

  const myAdvances = useMemo(() => 
    advances.filter(a => a.createdBy?.uid === user?.uid),
    [advances, user]
  );

  const myLoans = useMemo(() => 
    loans.filter(l => l.createdBy?.uid === user?.uid),
    [loans, user]
  );

  if (!user) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">My Requested History</h1>
        <p className="text-gray-500 mt-1">Track the status of staff advances and loans you've initiated.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Advances Section */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Wallet className="w-5 h-5 text-emerald-600" />
            <h2 className="text-xl font-semibold">Staff Advances</h2>
          </div>
          
          {advLoading ? (
             <div className="animate-pulse space-y-4">
               {[1,2].map(i => <div key={i} className="h-24 bg-gray-100 rounded-xl"></div>)}
             </div>
          ) : myAdvances.length === 0 ? (
            <div className="bg-gray-50 border border-dashed rounded-xl p-8 text-center text-gray-400">
              No advances requested by you.
            </div>
          ) : (
            <div className="space-y-4">
              {myAdvances.map(adv => (
                <RequestCard key={adv.id} item={adv} type="Advance" />
              ))}
            </div>
          )}
        </section>

        {/* Loans Section */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Landmark className="w-5 h-5 text-teal-600" />
            <h2 className="text-xl font-semibold">Staff Loans</h2>
          </div>

          {loanLoading ? (
             <div className="animate-pulse space-y-4">
               {[1,2].map(i => <div key={i} className="h-24 bg-gray-100 rounded-xl"></div>)}
             </div>
          ) : myLoans.length === 0 ? (
            <div className="bg-gray-50 border border-dashed rounded-xl p-8 text-center text-gray-400">
              No loans requested by you.
            </div>
          ) : (
            <div className="space-y-4">
              {myLoans.map(loan => (
                <RequestCard key={loan.id} item={loan} type="Loan" />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function RequestCard({ item, type }) {
  const statusColors = {
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    approved: "bg-green-50 text-green-700 border-green-200",
    rejected: "bg-red-50 text-red-700 border-red-200",
  };

  const StatusIcon = {
    pending: Clock,
    approved: CheckCircle2,
    rejected: XCircle,
  }[item.status] || Clock;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition">
      <div className="flex justify-between items-start mb-3">
        <div>
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">{type}</span>
          <h3 className="font-bold text-gray-900">{item.staffName}</h3>
        </div>
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${statusColors[item.status] || "bg-gray-50 text-gray-600"}`}>
          <StatusIcon className="w-3.5 h-3.5" />
          <span className="capitalize">{item.status}</span>
        </div>
      </div>

      <div className="space-y-1 text-sm text-gray-600">
        <div className="flex justify-between">
          <span>Amount:</span>
          <span className="font-semibold text-gray-900">${Number(item.amount).toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span>Date:</span>
          <span>{item.date ? format(new Date(item.date), "dd MMM yyyy") : "-"}</span>
        </div>
        {item.reason && (
          <div className="mt-2 text-xs text-gray-500 italic line-clamp-1">
            "{item.reason}"
          </div>
        )}
      </div>

      {item.status !== "pending" && item.approvedBy && (
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 text-[10px] text-gray-400">
          <span className="font-medium">{item.status === "approved" ? "Approved" : "Rejected"} by:</span>
          <span>{item.approvedBy.name} ({item.approvedBy.role})</span>
        </div>
      )}
    </div>
  );
}
