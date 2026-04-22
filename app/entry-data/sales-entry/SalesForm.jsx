/* eslint-disable react/prop-types */
import React from "react";
import { FaUpload } from "react-icons/fa";
// 1. Import the library
import { NumericFormat } from "react-number-format";

export default function SalesForm({
  date,
  setDate,
  tendersConfig,
  form,
  handleChange,
  notes,
  handleNoteChange,
  openNote,
  setOpenNote,
  zReportFile,
  zReportPreview,
  handleFileChange,
  removeFile,
  uploadProgress,
  total,
  onSubmit,
  isSubmitDisabled,
  submitLabel,
  onCancel,
  showCancel,
  errorMessage,
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
      {/* Date Selector */}
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">
          Date
        </label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-gray-700 focus:ring-2 focus:ring-primary outline-none transition-all"
        />
      </div>

      {/* Dynamic Tender Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {tendersConfig.map((t) => (
          <div key={t.key} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-bold text-gray-500 uppercase">
                {t.label}
              </label>
              {t.requireProof && (
                <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold uppercase">
                  Proof Req.
                </span>
              )}
            </div>

            <div className="flex gap-2">
              {/* 2. Replaced standard input with NumericFormat */}
              <NumericFormat
                value={form[t.key] ?? ""}
                thousandSeparator={true} // Adds the commas (24,555)
                decimalScale={2}         // Limits to 2 decimal places
                fixedDecimalScale={false} // Set true if you always want .00
                allowNegative={false}
                placeholder="0.00"
                className="flex-1 bg-white border border-gray-200 rounded-lg p-2 text-lg font-semibold text-gray-800 placeholder-gray-300 focus:outline-none focus:border-primary transition-colors"
                // 3. Update state with the RAW value (no commas) so calculations work
                onValueChange={(values) => {
                  handleChange(t.key, values.value);
                }}
              />
              
              <button
                type="button"
                onClick={() => setOpenNote(openNote === t.key ? null : t.key)}
                className={`p-2 rounded-lg transition-colors ${
                  notes[t.key]
                    ? "bg-primary text-primary"
                    : "bg-gray-200 text-gray-500 hover:bg-gray-300"
                }`}
                title="Add Note"
              >
                📝
              </button>
            </div>

            {/* Note Input (Conditional) */}
            {(openNote === t.key || notes[t.key]) && (
              <input
                type="text"
                placeholder="Add a note..."
                value={notes[t.key] ?? ""}
                onChange={(e) => handleNoteChange(t.key, e.target.value)}
                className="mt-2 w-full text-xs bg-white border border-gray-200 rounded p-1.5 focus:outline-none focus:border-surface transition-colors"
              />
            )}
          </div>
        ))}
      </div>

      {/* Z Report Upload with Preview */}
      <div className="border-t border-gray-100 pt-4">
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
          Z Report Image
        </label>
        
        {!zReportPreview ? (
          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
            <FaUpload className="text-gray-400 text-2xl mb-2" />
            <span className="text-sm text-gray-500 font-medium">Click to upload Z Report</span>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
        ) : (
          <div className="relative group w-full sm:w-64 h-auto border rounded-lg overflow-hidden bg-gray-100">
             {/* PREVIEW IMAGE */}
             <img 
               src={zReportPreview} 
               alt="Preview" 
               className="w-full h-auto object-contain max-h-64"
             />
             
             {/* Overlay Actions */}
             <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <a 
                  href={zReportPreview} 
                  target="_blank" 
                  rel="noreferrer"
                  className="px-3 py-1 bg-white/90 rounded text-xs font-bold hover:bg-white"
                >
                  View Full
                </a>
                <button 
                  onClick={removeFile}
                  className="px-3 py-1 bg-red-500/90 text-white rounded text-xs font-bold hover:bg-red-600"
                >
                  Remove
                </button>
             </div>

             {/* Progress Bar */}
             {uploadProgress > 0 && uploadProgress < 100 && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200">
                  <div 
                    className="h-full bg-green-500 transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
             )}
          </div>
        )}
        
        {/* File Name Info */}
        {zReportFile && (
           <p className="text-xs text-gray-400 mt-1">
             Selected: {zReportFile.name} ({(zReportFile.size/1024/1024).toFixed(2)} MB)
           </p>
        )}
      </div>

      {/* Total & Submit */}
      <div className="flex flex-col gap-4 border-t border-gray-100 pt-6">
         <div className="flex justify-between items-end">
            <span className="text-sm font-medium text-gray-500">Total Sales</span>
            <span className="text-3xl font-bold text-green-600">
              {total.toLocaleString(undefined, {style: 'currency', currency: 'MYR'})}
            </span>
         </div>

         {errorMessage && (
           <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2">
             <span>⚠️</span> {errorMessage}
           </div>
         )}

         <div className="flex gap-3">
            {showCancel && (
              <button
                onClick={onCancel}
                className="flex-1 py-3 rounded-xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Cancel Edit
              </button>
            )}
            <button
              onClick={onSubmit}
              disabled={isSubmitDisabled}
              className="flex-[2] py-3 rounded-xl font-bold text-white bg-primary hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed shadow-md transition-all active:scale-[0.98]"
            >
              {submitLabel}
            </button>
         </div>
      </div>
    </div>
  );
}