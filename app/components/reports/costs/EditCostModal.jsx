"use client";
import React, { useState, useEffect, useMemo } from "react";
import { FaUpload, FaTimes } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import imageCompression from "browser-image-compression";
import { format } from "date-fns";
import { storage } from "@/lib/firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { useUpdateCostEntryMutation } from "@/lib/redux/api/costApiSlice";
import useResolvedCompanyBranch from "@/utils/useResolvedCompanyBranch";
import useCurrency from "@/app/hooks/useCurrency";

const CATEGORIES = [
  'Utilities', 'Inventory', 'Maintenance', 'Staff Cost', 'Rent/Deposit',
  'Transport/Delivery', 'Office Supplies', 'Operation', 'New Purchases/Assets',
  'Software/Subscriptions', 'Taxes/License', 'compund', 'Packaging',
  'Marketing/Ads', 'Bank Charges', 'Other'
];

const BACK_OFFICE_METHODS = [
  { value: 'card', label: 'Card' },
  { value: 'qr', label: 'QR' },
  { value: 'online', label: 'Online' },
  { value: 'bank_transfer', label: 'Bank Transfer' }
];

export default function EditCostModal({ cost, onClose, onSuccess }) {
  const currency = useCurrency();
  const { ready, companyId, branchId } = useResolvedCompanyBranch();
  const [updateCostEntry, { isLoading: isUpdating }] = useUpdateCostEntryMutation();

  const [date, setDate] = useState(() => {
    return cost.date ? format(new Date(cost.date), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd");
  });
  const [amount, setAmount] = useState(cost?.amount || "");
  const [category, setCategory] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [description, setDescription] = useState(cost?.description || "");
  
  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState(cost?.fileURL || null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [paidFromOffice, setPaidFromOffice] = useState(cost?.paidFromOffice || "front");
  const [paidMethod, setPaidMethod] = useState(cost?.paidMethod || "cash");

  useEffect(() => {
    if (cost?.category) {
      if (CATEGORIES.includes(cost.category)) {
        setCategory(cost.category);
      } else {
        setCategory("Other");
        setCustomCategory(cost.category);
      }
    }
  }, [cost]);

  // Keep method synced with office choice
  useEffect(() => {
    if (paidFromOffice === 'front') {
      setPaidMethod('cash');
    } else if (paidFromOffice === 'back' && paidMethod === 'cash') {
      setPaidMethod(''); 
    }
  }, [paidFromOffice]);

  const resolvedCategory = useMemo(() => {
    return category === 'Other' ? (customCategory || 'Other').trim() : category;
  }, [category, customCategory]);

  const handleFileChange = async (e) => {
    try {
      const selectedFile = e.target.files[0];
      if (!selectedFile) return;
      let processedFile = selectedFile;
      if (selectedFile.type.startsWith('image/')) {
        const options = { maxSizeMB: 0.5, maxWidthOrHeight: 1024, useWebWorker: true };
        processedFile = await imageCompression(selectedFile, options);
        setFilePreview(URL.createObjectURL(processedFile));
      } else {
        setFilePreview(null);
      }
      setFile(processedFile);
    } catch (err) {
      console.error('File processing error:', err);
      alert('Failed to process file. Try again.');
    }
  };

  const uploadFile = async () => {
    if (!file || !companyId || !branchId) return null;
    return new Promise((resolve, reject) => {
      try {
        const fileExtension = file.name.split('.').pop();
        const safeCategory = (resolvedCategory || 'uncategorized').replace(/[^\w-]+/g, '_');
        const officeFolder = paidFromOffice === 'front' ? 'front' : 'back';
        const filePath = `costs/${companyId}/${branchId}/${safeCategory}/${officeFolder}/${Date.now()}.${fileExtension}`;
        const storageRef = ref(storage, filePath);
        
        const uploadTask = uploadBytesResumable(storageRef, file);
        uploadTask.on('state_changed',
          snapshot => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setUploadProgress(progress);
          },
          error => {
            console.error('Upload failed:', error);
            reject(error);
          },
          async () => {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(downloadURL);
          }
        );
      } catch (err) { reject(err); }
    });
  };

  const handleSave = async () => {
    if (!amount) return alert('Please enter amount.');
    if (!resolvedCategory) return alert('Please select a category.');
    if (category === 'Other' && !customCategory.trim()) return alert('Please type a custom category name.');
    if (paidFromOffice === 'back' && !paidMethod) return alert('Please select a payment method for Back Office.');

    try {
      let fileURL = cost?.fileURL;
      if (file) {
        fileURL = await uploadFile();
      }

      const data = {
        date,
        amount: Number(amount),
        category: resolvedCategory,
        description: description?.trim() || '',
        fileURL: fileURL || null,
        paidFromOffice,
        paidMethod: paidFromOffice === 'front' ? 'cash' : paidMethod,
        isFrontOffice: paidFromOffice === 'front',
        isBackOffice: paidFromOffice === 'back',
        updatedAt: new Date().toISOString()
      };

      await updateCostEntry({ companyId, branchId, costId: cost.id, data }).unwrap();
      onSuccess();
    } catch (err) {
      console.error('Update failed:', err);
      alert('Failed to update cost entry.');
    }
  };

  const overlayVar = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 }
  };

  const modalVar = {
    hidden: { opacity: 0, y: 50, scale: 0.95 },
    visible: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 300, damping: 25 } },
    exit: { opacity: 0, scale: 0.95, y: 20 }
  };

  return (
    <AnimatePresence>
      <motion.div 
        variants={overlayVar} 
        initial="hidden" 
        animate="visible" 
        exit="hidden"
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-[100] p-0 sm:p-4"
      >
        <motion.div 
          variants={modalVar}
          initial={{ opacity: 0, y: 100, scale: 1 }}
          animate={{ opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 300, damping: 25 } }}
          exit={{ opacity: 0, y: 100, scale: 0.95 }}
          className="bg-white rounded-t-3xl sm:rounded-2xl w-full max-w-lg mt-0 sm:mt-auto sm:mb-auto relative flex flex-col max-h-[85vh] sm:max-h-[90vh] shadow-2xl overflow-hidden border border-gray-100 pt-2 sm:pt-0"
        >
          {/* Header */}
          <div className="px-5 sm:px-6 py-4 sm:py-5 border-b border-gray-50 flex justify-between items-center bg-gradient-to-r from-blue-50/50 to-indigo-50/50">
            <h2 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Update Cost Entry
            </h2>
            <button 
              onClick={onClose} 
              className="p-2 text-gray-400 hover:text-red-500 bg-white rounded-full hover:bg-red-50 hover:shadow-sm transition-all absolute right-4 top-4"
            >
              <FaTimes size={16}/>
            </button>
          </div>

          {/* Form Content */}
          <div className="p-5 sm:p-6 overflow-y-auto overflow-x-hidden relative styled-scrollbar">
            <div className="space-y-4 sm:space-y-5">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Date</label>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} 
                    className="w-full rounded-xl border border-gray-200 p-2.5 sm:p-3 text-sm text-gray-700 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Amount ({currency})</label>
                  <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" 
                    className="w-full rounded-xl border border-gray-200 p-2.5 sm:p-3 text-sm text-gray-700 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm font-medium" 
                  />
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <label className="block text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Payment Source</label>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 text-sm mb-3">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input type="radio" name="editPaidFrom" value="front" checked={paidFromOffice === 'front'} onChange={() => setPaidFromOffice('front')} 
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    /> 
                    <span className="font-medium text-gray-700 group-hover:text-blue-600 transition-colors">Front Office (Cash)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input type="radio" name="editPaidFrom" value="back" checked={paidFromOffice === 'back'} onChange={() => setPaidFromOffice('back')} 
                      className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                    /> 
                    <span className="font-medium text-gray-700 group-hover:text-indigo-600 transition-colors">Back Office</span>
                  </label>
                </div>
                {paidFromOffice === 'back' && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-2 text-sm overflow-hidden">
                    <select value={paidMethod} onChange={e => setPaidMethod(e.target.value)} 
                      className="w-full rounded-lg border border-gray-200 p-2.5 bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all shadow-sm"
                    >
                      <option value="" disabled>Select a payment method</option>
                      {BACK_OFFICE_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                  </motion.div>
                )}
              </div>

              <div>
                <label className="block text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Category</label>
                <select value={category} onChange={e => setCategory(e.target.value)} 
                  className="w-full rounded-xl border border-gray-200 p-2.5 sm:p-3 text-sm text-gray-700 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm"
                >
                  <option value="" disabled>Select a category</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                {category === 'Other' && (
                  <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}>
                    <input type="text" value={customCategory} onChange={e => setCustomCategory(e.target.value)} placeholder="Type custom category..." 
                      className="mt-3 w-full rounded-xl border border-gray-200 p-2.5 sm:p-3 text-sm text-gray-700 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none shadow-sm" 
                    />
                  </motion.div>
                )}
              </div>

              <div>
                <label className="block text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Description (Notes)</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Add any additional details..."
                  className="w-full rounded-xl border border-gray-200 p-2.5 sm:p-3 text-sm text-gray-700 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm resize-none" 
                />
              </div>

              <div className="bg-indigo-50/40 p-4 rounded-xl border border-indigo-100 border-dashed">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-3">
                  <label className="block text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-indigo-700">Attachment File</label>
                  <label className="cursor-pointer inline-flex w-full sm:w-auto justify-center items-center gap-2 px-4 py-2 bg-white text-indigo-700 text-xs font-semibold rounded-lg border border-indigo-200 shadow-sm hover:shadow hover:bg-indigo-50 transition-all">
                    <FaUpload className="text-indigo-500" />
                    <span>Upload New File</span>
                    <input type="file" accept=".pdf,image/*" onChange={handleFileChange} className="hidden" />
                  </label>
                </div>
                
                {filePreview ? (
                  <div className="mt-3">
                    <div className="w-full h-40 sm:h-56 border border-indigo-100 rounded-xl overflow-hidden bg-gray-50 flex items-center justify-center p-2 shadow-inner relative">
                      {filePreview.match(/\.(jpeg|jpg|gif|png|webp|bmp)(?:\?.*)?$/i) || filePreview.startsWith('blob:') ? (
                        <img 
                          src={filePreview} 
                          alt="Preview" 
                          className="max-w-full max-h-full object-contain rounded-lg"
                        />
                      ) : (
                        <iframe
                          src={filePreview}
                          className="w-full h-full rounded-lg"
                          title="Attached File Preview"
                        />
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="py-6 flex flex-col items-center justify-center text-indigo-400 bg-white/50 rounded-xl border border-indigo-50">
                    <span className="text-xs font-medium">No attachment available</span>
                  </div>
                )}

                {uploadProgress > 0 && uploadProgress < 100 && (
                  <div className="w-full bg-gray-200 rounded-full h-1.5 mt-4 overflow-hidden">
                    <motion.div 
                      className="bg-indigo-500 h-1.5 rounded-full" 
                      initial={{ width: 0 }}
                      animate={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 sm:px-6 sm:py-4 border-t border-gray-100 bg-gray-50 flex flex-col sm:flex-row justify-end gap-3">
            <button onClick={onClose} disabled={isUpdating} className="w-full sm:w-auto px-5 py-2.5 sm:py-2.5 rounded-xl font-medium text-gray-600 bg-white border border-gray-200 hover:bg-gray-100 transition-colors shadow-sm text-sm">
              Cancel
            </button>
            <button 
              onClick={handleSave} 
              disabled={isUpdating || (uploadProgress > 0 && uploadProgress < 100)} 
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md hover:shadow-lg active:scale-[0.98] transition-all disabled:opacity-50 text-sm flex items-center justify-center gap-2"
            >
              {isUpdating ? (
                <>
                  <svg className="animate-spin -ml-1 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Saving...
                </>
              ) : 'Save Updates'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

