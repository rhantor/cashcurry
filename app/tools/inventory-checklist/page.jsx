"use client";

import React, { useState, useRef } from "react";
import { jsPDF } from "jspdf";
import { toPng } from "html-to-image";

export default function InventoryChecklistGenerator() {
  const checklistRef = useRef(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const [headerDetails, setHeaderDetails] = useState({
    title: "Daily Inventory Count",
    date: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
    preparedBy: "Manager",
    branch: "Main Branch",
  });

  const [categories, setCategories] = useState([
    {
      id: 1,
      name: "Meat & Poultry",
      items: [
        { id: 1, name: "Chicken Breast", expectedQty: "10 kg" },
        { id: 2, name: "Beef Mince", expectedQty: "5 kg" },
      ]
    },
    {
      id: 2,
      name: "Vegetables",
      items: [
        { id: 3, name: "Onions", expectedQty: "20 kg" },
        { id: 4, name: "Tomatoes", expectedQty: "15 kg" },
      ]
    }
  ]);

  // Handle header changes
  const handleHeaderChange = (field, value) => {
    setHeaderDetails(prev => ({ ...prev, [field]: value }));
  };

  // Category Operations
  const addCategory = () => {
    setCategories([
      ...categories,
      { id: Date.now(), name: "New Category", items: [] }
    ]);
  };

  const updateCategoryName = (catId, newName) => {
    setCategories(categories.map(cat => cat.id === catId ? { ...cat, name: newName } : cat));
  };

  const removeCategory = (catId) => {
    setCategories(categories.filter(cat => cat.id !== catId));
  };

  // Item Operations
  const addItem = (catId) => {
    setCategories(categories.map(cat => {
      if (cat.id === catId) {
        return {
          ...cat,
          items: [...cat.items, { id: Date.now(), name: "", expectedQty: "" }]
        };
      }
      return cat;
    }));
  };

  const updateItem = (catId, itemId, field, value) => {
    setCategories(categories.map(cat => {
      if (cat.id === catId) {
        return {
          ...cat,
          items: cat.items.map(item => item.id === itemId ? { ...item, [field]: value } : item)
        };
      }
      return cat;
    }));
  };

  const removeItem = (catId, itemId) => {
    setCategories(categories.map(cat => {
      if (cat.id === catId) {
        return {
          ...cat,
          items: cat.items.filter(item => item.id !== itemId)
        };
      }
      return cat;
    }));
  };

  const handlePrint = async () => {
    if (!checklistRef.current) return;
    setIsGenerating(true);

    try {
      const dataUrl = await toPng(checklistRef.current, { 
        quality: 1.0, 
        pixelRatio: 2,
        backgroundColor: '#ffffff'
      });
      
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (checklistRef.current.offsetHeight * pdfWidth) / checklistRef.current.offsetWidth;
      
      pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Checklist_${headerDetails.date.replace(/ /g, '_')}.pdf`);
    } catch (err) {
      console.error('Failed to generate PDF', err);
      window.print();
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8 flex flex-col md:flex-row gap-8 print:bg-white print:p-0 print:m-0">
      
      {/* Configuration Form */}
      <div className="w-full md:w-1/3 bg-white p-6 rounded-lg shadow-md h-fit overflow-y-auto max-h-[90vh] print:hidden">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">Checklist Generator</h2>
        
        <div className="space-y-6">
          {/* Header Details */}
          <div>
            <h3 className="text-lg font-semibold mb-3 text-gray-800 border-b pb-2">Document Info</h3>
            <input type="text" className="w-full border p-2 mb-2 rounded text-sm text-black" placeholder="Checklist Title" value={headerDetails.title} onChange={(e) => handleHeaderChange('title', e.target.value)} />
            <input type="text" className="w-full border p-2 mb-2 rounded text-sm text-black" placeholder="Branch Name" value={headerDetails.branch} onChange={(e) => handleHeaderChange('branch', e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <input type="text" className="border p-2 rounded text-sm text-black" placeholder="Date" value={headerDetails.date} onChange={(e) => handleHeaderChange('date', e.target.value)} />
              <input type="text" className="border p-2 rounded text-sm text-black" placeholder="Prepared By" value={headerDetails.preparedBy} onChange={(e) => handleHeaderChange('preparedBy', e.target.value)} />
            </div>
          </div>

          {/* Categories and Items */}
          <div>
            <div className="flex justify-between items-center mb-3 border-b pb-2">
              <h3 className="text-lg font-semibold text-gray-800">Inventory Items</h3>
              <button onClick={addCategory} className="bg-mint-600 hover:bg-mint-700 text-white px-3 py-1 rounded text-xs font-medium">
                + Add Category
              </button>
            </div>

            <div className="space-y-4">
              {categories.map((category) => (
                <div key={category.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                  <div className="flex gap-2 mb-3 items-center">
                    <input 
                      type="text" 
                      className="flex-1 font-bold border-b border-gray-300 bg-transparent px-1 py-1 text-sm text-black outline-none focus:border-mint-500" 
                      value={category.name} 
                      onChange={(e) => updateCategoryName(category.id, e.target.value)} 
                    />
                    <button onClick={() => removeCategory(category.id)} className="text-red-500 text-xs hover:underline">Delete Category</button>
                  </div>
                  
                  {category.items.map((item, idx) => (
                    <div key={item.id} className="flex gap-2 mb-2 items-center">
                      <span className="text-xs text-gray-400 w-4">{idx + 1}.</span>
                      <input 
                        type="text" 
                        className="flex-1 border p-1.5 rounded text-xs text-black" 
                        placeholder="Item Name" 
                        value={item.name} 
                        onChange={(e) => updateItem(category.id, item.id, 'name', e.target.value)} 
                      />
                      <input 
                        type="text" 
                        className="w-20 border p-1.5 rounded text-xs text-black" 
                        placeholder="Expected" 
                        value={item.expectedQty} 
                        onChange={(e) => updateItem(category.id, item.id, 'expectedQty', e.target.value)} 
                      />
                      <button onClick={() => removeItem(category.id, item.id)} className="text-red-400 text-xs">✕</button>
                    </div>
                  ))}
                  <button onClick={() => addItem(category.id)} className="mt-1 text-mint-600 text-xs font-semibold hover:underline">
                    + Add Item
                  </button>
                </div>
              ))}
            </div>
          </div>

          <button 
            onClick={handlePrint} 
            disabled={isGenerating}
            className={`w-full text-white font-bold py-3 px-4 rounded mt-4 transition-colors ${isGenerating ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {isGenerating ? 'Generating PDF...' : 'Print / Save Checklist'}
          </button>
        </div>
      </div>

      {/* Checklist Preview */}
      <div className="w-full md:w-2/3 flex justify-center print:w-full print:block">
        <div 
          ref={checklistRef} 
          className="bg-white shadow-lg print:shadow-none w-[210mm] min-h-[297mm] p-[15mm] box-border font-sans text-black flex flex-col relative" 
          style={{ backgroundColor: 'white' }}
        >
          {/* Header */}
          <div className="flex justify-between items-end border-b-2 border-gray-800 pb-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 tracking-tight uppercase">{headerDetails.title}</h1>
              <p className="text-lg text-gray-600 mt-1 font-medium">{headerDetails.branch}</p>
            </div>
            <div className="text-sm text-right space-y-1">
              <p><span className="font-bold">Date:</span> {headerDetails.date}</p>
              <p><span className="font-bold">Prepared By:</span> {headerDetails.preparedBy}</p>
              <p><span className="font-bold">Checked By:</span> ___________________</p>
            </div>
          </div>

          {/* Checklist Table */}
          <table className="w-full border-collapse border border-black text-sm mb-8">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-black px-3 py-2 text-left font-bold w-[40%]">Item Description</th>
                <th className="border border-black px-3 py-2 text-center font-bold w-[15%]">System Qty</th>
                <th className="border border-black px-3 py-2 text-center font-bold w-[15%]">Actual Count</th>
                <th className="border border-black px-3 py-2 text-center font-bold w-[15%]">Difference</th>
                <th className="border border-black px-3 py-2 text-left font-bold w-[15%]">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <React.Fragment key={category.id}>
                  {/* Category Header Row */}
                  <tr className="bg-gray-200">
                    <td colSpan="5" className="border border-black px-3 py-2 font-bold uppercase text-gray-800">
                      {category.name}
                    </td>
                  </tr>
                  {/* Item Rows */}
                  {category.items.map((item) => (
                    <tr key={item.id}>
                      <td className="border border-black px-3 py-2">{item.name}</td>
                      <td className="border border-black px-3 py-2 text-center text-gray-600 bg-gray-50">{item.expectedQty}</td>
                      <td className="border border-black px-3 py-2"></td>
                      <td className="border border-black px-3 py-2"></td>
                      <td className="border border-black px-3 py-2"></td>
                    </tr>
                  ))}
                  {/* Add a little space if the category has no items yet */}
                  {category.items.length === 0 && (
                    <tr>
                      <td className="border border-black px-3 py-4 text-gray-400 italic text-center" colSpan="5">No items listed</td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>

          {/* Signatures Footer */}
          <div className="mt-auto pt-8 border-t border-gray-300">
            <div className="flex justify-between px-10">
              <div className="w-48 text-center text-sm">
                <div className="border-t border-black pt-2">
                  Prepared By (Signature)
                </div>
              </div>
              <div className="w-48 text-center text-sm">
                <div className="border-t border-black pt-2">
                  Verified By (Manager)
                </div>
              </div>
            </div>
          </div>
          
        </div>
      </div>
      
      {/* Global CSS for printing */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * { visibility: hidden; }
          .print\\:w-full, .print\\:w-full * { visibility: visible; }
          .print\\:w-full {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          @page { size: A4; margin: 0; }
        }
      `}} />
    </div>
  );
}
