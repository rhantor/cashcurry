/* eslint-disable react/prop-types */
import React, { useState, useEffect } from "react";
import { useUpdateSalaryEntryMutation, useDeleteSalaryEntryMutation } from "@/lib/redux/api/salaryApiSlice";
import { getCurrentUser } from "@/lib/authz/roles";
import { FaTimes, FaSpinner, FaSave, FaUpload, FaFilePdf, FaTrash, FaEye } from "react-icons/fa";
import { storage } from "@/lib/firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import useCurrency from "@/app/hooks/useCurrency";

const PAID_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "card", label: "Card" },
  { value: "qr", label: "QR" },
  { value: "online", label: "Online" },
];

export default function EditSalaryModal({ item, onClose, companyId, branchId }) {
  const currency = useCurrency();
  const [amount, setAmount] = useState(item.totalSalary || item.amount || 0);
  const [paymentDate, setPaymentDate] = useState(item.paymentDate || "");
  const [paidFromOffice, setPaidFromOffice] = useState(item.paidFromOffice || "front");
  const [paidMethod, setPaidMethod] = useState(item.paidMethod || "cash");
  const [notes, setNotes] = useState(item.notes || "");

  // Salary sheet attachment
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfName, setPdfName] = useState("");
  const [previewUrl, setPreviewUrl] = useState(null);   // blob: URL for a newly picked file
  const [existingUrl, setExistingUrl] = useState(item.pdfUrl || "");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [fileError, setFileError] = useState("");

  // Revoke the blob URL so picking several files in a row does not leak
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const [updateSalaryEntry, { isLoading }] = useUpdateSalaryEntryMutation();
  const [deleteSalaryEntry, { isLoading: isDeleting }] = useDeleteSalaryEntryMutation();

  const handleFileChange = (e) => {
    const picked = e.target.files[0];
    e.target.value = ""; // let the same file be re-picked after a remove
    if (!picked) return;

    if (picked.type !== "application/pdf") {
      setFileError("Please select a PDF file.");
      return;
    }

    setFileError("");
    setPdfFile(picked);
    setPdfName(picked.name);
    setUploadProgress(0);
    setPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(picked);
    });
  };

  const handleRemoveFile = () => {
    setPdfFile(null);
    setPdfName("");
    setExistingUrl("");
    setUploadProgress(0);
    setFileError("");
    setPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });
  };

  // Mirrors the path the salary entry form writes to, so both land together.
  const uploadPdf = () => {
    const period = item.month || (paymentDate ? paymentDate.slice(0, 7) : "unknown");
    const filePath = `salarySheets/${companyId}/${branchId}/${period}-${Date.now()}.pdf`;
    const storageRef = ref(storage, filePath);

    setIsUploading(true);
    return new Promise((resolve, reject) => {
      const task = uploadBytesResumable(storageRef, pdfFile);
      task.on(
        "state_changed",
        (snap) => setUploadProgress((snap.bytesTransferred / snap.totalBytes) * 100),
        (err) => {
          setIsUploading(false);
          reject(err);
        },
        async () => {
          const url = await getDownloadURL(task.snapshot.ref);
          setIsUploading(false);
          resolve(url);
        }
      );
    });
  };

  const handleSave = async () => {
    try {
      const data = {
        amount: parseFloat(amount),
        totalSalary: parseFloat(amount), // Keep consistent
        paymentDate,
        paidFromOffice,
        paidMethod,
        notes,
      };

      // Only touch pdfUrl when the attachment actually changed, so saving an
      // unrelated edit can never drop the existing sheet.
      if (pdfFile) {
        data.pdfUrl = await uploadPdf();
      } else if (!existingUrl && item.pdfUrl) {
        data.pdfUrl = "";
      }

      await updateSalaryEntry({ 
        companyId, 
        branchId, 
        entryId: item.id, 
        user: getCurrentUser(),
        data 
      }).unwrap();
      
      onClose(); // Close modal on success
    } catch (error) {
      console.error("Failed to update salary:", error);
      setIsUploading(false);
      alert(error?.message || "Failed to update. Please try again.");
    }
  };

  const handleDelete = async () => {
    if (window.confirm("Are you sure you want to delete this salary entry? This action cannot be undone.")) {
      try {
        await deleteSalaryEntry({ companyId, branchId, salaryId: item.id, user: getCurrentUser() }).unwrap();
        onClose();
      } catch (error) {
        console.error("Failed to delete salary:", error);
        alert("Failed to delete. Please try again.");
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md max-h-[92vh] flex flex-col bg-white rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
          <h3 className="font-bold text-gray-800">Edit Salary Entry</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <FaTimes />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 overflow-y-auto">
          
          {/* Amount */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Total Salary ({currency})</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-mint-500 outline-none"
            />
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Payment Date</label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-mint-500 outline-none"
            />
          </div>

          {/* Office & Method */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Paid From</label>
              <select
                value={paidFromOffice}
                onChange={(e) => {
                    setPaidFromOffice(e.target.value);
                    if(e.target.value === 'front') setPaidMethod('cash');
                }}
                className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-mint-500 outline-none"
              >
                <option value="front">Front (Cash)</option>
                <option value="back">Back (Bank)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Method</label>
              <select
                value={paidMethod}
                onChange={(e) => setPaidMethod(e.target.value)}
                disabled={paidFromOffice === 'front'}
                className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-mint-500 outline-none disabled:bg-gray-100"
              >
                {PAID_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Notes</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-mint-500 outline-none resize-none"
            />
          </div>

          {/* Salary sheet attachment */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Salary Sheet (PDF)</label>

            {!pdfName && !existingUrl ? (
              <label className="cursor-pointer flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-mint-200 rounded-lg hover:bg-mint-50 transition-colors">
                <FaUpload className="text-mint-400 text-xl mb-1" />
                <span className="text-sm text-gray-600 font-medium">Click to attach PDF</span>
                <input type="file" accept="application/pdf" onChange={handleFileChange} className="hidden" />
              </label>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <div className="flex items-center gap-3 min-w-0">
                    <FaFilePdf className="text-red-500 text-xl shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-700 truncate">
                        {pdfName || "Current salary sheet"}
                      </p>
                      <p className="text-[11px] text-gray-400">
                        {pdfFile ? "New file — saved when you press Save Changes" : "Already attached"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <a
                      href={previewUrl || existingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="View PDF"
                      className="text-gray-400 hover:text-blue-500 p-2 transition-colors"
                    >
                      <FaEye />
                    </a>
                    <button
                      onClick={handleRemoveFile}
                      disabled={isUploading}
                      title="Remove"
                      className="text-gray-400 hover:text-red-500 p-2 transition-colors disabled:opacity-50"
                    >
                      <FaTrash />
                    </button>
                  </div>
                </div>

                <label className="cursor-pointer block text-center text-xs font-semibold text-mint-600 hover:text-mint-700 border border-dashed border-mint-200 rounded-lg py-2 hover:bg-mint-50 transition-colors">
                  Replace with another PDF
                  <input type="file" accept="application/pdf" onChange={handleFileChange} className="hidden" />
                </label>
              </div>
            )}

            {isUploading && (
              <div className="mt-2">
                <div className="w-full bg-gray-200 rounded-full h-1">
                  <div
                    className="bg-mint-500 h-1 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-xs text-mint-600 mt-1">Uploading {uploadProgress.toFixed(0)}%</p>
              </div>
            )}

            {fileError && <p className="text-xs text-red-600 mt-1">{fileError}</p>}
          </div>
        </div>

        <div className="bg-gray-50 px-6 py-4 flex justify-between items-center">
          <button 
            onClick={handleDelete}
            disabled={isLoading || isDeleting || isUploading}
            className="text-xs font-bold text-red-500 hover:text-red-700 uppercase tracking-wider disabled:opacity-50"
          >
            {isDeleting ? "Deleting..." : "Delete Entry"}
          </button>
          <div className="flex gap-3">
            <button 
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={handleSave}
              disabled={isLoading || isDeleting || isUploading}
              className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-mint-500 hover:bg-mint-600 rounded-lg shadow-sm transition-all disabled:opacity-50"
            >
              {(isLoading || isUploading) ? <FaSpinner className="animate-spin" /> : <FaSave />}
              <span>{isUploading ? "Uploading..." : "Save Changes"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}