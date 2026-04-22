/* eslint-disable no-unused-vars */
"use client";
import React, { useEffect, useState } from "react";
import { NumericFormat } from "react-number-format";
import { useAddWithdrawEntryMutation } from "@/lib/redux/api/cashWithdrawApiSlice";
import { storage } from "@/lib/firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { FaUpload, FaFileAlt, FaFilePdf, FaTrash, FaSpinner, FaCheckCircle, FaExclamationCircle } from "react-icons/fa";
import useCurrency from "@/app/hooks/useCurrency";

const CATEGORIES = [
  "Supplier Payment",
  "Staff Advance",
  "Staff Salary",
  "Utility Bills",
  "Rent/Deposit",
  "Maintenance",
  "Transport/Delivery",
  "Petty Cash",
  "Other",
];

const METHODS = ["ATM Withdraw", "Online Transfer", "Other"];

export default function CashWithdrawPage() {
  const currency = useCurrency();
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [companyId, setCompanyId] = useState(null);
  const [branchId, setBranchId] = useState(null);

  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [method, setMethod] = useState(METHODS[0]);
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  // Multiple files state
  const [files, setFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const [showConfirm, setShowConfirm] = useState(false);
  const [msg, setMsg] = useState({ text: "", type: "" }); // type: 'success' | 'error'

  const [addWithdrawEntry, { isLoading: isSaving }] = useAddWithdrawEntryMutation();

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) {
      const u = JSON.parse(stored);
      setCompanyId(u.companyId);
      setBranchId(u.branchId);
    }
  }, []);

  const onAmountChange = (v) => {
    const n = parseFloat(v);
    if (v === "" || (!isNaN(n) && n >= 0)) setAmount(v);
  };

  // Handle multiple file selection
  const onFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    if (selectedFiles.length === 0) return;

    const validFiles = selectedFiles.filter(f => 
      ["application/pdf", "image/jpeg", "image/png", "image/jpg"].includes(f.type)
    );

    if (validFiles.length !== selectedFiles.length) {
      setMsg({ text: "Some files were rejected. Only PDF/JPG/PNG allowed.", type: "error" });
    } else {
      setMsg({ text: "", type: "" });
    }

    setFiles((prev) => [...prev, ...validFiles]);
    setUploadProgress(0);
  };

  const removeFile = (indexToRemove) => {
    setFiles((prev) => prev.filter((_, i) => i !== indexToRemove));
  };

  // Upload all files and return array of URLs
  const uploadReceipts = async () => {
    if (files.length === 0 || !companyId || !branchId) return [];

    setIsUploading(true);
    const urls = [];
    let completedCount = 0;

    try {
      const uploadPromises = files.map((file) => {
        return new Promise((resolve, reject) => {
          const ext = file.name.split(".").pop();
          const filePath = `withdrawReceipts/${companyId}/${branchId}/${date}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${ext}`;
          const storageRef = ref(storage, filePath);
          const task = uploadBytesResumable(storageRef, file);

          task.on(
            "state_changed",
            (snap) => {
              // Individual progress tracking is tricky with Promise.all, 
              // we mostly care about completion here or use a total bytes calculation logic
            },
            (err) => reject(err),
            async () => {
              const url = await getDownloadURL(task.snapshot.ref);
              completedCount++;
              setUploadProgress((completedCount / files.length) * 100);
              resolve(url);
            }
          );
        });
      });

      const results = await Promise.all(uploadPromises);
      urls.push(...results);
    } catch (err) {
      console.error("Upload error:", err);
      throw new Error("Failed to upload one or more files.");
    } finally {
      setIsUploading(false);
    }

    return urls;
  };

  const handleSave = async () => {
    if (!companyId || !branchId) return;
    if (!date) return setMsg({ text: "Select a date.", type: "error" });
    if (!amount) return setMsg({ text: "Enter an amount.", type: "error" });
    if (files.length === 0) {
      return setMsg({ text: "Receipt is required. Please attach at least one file.", type: "error" });
    }

    try {
      // 1. Upload Files
      const uploadedUrls = await uploadReceipts();

      // 2. Prepare Data
      const storedUser = localStorage.getItem("user");
      const createdBy = storedUser ? JSON.parse(storedUser) : {};

      const data = {
        date,
        amount: Number(amount) || 0,
        category,
        method,
        reference: reference || "",
        notes: notes || "",
        receiptUrl: uploadedUrls[0] || "", // Backward compatibility (save first image)
        receiptUrls: uploadedUrls,         // New field: Array of all images
        createdBy,
        createdAt: new Date().toISOString(),
      };

      // 3. Submit API
      await addWithdrawEntry({ companyId, branchId, data }).unwrap();

      // 4. Reset Form
      setAmount("");
      setCategory(CATEGORIES[0]);
      setMethod(METHODS[0]);
      setReference("");
      setNotes("");
      setFiles([]);
      setUploadProgress(0);
      setShowConfirm(false);
      setMsg({ text: "Entry saved successfully!", type: "success" });

      // Clear success message after 3 seconds
      setTimeout(() => setMsg({ text: "", type: "" }), 3000);

    } catch (e) {
      setMsg({ text: "Failed to save. Please try again.", type: "error" });
    }
  };

  // Helper to determine icon based on file type
  const getFileIcon = (fileName) => {
    return fileName.toLowerCase().endsWith(".pdf") ? <FaFilePdf className="text-red-500" /> : <FaFileAlt className="text-blue-500" />;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <h1 className="text-xl md:text-2xl font-bold text-center mb-6 text-mint-600">
        Cash Withdraw Entry
      </h1>

      {/* --- Main Form Card --- */}
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Date & Amount */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-transparent text-gray-800 font-medium focus:outline-none"
            />
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
              Amount ({currency})
            </label>
            <NumericFormat
              value={amount}
              thousandSeparator={true}
              decimalScale={2}
              allowNegative={false}
              placeholder="0.00"
              className="w-full bg-transparent text-xl font-bold text-gray-800 placeholder-gray-300 focus:outline-none"
              onValueChange={(values) => {
                setAmount(values.value)
              }}
            />
          </div>
        </div>

        {/* Category & Method */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-transparent text-gray-800 font-medium focus:outline-none cursor-pointer"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
              Method
            </label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="w-full bg-transparent text-gray-800 font-medium focus:outline-none cursor-pointer"
            >
              {METHODS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Reference & Notes */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="grid grid-cols-1 gap-4">
             <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                  Reference (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Slip No, Transfer ID..."
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="w-full border-b border-gray-200 pb-2 focus:border-mint-500 focus:outline-none text-sm"
                />
             </div>
             <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                  Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Additional details..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full border-b border-gray-200 pb-2 focus:border-mint-500 focus:outline-none text-sm resize-none"
                />
             </div>
          </div>
        </div>

        {/* Receipt Upload (Multiple) */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex justify-between items-center mb-3">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
              Receipts <span className="text-red-500">*</span>
            </label>
            <span className="text-xs text-gray-400">{files.length} selected</span>
          </div>

          <label className="cursor-pointer flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-mint-200 rounded-lg hover:bg-mint-50 transition-colors">
            <FaUpload className="text-mint-400 text-xl mb-1" />
            <span className="text-sm text-gray-600 font-medium">Click to attach files</span>
            <span className="text-xs text-gray-400">(PDF, JPG, PNG allowed)</span>
            <input
              type="file"
              multiple // <--- Enable multiple files
              accept="application/pdf,image/jpeg,image/png,image/jpg"
              onChange={onFileChange}
              className="hidden"
            />
          </label>

          {/* File List */}
          {files.length > 0 && (
            <div className="mt-4 space-y-2">
              {files.map((file, idx) => (
                <div key={idx} className="flex items-center justify-between bg-gray-50 p-2 rounded-md border border-gray-100">
                  <div className="flex items-center gap-3 overflow-hidden">
                    {getFileIcon(file.name)}
                    <span className="text-sm text-gray-700 truncate">{file.name}</span>
                    <span className="text-xs text-gray-400">({(file.size / 1024).toFixed(0)} KB)</span>
                  </div>
                  <button 
                    onClick={() => removeFile(idx)}
                    className="text-gray-400 hover:text-red-500 p-1 transition-colors"
                  >
                    <FaTrash size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Progress Bar (Only show when actually uploading) */}
          {isUploading && (
            <div className="mt-3">
              <div className="flex justify-between text-xs text-mint-600 mb-1">
                <span>Uploading files...</span>
                <span>{uploadProgress.toFixed(0)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div
                  className="bg-mint-500 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Global Message */}
        {msg.text && (
            <div className={`p-3 rounded-lg flex items-center gap-2 text-sm ${msg.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                {msg.type === 'error' ? <FaExclamationCircle /> : <FaCheckCircle />}
                {msg.text}
            </div>
        )}

        {/* Submit Button */}
        <button
          onClick={() => setShowConfirm(true)}
          disabled={isSaving || isUploading || !companyId || !branchId}
          className="w-full bg-gradient-to-r from-mint-500 to-mint-600 hover:from-mint-600 hover:to-mint-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3.5 rounded-xl font-bold text-lg shadow-md transition-all transform active:scale-[0.98] flex items-center justify-center gap-2"
        >
          {(isSaving || isUploading) ? (
            <>
              <FaSpinner className="animate-spin" />
              <span>{isUploading ? "Uploading..." : "Saving..."}</span>
            </>
          ) : (
            "Save Withdraw Entry"
          )}
        </button>

      </div>

      {/* --- Confirm Modal --- */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm animate-in fade-in zoom-in duration-200">
            <h2 className="text-lg font-bold mb-4 text-gray-800 text-center">Confirm Details</h2>

            <div className="space-y-3 text-sm bg-gray-50 p-4 rounded-xl border border-gray-100">
              <div className="flex justify-between border-b border-gray-200 pb-2">
                <span className="text-gray-500">Amount</span>
                <span className="font-bold text-lg text-red-600">{currency} {(Number(amount) || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Date</span>
                <span className="font-medium">{date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Category</span>
                <span className="font-medium text-right">{category}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Method</span>
                <span className="font-medium">{method}</span>
              </div>
              <div className="flex justify-between items-center">
                 <span className="text-gray-500">Attachments</span>
                 <span className="text-xs bg-mint-100 text-mint-700 px-2 py-0.5 rounded-full font-bold">
                    {files.length} Files
                 </span>
              </div>
              {notes && (
                <div className="pt-2 border-t border-gray-200">
                  <span className="text-gray-500 block mb-1">Notes</span>
                  <p className="text-gray-800 italic">{notes}</p>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || isUploading}
                className="flex-1 py-2.5 rounded-xl bg-mint-500 hover:bg-mint-600 text-white font-bold transition-colors flex justify-center items-center gap-2"
              >
                 {(isSaving || isUploading) ? <FaSpinner className="animate-spin" /> : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}