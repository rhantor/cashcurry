"use client";
import React, { useEffect, useMemo, useState } from "react";
import {
  useGetAdvanceEntriesQuery,
  useUpdateAdvanceEntryMutation,
} from "@/lib/redux/api/AdvanceApiSlice";
import {
  useGetLoanEntriesQuery,
  useUpdateLoanEntryMutation,
  useApproveRepaymentWithAllocationMutation,
  useRejectRepaymentEntryMutation,
} from "@/lib/redux/api/loanApiSlice";
import { useGetBranchesBasicQuery } from "@/lib/redux/api/branchApiSlice";
import { serverTimestamp } from "firebase/firestore";
import AdvanceRequests from "./AdvanceRequests";
import LoanRequests from "./LoanRequests";

export default function RequestedPanel() {
  const [companyId, setCompanyId] = useState(null);
  const [branchId, setBranchId] = useState(null);
  const [activeTab, setActiveTab] = useState("advance");
  const [user, setUser] = useState(null);

  // local action states
  const [advWorkingId, setAdvWorkingId] = useState(null);
  const [advErrorMsg, setAdvErrorMsg] = useState("");
  const [loanWorkingId, setLoanWorkingId] = useState(null);
  const [loanErrorMsg, setLoanErrorMsg] = useState("");

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (!storedUser) return;
    try {
      const parsed = JSON.parse(storedUser);
      setCompanyId(parsed.companyId);
      setBranchId(parsed.branchId);
      setUser(parsed);
    } catch (error) {
      console.error("Failed to parse user from localStorage:", error);
    }
  }, []);

  // Branch directory
  const { data: branches } = useGetBranchesBasicQuery(companyId, {
    skip: !companyId,
  });
  const getBranchName = (id) => branches?.find((b) => b.id === id)?.name || id;

  // Data queries (branch-scoped)
  const {
    data: advances,
    isLoading: advLoading,
    isError: advError,
  } = useGetAdvanceEntriesQuery(
    { companyId, branchId },
    { skip: !companyId || !branchId, pollingInterval: 5000 }
  );

  const {
    data: loans,
    isLoading: loanLoading,
    isError: loanError,
  } = useGetLoanEntriesQuery(
    { companyId, branchId },
    { skip: !companyId || !branchId, pollingInterval: 5000 }
  );

  const [updateAdvance] = useUpdateAdvanceEntryMutation();
  const [updateLoan] = useUpdateLoanEntryMutation();
  const [approveRepayment] = useApproveRepaymentWithAllocationMutation();
  const [rejectRepayment] = useRejectRepaymentEntryMutation();

  // Pending filters (UI list props)
  const pendingAdvances = useMemo(
    () => (advances || []).filter((a) => a.status === "pending"),
    [advances]
  );

  // Loans coming IN to this branch are already filtered by the API; just keep pending
  const pendingLoans = useMemo(
    () => (loans || []).filter((l) => l.status === "pending"),
    [loans]
  );

  // Permissions
  const canApproveLoans =
    user?.role === "manager" ||
    user?.role === "accountant" ||
    user?.role === "branchAdmin" ||
    user?.role === "superAdmin" ||
    user?.role === "owner" ||
    user?.role === "gm";

  // ---- Handlers ----
  const handleAdvanceAction = async (req, action) => {
    setAdvErrorMsg("");
    if (!["approved", "rejected"].includes(action)) return;
    setAdvWorkingId(req.id);
    try {
      await updateAdvance({
        companyId,
        branchId,
        id: req.id,
        data: {
          status: action,
          approvedBy: {
            id: user?.uid || "",
            name: user?.username || "Unknown",
            role: user?.role || "N/A",
            timestamp: serverTimestamp(),
          },
        },
      }).unwrap();
    } catch (err) {
      console.error(err);
      setAdvErrorMsg("Failed to update advance request. Please try again.");
    } finally {
      setAdvWorkingId(null);
    }
  };

  const handleLoanAction = async (req, action) => {
    setLoanErrorMsg("");
    if (!["approved", "rejected"].includes(action)) return;
    setLoanWorkingId(req.id);

    try {
      if (req.type === "repayment") {
        if (action === "approved") {
          await approveRepayment({
            companyId,
            id: req.id,
            approvedBy: {
              id: user?.uid || "",
              name: user?.username || "Unknown",
              role: user?.role || "N/A",
            },
          }).unwrap();
        } else {
          // Ask whether to auto-create refund entry
          const needRefund = window.confirm(
            "This repayment will be rejected.\nDo you also want to create a pending refund entry back to the payer?"
          );
          const reason = window.prompt("Reason / note (optional):", "");

          await rejectRepayment({
            companyId,
            id: req.id,
            requireRefund: !!needRefund,
            refundNote: reason || "",
            rejectedBy: {
              id: user?.uid || "",
              name: user?.username || "Unknown",
              role: user?.role || "N/A",
            },
          }).unwrap();
        }
      } else {
        // loan approval/rejection path (unchanged)
        await updateLoan({
          companyId,
          branchId,
          id: req.id,
          data: {
            status: action,
            approvedBy: {
              id: user?.uid || "",
              name: user?.username || "Unknown",
              role: user?.role || "N/A",
              timestamp: serverTimestamp(),
            },
          },
        }).unwrap();
      }
    } catch (err) {
      console.error(err);
      setLoanErrorMsg("Failed to update loan/repayment. Please try again.");
    } finally {
      setLoanWorkingId(null);
    }
  };

  if (!companyId || !branchId) return <p className="p-6">Loading...</p>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6 text-mint-600">
        Requested Panel
      </h1>

      {/* Tabs */}
      <div className="flex gap-4 mb-6">
        <button
          className={`relative px-4 py-2 rounded-lg font-medium ${
            activeTab === "advance"
              ? "bg-mint-600 text-white"
              : "bg-mint-200 text-black"
          }`}
          onClick={() => setActiveTab("advance")}
        >
          Advance Requests
          {pendingAdvances.length > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full">
              {pendingAdvances.length}
            </span>
          )}
        </button>

        <button
          className={`relative px-4 py-2 rounded-lg font-medium ${
            activeTab === "loan"
              ? "bg-mint-600 text-white"
              : "bg-mint-200 text-black"
          }`}
          onClick={() => setActiveTab("loan")}
        >
          Loan Requests
          {pendingLoans.length > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full">
              {pendingLoans.length}
            </span>
          )}
        </button>
      </div>

      {/* Panels */}
      {activeTab === "advance" ? (
        <AdvanceRequests
          loading={advLoading}
          error={advError}
          errorMsg={advErrorMsg}
          items={pendingAdvances}
          workingId={advWorkingId}
          onAction={handleAdvanceAction}
        />
      ) : (
        <LoanRequests
          loading={loanLoading}
          error={loanError}
          errorMsg={loanErrorMsg}
          items={pendingLoans}
          workingId={loanWorkingId}
          onAction={handleLoanAction}
          canApprove={canApproveLoans}
          getBranchName={getBranchName}
        />
      )}
    </div>
  );
}
