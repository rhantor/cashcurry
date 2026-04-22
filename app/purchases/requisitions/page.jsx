"use client";
import React, { useState, useMemo } from "react";
import { skipToken } from "@reduxjs/toolkit/query";
import useResolvedCompanyBranch from "@/utils/useResolvedCompanyBranch";
import {
  useGetRequisitionsQuery,
  useAddRequisitionMutation,
  useUpdateRequisitionMutation,
  useDeleteRequisitionMutation,
} from "@/lib/redux/api/requisitionsApiSlice";
import { useGetVendorsQuery } from "@/lib/redux/api/vendorsApiSlice";
import { useGetItemsQuery } from "@/lib/redux/api/itemsApiSlice";
import Button from "@/app/components/common/Button";
import Modal from "@/app/components/common/Modal";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatMoney } from "@/utils/formatMoney";
import useCurrency from "@/app/hooks/useCurrency";
import { Edit3, Trash2, FileText, Send, CheckCircle, XCircle } from "lucide-react";

const STATUS_COLORS = {
  Pending: "bg-yellow-100 text-yellow-800",
  Approved: "bg-emerald-100 text-emerald-800",
  Sent: "bg-blue-100 text-blue-800",
  Rejected: "bg-red-100 text-red-800",
};

export default function RequisitionsPage() {
  const { ready, companyId, branchId, user } = useResolvedCompanyBranch();
  const currency = useCurrency();
  const args = ready && companyId && branchId ? { companyId, branchId } : skipToken;

  const { data: requisitions = [], isLoading: reqLoading } = useGetRequisitionsQuery(args);
  const { data: vendors = [], isLoading: vLoading } = useGetVendorsQuery(companyId ? { companyId } : skipToken);
  const { data: items = [], isLoading: iLoading } = useGetItemsQuery(companyId ? { companyId } : skipToken);

  const [addReq, { isLoading: adding }] = useAddRequisitionMutation();
  const [updateReq, { isLoading: updating }] = useUpdateRequisitionMutation();
  const [deleteReq, { isLoading: deleting }] = useDeleteRequisitionMutation();
  
  const busy = reqLoading || vLoading || iLoading || adding || updating || deleting;

  const [openBuilder, setOpenBuilder] = useState(false);
  const [reqVendorId, setReqVendorId] = useState("");
  const [reqItems, setReqItems] = useState([]); // { itemId, requestedQty, estPrice }
  const [reqNotes, setReqNotes] = useState("");

  // Last Purchase History helper
  const getLastPurchaseData = (itemId, vendorId) => {
    // Find previous requisitions for this vendor that were at least Approved or Sent
    const pastForVendor = requisitions
      .filter(r => r.vendorId === vendorId && (r.status === "Approved" || r.status === "Sent"))
      .sort((a,b) => b.createdAt?.seconds - a.createdAt?.seconds);

    for (let req of pastForVendor) {
      const found = req.items?.find(i => i.itemId === itemId);
      if (found) {
        return {
          qty: found.requestedQty,
          price: found.estPrice,
          date: req.createdAt ? new Date(req.createdAt.seconds * 1000).toLocaleDateString() : "-",
        };
      }
    }
    return null;
  };

  const selectedVendor = useMemo(() => vendors.find(v => v.id === reqVendorId), [vendors, reqVendorId]);
  
  // Initialize checklist whenever vendor changes
  React.useEffect(() => {
    if (!reqVendorId) {
      setReqItems([]);
      return;
    }
    const vendorItems = items.filter(i => !i.vendorIds?.length || i.vendorIds.includes(reqVendorId));
    
    // Attempt to retain existing selections if vendor didn't change (prevents wipe on other renders)
    // But since this effect only triggers on reqVendorId or items changes, it's generally safe.
    // To preserve edits during items refetch, map over existing items.
    setReqItems(prev => {
      const existingMap = new Map(prev.map(p => [p.itemId, p]));
      
      return vendorItems.map(itemObj => {
         const existing = existingMap.get(itemObj.id);
         if (existing) return existing; // Keep user edits if already present
         
         const lastP = getLastPurchaseData(itemObj.id, reqVendorId);
         const autoPrice = lastP?.price || itemObj?.defaultPrice || "";
         return {
            itemId: itemObj.id,
            name: itemObj.name || "Unknown",
            unit: itemObj.unit || "Pcs",
            category: itemObj.category || "",
            requestedQty: "",
            estPrice: autoPrice,
            checked: false,
            lastQty: lastP?.qty,
            lastPrice: lastP?.price
         };
      });
    });
  }, [reqVendorId, items]);

  const updateReqItem = (itemId, key, val) => {
    setReqItems(prev => prev.map(i => i.itemId === itemId ? { ...i, [key]: val } : i));
  };

  const handleCreateRequisition = async () => {
    if (!reqVendorId) return alert("Select a vendor");
    
    const finalItems = reqItems.filter(i => i.checked && Number(i.requestedQty || 0) > 0);
    if (finalItems.length === 0) return alert("Select at least one item and enter a quantity.");

    try {
      await addReq({
        companyId, branchId,
        requisition: {
          vendorId: reqVendorId,
          vendorName: selectedVendor?.name || "Unknown",
          items: finalItems.map(({ lastQty, lastPrice, checked, ...rest }) => rest), // clean up ui state
          notes: reqNotes,
          createdBy: user?.uid || "Unknown User",
          createdByName: user?.displayName || user?.email || "Unknown",
          totalEst: finalItems.reduce((acc, curr) => acc + (Number(curr.requestedQty || 0) * Number(curr.estPrice || 0)), 0),
          status: "Pending" // Starts pending
        }
      }).unwrap();
      setOpenBuilder(false);
      setReqVendorId("");
      setReqItems([]);
      setReqNotes("");
    } catch (err) {
      console.error(err);
      alert("Failed to create requisition.");
    }
  };

  const generatePDF = (req) => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(20);
    doc.text("PURCHASE REQUISITION", 14, 22);
    
    doc.setFontSize(10);
    doc.text(`Ref ID: ${req.id}`, 14, 30);
    doc.text(`Date: ${req.createdAt ? new Date(req.createdAt.seconds * 1000).toLocaleDateString() : "-"}`, 14, 35);
    doc.text(`Status: ${req.status}`, 14, 40);

    // Vendor Info
    doc.setFontSize(12);
    const vInfo = vendors.find(v => v.id === req.vendorId);
    doc.text("Vendor Details:", 130, 22);
    doc.setFontSize(10);
    doc.text(`Name: ${req.vendorName}`, 130, 28);
    if(vInfo?.phone)  doc.text(`Phone: ${vInfo.phone}`, 130, 33);
    if(vInfo?.email)  doc.text(`Email: ${vInfo.email}`, 130, 38);
    if(vInfo?.address) {
       const splitAddress = doc.splitTextToSize(vInfo.address, 65);
       doc.text(splitAddress, 130, 43);
    }

    doc.line(14, 52, 196, 52); // separator

    // Items table
    const tableData = req.items.map((i, index) => [
      index + 1,
      i.name,
      i.category,
      `${i.requestedQty} ${i.unit}`,
      `${currency} ${Number(i.estPrice || 0).toFixed(2)}`,
      `${currency} ${(Number(i.requestedQty || 0) * Number(i.estPrice || 0)).toFixed(2)}`
    ]);

    autoTable(doc, {
      startY: 56,
      head: [["#", "Item", "Category", "Quantity", "Unit Price (Est)", "Total (Est)"]],
      body: tableData,
      theme: "grid",
      headStyles: { fillColor: [74, 222, 128] } // Mint colorish
    });

    // Totals
    const finalY = doc.lastAutoTable.finalY || 60;
    doc.setFontSize(12);
    doc.text(`Estimated Total: ${currency} ${req.totalEst.toFixed(2)}`, 140, finalY + 10);

    if (req.notes) {
      doc.setFontSize(10);
      doc.text("Notes/Remarks:", 14, finalY + 10);
      doc.setFont("helvetica", "italic");
      doc.text(doc.splitTextToSize(req.notes, 100), 14, finalY + 15);
    }

    doc.save(`Requisition_${req.vendorName.replace(/\s+/g,"_")}_${new Date().getTime()}.pdf`);
  };

  const updateStatus = async (req, newStatus) => {
    try {
      await updateReq({ companyId, branchId, requisitionId: req.id, patch: { status: newStatus } }).unwrap();
    } catch (e) {
      alert("Failed to update status.");
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Purchase Requisitions</h1>
          <p className="text-gray-500 text-sm">Generate and track vendor orders.</p>
        </div>
        
        <Button onClick={() => setOpenBuilder(true)} disabled={busy}>+ New Requisition</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {requisitions.map(req => (
          <div key={req.id} className="bg-white rounded-xl shadow p-5 border border-gray-100 flex flex-col justify-between h-full">
            <div>
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-gray-900 truncate pr-2">{req.vendorName}</h3>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[req.status] || "bg-gray-100"}`}>
                  {req.status}
                </span>
              </div>
              <p className="text-sm text-gray-500 mb-4 flex justify-between">
                <span>{req.createdAt ? new Date(req.createdAt.seconds * 1000).toLocaleDateString() : "-"}</span>
                <span>{req.items?.length || 0} items</span>
              </p>
              
              <div className="mb-4 text-2xl font-bold tabular-nums">
                {currency} {(req.totalEst || 0).toFixed(2)} <span className="text-sm font-normal text-gray-400">est.</span>
              </div>
            </div>

            <div className="pt-4 border-t flex flex-wrap gap-2">
               {req.status === "Pending" && (
                 <>
                   <button onClick={() => updateStatus(req, "Approved")} className="flex items-center gap-1 text-xs px-2 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg">
                      <CheckCircle className="w-3 h-3" /> Approve
                   </button>
                   <button onClick={() => updateStatus(req, "Rejected")} className="flex items-center gap-1 text-xs px-2 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg">
                      <XCircle className="w-3 h-3" /> Reject
                   </button>
                 </>
               )}
               {req.status === "Approved" && (
                 <button onClick={() => updateStatus(req, "Sent")} className="flex items-center gap-1 text-xs px-2 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg">
                    <Send className="w-3 h-3" /> Mark as Sent
                 </button>
               )}
               <button onClick={() => generatePDF(req)} className="flex items-center gap-1 text-xs px-2 py-1.5 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg ml-auto">
                 <FileText className="w-3 h-3" /> Export PDF
               </button>
            </div>
          </div>
        ))}
        {requisitions.length === 0 && !reqLoading && (
          <div className="col-span-full py-12 text-center text-gray-500 bg-white rounded-xl shadow border border-gray-100">
            No requisitions found. Create your first one!
          </div>
        )}
      </div>

      {openBuilder && (
        <Modal title="Create Requisition" onClose={() => setOpenBuilder(false)}>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Select Vendor *</label>
              <select className="w-full p-2 border rounded-lg" value={reqVendorId} onChange={(e) => {
                setReqVendorId(e.target.value);
                setReqItems([]); // Change vendor clears list
              }}>
                <option value="">-- Choose Vendor --</option>
                {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>

            {reqVendorId && (
              <>
                <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 space-y-3">
                  <div className="flex justify-between items-end mb-2">
                    <label className="text-sm font-medium text-gray-700">Check items to include</label>
                  </div>
                  
                  {reqItems.length > 0 ? (
                    <div className="max-h-[40vh] overflow-y-auto border shadow-sm rounded-lg bg-white">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-gray-50 sticky top-0 z-10">
                          <tr>
                            <th className="p-2 w-10 text-center border-b">Inc</th>
                            <th className="p-2 border-b">Item</th>
                            <th className="p-2 w-24 border-b">Req Qty</th>
                            <th className="p-2 w-28 border-b">Est Price ({currency})</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {reqItems.map((item) => (
                            <tr key={item.itemId} className={item.checked ? "bg-mint-50/30" : ""}>
                              <td className="p-2 text-center align-middle">
                                <input 
                                  type="checkbox" 
                                  className="w-4 h-4 rounded text-mint-600 focus:ring-mint-500 border-gray-300"
                                  checked={item.checked} 
                                  onChange={e => updateReqItem(item.itemId, 'checked', e.target.checked)} 
                                />
                              </td>
                              <td className="p-2">
                                <div className={`font-medium ${item.checked ? "text-gray-900" : "text-gray-600"}`}>
                                  {item.name}
                                </div>
                                {item.lastPrice && (
                                  <div className="text-[10px] text-gray-400 mt-0.5">
                                    Last: {item.lastQty}{item.unit} @ {item.lastPrice}
                                  </div>
                                )}
                              </td>
                              <td className="p-2">
                                <div className="flex items-center gap-1">
                                  <input 
                                    type="number" 
                                    className="w-16 border rounded p-1" 
                                    placeholder="0"
                                    value={item.requestedQty ?? ""} 
                                    onChange={(e) => {
                                      updateReqItem(item.itemId, 'requestedQty', e.target.value);
                                      if (Number(e.target.value) > 0) updateReqItem(item.itemId, 'checked', true);
                                      else if (e.target.value === "") updateReqItem(item.itemId, 'checked', false);
                                    }} 
                                  />
                                  <span className="text-gray-500">{item.unit}</span>
                                </div>
                              </td>
                              <td className="p-2">
                                <input 
                                  type="number" 
                                  step="0.01" 
                                  className="w-full border rounded p-1" 
                                  value={item.estPrice ?? ""} 
                                  onChange={(e) => updateReqItem(item.itemId, 'estPrice', e.target.value)} 
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500 p-4text-center bg-white border rounded">
                      No items available for this vendor. Add items in the Catalog first!
                    </div>
                  )}
                  
                  {reqItems.filter(i => i.checked).length > 0 && (
                     <div className="text-right text-sm font-bold mt-2">
                       Total Est: {currency} {reqItems.filter(i => i.checked).reduce((acc, curr) => acc + (Number(curr.requestedQty || 0) * Number(curr.estPrice || 0)), 0).toFixed(2)}
                     </div>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Notes / Remarks</label>
                  <textarea className="w-full p-2 border rounded-lg text-sm" rows={2} value={reqNotes} onChange={e => setReqNotes(e.target.value)} placeholder="E.g., Please deliver before noon." />
                </div>
              </>
            )}

            <div className="pt-4 flex justify-end gap-3 border-t mt-4">
              <Button variant="ghost" onClick={() => setOpenBuilder(false)}>Cancel</Button>
              <Button onClick={handleCreateRequisition} disabled={busy || !reqVendorId || reqItems.length === 0}>Generate Requisition</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
