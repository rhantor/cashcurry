"use client";
import React, { useState, useRef } from "react";
import { skipToken } from "@reduxjs/toolkit/query";
import useCompanyId from "@/utils/useCompanyId";
import {
  useGetItemsQuery,
  useAddItemMutation,
  useUpdateItemMutation,
  useDeleteItemMutation,
  useAddMultipleItemsMutation,
} from "@/lib/redux/api/itemsApiSlice";
import { useGetVendorsQuery } from "@/lib/redux/api/vendorsApiSlice";
import Modal from "@/app/components/common/Modal";
import Input from "@/app/components/common/Input";
import Button from "@/app/components/common/Button";
import * as XLSX from "xlsx";
import { Upload, FileSpreadsheet, Trash2, Edit3, Plus } from "lucide-react";

export default function ItemsCatalogPage() {
  const companyId = useCompanyId();
  const args = companyId ? { companyId } : skipToken;

  const { data: items = [], isLoading, isFetching } = useGetItemsQuery(args);
  const { data: vendors = [], isLoading: vendorsLoading } = useGetVendorsQuery(args);

  const [addItem, { isLoading: adding }] = useAddItemMutation();
  const [updateItem, { isLoading: updating }] = useUpdateItemMutation();
  const [deleteItem, { isLoading: deleting }] = useDeleteItemMutation();
  const [addMultipleItems, { isLoading: bulkAdding }] = useAddMultipleItemsMutation();

  const busy = isLoading || isFetching || adding || updating || deleting || bulkAdding;

  const [openAdd, setOpenAdd] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", category: "", unit: "Pcs", defaultPrice: "", vendorIds: [] });

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState(null);

  const fileInputRef = useRef(null);

  const handleSaveNew = async () => {
    if (!addForm.name?.trim()) return alert("Please enter item name");
    if (!addForm.category?.trim()) return alert("Please enter category");
    try {
      await addItem({ companyId, item: addForm }).unwrap();
      setAddForm({ name: "", category: "", unit: "Pcs", defaultPrice: "", vendorIds: [] });
      setOpenAdd(false);
    } catch (e) {
      console.error(e);
      alert("Failed to add item");
    }
  };

  const handleOpenEdit = (i) => {
    setEditForm({ ...i });
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editForm?.id) return;
    try {
      await updateItem({
        companyId,
        itemId: editForm.id,
        patch: {
          name: editForm.name,
          category: editForm.category,
          unit: editForm.unit,
          defaultPrice: Number(editForm.defaultPrice || 0),
          vendorIds: editForm.vendorIds,
        },
      }).unwrap();
      setEditOpen(false);
    } catch (e) {
      console.error(e);
      alert("Failed to update item");
    }
  };

  const handleDelete = async (i) => {
    if (!confirm(`Delete ${i.name}?`)) return;
    try {
      await deleteItem({ companyId, itemId: i.id }).unwrap();
    } catch (e) {
      console.error(e);
      alert("Failed to delete item");
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        if (data.length === 0) {
          alert("The uploaded excel file is empty.");
          return;
        }

        const validItems = data.map((row) => ({
          name: row["Item Name"] || row["Name"] || "",
          category: row["Category"] || "Uncategorized",
          unit: row["Unit"] || "Pcs",
          defaultPrice: row["Default Price"] || row["Price"] || 0,
          vendorIds: [], // Advanced mapping could happen here if vendors were provided by exact name
        })).filter(i => i.name.trim() !== "");

        if (validItems.length === 0) {
          alert("No valid items found. Ensure you have an 'Item Name' column.");
          return;
        }

        if (confirm(`Are you sure you want to import ${validItems.length} items?`)) {
          await addMultipleItems({ companyId, items: validItems }).unwrap();
          alert(`Successfully imported ${validItems.length} items.`);
        }
      } catch (err) {
        console.error(err);
        alert("Error parsing excel file. Please make sure it's a valid XLSX/CSV.");
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsBinaryString(file);
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      { "Item Name": "Tomato", Category: "Groceries", Unit: "Kg", "Default Price": 5.50 },
      { "Item Name": "Heineken Bottle", Category: "Bar Items", Unit: "Box", "Default Price": 120.00 },
      { "Item Name": "Tissue Paper", Category: "Stationeries", Unit: "Pcs", "Default Price": 2.00 },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ItemsTemplate");
    XLSX.writeFile(wb, "Items_Import_Template.xlsx");
  };

  // Group items by category for simple display
  const itemsByCategory = items.reduce((acc, item) => {
    const cat = item.category || "Uncategorized";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Items Catalog</h1>
          <p className="text-gray-500 text-sm">Manage products for fast ordering in requisitions.</p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <input 
            type="file" 
            accept=".xlsx, .xls, .csv" 
            className="hidden" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
          />
          
          <Button variant="outline" className="flex items-center gap-2" onClick={downloadTemplate}>
            <FileSpreadsheet className="w-4 h-4" /> Template
          </Button>
          
          <Button variant="secondary" className="flex items-center gap-2" onClick={() => fileInputRef.current?.click()} disabled={busy}>
            <Upload className="w-4 h-4" /> Import Excel
          </Button>

          <Button className="flex items-center gap-2" onClick={() => setOpenAdd(true)} disabled={!companyId || busy}>
            <Plus className="w-4 h-4" /> Add Item
          </Button>
        </div>
      </div>

      {busy ? (
        <div className="text-gray-400 animate-pulse text-sm">Working...</div>
      ) : Object.keys(itemsByCategory).length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl shadow border border-gray-100">
          <FileSpreadsheet className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <h3 className="text-lg font-medium text-gray-900">No items available</h3>
          <p className="text-gray-500 text-sm mb-4">Start by adding a new item manually or importing from Excel.</p>
          <Button onClick={() => setOpenAdd(true)}>+ Add Your First Item</Button>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(itemsByCategory).map(([category, catItems]) => (
            <div key={category} className="bg-white rounded-xl shadow overflow-hidden border border-gray-100">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 font-semibold text-gray-800">
                {category} <span className="text-xs text-mint-600 px-2 py-0.5 bg-mint-50 rounded-full ml-2">{catItems.length}</span>
              </div>
              <ul className="divide-y divide-gray-100">
                {catItems.map((item) => (
                  <li key={item.id} className="p-4 flex items-center justify-between hover:bg-gray-50/50">
                    <div>
                      <div className="font-medium text-gray-900">{item.name}</div>
                      <div className="flex gap-4 text-xs text-gray-500 mt-1">
                        <span>Unit: {item.unit}</span>
                        {item.defaultPrice > 0 && <span>Est. Price: {Number(item.defaultPrice).toFixed(2)}</span>}
                        {item.vendorIds?.length > 0 && <span>• Mapped to {item.vendorIds.length} Vendor(s)</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                       <button onClick={() => handleOpenEdit(item)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors">
                         <Edit3 className="w-4 h-4" />
                       </button>
                       <button onClick={() => handleDelete(item)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors">
                         <Trash2 className="w-4 h-4" />
                       </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* Add Modal */}
      {openAdd && (
        <Modal title="Add Item" onClose={() => setOpenAdd(false)}>
          <div className="grid grid-cols-1 gap-4">
            <Input label="Item Name *" value={addForm.name} onChange={(v) => setAddForm((f) => ({ ...f, name: v }))} autoFocus />
            <Input label="Category *" list="cat-list" value={addForm.category} onChange={(v) => setAddForm((f) => ({ ...f, category: v }))} placeholder="e.g., Groceries, Stationeries" />
            <div className="grid grid-cols-2 gap-4">
               <Input label="Unit" value={addForm.unit} onChange={(v) => setAddForm((f) => ({ ...f, unit: v }))} placeholder="e.g., Kg, Pcs, Box" />
               <Input label="Default Price (Est)" type="number" step="0.01" value={addForm.defaultPrice} onChange={(v) => setAddForm((f) => ({ ...f, defaultPrice: v }))} placeholder="0.00" />
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-700">Preferred Vendors</label>
              <select 
                multiple 
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-mint-500 focus:ring-mint-500 sm:text-sm p-2 border min-h-[100px]"
                value={addForm.vendorIds}
                onChange={(e) => {
                  const options = Array.from(e.target.options);
                  setAddForm(f => ({ ...f, vendorIds: options.filter(o => o.selected).map(o => o.value) }));
                }}
              >
                {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
              <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple vendors.</p>
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setOpenAdd(false)}>Cancel</Button>
            <Button onClick={handleSaveNew} disabled={busy}>Save Item</Button>
          </div>
        </Modal>
      )}

      {/* Edit Modal */}
      {editOpen && editForm && (
        <Modal title="Edit Item" onClose={() => setEditOpen(false)}>
          <div className="grid grid-cols-1 gap-4">
            <Input label="Item Name *" value={editForm.name} onChange={(v) => setEditForm((f) => ({ ...f, name: v }))} autoFocus />
            <Input label="Category *" value={editForm.category} onChange={(v) => setEditForm((f) => ({ ...f, category: v }))} />
            <div className="grid grid-cols-2 gap-4">
               <Input label="Unit" value={editForm.unit} onChange={(v) => setEditForm((f) => ({ ...f, unit: v }))} />
               <Input label="Default Price (Est)" type="number" step="0.01" value={editForm.defaultPrice} onChange={(v) => setEditForm((f) => ({ ...f, defaultPrice: v }))} />
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-700">Preferred Vendors</label>
              <select 
                multiple 
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-mint-500 focus:ring-mint-500 sm:text-sm p-2 border min-h-[100px]"
                value={editForm.vendorIds || []}
                onChange={(e) => {
                  const options = Array.from(e.target.options);
                  setEditForm(f => ({ ...f, vendorIds: options.filter(o => o.selected).map(o => o.value) }));
                }}
              >
                {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={busy}>Update Item</Button>
          </div>
        </Modal>
      )}
      
      {/* Category Datalist for autocomplete */}
      <datalist id="cat-list">
         {Object.keys(itemsByCategory).map(cat => <option key={cat} value={cat} />)}
      </datalist>
    </div>
  );
}
