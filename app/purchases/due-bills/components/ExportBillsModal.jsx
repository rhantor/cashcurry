import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileText, CheckSquare, Square, Download, FileSpreadsheet } from 'lucide-react';

export default function ExportBillsModal({ 
  isOpen, 
  onClose, 
  vendors, 
  onExportSummary, 
  onExportIndividual, 
  isExporting 
}) {
  const [selectedVendors, setSelectedVendors] = useState([]);

  // Reset selection when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedVendors(vendors.map(v => v.id)); // Default: select all
    }
  }, [isOpen, vendors]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleToggleAll = () => {
    if (selectedVendors.length === vendors.length) {
      setSelectedVendors([]);
    } else {
      setSelectedVendors(vendors.map(v => v.id));
    }
  };

  const handleToggleVendor = (id) => {
    if (selectedVendors.includes(id)) {
      setSelectedVendors(selectedVendors.filter(vId => vId !== id));
    } else {
      setSelectedVendors([...selectedVendors, id]);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key='backdrop'
            className='fixed inset-0 bg-black/40 backdrop-blur-sm z-50'
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={!isExporting ? onClose : undefined}
          />

          {/* Modal Container */}
          <div className='fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 pointer-events-none'>
            <motion.div
              key='modal'
              className='pointer-events-auto bg-white flex flex-col overflow-hidden w-full max-w-lg max-h-[90vh] rounded-2xl shadow-2xl relative'
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            >
              {/* Header */}
              <div className='flex items-start justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0 bg-white'>
                <div>
                  <h2 className='text-lg font-bold text-gray-900'>Export Bills</h2>
                  <p className='text-xs text-gray-400 mt-0.5'>
                    Select vendors to download their statements.
                  </p>
                </div>
                <button
                  onClick={onClose}
                  disabled={isExporting}
                  className='p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors disabled:opacity-50'
                >
                  <X className='w-5 h-5' />
                </button>
              </div>

              {/* Body */}
              <div className='flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50/50'>
                <div className='bg-white rounded-xl border border-gray-200 overflow-hidden'>
                  <div className='flex items-center justify-between p-3 border-b border-gray-100 bg-gray-50'>
                    <span className='text-sm font-semibold text-gray-700'>
                      Vendors ({selectedVendors.length}/{vendors.length})
                    </span>
                    <button
                      onClick={handleToggleAll}
                      disabled={isExporting}
                      className='text-xs font-medium text-mint-600 hover:text-mint-700 flex items-center gap-1 transition-colors'
                    >
                      {selectedVendors.length === vendors.length ? (
                        <><CheckSquare className="w-3.5 h-3.5" /> Deselect All</>
                      ) : (
                        <><Square className="w-3.5 h-3.5" /> Select All</>
                      )}
                    </button>
                  </div>
                  
                  <div className='divide-y divide-gray-100 max-h-60 overflow-y-auto'>
                    {vendors.length === 0 && (
                      <div className="p-4 text-center text-sm text-gray-500">
                        No vendors with pending bills.
                      </div>
                    )}
                    {vendors.map(vendor => (
                      <label 
                        key={vendor.id} 
                        className={`flex items-center gap-3 p-3 cursor-pointer transition-colors hover:bg-gray-50 ${isExporting ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <input
                          type='checkbox'
                          checked={selectedVendors.includes(vendor.id)}
                          onChange={() => handleToggleVendor(vendor.id)}
                          disabled={isExporting}
                          className='w-4 h-4 rounded border-gray-300 text-mint-600 focus:ring-mint-600 cursor-pointer'
                        />
                        <div className='flex-1 min-w-0'>
                          <p className='text-sm font-medium text-gray-800 truncate'>
                            {vendor.name}
                          </p>
                          <p className='text-xs text-gray-400'>
                            {vendor.billsCount} pending bill(s)
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
                
                {isExporting && (
                  <div className="mt-4 p-3 bg-blue-50 text-blue-700 rounded-lg text-sm flex items-center justify-center gap-2 font-medium">
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generating PDFs... Please wait.
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className='px-6 py-4 border-t border-gray-100 bg-white flex flex-col sm:flex-row gap-3 justify-end flex-shrink-0'>
                <button
                  onClick={() => onExportSummary(selectedVendors)}
                  disabled={isExporting || selectedVendors.length === 0}
                  className='flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
                >
                  <FileSpreadsheet className='w-4 h-4' />
                  Summary Only
                </button>
                <button
                  onClick={() => onExportIndividual(selectedVendors)}
                  disabled={isExporting || selectedVendors.length === 0}
                  className='flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
                >
                  <Download className='w-4 h-4' />
                  Download Individual PDFs
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
