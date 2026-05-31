"use client";
import React, { useState } from "react";
import { skipToken } from "@reduxjs/toolkit/query";
import useResolvedCompanyBranch from "@/utils/useResolvedCompanyBranch";
import {
  useGetRequisitionsQuery, // Using requisitionsApiSlice as our PO storage
  useUpdateRequisitionMutation,
  useDeleteRequisitionMutation,
} from "@/lib/redux/api/requisitionsApiSlice";
import { useAddVendorBillMutation } from "@/lib/redux/api/vendorBillsApiSlice";
import { useUpdateItemMutation } from "@/lib/redux/api/itemsApiSlice";
import Button from "@/app/components/common/Button";
import Modal from "@/app/components/common/Modal";
import Input from "@/app/components/common/Input";
import useCurrency from "@/app/hooks/useCurrency";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatMoney } from "@/utils/formatMoney";
import { FileText, Send, CheckCircle, PackageOpen, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

const STATUS_COLORS = {
  Pending: "bg-yellow-100 text-yellow-800",
  Sent: "bg-blue-100 text-blue-800",
  Received: "bg-emerald-100 text-emerald-800",
  Cancelled: "bg-red-100 text-red-800",
};

export default function PurchaseOrdersPage() {
  const { ready, companyId, branchId, user } = useResolvedCompanyBranch();
  const currency = useCurrency();
  const router = useRouter();

  const args = ready && companyId && branchId ? { companyId, branchId } : skipToken;

  const { data: orders = [], isLoading: ordersLoading } = useGetRequisitionsQuery(args);
  const [updateOrder, { isLoading: updating }] = useUpdateRequisitionMutation();
  const [deleteOrder, { isLoading: deleting }] = useDeleteRequisitionMutation();
  
  const [addVendorBill, { isLoading: addingBill }] = useAddVendorBillMutation();
  const [updateItem, { isLoading: updatingItem }] = useUpdateItemMutation();

  const busy = ordersLoading || updating || deleting || addingBill || updatingItem;

  const [openReceiveModal, setOpenReceiveModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  
  // State for receiving items
  const [receiveData, setReceiveData] = useState({
    invoiceNo: "",
    items: [] // { itemId, requestedQty, receivedQty, finalPrice }
  });

  const handleOpenReceive = (order) => {
    setSelectedOrder(order);
    setReceiveData({
      invoiceNo: "",
      items: order.items.map(i => ({
        itemId: i.itemId,
        name: i.name,
        category: i.category,
        unit: i.unit,
        requestedQty: i.requestedQty,
        receivedQty: i.requestedQty, // default to receiving exactly what was ordered
        finalPrice: i.estPrice // default to est price
      }))
    });
    setOpenReceiveModal(true);
  };

  const updateReceiveRow = (itemId, key, val) => {
    setReceiveData(prev => ({
      ...prev,
      items: prev.items.map(row => row.itemId === itemId ? { ...row, [key]: val } : row)
    }));
  };

  const handleReceiveOrder = async () => {
    if (!receiveData.invoiceNo.trim()) return alert("Please enter the vendor's invoice number.");
    
    const finalTotal = receiveData.items.reduce((acc, curr) => acc + (Number(curr.receivedQty || 0) * Number(curr.finalPrice || 0)), 0);
    
    if (finalTotal <= 0) return alert("Total invoice amount must be greater than 0.");

    try {
      // 1. Generate Accounts Payable Vendor Bill
      await addVendorBill({
        companyId,
        branchId,
        bill: {
          vendorId: selectedOrder.vendorId,
          vendorName: selectedOrder.vendorName,
          invoiceNo: receiveData.invoiceNo,
          invoiceDate: new Date().toISOString().split("T")[0],
          dueDate: new Date().toISOString().split("T")[0], // Assuming COD or default terms apply elsewhere
          total: finalTotal,
          note: `Received from PO: ${selectedOrder.id}`,
          attachments: [], // physical invoice can be uploaded in New Bill page if needed
          createdBy: user || {},
        },
        skipBalanceUpdate: false,
      }).unwrap();

      // 2. Mark PO as Received
      await updateOrder({
        companyId,
        branchId,
        requisitionId: selectedOrder.id,
        patch: { 
          status: "Received",
          receivedItems: receiveData.items,
          finalTotal: finalTotal
        }
      }).unwrap();

      // 3. (Optional but recommended) Update Master Item Catalog with last purchase price
      for (const item of receiveData.items) {
        if (Number(item.finalPrice) > 0) {
           await updateItem({
             companyId,
             itemId: item.itemId,
             patch: { defaultPrice: Number(item.finalPrice) }
           });
        }
      }

      setOpenReceiveModal(false);
      alert("Order received and AP Bill generated successfully!");
    } catch (e) {
      console.error(e);
      alert("Failed to receive order and generate bill.");
    }
  };

  const updateStatus = async (order, newStatus) => {
    try {
      await updateOrder({ companyId, branchId, requisitionId: order.id, patch: { status: newStatus } }).unwrap();
    } catch (e) {
      alert("Failed to update status.");
    }
  };

  const exportPDF = (order) => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text("PURCHASE ORDER", 14, 22);
    
    doc.setFontSize(10);
    doc.text(`PO Ref: ${order.id}`, 14, 30);
    doc.text(`Date: ${order.createdAt ? new Date(order.createdAt.seconds * 1000).toLocaleDateString() : "-"}`, 14, 35);
    doc.text(`Status: ${order.status}`, 14, 40);

    doc.setFontSize(12);
    doc.text("Vendor Details:", 130, 22);
    doc.setFontSize(10);
    doc.text(`Name: ${order.vendorName}`, 130, 28);

    doc.line(14, 45, 196, 45);

    const tableData = order.items.map((i, index) => [
      index + 1,
      i.name,
      `${i.requestedQty} ${i.unit}`,
      `${currency} ${Number(i.estPrice || 0).toFixed(2)}`,
      `${currency} ${(Number(i.requestedQty || 0) * Number(i.estPrice || 0)).toFixed(2)}`
    ]);

    autoTable(doc, {
      startY: 50,
      head: [["#", "Item", "Quantity", "Unit Price (Est)", "Total (Est)"]],
      body: tableData,
      theme: "grid",
      headStyles: { fillColor: [74, 222, 128] }
    });

    const finalY = doc.lastAutoTable.finalY || 60;
    doc.setFontSize(12);
    doc.text(`Estimated Total: ${currency} ${(order.totalEst || 0).toFixed(2)}`, 140, finalY + 10);

    if (order.notes) {
      doc.setFontSize(10);
      doc.text("Notes:", 14, finalY + 10);
      doc.setFont("helvetica", "italic");
      doc.text(doc.splitTextToSize(order.notes, 100), 14, finalY + 15);
    }

    doc.save(`PO_${order.vendorName.replace(/\s+/g,"_")}_${new Date().getTime()}.pdf`);
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Purchase Orders</h1>
          <p className="text-slate-500 text-sm">Track sent orders and receive goods to generate bills.</p>
        </div>
        <Button onClick={() => router.push("/purchases/order-guides")} variant="outline">
          Use Order Guides
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {orders.map(order => (
          <div key={order.id} className="bg-white rounded-3xl shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-slate-100/60 p-6 flex flex-col justify-between h-full transition-all duration-300">
            <div>
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-bold text-slate-800 tracking-tight text-lg truncate pr-2">{order.vendorName}</h3>
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[order.status] || "bg-slate-100 text-slate-600"}`}>
                  {order.status}
                </span>
              </div>
              <p className="text-sm text-slate-500 mb-4 flex justify-between font-medium">
                <span>{order.createdAt ? new Date(order.createdAt.seconds * 1000).toLocaleDateString() : "-"}</span>
                <span>{order.items?.length || 0} items</span>
              </p>
              
              <div className="mb-6 text-2xl font-bold text-slate-900 tracking-tight">
                {currency} {order.status === "Received" ? (order.finalTotal || 0).toFixed(2) : (order.totalEst || 0).toFixed(2)} 
                {order.status !== "Received" && <span className="text-xs font-medium text-slate-400 ml-1">est.</span>}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100/60 flex flex-wrap gap-2">
               {order.status === "Pending" && (
                 <button onClick={() => updateStatus(order, "Sent")} className="flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold px-3 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl transition-colors">
                    <Send className="w-4 h-4" /> Send
                 </button>
               )}
               {order.status === "Sent" && (
                 <button onClick={() => handleOpenReceive(order)} className="flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold px-3 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl transition-colors">
                    <PackageOpen className="w-4 h-4" /> Receive GRN
                 </button>
               )}
               <button onClick={() => exportPDF(order)} className="flex items-center justify-center gap-1.5 text-sm font-semibold px-3 py-2 bg-slate-50 text-slate-700 hover:bg-slate-100 rounded-xl transition-colors">
                 <FileText className="w-4 h-4" /> PDF
               </button>
               {(order.status === "Pending" || order.status === "Sent") && (
                 <button onClick={() => updateStatus(order, "Cancelled")} className="flex items-center justify-center text-sm font-semibold px-3 py-2 text-slate-400 hover:text-red-600 rounded-xl transition-colors">
                    <Trash2 className="w-4 h-4" />
                 </button>
               )}
            </div>
          </div>
        ))}
        
        {orders.length === 0 && !ordersLoading && (
          <div className="col-span-full py-16 text-center bg-white rounded-3xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
            <PackageOpen className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-700">No Purchase Orders</h3>
            <p className="text-slate-500 mt-1">Generate a PO using the Order Guides tab.</p>
          </div>
        )}
      </div>

      {openReceiveModal && selectedOrder && (
        <Modal title={`Receive Goods: ${selectedOrder.vendorName}`} onClose={() => setOpenReceiveModal(false)} maxWidth="max-w-4xl">
          <div className="space-y-4">
            <div className="bg-emerald-50/50 rounded-xl p-4 border border-emerald-100">
               <p className="text-sm text-emerald-800 font-medium">
                 Verify quantities received and exact invoice pricing. Submitting this will automatically generate an Accounts Payable Vendor Bill.
               </p>
            </div>
            
            <div className="w-1/3 min-w-[200px]">
              <Input label="Vendor Invoice No. *" value={receiveData.invoiceNo} onChange={v => setReceiveData(p => ({ ...p, invoiceNo: v }))} placeholder="INV-12345" autoFocus />
            </div>

            <div className="max-h-[50vh] overflow-y-auto rounded-xl border border-slate-200 mt-4">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-100 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600">Item</th>
                    <th className="px-4 py-3 text-center font-semibold text-slate-600 w-32">Ordered</th>
                    <th className="px-4 py-3 text-center font-semibold text-slate-600 w-40">Received Qty</th>
                    <th className="px-4 py-3 text-center font-semibold text-slate-600 w-40">Final Unit Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {receiveData.items.map(item => (
                    <tr key={item.itemId} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{item.name}</div>
                        <div className="text-xs text-slate-400">{item.category}</div>
                      </td>
                      <td className="px-4 py-3 text-center text-slate-500 font-medium">
                        {item.requestedQty} {item.unit}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center justify-center gap-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className={`w-20 p-2 border rounded-lg text-center font-semibold focus:outline-none focus:ring-2 ${Number(item.receivedQty) !== Number(item.requestedQty) ? 'border-amber-300 bg-amber-50 text-amber-900 focus:ring-amber-500/20' : 'border-slate-200 text-slate-800 focus:ring-mint-500/20 focus:border-mint-500'}`}
                            value={item.receivedQty}
                            onChange={(e) => updateReceiveRow(item.itemId, 'receivedQty', e.target.value)}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-2">
                         <div className="flex items-center justify-center gap-2">
                           <span className="text-slate-400">{currency}</span>
                           <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="w-20 p-2 border border-slate-200 rounded-lg text-center font-semibold text-slate-800 focus:border-mint-500 focus:ring-2 focus:ring-mint-500/20 outline-none"
                            value={item.finalPrice}
                            onChange={(e) => updateReceiveRow(item.itemId, 'finalPrice', e.target.value)}
                          />
                         </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex justify-end items-center">
               <div className="text-right">
                 <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Final Invoice Total</p>
                 <p className="font-bold text-2xl text-slate-800">
                   {currency} {receiveData.items.reduce((acc, curr) => acc + (Number(curr.receivedQty || 0) * Number(curr.finalPrice || 0)), 0).toFixed(2)}
                 </p>
               </div>
            </div>

            <div className="pt-2 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setOpenReceiveModal(false)}>Cancel</Button>
              <Button onClick={handleReceiveOrder} disabled={busy} className="bg-emerald-600 text-white hover:bg-emerald-700">Receive & Generate Bill</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
