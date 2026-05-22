"use client";

import React, { useState, useRef } from "react";
import { jsPDF } from "jspdf";
import { toPng } from "html-to-image";

export default function InvoiceGenerator() {
  const invoiceRef = useRef(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const [logo, setLogo] = useState(null);
  const [companyDetails, setCompanyDetails] = useState({
    name: "",
    registrationNo: "",
    addressLine1: "",
    addressLine2: "",
    phoneFax: "",
  });

  const [invoiceDetails, setInvoiceDetails] = useState({
    invoiceNo: "",
    date: "",
    terms: "",
    attn: "",
  });

  const [billTo, setBillTo] = useState("");

  const [items, setItems] = useState([
    {
      description: "",
      qty: 1,
      unitPrice: 0.0,
    },
  ]);

  const [rounding, setRounding] = useState(0.0);

  const [bankDetails, setBankDetails] = useState({
    accountName: "",
    accountNumber: "",
    bankName: "",
  });

  const [signatures, setSignatures] = useState({
    left: "Authorized Signature",
    right: "Company Stamp",
  });

  const [amountInWords, setAmountInWords] = useState("");

  // Format currency
  const formatCurrency = (amount) => {
    return `RM${parseFloat(amount).toFixed(2)}`;
  };

  // Calculations
  const subtotal = items.reduce((acc, item) => acc + item.qty * item.unitPrice, 0);
  const totalAmount = subtotal + parseFloat(rounding || 0);

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogo(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, { description: "", qty: 1, unitPrice: 0 }]);
  };

  const removeItem = (index) => {
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
  };

  const handlePrint = async () => {
    if (!invoiceRef.current) return;
    setIsGenerating(true);

    try {
      const dataUrl = await toPng(invoiceRef.current, { 
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
      const pdfHeight = (invoiceRef.current.offsetHeight * pdfWidth) / invoiceRef.current.offsetWidth;
      
      pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${invoiceDetails.invoiceNo || 'invoice'}.pdf`);
    } catch (err) {
      console.error('Failed to generate PDF', err);
      // Fallback to standard print if html-to-image fails
      window.print();
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8 flex flex-col md:flex-row gap-8 print:bg-white print:p-0 print:m-0">
      
      {/* Configuration Form - Hidden when printing */}
      <div className="w-full md:w-1/3 bg-white p-6 rounded-lg shadow-md h-fit overflow-y-auto max-h-[90vh] print:hidden">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">Invoice Generator</h2>
        
        <div className="space-y-6">
          {/* Logo Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company Logo</label>
            <input type="file" accept="image/*" onChange={handleLogoUpload} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
          </div>

          {/* Company Details */}
          <div className="border-t pt-4">
            <h3 className="text-lg font-semibold mb-3 text-gray-800">Company Details</h3>
            <input type="text" className="w-full border p-2 mb-2 rounded text-sm text-black" placeholder="Company Name" value={companyDetails.name} onChange={(e) => setCompanyDetails({...companyDetails, name: e.target.value})} />
            <input type="text" className="w-full border p-2 mb-2 rounded text-sm text-black" placeholder="Registration No" value={companyDetails.registrationNo} onChange={(e) => setCompanyDetails({...companyDetails, registrationNo: e.target.value})} />
            <input type="text" className="w-full border p-2 mb-2 rounded text-sm text-black" placeholder="Address Line 1" value={companyDetails.addressLine1} onChange={(e) => setCompanyDetails({...companyDetails, addressLine1: e.target.value})} />
            <input type="text" className="w-full border p-2 mb-2 rounded text-sm text-black" placeholder="Address Line 2" value={companyDetails.addressLine2} onChange={(e) => setCompanyDetails({...companyDetails, addressLine2: e.target.value})} />
            <input type="text" className="w-full border p-2 mb-2 rounded text-sm text-black" placeholder="Phone/Fax" value={companyDetails.phoneFax} onChange={(e) => setCompanyDetails({...companyDetails, phoneFax: e.target.value})} />
          </div>

          {/* Invoice Details */}
          <div className="border-t pt-4">
            <h3 className="text-lg font-semibold mb-3 text-gray-800">Invoice Meta</h3>
            <div className="grid grid-cols-2 gap-2">
              <input type="text" className="border p-2 rounded text-sm text-black" placeholder="Invoice No" value={invoiceDetails.invoiceNo} onChange={(e) => setInvoiceDetails({...invoiceDetails, invoiceNo: e.target.value})} />
              <input type="text" className="border p-2 rounded text-sm text-black" placeholder="Date" value={invoiceDetails.date} onChange={(e) => setInvoiceDetails({...invoiceDetails, date: e.target.value})} />
              <input type="text" className="border p-2 rounded text-sm text-black" placeholder="Terms" value={invoiceDetails.terms} onChange={(e) => setInvoiceDetails({...invoiceDetails, terms: e.target.value})} />
              <input type="text" className="border p-2 rounded text-sm text-black" placeholder="Attn" value={invoiceDetails.attn} onChange={(e) => setInvoiceDetails({...invoiceDetails, attn: e.target.value})} />
            </div>
          </div>

          {/* Bill To */}
          <div className="border-t pt-4">
            <h3 className="text-lg font-semibold mb-3 text-gray-800">Bill To</h3>
            <textarea className="w-full border p-2 rounded text-sm text-black" rows="3" placeholder="Client Address/Details" value={billTo} onChange={(e) => setBillTo(e.target.value)}></textarea>
          </div>

          {/* Items */}
          <div className="border-t pt-4">
            <h3 className="text-lg font-semibold mb-3 flex justify-between items-center text-gray-800">
              Items
              <button onClick={addItem} className="bg-blue-500 text-white px-2 py-1 rounded text-xs">Add Item</button>
            </h3>
            {items.map((item, index) => (
              <div key={index} className="border p-3 rounded mb-3 bg-gray-50">
                <textarea className="w-full border p-2 mb-2 rounded text-sm text-black" placeholder="Description" rows="2" value={item.description} onChange={(e) => handleItemChange(index, "description", e.target.value)}></textarea>
                <div className="flex gap-2 mb-2">
                  <input type="number" className="w-1/3 border p-2 rounded text-sm text-black" placeholder="Qty" value={item.qty} onChange={(e) => handleItemChange(index, "qty", parseFloat(e.target.value) || 0)} />
                  <input type="number" className="w-2/3 border p-2 rounded text-sm text-black" placeholder="Unit Price" value={item.unitPrice} onChange={(e) => handleItemChange(index, "unitPrice", parseFloat(e.target.value) || 0)} />
                </div>
                {items.length > 1 && (
                  <button onClick={() => removeItem(index)} className="text-red-500 text-xs">Remove</button>
                )}
              </div>
            ))}
            <div className="mt-2 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Rounding / Adjustment:</span>
              <input type="number" className="border p-2 rounded text-sm w-32 text-black" value={rounding} onChange={(e) => setRounding(parseFloat(e.target.value) || 0)} />
            </div>
          </div>

          {/* Extras */}
          <div className="border-t pt-4">
            <h3 className="text-lg font-semibold mb-3 text-gray-800">Extras</h3>
            <input type="text" className="w-full border p-2 mb-2 rounded text-sm text-black" placeholder="Amount In Words" value={amountInWords} onChange={(e) => setAmountInWords(e.target.value)} />
            
            <h4 className="text-sm font-medium mt-3 mb-1 text-gray-700">Bank Details</h4>
            <input type="text" className="w-full border p-2 mb-1 rounded text-sm text-black" placeholder="Account Name" value={bankDetails.accountName} onChange={(e) => setBankDetails({...bankDetails, accountName: e.target.value})} />
            <input type="text" className="w-full border p-2 mb-1 rounded text-sm text-black" placeholder="Account Number" value={bankDetails.accountNumber} onChange={(e) => setBankDetails({...bankDetails, accountNumber: e.target.value})} />
            <input type="text" className="w-full border p-2 mb-1 rounded text-sm text-black" placeholder="Bank Name" value={bankDetails.bankName} onChange={(e) => setBankDetails({...bankDetails, bankName: e.target.value})} />

            <h4 className="text-sm font-medium mt-3 mb-1 text-gray-700">Signatures</h4>
            <div className="flex gap-2">
              <input type="text" className="w-1/2 border p-2 rounded text-sm text-black" placeholder="Left Sign" value={signatures.left} onChange={(e) => setSignatures({...signatures, left: e.target.value})} />
              <input type="text" className="w-1/2 border p-2 rounded text-sm text-black" placeholder="Right Sign" value={signatures.right} onChange={(e) => setSignatures({...signatures, right: e.target.value})} />
            </div>
          </div>

          <button 
            onClick={handlePrint} 
            disabled={isGenerating}
            className={`w-full text-white font-bold py-3 px-4 rounded mt-4 transition-colors ${isGenerating ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {isGenerating ? 'Generating PDF...' : 'Print / Save as PDF'}
          </button>
        </div>
      </div>

      {/* Invoice Preview */}
      <div className="w-full md:w-2/3 flex justify-center print:w-full print:block">
        {/* A4 Paper Dimensions: 210mm x 297mm */}
        <div 
          ref={invoiceRef} 
          className="bg-white shadow-lg print:shadow-none w-[210mm] min-h-[297mm] p-[20mm] box-border font-serif text-black leading-tight flex flex-col relative" 
          style={{ backgroundColor: 'white' }}
        >
          
          {/* Header section */}
          <div className="flex justify-between items-start mb-6">
            <div className="flex flex-col items-start text-left">
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt="Company Logo" className="h-16 w-auto object-contain object-left self-start mb-4" />
              ) : (
                <div className="h-16 w-16 bg-gray-200 border border-gray-300 flex items-center justify-center text-xs text-gray-500 mb-4 print:hidden self-start">
                  Logo
                </div>
              )}
              
              <h1 className="text-xl font-bold mb-1">
                {companyDetails.name} <span className="text-base font-normal">{companyDetails.registrationNo}</span>
              </h1>
              <div className="text-sm flex flex-col gap-0.5">
                <p>{companyDetails.addressLine1}</p>
                <p>{companyDetails.addressLine2}</p>
                <p>{companyDetails.phoneFax}</p>
              </div>
            </div>
            <div>
              <h1 className="text-4xl font-bold tracking-wide mt-2 text-blue-950">Invoice</h1>
            </div>
          </div>

          {/* Invoice Meta Table */}
          <table className="w-full mb-8 border-collapse border border-black text-sm">
            <thead>
              <tr>
                <th className="border border-black px-2 py-1 text-left font-bold w-1/4">Invoice No.</th>
                <th className="border border-black px-2 py-1 text-left font-bold w-1/4">Date</th>
                <th className="border border-black px-2 py-1 text-left font-bold w-1/4">Terms</th>
                <th className="border border-black px-2 py-1 text-left font-bold w-1/4">Attn</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-black px-2 py-1">{invoiceDetails.invoiceNo}</td>
                <td className="border border-black px-2 py-1">{invoiceDetails.date}</td>
                <td className="border border-black px-2 py-1">{invoiceDetails.terms}</td>
                <td className="border border-black px-2 py-1">{invoiceDetails.attn}</td>
              </tr>
            </tbody>
          </table>

          {/* Bill To */}
          <div className="mb-8">
            <h2 className="font-bold mb-1">Invoice To:</h2>
            <div className="text-sm whitespace-pre-wrap uppercase">
              {billTo}
            </div>
          </div>

          {/* Items Table */}
          <table className="w-full mb-8 border-collapse border border-black text-sm">
            <thead>
              <tr>
                <th className="border border-black px-2 py-1 text-left font-bold w-[55%]">Description</th>
                <th className="border border-black px-2 py-1 text-left font-bold w-[10%]">Qty</th>
                <th className="border border-black px-2 py-1 text-left font-bold w-[17.5%]">Unit Price</th>
                <th className="border border-black px-2 py-1 text-left font-bold w-[17.5%]">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={index} className="align-top">
                  <td className="border border-black px-2 py-2 whitespace-pre-wrap">
                    {item.description}
                  </td>
                  <td className="border border-black px-2 py-2 text-center">
                    {item.qty}
                  </td>
                  <td className="border border-black px-2 py-2">
                    {formatCurrency(item.unitPrice)}
                  </td>
                  <td className="border border-black px-2 py-2">
                    {formatCurrency(item.qty * item.unitPrice)}
                  </td>
                </tr>
              ))}
              {/* Spacer row to push totals down if needed, but per screenshot we can just cap it */}
              <tr>
                <td className="border-l border-r border-b border-black p-0 h-10"></td>
                <td className="border-l border-r border-b border-black p-0 h-10"></td>
                <td className="border-l border-r border-b border-black p-0 h-10"></td>
                <td className="border-l border-r border-b border-black p-0 h-10"></td>
              </tr>
              {/* Totals rows */}
              <tr>
                <td className="border-0 px-2 py-1"></td>
                <td className="border-0 px-2 py-1"></td>
                <td className="border border-black px-2 py-1 font-semibold">Subtotal</td>
                <td className="border border-black px-2 py-1">{formatCurrency(subtotal)}</td>
              </tr>
              <tr>
                <td className="border-0 px-2 py-1"></td>
                <td className="border-0 px-2 py-1"></td>
                <td className="border border-black px-2 py-1 font-semibold">Rounding</td>
                <td className="border border-black px-2 py-1">{formatCurrency(rounding)}</td>
              </tr>
              <tr>
                <td className="border-0 px-2 py-1"></td>
                <td className="border-0 px-2 py-1"></td>
                <td className="border border-black px-2 py-1 font-bold">TOTAL AMOUNT</td>
                <td className="border border-black px-2 py-1 font-bold">{formatCurrency(totalAmount).replace('.00', '')}</td>
              </tr>
            </tbody>
          </table>

          {/* Amount In Words */}
          <div className="mb-10 font-bold text-sm">
            {amountInWords}
          </div>

          {/* Bank Details */}
          <div className="mb-16 text-sm">
            <h3 className="font-bold mb-2">Bank Details</h3>
            <p><span className="font-bold">Account Name:</span> {bankDetails.accountName}</p>
            <p><span className="font-bold">Account Number:</span> {bankDetails.accountNumber}</p>
            <p><span className="font-bold">Bank Name:</span> {bankDetails.bankName}</p>
          </div>

          {/* Footer Signatures */}
          <div className="mt-auto pt-10">
            <div className="flex justify-between px-8">
              <div className="w-48 text-center text-sm">
                <div className="border-t border-black pt-1">
                  {signatures.left}
                </div>
              </div>
              <div className="w-48 text-center text-sm">
                <div className="border-t border-black pt-1">
                  {signatures.right}
                </div>
              </div>
            </div>
            
            <div className="text-center mt-12 mb-4 font-bold text-sm">
              THANK YOU FOR YOUR BUSINESS
            </div>
          </div>
          
        </div>
      </div>
      
      {/* Global CSS for printing adjustments */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:w-full, .print\\:w-full * {
            visibility: visible;
          }
          .print\\:w-full {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          @page {
            size: A4;
            margin: 0;
          }
        }
      `}} />
    </div>
  );
}
