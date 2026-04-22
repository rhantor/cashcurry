"use client";
import React, { useState } from "react";
import * as XLSX from "xlsx";
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
import useCompanyId from "@/utils/useCompanyId";
import useCurrency from "@/app/hooks/useCurrency";
import VendorTable from "./VendorTable";
import SyncVendorMetrics from "./SyncVendorMetrics";

export default function VendorsPage() {
  const companyId = useCompanyId();
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

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-mint-500">Vendors</h1>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => handleExportExcel('directory')} className="bg-sky-600 hover:bg-sky-700 text-white" disabled={!vendors?.length}>
            Export Directory
          </Button>
          <Button onClick={() => handleExportExcel('full')} className="bg-emerald-600 hover:bg-emerald-700 text-white" disabled={!vendors?.length}>
            Export w/ Financials
          </Button>
          <Button onClick={() => setOpenAdd(true)} disabled={!companyId || busy} className="ml-2">
            + Add Vendor
          </Button>
        </div>
      </div>

      <SyncVendorMetrics companyId={companyId} />

      {/* Summary Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 flex flex-col justify-center">
          <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Total Vendors</div>
          <div className="text-3xl font-extrabold text-gray-800">{vendors.length}</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 flex flex-col justify-center">
          <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Global AP Balance</div>
          <div className="text-3xl font-extrabold text-red-500 tabular-nums">
             <span className="text-lg opacity-70 mr-1">{currency}</span>
             {vendors.reduce((s, v) => s + Number(v.currentBalance || 0), 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 flex flex-col justify-center">
          <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Global Total Paid</div>
          <div className="text-3xl font-extrabold text-blue-600 tabular-nums">
            <span className="text-lg opacity-70 mr-1">{currency}</span>
            {vendors.reduce((s, v) => s + Number(v.totalPaid || 0), 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
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
          <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
            <div>
              <h3 className="text-sm font-semibold text-mint-700 border-b pb-1 mb-3">Basic Information</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500 block text-xs uppercase tracking-wide">Vendor Name</span>
                  <span className="font-semibold text-gray-800">{viewData.name || "-"}</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-xs uppercase tracking-wide">Vendor Code</span>
                  <span className="font-semibold text-gray-800">{viewData.code || "-"}</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-xs uppercase tracking-wide">Reg. Number (SSM)</span>
                  <span className="text-gray-800">{viewData.registrationNumber || "-"}</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-xs uppercase tracking-wide">Tax Number</span>
                  <span className="text-gray-800">{viewData.taxNumber || "-"}</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-mint-700 border-b pb-1 mb-3">Contact Details</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500 block text-xs uppercase tracking-wide">Incharge / Owner</span>
                  <span className="font-semibold text-gray-800">{viewData.ownerName || "-"}</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-xs uppercase tracking-wide">Phone Number</span>
                  <span className="text-gray-800">{viewData.phone || "-"}</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-xs uppercase tracking-wide">Primary Email</span>
                  <span className="text-gray-800">{viewData.email || "-"}</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-xs uppercase tracking-wide">Enquiries Email</span>
                  <span className="text-gray-800">{viewData.enquiriesEmail || "-"}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500 block text-xs uppercase tracking-wide">Website Link</span>
                  {viewData.website ? (
                    <a href={viewData.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center">
                      {viewData.website}
                    </a>
                  ) : "-"}
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500 block text-xs uppercase tracking-wide">Physical Address</span>
                  <span className="text-gray-800 whitespace-pre-wrap">{viewData.address || "-"}</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-mint-700 border-b pb-1 mb-3">Financial & Accounts</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500 block text-xs uppercase tracking-wide">Bank Name</span>
                  <span className="text-gray-800">{viewData.bankName || "-"}</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-xs uppercase tracking-wide">Account Number</span>
                  <span className="text-gray-800 tracking-wider font-mono">{viewData.bankAccountNumber || "-"}</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-xs uppercase tracking-wide">Payment Terms</span>
                  <span className="text-gray-800">{viewData.termsDays !== null && viewData.termsDays !== undefined ? `${viewData.termsDays} days` : "-"}</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-xs uppercase tracking-wide">Credit Limit (Active Bills)</span>
                  <span className="text-gray-800">{viewData.maxOpenBills || "Unlimited"}</span>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-50 border border-gray-100 rounded-lg p-4 mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                 <div>
                   <span className="text-gray-500 block text-xs uppercase tracking-wide">Total Billed</span>
                   <span className="font-bold text-gray-700">{currency} {Number(viewData.totalBilled || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                 </div>
                 <div>
                   <span className="text-gray-500 block text-xs uppercase tracking-wide">Total Paid</span>
                   <span className="font-bold text-blue-600">{currency} {Number(viewData.totalPaid || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                 </div>
                 <div>
                   <span className="text-gray-500 block text-xs uppercase tracking-wide">AP Balance</span>
                   <span className={`font-bold ${Number(viewData.currentBalance || 0) > 0 ? "text-red-500" : "text-emerald-600"}`}>{currency} {Number(viewData.currentBalance || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                 </div>
                 <div>
                   <span className="text-gray-500 block text-xs uppercase tracking-wide">Last Payment</span>
                   <span className="text-gray-700 font-medium">{viewData.lastPaymentDate ? new Date(viewData.lastPaymentDate).toLocaleDateString() : "-"}</span>
                 </div>
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <Button onClick={() => setViewOpen(false)}>Close</Button>
          </div>
        </Modal>
      )}

      {/* Add Vendor Modal */}
      {openAdd && (
        <Modal title="Add Vendor" maxWidth="max-w-2xl" onClose={() => setOpenAdd(false)}>
          <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
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
          <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
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
