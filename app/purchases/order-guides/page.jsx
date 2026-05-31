"use client";
import React, { useState, useMemo } from "react";
import { skipToken } from "@reduxjs/toolkit/query";
import useResolvedCompanyBranch from "@/utils/useResolvedCompanyBranch";
import {
  useGetOrderGuidesQuery,
  useAddOrderGuideMutation,
  useDeleteOrderGuideMutation,
  useUpdateOrderGuideMutation,
} from "@/lib/redux/api/orderGuidesApiSlice";
import { useGetVendorsQuery } from "@/lib/redux/api/vendorsApiSlice";
import { useGetItemsQuery } from "@/lib/redux/api/itemsApiSlice";
import { useAddRequisitionMutation } from "@/lib/redux/api/requisitionsApiSlice";
import Button from "@/app/components/common/Button";
import Modal from "@/app/components/common/Modal";
import Input from "@/app/components/common/Input";
import useCurrency from "@/app/hooks/useCurrency";
import { Plus, Edit3, Trash2, ShoppingCart, ListChecks } from "lucide-react";
import { useRouter } from "next/navigation";

export default function OrderGuidesPage() {
  const { ready, companyId, branchId, user } = useResolvedCompanyBranch();
  const currency = useCurrency();
  const router = useRouter();

  const args = ready && companyId && branchId ? { companyId, branchId } : skipToken;
  const companyArgs = ready && companyId ? { companyId } : skipToken;

  const { data: guides = [], isLoading: guidesLoading } = useGetOrderGuidesQuery(args);
  const { data: vendors = [], isLoading: vLoading } = useGetVendorsQuery(companyArgs);
  const { data: items = [], isLoading: iLoading } = useGetItemsQuery(companyArgs);

  const [addGuide, { isLoading: addingGuide }] = useAddOrderGuideMutation();
  const [updateGuide, { isLoading: updatingGuide }] = useUpdateOrderGuideMutation();
  const [deleteGuide, { isLoading: deletingGuide }] = useDeleteOrderGuideMutation();
  const [createOrder, { isLoading: creatingOrder }] = useAddRequisitionMutation();

  const busy = guidesLoading || vLoading || iLoading || addingGuide || updatingGuide || deletingGuide || creatingOrder;

  // --- Modals State ---
  const [openGuideBuilder, setOpenGuideBuilder] = useState(false);
  const [builderForm, setBuilderForm] = useState({ id: null, name: "", vendorId: "", itemIds: [] });

  const [openOrderModal, setOpenOrderModal] = useState(false);
  const [selectedGuide, setSelectedGuide] = useState(null);
  const [orderItems, setOrderItems] = useState([]); // { itemId, requestedQty, estPrice }

  // --- Guide Builder Logic ---
  const handleOpenBuilder = (guide = null) => {
    if (guide) {
      setBuilderForm({ id: guide.id, name: guide.name, vendorId: guide.vendorId, itemIds: guide.itemIds || [] });
    } else {
      setBuilderForm({ id: null, name: "", vendorId: "", itemIds: [] });
    }
    setOpenGuideBuilder(true);
  };

  const handleSaveGuide = async () => {
    if (!builderForm.name.trim() || !builderForm.vendorId) {
      return alert("Name and Vendor are required.");
    }
    if (builderForm.itemIds.length === 0) {
      return alert("Select at least one item for the guide.");
    }

    try {
      if (builderForm.id) {
        await updateGuide({
          companyId,
          branchId,
          guideId: builderForm.id,
          patch: {
            name: builderForm.name,
            vendorId: builderForm.vendorId,
            vendorName: vendors.find(v => v.id === builderForm.vendorId)?.name || "",
            itemIds: builderForm.itemIds,
          }
        }).unwrap();
      } else {
        await addGuide({
          companyId,
          branchId,
          orderGuide: {
            name: builderForm.name,
            vendorId: builderForm.vendorId,
            vendorName: vendors.find(v => v.id === builderForm.vendorId)?.name || "",
            itemIds: builderForm.itemIds,
            createdBy: user?.uid || "",
          }
        }).unwrap();
      }
      setOpenGuideBuilder(false);
    } catch (e) {
      console.error(e);
      alert("Failed to save order guide.");
    }
  };

  const handleDeleteGuide = async (guide) => {
    if (!confirm(`Delete order guide: ${guide.name}?`)) return;
    try {
      await deleteGuide({ companyId, branchId, guideId: guide.id }).unwrap();
    } catch (e) {
      alert("Failed to delete guide.");
    }
  };

  const toggleItemInGuide = (itemId) => {
    setBuilderForm(prev => {
      if (prev.itemIds.includes(itemId)) {
        return { ...prev, itemIds: prev.itemIds.filter(id => id !== itemId) };
      } else {
        return { ...prev, itemIds: [...prev.itemIds, itemId] };
      }
    });
  };

  // --- Place Order Logic ---
  const handleOpenOrder = (guide) => {
    setSelectedGuide(guide);
    // Build spreadsheet rows
    const defaultRows = guide.itemIds.map(id => {
      const itemData = items.find(i => i.id === id);
      return {
        itemId: id,
        name: itemData?.name || "Unknown Item",
        unit: itemData?.unit || "Pcs",
        category: itemData?.category || "",
        requestedQty: "",
        estPrice: itemData?.defaultPrice || 0,
      };
    });
    setOrderItems(defaultRows);
    setOpenOrderModal(true);
  };

  const updateOrderRow = (itemId, val) => {
    setOrderItems(prev => prev.map(row => row.itemId === itemId ? { ...row, requestedQty: val } : row));
  };

  const handleSubmitOrder = async () => {
    const validItems = orderItems.filter(i => Number(i.requestedQty || 0) > 0);
    if (validItems.length === 0) {
      return alert("Enter quantity for at least one item.");
    }

    try {
      await createOrder({
        companyId,
        branchId,
        requisition: {
          vendorId: selectedGuide.vendorId,
          vendorName: selectedGuide.vendorName,
          orderGuideId: selectedGuide.id,
          items: validItems,
          notes: `Generated from Order Guide: ${selectedGuide.name}`,
          createdBy: user?.uid || "Unknown User",
          createdByName: user?.displayName || user?.email || "Unknown",
          totalEst: validItems.reduce((acc, curr) => acc + (Number(curr.requestedQty) * Number(curr.estPrice)), 0),
          status: "Pending" // Maps to Purchase Orders pipeline
        }
      }).unwrap();
      
      setOpenOrderModal(false);
      alert("Purchase Order created successfully!");
      router.push("/purchases/purchase-orders"); // Go to POs page
    } catch (e) {
      console.error(e);
      alert("Failed to submit order.");
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Order Guides</h1>
          <p className="text-slate-500 text-sm">Rapid ordering templates for your regular suppliers.</p>
        </div>
        <Button onClick={() => handleOpenBuilder()} disabled={busy} className="flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Order Guide
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {guides.map(guide => (
          <div key={guide.id} className="bg-white rounded-3xl shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-slate-100/60 p-6 flex flex-col justify-between h-full transition-all duration-300 hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] transform hover:-translate-y-0.5">
            <div>
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-slate-800 tracking-tight text-lg">{guide.name}</h3>
                <div className="flex gap-2">
                  <button onClick={() => handleOpenBuilder(guide)} className="text-slate-400 hover:text-blue-600 transition-colors">
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDeleteGuide(guide)} className="text-slate-400 hover:text-red-600 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <p className="text-sm font-medium text-slate-500 mb-4">{guide.vendorName}</p>
              
              <div className="flex items-center gap-2 text-sm text-slate-500 mb-6 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <ListChecks className="w-4 h-4 text-mint-500" />
                <span>{guide.itemIds?.length || 0} configured items</span>
              </div>
            </div>

            <Button onClick={() => handleOpenOrder(guide)} className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white hover:bg-slate-800">
              <ShoppingCart className="w-4 h-4" /> Place Order
            </Button>
          </div>
        ))}
        
        {guides.length === 0 && !guidesLoading && (
          <div className="col-span-full py-16 text-center bg-white rounded-3xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
            <ListChecks className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-700">No Order Guides yet</h3>
            <p className="text-slate-500 mt-1 max-w-sm mx-auto">Create order guides for your frequent vendors to speed up daily ordering.</p>
          </div>
        )}
      </div>

      {/* Builder Modal */}
      {openGuideBuilder && (
        <Modal title={builderForm.id ? "Edit Order Guide" : "New Order Guide"} onClose={() => setOpenGuideBuilder(false)}>
          <div className="space-y-4">
            <Input label="Guide Name *" placeholder="e.g. Daily Produce" value={builderForm.name} onChange={v => setBuilderForm(f => ({ ...f, name: v }))} />
            
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-1.5">Supplier / Vendor *</label>
              <select 
                className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-mint-500/20 focus:border-mint-500 transition-all outline-none" 
                value={builderForm.vendorId} 
                onChange={e => setBuilderForm(f => ({ ...f, vendorId: e.target.value }))}
              >
                <option value="">-- Select Vendor --</option>
                {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>

            <div className="pt-2">
              <label className="text-sm font-semibold text-slate-700 block mb-2">Select Items for this Guide</label>
              <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                {items.length === 0 ? (
                   <div className="p-4 text-sm text-slate-500 text-center">No items in catalog.</div>
                ) : items.map(item => (
                  <label key={item.id} className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer transition-colors">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded text-mint-600 focus:ring-mint-500 border-slate-300"
                      checked={builderForm.itemIds.includes(item.id)}
                      onChange={() => toggleItemInGuide(item.id)}
                    />
                    <div>
                      <div className="font-medium text-slate-800 text-sm">{item.name}</div>
                      <div className="text-xs text-slate-500">{item.category} • {item.unit}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            
            <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setOpenGuideBuilder(false)}>Cancel</Button>
              <Button onClick={handleSaveGuide} disabled={busy}>Save Guide</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Place Order Modal (Spreadsheet UI) */}
      {openOrderModal && selectedGuide && (
        <Modal title={`Order: ${selectedGuide.name}`} onClose={() => setOpenOrderModal(false)} maxWidth="max-w-4xl">
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex justify-between items-center">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Supplier</p>
                <p className="font-bold text-slate-800">{selectedGuide.vendorName}</p>
              </div>
              <div className="text-right">
                 <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Estimated Total</p>
                 <p className="font-bold text-xl text-slate-800">
                   {currency} {orderItems.reduce((acc, curr) => acc + (Number(curr.requestedQty) * Number(curr.estPrice)), 0).toFixed(2)}
                 </p>
              </div>
            </div>
            
            <div className="max-h-[50vh] overflow-y-auto rounded-xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-100 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Item</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-600 w-32">Est. Price</th>
                    <th className="px-4 py-3 text-center font-semibold text-slate-600 w-40">Order Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {orderItems.map((item, idx) => (
                    <tr key={item.itemId} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{item.name}</div>
                        <div className="text-xs text-slate-400">{item.category}</div>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600 font-medium">
                        {currency} {Number(item.estPrice).toFixed(2)}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center justify-center gap-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="w-20 p-2 border border-slate-200 rounded-lg text-center font-semibold text-slate-800 focus:border-mint-500 focus:ring-2 focus:ring-mint-500/20 outline-none"
                            placeholder="0"
                            value={item.requestedQty}
                            onChange={(e) => updateOrderRow(item.itemId, e.target.value)}
                            autoFocus={idx === 0} // focus first input for rapid entry
                          />
                          <span className="text-slate-500 w-8">{item.unit}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setOpenOrderModal(false)}>Cancel</Button>
              <Button onClick={handleSubmitOrder} disabled={busy} className="bg-mint-600 text-white hover:bg-mint-700">Submit Order</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
