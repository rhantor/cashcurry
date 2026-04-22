"use client";

import { React, useState, useEffect } from "react";
import { NumericFormat } from "react-number-format";
import {
  useAddDepositEntryMutation,
  useGetDepositEntryQuery,
} from "@/lib/redux/api/depositApiSlice";
import { storage } from "@/lib/firebase"; // adjust path if needed
import { serverTimestamp } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { format } from "date-fns";
import { useGetSingleBranchQuery } from "@/lib/redux/api/branchApiSlice";
import {
  exportDepositToExcel,
  exportDepositToPDF,
  shareDeposit,
} from "@/utils/export/exportDepositData";
import Link from "next/link";
import useCurrency from "@/app/hooks/useCurrency";

export default function DepositEntryPage() {
  const currency = useCurrency();
  const [date, setDate] = useState("");
  const [amount, setAmount] = useState("");
  const [bankName, setBankName] = useState("");
  const [traceNo, setTraceNo] = useState("");
  const [receipt, setReceipt] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [companyId, setCompanyId] = useState(null);
  const [branchId, setBranchId] = useState(null);
  const [selectedDeposit, setSelectedDeposit] = useState(null);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      const parsed = JSON.parse(storedUser);
      setCompanyId(parsed.companyId);
      setBranchId(parsed.branchId);
    }
  }, []);

  const [addDepositEntry] = useAddDepositEntryMutation();

  // ✅ Query deposits
  const {
    data: deposits = [],
    isLoading,
    isError,
  } = useGetDepositEntryQuery(
    { companyId, branchId },
    { skip: !companyId || !branchId }
  );

  const { data: branchData = [] } = useGetSingleBranchQuery({
    companyId,
    branchId,
  });

  const lastFiveDeposits = deposits?.slice(-5).reverse();

  // ✅ Upload File
  const uploadFile = async () => {
    if (!receipt || !companyId || !branchId) return null;

    const fileExtension = receipt.name.split(".").pop();
    const filePath = `deposits/${companyId}/${branchId}/${Date.now()}.${fileExtension}`;
    const storageRef = ref(storage, filePath);

    return new Promise((resolve, reject) => {
      const uploadTask = uploadBytesResumable(storageRef, receipt);

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress =
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        },
        (error) => {
          console.error("Upload failed:", error);
          reject(error);
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(downloadURL);
        }
      );
    });
  };

  // ✅ Save Deposit Entry
  const handleSave = async () => {
    if (!companyId || !branchId) return;
    if (!date || !amount || !bankName || !traceNo || !receipt) {
      setError("⚠️ All fields including receipt are required!");
      return;
    }
    if (parseFloat(amount) <= 0) {
      setError("⚠️ Amount must be greater than zero.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const fileURL = await uploadFile();
      const storedUser = localStorage.getItem("user");
      const createdBy = storedUser ? JSON.parse(storedUser) : {};
      const data = {
        date,
        amount,
        bankName,
        traceNo,
        fileURL,
        createdAt: serverTimestamp(),
        createdBy: createdBy || "Unknown",
      };
      await addDepositEntry({ companyId, branchId, data }).unwrap();
      // Reset
      setDate("");
      setAmount("");
      setBankName("");
      setTraceNo("");
      setReceipt(null);
      setReceiptPreview(null);
      setUploadProgress(0);
      alert("✅ Deposit entry saved successfully!");
    } catch (err) {
      console.error("Save failed:", err);
      setError("❌ Failed to save deposit entry. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ✅ Handle file preview
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setReceipt(file);
    if (file) {
      setReceiptPreview(URL.createObjectURL(file));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <h1 className="text-lg font-bold mb-4 text-center">Cash Deposit Entry</h1>

      {/* Deposit Form */}
      <div className="bg-white p-4 rounded-lg shadow-md space-y-3 max-w-md mx-auto mb-6">
        {error && <p className="text-red-500 text-sm">{error}</p>}

        <label className="block text-sm font-medium">
          Date <span className="text-red-500">*</span>
        </label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full rounded-lg border p-2 text-sm"
          required
        />

        <label className="block text-sm font-medium">
          Deposit Amount <span className="text-red-500">*</span>
        </label>
        <NumericFormat
          value={amount}
          thousandSeparator={true}
          decimalScale={2}
          allowNegative={false}
          placeholder="0.00"
          className="w-full rounded-lg border p-2 text-sm"
          onValueChange={(values) => {
            setAmount(values.value)
          }}
        />

        <label className="block text-sm font-medium">
          Bank Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          placeholder="Bank Name"
          value={bankName}
          onChange={(e) => setBankName(e.target.value)}
          className="w-full rounded-lg border p-2 text-sm"
          required
        />

        <label className="block text-sm font-medium">
          Trace No. <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          placeholder="Trace No."
          value={traceNo}
          onChange={(e) => setTraceNo(e.target.value)}
          className="w-full rounded-lg border p-2 text-sm"
          required
        />

        <label className="block text-sm font-medium">
          Receipt Upload <span className="text-red-500">*</span>
        </label>
        <input
          type="file"
          accept="image/*,.pdf"
          onChange={handleFileChange}
          className="w-full rounded-lg border p-2 text-sm"
          required
        />
        {receiptPreview && (
          <img
            src={receiptPreview}
            alt="Preview"
            className="h-20 mt-2 rounded border"
          />
        )}
        {uploadProgress > 0 && (
          <p className="text-xs text-gray-500">
            Upload Progress: {uploadProgress.toFixed(0)}%
          </p>
        )}

        <button
          onClick={handleSave}
          disabled={loading}
          className="w-full bg-purple-500 text-white rounded-lg px-4 py-2 text-sm hover:bg-purple-600 disabled:opacity-50"
        >
          {loading ? "Saving..." : "Save Deposit"}
        </button>
      </div>

      {/* Last 5 Deposits */}
      <div className="bg-white p-4 rounded-lg shadow-md max-w-2xl mx-auto">
        <div className="flex justify-between items-center">
          <h2 className="text-md font-semibold mb-3">Last 5 Deposits</h2>
          <Link href={"/reports/deposit-reports"}> </Link>
        </div>
        {isLoading ? (
          <p className="text-gray-500">Loading...</p>
        ) : isError ? (
          <p className="text-red-500">❌ Failed to load deposits.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border text-sm">
              <thead>
                <tr className="bg-gray-100 text-left">
                  <th className="border p-2">Date</th>
                  <th className="border p-2">Amount</th>
                  <th className="border p-2">Bank</th>
                  <th className="border p-2">Trace No.</th>
                  <th className="border p-2">Receipt</th>
                  <th className="border p-2">Added By</th>
                  <th className="border p-2">Added Time</th>
                </tr>
              </thead>
              <tbody>
                {lastFiveDeposits?.map((dep) => (
                  <tr
                    key={dep.id}
                    className="hover:bg-gray-50"
                    onClick={() => setSelectedDeposit(dep)}
                  >
                    <td className="border p-2">{dep.date}</td>
                    <td className="border p-2">{currency} {dep.amount}</td>
                    <td className="border p-2">{dep.bankName}</td>
                    <td className="border p-2">{dep.traceNo}</td>
                    <td className="border p-2">
                      {dep.fileURL ? (
                        <img
                          src={dep.fileURL}
                          alt="Receipt"
                          className="h-12 w-12 object-cover rounded"
                        />
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="border p-2">{dep?.createdBy?.username}</td>
                    <td className="border p-2">
                      {dep.createdAt?.seconds
                        ? format(
                            new Date(dep.createdAt.seconds * 1000),
                            "dd/MM/yyyy, HH:mm"
                          )
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {/* Modal */}
      {selectedDeposit && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">
                {Array.isArray(branchData)
                  ? branchData.map((branch) => branch.name).join(", ")
                  : branchData?.name || "Branch"}
              </h2>
              <h2 className="text-lg font-bold">
                Deposit – {format(new Date(selectedDeposit.date), "dd/MM/yyyy")}
              </h2>
            </div>

            {/* Deposit details */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Amount</span>
                <span>{currency} {selectedDeposit.amount}</span>
              </div>
              <div className="flex justify-between">
                <span>Bank</span>
                <span>{selectedDeposit.bankName}</span>
              </div>
              <div className="flex justify-between">
                <span>Trace No.</span>
                <span>{selectedDeposit.traceNo}</span>
              </div>
              <div className="flex justify-between">
                <span>Added By</span>
                <span>{selectedDeposit?.createdBy?.username}</span>
              </div>
              <div className="flex justify-between">
                <span>Added Time</span>
                <span>
                  {selectedDeposit?.createdAt?.seconds
                    ? format(
                        new Date(selectedDeposit.createdAt.seconds * 1000),
                        "dd/MM/yyyy, HH:mm"
                      )
                    : "-"}
                </span>
              </div>
              {/* Receipt Image */}
              {selectedDeposit.fileURL && (
                <div className="mt-4">
                  <p className="text-sm font-medium mb-1">Receipt:</p>
                  <img
                    src={selectedDeposit.fileURL}
                    alt="Deposit Receipt"
                    className="w-full rounded-lg border"
                  />
                  <a
                    href={selectedDeposit.fileURL}
                    download={`DepositEntry-${selectedDeposit.date}`}
                    className="inline-block mt-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm"
                  >
                    Download
                  </a>
                </div>
              )}
            </div>

            {/* Footer buttons */}
            <div className="flex flex-wrap justify-end gap-2 sm:gap-3 mt-6 text-xs">
              <button
                onClick={() => setSelectedDeposit(null)}
                className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700"
              >
                Close
              </button>
              <button
                onClick={() => exportDepositToPDF(selectedDeposit, branchData)}
                className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white"
              >
                Export PDF
              </button>
              <button
                onClick={() =>
                  exportDepositToExcel(selectedDeposit, branchData)
                }
                className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white"
              >
                Export Excel
              </button>
              <button
                onClick={() => shareDeposit(selectedDeposit, branchData)}
                className="px-4 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white"
              >
                Share
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
