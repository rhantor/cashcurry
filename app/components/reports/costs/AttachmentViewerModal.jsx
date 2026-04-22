import React, { useState } from "react";
import Modal from "@/app/components/common/Modal";

export default function AttachmentViewerModal({ costEntry, onClose }) {
  const attachments = costEntry.attachments?.length > 0 
    ? costEntry.attachments 
    : (costEntry.fileURL ? [costEntry.fileURL] : []);
    
  const allocations = costEntry.meta?.allocations || [];

  const [activeIndex, setActiveIndex] = useState(0);

  const activeUrl = attachments[activeIndex];
  const isImage = activeUrl && activeUrl.match(/\.(jpeg|jpg|gif|png|webp)(\?|$)/i) !== null;
  const isPDF = activeUrl && activeUrl.match(/\.(pdf)(\?|$)/i) !== null;

  return (
    <Modal title="Payment Proof & Invoices" onClose={onClose} maxWidth="max-w-5xl">
       <div className="flex flex-col md:flex-row gap-6 h-[75vh]">
          {/* Left panel: Info & Thumbnails */}
          <div className="w-full md:w-1/3 flex flex-col gap-5 overflow-y-auto pr-2">
              <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <h3 className="font-semibold text-mint-700 border-b pb-2 mb-3">Transaction Details</h3>
                <p className="text-sm text-gray-700 font-medium leading-relaxed">{costEntry.description}</p>
                <div className="mt-3 flex items-end justify-between">
                   <p className="text-2xl font-bold text-gray-900 border-b-2 border-emerald-500 rounded-sm pb-1">
                      RM {Number(costEntry.amount).toFixed(2)}
                   </p>
                </div>
                <div className="text-xs text-gray-500 mt-3 font-mono tracking-wide">
                   {costEntry.category} • {costEntry.paidMethod} ({costEntry.paidFromOffice})
                </div>
              </div>

              {allocations.length > 0 && (
                <div className="bg-emerald-50/50 rounded-xl p-4 border border-emerald-100 text-sm shadow-sm">
                  <h4 className="font-bold text-emerald-800 mb-3 uppercase tracking-wide text-xs">Included Invoices ({allocations.length})</h4>
                  <ul className="space-y-3">
                    {allocations.map((a, i) => (
                       <li key={i} className="flex justify-between items-start text-xs bg-white p-3 rounded-lg shadow-sm border border-emerald-50">
                          <div>
                            <div className="font-bold text-gray-800 text-sm mb-0.5">{a.invoiceNo || a.billId}</div>
                            {a.invoiceDate && <div className="text-gray-400 font-mono text-[10px]">Date: {a.invoiceDate}</div>}
                          </div>
                          <div className="font-bold text-emerald-600 tabular-nums bg-emerald-50 px-2 py-1 rounded">
                             RM {Number(a.amount).toFixed(2)}
                          </div>
                       </li>
                    ))}
                  </ul>
                </div>
              )}

              {attachments.length > 1 && (
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                   <h4 className="font-bold text-gray-700 mb-3 uppercase tracking-wide text-xs">Attached Files ({attachments.length})</h4>
                   <div className="flex flex-col gap-2">
                     {attachments.map((url, i) => (
                        <button 
                          key={i} 
                          onClick={() => setActiveIndex(i)}
                          className={`text-left text-sm p-3 rounded-lg border transition-all ${i === activeIndex ? 'bg-mint-50 border-mint-400 text-mint-800 font-bold shadow-sm' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                        >
                          {i === attachments.length - 1 ? "🧾 Payment Proof Receipt" : `📄 Vendor Invoice #${i + 1}`}
                        </button>
                     ))}
                   </div>
                </div>
              )}
          </div>

          {/* Right panel: Main Viewer */}
          <div className="w-full md:w-2/3 bg-gray-100/80 rounded-2xl overflow-hidden border border-gray-200 flex items-center justify-center relative shadow-inner">
             {attachments.length === 0 ? (
                <div className="text-gray-400 italic">No attachments were uploaded for this transaction.</div>
             ) : (
                isPDF ? (
                  <iframe src={`${activeUrl}#view=FitH`} className="w-full h-full border-0" title="PDF Document" allowFullScreen />
                ) : (
                  <img src={activeUrl} alt="Document" className="max-w-full max-h-full object-contain drop-shadow-md rounded p-2" />
                )
             )}
          </div>
       </div>

       <div className="mt-5 flex justify-between items-center border-t pt-4">
          <div>
            {attachments.length > 0 && (
                <a href={activeUrl} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-blue-50 text-blue-600 font-medium text-sm rounded-lg hover:bg-blue-100 transition-colors">
                  ↗ Open File Externally
                </a>
            )}
          </div>
          <button onClick={onClose} className="px-6 py-2 bg-gray-800 hover:bg-gray-900 text-white font-medium rounded-lg shadow-sm transition-colors">Close Viewer</button>
       </div>
    </Modal>
  )
}
