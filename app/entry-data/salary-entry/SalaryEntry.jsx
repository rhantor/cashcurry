/* eslint-disable no-unused-vars */
"use client";
import React, { useEffect, useMemo, useState } from "react";
import { NumericFormat } from "react-number-format";
import { useAddSalaryEntryMutation } from "@/lib/redux/api/salaryApiSlice";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db, storage } from "@/lib/firebase";
import { FaUpload, FaFilePdf, FaFileAlt, FaSpinner, FaTrash, FaExclamationCircle, FaCheckCircle, FaEye } from "react-icons/fa";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import useCurrency from "@/app/hooks/useCurrency";

/** ---- tiny helpers ---- */
const toISODate = (d) => new Date(d).toISOString().slice(0, 10);
const toISOMonth = (d) => new Date(d).toISOString().slice(0, 7);
const monthStartEnd = (yyyyMM) => {
  const [y, m] = yyyyMM.split("-").map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0);
  const toISO = (d) => toISODate(d);
  return { monthStart: toISO(start), monthEnd: toISO(end) };
};

const PAID_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "card", label: "Card" },
  { value: "qr", label: "QR" },
  { value: "online", label: "Online" },
];

export default function SalaryEntryPage() {
  const currency = useCurrency();
  const thisMonth = toISOMonth(new Date());
  const [month, setMonth] = useState(thisMonth);
  const today = toISODate(new Date());
  const [paymentDate, setPaymentDate] = useState(today);

  const [companyId, setCompanyId] = useState(null);
  const [branchId, setBranchId] = useState(null);

  const [totalSalary, setTotalSalary] = useState("");
  const numericTotal = useMemo(() => parseFloat(totalSalary) || 0, [totalSalary]);

  const [paidFromOffice, setPaidFromOffice] = useState("front");
  const [paidMethod, setPaidMethod] = useState("cash");
  const [notes, setNotes] = useState("");

  // PDF Upload & Preview State
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfName, setPdfName] = useState("");
  const [previewUrl, setPreviewUrl] = useState(null); // <--- NEW: For Preview
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const [showConfirm, setShowConfirm] = useState(false);
  const [msg, setMsg] = useState({ text: "", type: "" });

  const [addSalaryEntry, { isLoading: isSaving }] = useAddSalaryEntryMutation();

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      const parsed = JSON.parse(storedUser);
      setCompanyId(parsed.companyId);
      setBranchId(parsed.branchId);
    }
  }, []);

  // Cleanup preview URL to avoid memory leaks
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    if (paidFromOffice === "front") {
      setPaidMethod("cash");
    } else if (paidFromOffice === "back" && paidMethod === "cash") {
      setPaidMethod("bank_transfer");
    }
  }, [paidFromOffice]);

  const handleTotalChange = (value) => {
    const num = parseFloat(value);
    if (!isNaN(num) && num >= 0) setTotalSalary(value);
    else if (value === "") setTotalSalary("");
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      setMsg({ text: "Please select a PDF file.", type: "error" });
      return;
    }

    setMsg({ text: "", type: "" });
    setPdfFile(file);
    setPdfName(file.name);
    setUploadProgress(0);

    // Generate Preview URL
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  const removeFile = () => {
    setPdfFile(null);
    setPdfName("");
    setUploadProgress(0);
    // Cleanup preview
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  };

  const uploadPdf = () => {
    if (!pdfFile || !companyId || !branchId || !month) return null;

    setIsUploading(true);
    const filePath = `salarySheets/${companyId}/${branchId}/${month}-${Date.now()}.pdf`;
    const storageRef = ref(storage, filePath);

    return new Promise((resolve, reject) => {
      const uploadTask = uploadBytesResumable(storageRef, pdfFile);
      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        },
        (err) => {
          setIsUploading(false);
          reject(err);
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          setIsUploading(false);
          resolve(downloadURL);
        }
      );
    });
  };

  const handleSave = async () => {
    if (!companyId || !branchId) return;
    setMsg({ text: "", type: "" });

    try {
      // 1. Check Duplicate
      const salariesRef = collection(db, "companies", companyId, "branches", branchId, "salaries");
      const q = query(salariesRef, where("month", "==", month));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        setMsg({ text: "Salary entry already exists for this month.", type: "error" });
        return;
      }

      // 2. Upload PDF
      let uploadedUrl = "";
      if (pdfFile) {
        uploadedUrl = await uploadPdf();
      }

      // 3. Prepare Data
      const storedUser = localStorage.getItem("user");
      const createdBy = storedUser ? JSON.parse(storedUser) : {};
      const { monthStart, monthEnd } = monthStartEnd(month);
      const paymentMonth = paymentDate ? paymentDate.slice(0, 7) : null;

      const data = {
        month,
        monthStart,
        monthEnd,
        paymentDate,
        paymentMonth,
        paidFromOffice,
        paidMethod,
        totalSalary: numericTotal,
        amount: numericTotal,
        notes,
        pdfUrl: uploadedUrl || "",
        createdBy,
        createdAt: new Date().toISOString(),
      };

      // 4. Submit
      await addSalaryEntry({ companyId, branchId, data }).unwrap();

      // 5. Reset
      setTotalSalary("");
      setNotes("");
      removeFile();
      setShowConfirm(false);
      setMsg({ text: "Salary entry saved successfully!", type: "success" });
      setTimeout(() => setMsg({ text: "", type: "" }), 3000);

    } catch (err) {
      console.error("Save failed:", err);
      setMsg({ text: "Failed to save. Please try again.", type: "error" });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <h1 className="text-xl md:text-2xl font-bold text-center mb-6 text-mint-600">
        Salary Entry
      </h1>

      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Period & Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
              Salary Period (Work Month)
            </label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-full bg-transparent text-gray-800 font-medium focus:outline-none"
            />
             <p className="text-[10px] text-gray-400 mt-1">E.g., Select August if paying for August work.</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
              Payment Date
            </label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full bg-transparent text-gray-800 font-medium focus:outline-none"
            />
          </div>
        </div>

        {/* Amount & Office */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
              Total Salary ({currency})
            </label>
            <NumericFormat
              value={totalSalary}
              thousandSeparator={true}
              decimalScale={2}
              allowNegative={false}
              placeholder="0.00"
              className="w-full bg-transparent text-xl font-bold text-gray-800 placeholder-gray-300 focus:outline-none"
              onValueChange={(values) => setTotalSalary(values.value)}
            />
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
             <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
              Paid From
            </label>
            <select
              value={paidFromOffice}
              onChange={(e) => setPaidFromOffice(e.target.value)}
              className="w-full bg-transparent text-gray-800 font-medium focus:outline-none cursor-pointer"
            >
              <option value="front">Front Office (Cash)</option>
              <option value="back">Back Office (Bank)</option>
            </select>
          </div>
        </div>

        {/* Method & Notes */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                Payment Method
              </label>
              <select
                value={paidMethod}
                onChange={(e) => setPaidMethod(e.target.value)}
                disabled={paidFromOffice === "front"}
                className="w-full bg-transparent text-gray-800 font-medium focus:outline-none cursor-pointer disabled:text-gray-400"
              >
                {PAID_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <div>
               <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
                Notes
              </label>
              <input
                type="text"
                placeholder="Optional (e.g. bonus, deduction)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full border-b border-gray-200 pb-1 focus:border-mint-500 focus:outline-none text-sm"
              />
            </div>
          </div>
        </div>

        {/* PDF Upload & Preview */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
           <div className="flex justify-between items-center mb-3">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
              Salary Sheet (PDF)
            </label>
          </div>

          {!pdfName ? (
            <label className="cursor-pointer flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-mint-200 rounded-lg hover:bg-mint-50 transition-colors">
              <FaUpload className="text-mint-400 text-xl mb-1" />
              <span className="text-sm text-gray-600 font-medium">Click to attach PDF</span>
              <input
                type="file"
                accept="application/pdf"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          ) : (
            <div className="space-y-3">
               {/* File Info Bar */}
               <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <div className="flex items-center gap-3">
                    <FaFilePdf className="text-red-500 text-xl" />
                    <div>
                      <p className="text-sm font-medium text-gray-700 truncate max-w-[200px] md:max-w-sm">{pdfName}</p>
                      {isUploading && <p className="text-xs text-mint-500">Uploading {uploadProgress.toFixed(0)}%</p>}
                    </div>
                  </div>
                  <button 
                    onClick={removeFile}
                    disabled={isUploading}
                    className="text-gray-400 hover:text-red-500 p-2 transition-colors"
                  >
                    <FaTrash />
                  </button>
               </div>
               
               {/* --- PDF PREVIEW --- */}
               {previewUrl && (
                  <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-100">
                    <div className="bg-gray-200 px-3 py-1 flex items-center gap-2 text-xs text-gray-600 font-bold uppercase">
                       <FaEye /> Preview
                    </div>
                    <iframe 
                        src={previewUrl} 
                        className="w-full h-64 md:h-96" 
                        title="PDF Preview"
                    />
                  </div>
               )}
            </div>
          )}
          
          {isUploading && (
            <div className="mt-2 w-full bg-gray-200 rounded-full h-1">
              <div
                className="bg-mint-500 h-1 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
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
          onClick={() => {
            if (!numericTotal || numericTotal <= 0) {
              setMsg({ text: "Enter a valid salary amount greater than zero.", type: "error" })
              return
            }
            setShowConfirm(true)
          }}
          disabled={isSaving || isUploading || !companyId || !branchId}
          className="w-full bg-gradient-to-r from-mint-500 to-mint-600 hover:from-mint-600 hover:to-mint-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3.5 rounded-xl font-bold text-lg shadow-md transition-all transform active:scale-[0.98] flex items-center justify-center gap-2"
        >
          {(isSaving || isUploading) ? (
            <>
              <FaSpinner className="animate-spin" />
              <span>{isUploading ? "Uploading..." : "Saving..."}</span>
            </>
          ) : (
            "Save Salary Entry"
          )}
        </button>

      </div>

      {/* Confirm Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm animate-in fade-in zoom-in duration-200">
            <h2 className="text-lg font-bold mb-4 text-gray-800 text-center">Confirm Entry</h2>

            <div className="space-y-3 text-sm bg-gray-50 p-4 rounded-xl border border-gray-100">
              <div className="flex justify-between border-b border-gray-200 pb-2">
                <span className="text-gray-500">Total Salary</span>
                <span className="font-bold text-lg text-green-600">{currency} {numericTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Period</span>
                <span className="font-medium">{month}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Paid Date</span>
                <span className="font-medium">{paymentDate}</span>
              </div>
              <div className="flex justify-between">
                 <span className="text-gray-500">Source</span>
                 <span className="font-medium capitalize">{paidFromOffice} Office</span>
              </div>
              <div className="flex justify-between">
                 <span className="text-gray-500">Method</span>
                 <span className="font-medium capitalize">{PAID_METHODS.find(m => m.value === paidMethod)?.label}</span>
              </div>
              {pdfName && (
                <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                  <span className="text-gray-500">Attachment</span>
                  <div className="flex items-center gap-1 text-xs bg-red-50 text-red-600 px-2 py-1 rounded">
                     <FaFilePdf /> PDF Included
                  </div>
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