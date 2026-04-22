"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useAddLoanEntryMutation } from "@/lib/redux/api/loanApiSlice";
import { useGetBranchesBasicQuery } from "@/lib/redux/api/branchApiSlice";
import { serverTimestamp } from "firebase/firestore";
import useResolvedCompanyBranch from "@/utils/useResolvedCompanyBranch";

const LoanRequestForm = () => {
  const { ready, companyId, branchId, user } = useResolvedCompanyBranch();

  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [toBranchId, setToBranchId] = useState("");

  const [touched, setTouched] = useState({ amount: false, toBranchId: false });

  const {
    data: branches,
    isLoading: branchesLoading,
    isError: branchesError,
    error: branchesErrorDetail,
    refetch: refetchBranches,
  } = useGetBranchesBasicQuery(companyId, { skip: !companyId, refetchOnMountOrArgChange: true });

  const getBranchName = (id) => branches?.find((b) => b.id === id)?.name || id;

  const [addLoanEntry, { isLoading, isError, error, isSuccess }] =
    useAddLoanEntryMutation();

  const fromBranchName = useMemo(() => {
    if (!branches || !branchId) return "";
    const b = branches.find((x) => x.id === branchId);
    return b?.name ?? "";
  }, [branches, branchId]);

  const otherBranches = useMemo(() => {
    if (!branches || !branchId) return [];
    return branches.filter((b) => b.id !== branchId);
  }, [branches, branchId]);

  // --- Validation ---
  const numericAmount = Number(amount);
  const amountValid = Number.isFinite(numericAmount) && numericAmount > 0;
  const toBranchValid = !!toBranchId && toBranchId !== branchId;
  const formValid =
    amountValid && toBranchValid && !!companyId && !!branchId && !!user;

  // Branch directory

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formValid) return;

    // IMPORTANT: If your RTK mutation runs on a server (Node) that writes to Firestore,
    // you should set timestamps on the server side instead of sending `serverTimestamp()` from the client.
    // If your mutation writes directly via client SDK inside the hook, `serverTimestamp()` is fine.
    const payload = {
      requestFromBranchId: branchId,
      requestedToBranchId: toBranchId,
      requestFrom: getBranchName(branchId),
      requestedTo: getBranchName(toBranchId),
      amount: numericAmount,
      reason: reason?.trim() || "",
      createdBy: {
        uid: user?.uid ?? null,
        username: user?.username ?? "",
        email: user?.email ?? "",
        role: user?.role ?? "",
      },
      requestedBy: {
        uid: user?.uid ?? null,
        username: user?.username ?? "",
        email: user?.email ?? "",
        role: user?.role ?? "",
      },
      status: "pending",
      createdAt: serverTimestamp(),
    };

    try {
      await addLoanEntry({ companyId, data: payload }).unwrap();
      setAmount("");
      setReason("");
      setToBranchId("");
      setTouched({ amount: false, toBranchId: false });
      alert("✅ Loan request sent!");
    } catch (err) {
      console.error(err);
    }
  };

  if (!ready) return <p className="p-4">Syncing session...</p>;
  if (!companyId || !branchId) return <p className="p-4">Please log in to a branch to request loans.</p>;

  return (
    <div className="bg-white rounded-2xl shadow p-4 sm:p-6 max-w-md mx-auto">
      <h2 className="text-lg sm:text-xl font-bold mb-4 text-black">
        Request Loan
      </h2>

      {branchesError && (
        <div className="mb-3 flex items-center gap-2">
          <p className="text-sm text-red-500 font-medium">
            Failed to load branches
            {branchesErrorDetail?.code ? ` (${branchesErrorDetail.code})` : ""}.
          </p>
          <button
            type="button"
            onClick={refetchBranches}
            className="text-xs text-blue-600 underline hover:text-blue-800"
          >
            Retry
          </button>
        </div>
      )}

      {isError && (
        <p className="mb-3 text-sm text-mint-500 font-medium">
          {error?.data?.message || "Failed to send request."}
        </p>
      )}
      {isSuccess && (
        <p className="mb-3 text-sm text-green-600 font-medium">
          Request submitted successfully.
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* From Branch (read-only) */}
        <div>
          <label className="block mb-1 font-semibold text-black">
            From Branch
          </label>
          <input
            type="text"
            value={fromBranchName || "Loading..."}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-100 text-black"
            readOnly
          />
        </div>

        {/* To Branch */}
        <div>
          <label className="block mb-1 font-semibold text-black">
            To Branch
          </label>
          <select
            value={toBranchId}
            onChange={(e) => setToBranchId(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, toBranchId: true }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-black"
            required
            disabled={branchesLoading || otherBranches.length === 0}
          >
            <option value="">Select branch</option>
            {otherBranches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          {!toBranchValid && touched.toBranchId && (
            <p className="mt-1 text-xs text-mint-600">
              Please choose a different branch.
            </p>
          )}
        </div>

        {/* Amount */}
        <div>
          <label className="block mb-1 font-semibold text-black">
            Amount (RM)
          </label>
          <input
            type="number"
            inputMode="decimal"
            min="1"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, amount: true }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-black"
            placeholder="5000"
            required
          />
          {!amountValid && touched.amount && (
            <p className="mt-1 text-xs text-mint-600">
              Enter a valid positive amount.
            </p>
          )}
        </div>

        {/* Reason */}
        <div>
          <label className="block mb-1 font-semibold text-black">Reason</label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-black"
            placeholder="Salary shortfall"
          />
          <p className="mt-1 text-xs text-gray-500">
            Optional, but recommended.
          </p>
        </div>

        {/* Requested By Info */}
        {user && (
          <div className="bg-mint-100 border border-mint-300 rounded-lg p-3">
            <p className="text-sm font-semibold text-black">
              Requested By:
              <span className="ml-1 text-green-700">
                {user.username || "Unknown"}
              </span>
            </p>
            <p className="text-xs text-black">
              Role:{" "}
              <span className="font-medium text-green-600">
                {user.role || "N/A"}
              </span>
            </p>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading || !formValid}
          className={`w-full rounded-lg py-2 font-semibold transition ${
            isLoading || !formValid
              ? "bg-gray-300 text-gray-600 cursor-not-allowed"
              : "bg-green-600 hover:bg-green-700 text-white"
          }`}
        >
          {isLoading ? "Submitting..." : "Send Loan Request"}
        </button>
      </form>
    </div>
  );
};

export default LoanRequestForm;
