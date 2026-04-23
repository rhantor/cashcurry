"use client";
import React, { useState } from "react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { skipToken } from "@reduxjs/toolkit/query";
import {
  useGetVendorsQuery,
  useAddVendorMutation,
  useUpdateVendorMutation,
  useDeleteVendorMutation,
} from "@/lib/redux/api/vendorsApiSlice";
import Modal from "@/app/components/common/Modal";
import Input from "@/app/components/common/Input";
import Button from "@/app/components/common/Button";
import useResolvedCompanyBranch from "@/utils/useResolvedCompanyBranch";
import useCurrency from "@/app/hooks/useCurrency";
import VendorTable from "./VendorTable";
import SyncVendorMetrics from "./SyncVendorMetrics";
import VendorPaidBills from "./VendorPaidBills";
import VendorUnpaidBills from "./VendorUnpaidBills";

export default function VendorsPage() {
  const { companyId, branchId } = useResolvedCompanyBranch();
  const currency = useCurrency();
  const args = companyId ? { companyId } : skipToken;

  const {
    data: vendors = [],
    isLoading,
    isFetching,
  } = useGetVendorsQuery(args);
  const [addVendor, { isLoading: adding }] = useAddVendorMutation();
  const [updateVendor, { isLoading: updating }] = useUpdateVendorMutation();
  const [deleteVendor, { isLoading: deleting }] = useDeleteVendorMutation();

  const busy = isLoading || isFetching || adding || updating || deleting;

  // Add modal state
  const [openAdd, setOpenAdd] = useState(false);
  const [addForm, setAddForm] = useState({
    name: "",
    code: "",
    termsDays: "",
    maxOpenBills: "",
    phone: "",
    email: "",
    address: "",
    taxNumber: "",
    registrationNumber: "",
    bankName: "",
    bankAccountNumber: "",
    ownerName: "",
    enquiriesEmail: "",
    website: "",
  });

  // Edit modal state
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState(null);

  // View modal state
  const [viewOpen, setViewOpen] = useState(false);
  const [viewData, setViewData] = useState(null);
  const [viewTab, setViewTab] = useState("overview"); // "overview" | "unpaid" | "paid"

  const handleSaveNew = async () => {
    if (!addForm.name?.trim()) return alert("Please enter vendor name");
    try {
      await addVendor({
        companyId,
        vendor: {
          name: addForm.name,
          code: addForm.code,
          termsDays: addForm.termsDays ? Number(addForm.termsDays) : null,
          maxOpenBills: addForm.maxOpenBills
            ? Number(addForm.maxOpenBills)
            : null,
          phone: addForm.phone,
          email: addForm.email,
          address: addForm.address,
          taxNumber: addForm.taxNumber,
          registrationNumber: addForm.registrationNumber,
          bankName: addForm.bankName,
          bankAccountNumber: addForm.bankAccountNumber,
          ownerName: addForm.ownerName,
          enquiriesEmail: addForm.enquiriesEmail,
          website: addForm.website,
        },
      }).unwrap();
      setAddForm({ 
        name: "", code: "", termsDays: "", maxOpenBills: "",
        phone: "", email: "", address: "", taxNumber: "", 
        registrationNumber: "", bankName: "", bankAccountNumber: "",
        ownerName: "", enquiriesEmail: "", website: ""
      });
      setOpenAdd(false);
    } catch (e) {
      console.error(e);
      alert("Failed to add vendor");
    }
  };

  const handleOpenView = (v) => {
    setViewData(v);
    setViewTab("overview");
    setViewOpen(true);
  };

  const handleOpenEdit = (v) => {
    setEditForm({
      id: v.id,
      name: v.name || "",
      code: v.code || "",
      termsDays: v.termsDays ?? "",
      maxOpenBills: v.maxOpenBills ?? "",
      phone: v.phone || "",
      email: v.email || "",
      address: v.address || "",
      taxNumber: v.taxNumber || "",
      registrationNumber: v.registrationNumber || "",
      bankName: v.bankName || "",
      bankAccountNumber: v.bankAccountNumber || "",
      ownerName: v.ownerName || "",
      enquiriesEmail: v.enquiriesEmail || "",
      website: v.website || "",
    });
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editForm?.id) return;
    try {
      await updateVendor({
        companyId,
        vendorId: editForm.id,
        patch: {
          name: editForm.name,
          code: editForm.code,
          termsDays:
            editForm.termsDays === "" ? null : Number(editForm.termsDays),
          maxOpenBills:
            editForm.maxOpenBills === "" ? null : Number(editForm.maxOpenBills),
          phone: editForm.phone,
          email: editForm.email,
          address: editForm.address,
          taxNumber: editForm.taxNumber,
          registrationNumber: editForm.registrationNumber,
          bankName: editForm.bankName,
          bankAccountNumber: editForm.bankAccountNumber,
          ownerName: editForm.ownerName,
          enquiriesEmail: editForm.enquiriesEmail,
          website: editForm.website,
        },
      }).unwrap();
      setEditOpen(false);
    } catch (e) {
      console.error(e);
      alert("Failed to update vendor");
    }
  };

  const handleIncMaxCredit = async (v) => {
    const next = (v.maxOpenBills || 0) + 1;
    try {
      await updateVendor({
        companyId,
        vendorId: v.id,
        patch: { maxOpenBills: next },
      }).unwrap();
    } catch (e) {
      console.error(e);
      alert("Failed to update");
    }
  };

  const handleDelete = async (v) => {
    if (!confirm(`Delete ${v.name}? This cannot be undone.`)) return;
    try {
      await deleteVendor({ companyId, vendorId: v.id }).unwrap();
    } catch (e) {
      console.error(e);
      alert("Failed to delete vendor");
    }
  };

  const handleExportExcel = (mode) => {
    if (!vendors?.length) return alert("No vendors to export");
    try {
      const dataForExcel = vendors.map(v => {
        const base = {
          "Vendor Name": v.name || "",
          "Vendor Code": v.code || "",
          "Incharge / Owner": v.ownerName || "",
          "Phone": v.phone || "",
          "Primary Email": v.email || "",
          "Enquiries Email": v.enquiriesEmail || "",
          "Website": v.website || "",
          "Address": v.address || "",
          "Reg. Number": v.registrationNumber || "",
          "Tax Number": v.taxNumber || "",
          "Bank Name": v.bankName || "",
          "Bank Account": v.bankAccountNumber || ""
        };

        if (mode === 'full') {
          return {
            ...base,
            "Payment Terms (Days)": v.termsDays || 0,
            "Max Credit Bills": v.maxOpenBills || 0,
            "Total Billed": Number(v.totalBilled || 0),
            "Total Paid": Number(v.totalPaid || 0),
            "AP Balance": Number(v.currentBalance || 0),
            "Last Payment": v.lastPaymentDate ? new Date(v.lastPaymentDate).toLocaleDateString() : "Never",
          };
        }
        return base;
      });
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(dataForExcel);
      XLSX.utils.book_append_sheet(wb, ws, "Vendors");
      XLSX.writeFile(wb, mode === 'full' ? "Vendors_Full_Financials.xlsx" : "Vendors_Directory.xlsx");
    } catch (e) {
      console.error(e);
      alert("Failed to export Excel.");
    }
  };

  const handleExportPDFMain = () => {
    if (!vendors?.length) return alert("No vendors to export");
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.text("Vendor Financial Directory", 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);
    
    const tableData = vendors.map((v, i) => [
      i + 1,
      v.name || "-",
      v.code || "-",
      v.phone || "-",
      currency + " " + (v.totalBilled || 0).toLocaleString(),
      currency + " " + (v.currentBalance || 0).toLocaleString()
    ]);
    
    autoTable(doc, {
      startY: 40,
      head: [["#", "Vendor Name", "Code", "Phone", "Total Billed", "AP Balance"]],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [16, 185, 129] },
      columnStyles: {
        4: { halign: 'right' },
        5: { halign: 'right' }
      }
    });
    
    doc.save(`Vendor_Directory_${Date.now()}.pdf`);
  };

  return (
    <div className="p-4 md:p-8 bg-gray-50/50 min-h-screen">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Vendors</h1>
          <p className="text-sm text-gray-500">Manage your supplier directory and AP balances</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="hidden sm:flex items-center gap-2 mr-2">
            <Button onClick={() => handleExportExcel('directory')} className="bg-white border border-gray-200 !text-black font-bold hover:bg-gray-50 text-xs shadow-sm" disabled={!vendors?.length}>
              Excel Directory
            </Button>
            <Button onClick={() => handleExportExcel('full')} className="bg-white border border-gray-200 !text-black font-bold hover:bg-gray-50 text-xs shadow-sm" disabled={!vendors?.length}>
              Excel Financials
            </Button>
            <Button onClick={handleExportPDFMain} className="bg-white border border-gray-200 !text-black font-bold hover:bg-gray-50 text-xs shadow-sm" disabled={!vendors?.length}>
              PDF Report
            </Button>
          </div>
          <Button onClick={() => setOpenAdd(true)} disabled={!companyId || busy} className="bg-mint-500 hover:bg-mint-600 text-white shadow-md shadow-mint-100 flex-1 sm:flex-none">
            + Add Vendor
          </Button>
          <div className="sm:hidden flex w-full gap-2 mt-1">
             <Button onClick={() => handleExportExcel('directory')} className="bg-gray-100 !text-black font-bold flex-1 text-[10px]" disabled={!vendors?.length}>Export Directory</Button>
             <Button onClick={() => handleExportExcel('full')} className="bg-gray-100 !text-black font-bold flex-1 text-[10px]" disabled={!vendors?.length}>Export w/ Finance</Button>
          </div>
        </div>
      </div>

      <SyncVendorMetrics companyId={companyId} />

      {/* Summary Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-mint-50 flex items-center justify-center text-mint-600">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
          </div>
          <div>
            <div className="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-0.5">Total Vendors</div>
            <div className="text-2xl font-black text-gray-900 leading-none">{vendors.length}</div>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center text-red-600">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <div>
            <div className="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-0.5">Global AP Balance</div>
            <div className="text-2xl font-black text-red-500 leading-none tabular-nums">
               <span className="text-sm font-bold opacity-70 mr-0.5">{currency}</span>
               {vendors.reduce((s, v) => s + Number(v.currentBalance || 0), 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100 flex items-center gap-4 sm:col-span-2 lg:col-span-1">
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <div>
            <div className="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-0.5">Global Total Paid</div>
            <div className="text-2xl font-black text-blue-600 leading-none tabular-nums">
              <span className="text-sm font-bold opacity-70 mr-0.5">{currency}</span>
              {vendors.reduce((s, v) => s + Number(v.totalPaid || 0), 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
            </div>
          </div>
        </div>
      </div>

      <VendorTable
        vendors={vendors}
        busy={busy}
        onView={handleOpenView}
        onEdit={handleOpenEdit}
        onInc={handleIncMaxCredit}
        onDelete={handleDelete}
      />

      {/* View Vendor Modal */}
      {viewOpen && viewData && (
        <Modal title="Vendor Details" maxWidth="max-w-2xl" onClose={() => setViewOpen(false)}>
          {/* Tabs */}
          <div className="flex border-b border-gray-100 mb-6">
            <button
              onClick={() => setViewTab("overview")}
              className={`px-6 py-2.5 text-xs font-black uppercase tracking-widest transition-all ${
                viewTab === "overview"
                  ? "text-mint-600 border-b-2 border-mint-500 bg-mint-50/30"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setViewTab("unpaid")}
              className={`px-6 py-2.5 text-xs font-black uppercase tracking-widest transition-all ${
                viewTab === "unpaid"
                  ? "text-mint-600 border-b-2 border-mint-500 bg-mint-50/30"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              Unpaid Bills
            </button>
            <button
              onClick={() => setViewTab("paid")}
              className={`px-6 py-2.5 text-xs font-black uppercase tracking-widest transition-all ${
                viewTab === "paid"
                  ? "text-mint-600 border-b-2 border-mint-500 bg-mint-50/30"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              Paid Bills
            </button>
          </div>

          <div className="px-1">
            {viewTab === "overview" ? (
              <div className="space-y-8">
                <section>
                  <h3 className="text-xs font-black text-mint-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span className="w-4 h-[2px] bg-mint-500"></span>
                    Basic Information
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <span className="text-gray-400 block text-[10px] uppercase font-bold tracking-widest mb-1">Vendor Name</span>
                      <span className="font-bold text-gray-900 text-base">{viewData.name || "-"}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px] uppercase font-bold tracking-widest mb-1">Vendor Code</span>
                      <span className="font-mono font-bold text-gray-700 bg-gray-50 px-2 py-0.5 rounded text-sm uppercase">{viewData.code || "-"}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px] uppercase font-bold tracking-widest mb-1">Reg. Number (SSM)</span>
                      <span className="text-gray-800 font-medium">{viewData.registrationNumber || "-"}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px] uppercase font-bold tracking-widest mb-1">Tax Number</span>
                      <span className="text-gray-800 font-medium">{viewData.taxNumber || "-"}</span>
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="text-xs font-black text-mint-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span className="w-4 h-[2px] bg-mint-500"></span>
                    Contact Details
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <span className="text-gray-400 block text-[10px] uppercase font-bold tracking-widest mb-1">Incharge / Owner</span>
                      <span className="font-bold text-gray-800">{viewData.ownerName || "-"}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px] uppercase font-bold tracking-widest mb-1">Phone Number</span>
                      <span className="text-gray-800 font-medium">{viewData.phone || "-"}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px] uppercase font-bold tracking-widest mb-1">Primary Email</span>
                      <span className="text-gray-800 font-medium">{viewData.email || "-"}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px] uppercase font-bold tracking-widest mb-1">Enquiries Email</span>
                      <span className="text-gray-800 font-medium">{viewData.enquiriesEmail || "-"}</span>
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-gray-400 block text-[10px] uppercase font-bold tracking-widest mb-1">Website Link</span>
                      {viewData.website ? (
                        <a href={viewData.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium break-all">
                          {viewData.website}
                        </a>
                      ) : "-"}
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-gray-400 block text-[10px] uppercase font-bold tracking-widest mb-1">Physical Address</span>
                      <span className="text-gray-700 font-medium leading-relaxed whitespace-pre-wrap">{viewData.address || "-"}</span>
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="text-xs font-black text-mint-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span className="w-4 h-[2px] bg-mint-500"></span>
                    Financial & Accounts
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <span className="text-gray-400 block text-[10px] uppercase font-bold tracking-widest mb-1">Bank Name</span>
                      <span className="text-gray-800 font-bold">{viewData.bankName || "-"}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px] uppercase font-bold tracking-widest mb-1">Account Number</span>
                      <span className="text-gray-800 tracking-widest font-mono font-bold bg-blue-50 px-2 py-1 rounded border border-blue-100">{viewData.bankAccountNumber || "-"}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px] uppercase font-bold tracking-widest mb-1">Payment Terms</span>
                      <span className="text-gray-800 font-bold">{viewData.termsDays !== null && viewData.termsDays !== undefined ? `${viewData.termsDays} days` : "-"}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[10px] uppercase font-bold tracking-widest mb-1">Credit Limit (Active Bills)</span>
                      <span className="text-gray-800 font-bold">{viewData.maxOpenBills || "Unlimited"}</span>
                    </div>
                  </div>
                </section>
                
                <div className="bg-gray-900 rounded-2xl p-6 grid grid-cols-2 sm:grid-cols-4 gap-6 shadow-xl">
                    <div className="space-y-1">
                      <span className="text-gray-500 block text-[9px] uppercase font-black tracking-widest">Total Billed</span>
                      <span className="font-bold text-white text-sm">{currency} {Number(viewData.totalBilled || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                    </div>
                    <div className="space-y-1 border-l border-gray-800 pl-4">
                      <span className="text-gray-500 block text-[9px] uppercase font-black tracking-widest">Total Paid</span>
                      <span className="font-bold text-blue-400 text-sm">{currency} {Number(viewData.totalPaid || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                    </div>
                    <div className="space-y-1 border-l border-gray-800 pl-4">
                      <span className="text-gray-500 block text-[9px] uppercase font-black tracking-widest">AP Balance</span>
                      <span className={`font-bold text-sm ${Number(viewData.currentBalance || 0) > 0 ? "text-red-400" : "text-emerald-400"}`}>{currency} {Number(viewData.currentBalance || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                    </div>
                    <div className="space-y-1 border-l border-gray-800 pl-4">
                      <span className="text-gray-500 block text-[9px] uppercase font-black tracking-widest">Last Payment</span>
                      <span className="text-gray-300 font-bold text-sm">{viewData.lastPaymentDate ? new Date(viewData.lastPaymentDate).toLocaleDateString() : "-"}</span>
                    </div>
                </div>
              </div>
            ) : viewTab === "unpaid" ? (
              <VendorUnpaidBills 
                companyId={companyId} 
                branchId={branchId} 
                vendorId={viewData.id} 
              />
            ) : (
              <VendorPaidBills 
                companyId={companyId} 
                branchId={branchId} 
                vendorId={viewData.id} 
              />
            )}
          </div>
          <div className="mt-8 flex justify-end">
            <Button onClick={() => setViewOpen(false)} className="w-full sm:w-auto bg-gray-100 text-gray-700 hover:bg-gray-200 border-none">Close</Button>
          </div>
        </Modal>
      )}

      {/* Add Vendor Modal */}
      {openAdd && (
        <Modal title="Add Vendor" maxWidth="max-w-2xl" onClose={() => setOpenAdd(false)}>
          <div className="space-y-6 pr-2">
            {/* Basic Information */}
            <div>
              <h3 className="text-sm font-semibold text-mint-700 border-b pb-1 mb-3">Basic Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  className="md:col-span-2"
                  label="Vendor Name *"
                  value={addForm.name}
                  onChange={(v) => setAddForm((f) => ({ ...f, name: v }))}
                  autoFocus
                />
                <Input
                  label="Vendor Code (optional)"
                  value={addForm.code}
                  onChange={(v) => setAddForm((f) => ({ ...f, code: v }))}
                />
                <Input
                  label="Registration Number (SSM)"
                  value={addForm.registrationNumber}
                  onChange={(v) => setAddForm((f) => ({ ...f, registrationNumber: v }))}
                />
              </div>
            </div>

            {/* Contact Details */}
            <div>
              <h3 className="text-sm font-semibold text-mint-700 border-b pb-1 mb-3">Contact Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Incharge / Owner Name"
                  value={addForm.ownerName}
                  onChange={(v) => setAddForm((f) => ({ ...f, ownerName: v }))}
                />
                <Input
                  label="Phone Number"
                  value={addForm.phone}
                  onChange={(v) => setAddForm((f) => ({ ...f, phone: v }))}
                />
                <Input
                  label="Primary Email"
                  value={addForm.email}
                  onChange={(v) => setAddForm((f) => ({ ...f, email: v }))}
                />
                <Input
                  label="Enquiries Email"
                  value={addForm.enquiriesEmail}
                  onChange={(v) => setAddForm((f) => ({ ...f, enquiriesEmail: v }))}
                />
                <Input
                  className="md:col-span-2"
                  label="Website Link"
                  value={addForm.website}
                  onChange={(v) => setAddForm((f) => ({ ...f, website: v }))}
                  placeholder="https://..."
                />
                <Input
                  className="md:col-span-2"
                  label="Physical Address"
                  value={addForm.address}
                  onChange={(v) => setAddForm((f) => ({ ...f, address: v }))}
                />
              </div>
            </div>

            {/* Financial & Terms */}
            <div>
              <h3 className="text-sm font-semibold text-mint-700 border-b pb-1 mb-3">Financial & Accounts</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Bank Name"
                  value={addForm.bankName}
                  onChange={(v) => setAddForm((f) => ({ ...f, bankName: v }))}
                />
                <Input
                  label="Account Number"
                  value={addForm.bankAccountNumber}
                  onChange={(v) => setAddForm((f) => ({ ...f, bankAccountNumber: v }))}
                />
                <Input
                  className="md:col-span-2"
                  label="Tax Number"
                  value={addForm.taxNumber}
                  onChange={(v) => setAddForm((f) => ({ ...f, taxNumber: v }))}
                />
                <Input
                  label="Payment Terms (days)"
                  type="number"
                  value={addForm.termsDays}
                  onChange={(v) => setAddForm((f) => ({ ...f, termsDays: v }))}
                />
                <Input
                  label="Max Credit Bills Limit"
                  type="number"
                  value={addForm.maxOpenBills}
                  onChange={(v) => setAddForm((f) => ({ ...f, maxOpenBills: v }))}
                />
              </div>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpenAdd(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveNew} disabled={busy}>
              Save
            </Button>
          </div>
        </Modal>
      )}

      {/* Edit Vendor Modal */}
      {editOpen && editForm && (
        <Modal title="Edit Vendor" maxWidth="max-w-2xl" onClose={() => setEditOpen(false)}>
          <div className="space-y-6 pr-2">
            {/* Basic Information */}
            <div>
              <h3 className="text-sm font-semibold text-mint-700 border-b pb-1 mb-3">Basic Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  className="md:col-span-2"
                  label="Vendor Name *"
                  value={editForm.name}
                  onChange={(v) => setEditForm((f) => ({ ...f, name: v }))}
                  autoFocus
                />
                <Input
                  label="Vendor Code (optional)"
                  value={editForm.code}
                  onChange={(v) => setEditForm((f) => ({ ...f, code: v }))}
                />
                <Input
                  label="Registration Number (SSM)"
                  value={editForm.registrationNumber}
                  onChange={(v) => setEditForm((f) => ({ ...f, registrationNumber: v }))}
                />
              </div>
            </div>

            {/* Contact Details */}
            <div>
              <h3 className="text-sm font-semibold text-mint-700 border-b pb-1 mb-3">Contact Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Incharge / Owner Name"
                  value={editForm.ownerName}
                  onChange={(v) => setEditForm((f) => ({ ...f, ownerName: v }))}
                />
                <Input
                  label="Phone Number"
                  value={editForm.phone}
                  onChange={(v) => setEditForm((f) => ({ ...f, phone: v }))}
                />
                <Input
                  label="Primary Email"
                  value={editForm.email}
                  onChange={(v) => setEditForm((f) => ({ ...f, email: v }))}
                />
                <Input
                  label="Enquiries Email"
                  value={editForm.enquiriesEmail}
                  onChange={(v) => setEditForm((f) => ({ ...f, enquiriesEmail: v }))}
                />
                <Input
                  className="md:col-span-2"
                  label="Website Link"
                  value={editForm.website}
                  onChange={(v) => setEditForm((f) => ({ ...f, website: v }))}
                  placeholder="https://..."
                />
                <Input
                  className="md:col-span-2"
                  label="Physical Address"
                  value={editForm.address}
                  onChange={(v) => setEditForm((f) => ({ ...f, address: v }))}
                />
              </div>
            </div>

            {/* Financial & Terms */}
            <div>
              <h3 className="text-sm font-semibold text-mint-700 border-b pb-1 mb-3">Financial & Accounts</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Bank Name"
                  value={editForm.bankName}
                  onChange={(v) => setEditForm((f) => ({ ...f, bankName: v }))}
                />
                <Input
                  label="Account Number"
                  value={editForm.bankAccountNumber}
                  onChange={(v) => setEditForm((f) => ({ ...f, bankAccountNumber: v }))}
                />
                <Input
                  className="md:col-span-2"
                  label="Tax Number"
                  value={editForm.taxNumber}
                  onChange={(v) => setEditForm((f) => ({ ...f, taxNumber: v }))}
                />
                <Input
                  label="Payment Terms (days)"
                  type="number"
                  value={editForm.termsDays}
                  onChange={(v) => setEditForm((f) => ({ ...f, termsDays: v }))}
                />
                <Input
                  label="Max Credit Bills Limit"
                  type="number"
                  value={editForm.maxOpenBills}
                  onChange={(v) => setEditForm((f) => ({ ...f, maxOpenBills: v }))}
                />
              </div>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={busy}>
              Update
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
