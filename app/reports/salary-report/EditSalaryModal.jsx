/* eslint-disable react/prop-types */
import React, { useState } from "react";
import { useUpdateSalaryEntryMutation } from "@/lib/redux/api/salaryApiSlice";
import { FaTimes, FaSpinner, FaSave } from "react-icons/fa";
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
  
  const [updateSalaryEntry, { isLoading }] = useUpdateSalaryEntryMutation();

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

      await updateSalaryEntry({ 
        companyId, 
        branchId, 
        entryId: item.id, 
        data 
      }).unwrap();
      
      onClose(); // Close modal on success
    } catch (error) {
      console.error("Failed to update salary:", error);
      alert("Failed to update. Please try again.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
          <h3 className="font-bold text-gray-800">Edit Salary Entry</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <FaTimes />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          
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
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            disabled={isLoading}
            className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-mint-500 hover:bg-mint-600 rounded-lg shadow-sm transition-all disabled:opacity-50"
          >
            {isLoading ? <FaSpinner className="animate-spin" /> : <FaSave />}
            <span>Save Changes</span>
          </button>
        </div>
      </div>
    </div>
  );
}