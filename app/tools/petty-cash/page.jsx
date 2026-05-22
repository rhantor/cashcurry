"use client";

import React, { useState, useRef, useEffect } from "react";
import { jsPDF } from "jspdf";
import { toPng } from "html-to-image";

export default function PettyCashTracker() {
  const trackerRef = useRef(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const [headerDetails, setHeaderDetails] = useState({
    title: "Petty Cash Log",
    branch: "Main Branch",
    period: "May 2026",
    preparedBy: "Manager",
    startingBalance: 500.0,
  });

  const [transactions, setTransactions] = useState([
    { id: 1, date: "01/05", description: "Office Supplies (Pens, Paper)", voucherNo: "V-001", cashIn: 0, cashOut: 45.5 },
    { id: 2, date: "03/05", description: "Postage/Courier", voucherNo: "V-002", cashIn: 0, cashOut: 12.0 },
    { id: 3, date: "10/05", description: "Cash Replenishment", voucherNo: "DEP-01", cashIn: 200, cashOut: 0 },
    { id: 4, date: "12/05", description: "Cleaning Supplies", voucherNo: "V-003", cashIn: 0, cashOut: 35.0 },
  ]);

  // Handle header changes
  const handleHeaderChange = (field, value) => {
    setHeaderDetails(prev => ({ ...prev, [field]: value }));
  };

  // Transaction Operations
  const addTransaction = () => {
    setTransactions([
      ...transactions,
      { id: Date.now(), date: "", description: "", voucherNo: "", cashIn: 0, cashOut: 0 }
    ]);
  };

  const updateTransaction = (id, field, value) => {
    setTransactions(transactions.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const removeTransaction = (id) => {
    setTransactions(transactions.filter(t => t.id !== id));
  };

  // Calculate Running Balances and Totals
  let currentBalance = parseFloat(headerDetails.startingBalance) || 0;
  let totalIn = 0;
  let totalOut = 0;

  const processedTransactions = transactions.map(t => {
    const cin = parseFloat(t.cashIn) || 0;
    const cout = parseFloat(t.cashOut) || 0;
    totalIn += cin;
    totalOut += cout;
    currentBalance = currentBalance + cin - cout;
    return { ...t, balance: currentBalance, cin, cout };
  });

  const endingBalance = currentBalance;

  const formatCurrency = (val) => `RM ${parseFloat(val).toFixed(2)}`;

  const handlePrint = async () => {
    if (!trackerRef.current) return;
    setIsGenerating(true);

    try {
      const dataUrl = await toPng(trackerRef.current, { 
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
      const pdfHeight = (trackerRef.current.offsetHeight * pdfWidth) / trackerRef.current.offsetWidth;
      
      pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Petty_Cash_${headerDetails.period.replace(/ /g, '_')}.pdf`);
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
        <h2 className="text-2xl font-bold mb-6 text-gray-800">Petty Cash Tracker</h2>
        
        <div className="space-y-6">
          {/* Header Details */}
          <div>
            <h3 className="text-lg font-semibold mb-3 text-gray-800 border-b pb-2">Log Details</h3>
            <input type="text" className="w-full border p-2 mb-2 rounded text-sm text-black" placeholder="Title" value={headerDetails.title} onChange={(e) => handleHeaderChange('title', e.target.value)} />
            <input type="text" className="w-full border p-2 mb-2 rounded text-sm text-black" placeholder="Branch Name" value={headerDetails.branch} onChange={(e) => handleHeaderChange('branch', e.target.value)} />
            <div className="grid grid-cols-2 gap-2 mb-2">
              <input type="text" className="border p-2 rounded text-sm text-black" placeholder="Period (e.g. May 2026)" value={headerDetails.period} onChange={(e) => handleHeaderChange('period', e.target.value)} />
              <input type="text" className="border p-2 rounded text-sm text-black" placeholder="Prepared By" value={headerDetails.preparedBy} onChange={(e) => handleHeaderChange('preparedBy', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Starting Balance</label>
              <input type="number" className="w-full border p-2 rounded text-sm text-black" value={headerDetails.startingBalance} onChange={(e) => handleHeaderChange('startingBalance', parseFloat(e.target.value) || 0)} />
            </div>
          </div>

          {/* Transactions */}
          <div>
            <div className="flex justify-between items-center mb-3 border-b pb-2">
              <h3 className="text-lg font-semibold text-gray-800">Transactions</h3>
              <button onClick={addTransaction} className="bg-mint-600 hover:bg-mint-700 text-white px-3 py-1 rounded text-xs font-medium">
                + Add Row
              </button>
            </div>

            <div className="space-y-3">
              {transactions.map((t, index) => (
                <div key={t.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50 relative">
                  <button onClick={() => removeTransaction(t.id)} className="absolute top-2 right-2 text-red-400 hover:text-red-600">✕</button>
                  <div className="grid grid-cols-2 gap-2 mb-2 pr-4">
                    <input type="text" className="border p-1.5 rounded text-xs text-black" placeholder="Date (dd/mm)" value={t.date} onChange={(e) => updateTransaction(t.id, 'date', e.target.value)} />
                    <input type="text" className="border p-1.5 rounded text-xs text-black" placeholder="Voucher/Receipt No." value={t.voucherNo} onChange={(e) => updateTransaction(t.id, 'voucherNo', e.target.value)} />
                  </div>
                  <input type="text" className="w-full border p-1.5 mb-2 rounded text-xs text-black" placeholder="Description" value={t.description} onChange={(e) => updateTransaction(t.id, 'description', e.target.value)} />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-0.5">Cash In (+)</label>
                      <input type="number" className="w-full border p-1.5 rounded text-xs text-black" value={t.cashIn} onChange={(e) => updateTransaction(t.id, 'cashIn', e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-0.5">Cash Out (-)</label>
                      <input type="number" className="w-full border p-1.5 rounded text-xs text-black" value={t.cashOut} onChange={(e) => updateTransaction(t.id, 'cashOut', e.target.value)} />
                    </div>
                  </div>
                </div>
              ))}
              {transactions.length === 0 && <p className="text-xs text-gray-500 italic">No transactions added.</p>}
            </div>
          </div>

          <button 
            onClick={handlePrint} 
            disabled={isGenerating}
            className={`w-full text-white font-bold py-3 px-4 rounded mt-4 transition-colors ${isGenerating ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {isGenerating ? 'Generating PDF...' : 'Print / Save Log'}
          </button>
        </div>
      </div>

      {/* Tracker Preview */}
      <div className="w-full md:w-2/3 flex justify-center print:w-full print:block">
        <div 
          ref={trackerRef} 
          className="bg-white shadow-lg print:shadow-none w-[210mm] min-h-[297mm] p-[15mm] box-border font-sans text-black flex flex-col relative" 
          style={{ backgroundColor: 'white' }}
        >
          {/* Header */}
          <div className="flex justify-between items-start border-b-2 border-mint-700 pb-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 tracking-tight uppercase">{headerDetails.title}</h1>
              <p className="text-lg text-gray-600 mt-1 font-medium">{headerDetails.branch}</p>
            </div>
            <div className="text-sm text-right space-y-1 bg-gray-50 p-3 rounded border border-gray-200 min-w-[200px]">
              <p className="flex justify-between"><span className="font-semibold text-gray-500">Period:</span> <span className="font-bold">{headerDetails.period}</span></p>
              <p className="flex justify-between"><span className="font-semibold text-gray-500">Prepared By:</span> <span className="font-bold">{headerDetails.preparedBy}</span></p>
              <div className="border-t border-gray-300 my-1"></div>
              <p className="flex justify-between text-base"><span className="font-semibold text-gray-500">Starting Bal:</span> <span className="font-bold text-mint-700">{formatCurrency(headerDetails.startingBalance)}</span></p>
            </div>
          </div>

          {/* Transactions Table */}
          <table className="w-full border-collapse border border-gray-300 text-sm mb-6">
            <thead>
              <tr className="bg-mint-50 text-mint-900 border-b-2 border-mint-200">
                <th className="border-x border-gray-300 px-3 py-2.5 text-left font-bold w-[10%]">Date</th>
                <th className="border-x border-gray-300 px-3 py-2.5 text-left font-bold w-[15%]">Vch. No.</th>
                <th className="border-x border-gray-300 px-3 py-2.5 text-left font-bold w-[35%]">Description</th>
                <th className="border-x border-gray-300 px-3 py-2.5 text-right font-bold w-[12%]">Cash In</th>
                <th className="border-x border-gray-300 px-3 py-2.5 text-right font-bold w-[12%]">Cash Out</th>
                <th className="border-x border-gray-300 px-3 py-2.5 text-right font-bold w-[16%]">Balance</th>
              </tr>
            </thead>
            <tbody>
              {/* Starting Balance Row */}
              <tr className="bg-gray-50 italic text-gray-600">
                <td className="border border-gray-300 px-3 py-2 text-center" colSpan="3">Starting Balance Carried Forward</td>
                <td className="border border-gray-300 px-3 py-2 text-right"></td>
                <td className="border border-gray-300 px-3 py-2 text-right"></td>
                <td className="border border-gray-300 px-3 py-2 text-right font-semibold text-gray-800">{formatCurrency(headerDetails.startingBalance)}</td>
              </tr>
              
              {/* Transaction Rows */}
              {processedTransactions.map((t, idx) => (
                <tr key={t.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                  <td className="border border-gray-300 px-3 py-2">{t.date}</td>
                  <td className="border border-gray-300 px-3 py-2 text-gray-500">{t.voucherNo}</td>
                  <td className="border border-gray-300 px-3 py-2">{t.description}</td>
                  <td className="border border-gray-300 px-3 py-2 text-right text-green-600">{t.cin > 0 ? formatCurrency(t.cin) : '-'}</td>
                  <td className="border border-gray-300 px-3 py-2 text-right text-red-500">{t.cout > 0 ? formatCurrency(t.cout) : '-'}</td>
                  <td className="border border-gray-300 px-3 py-2 text-right font-medium">{formatCurrency(t.balance)}</td>
                </tr>
              ))}

              {processedTransactions.length === 0 && (
                <tr>
                  <td colSpan="6" className="border border-gray-300 px-3 py-8 text-center text-gray-400 italic">No transactions recorded for this period.</td>
                </tr>
              )}
            </tbody>
            {/* Totals Footer */}
            <tfoot>
              <tr className="bg-gray-100 font-bold border-t-2 border-gray-400">
                <td className="border border-gray-300 px-3 py-2 text-right" colSpan="3">TOTALS</td>
                <td className="border border-gray-300 px-3 py-2 text-right text-green-700">{formatCurrency(totalIn)}</td>
                <td className="border border-gray-300 px-3 py-2 text-right text-red-600">{formatCurrency(totalOut)}</td>
                <td className="border border-gray-300 px-3 py-2 text-right text-mint-800 bg-mint-50">{formatCurrency(endingBalance)}</td>
              </tr>
            </tfoot>
          </table>

          {/* Ending Summary Box */}
          <div className="flex justify-end mb-10">
            <div className="w-64 border-2 border-mint-700 rounded-lg overflow-hidden">
              <div className="bg-mint-700 text-white text-center py-1.5 font-bold text-sm uppercase tracking-wider">
                Closing Balance
              </div>
              <div className="bg-white text-center py-3 text-xl font-bold text-gray-800">
                {formatCurrency(endingBalance)}
              </div>
            </div>
          </div>

          {/* Signatures Footer */}
          <div className="mt-auto pt-8">
            <div className="flex justify-between px-10">
              <div className="w-48 text-center text-sm">
                <div className="border-t border-gray-800 pt-2 font-semibold">
                  Prepared By
                </div>
                <div className="text-gray-500 mt-1 text-xs">{headerDetails.preparedBy}</div>
              </div>
              <div className="w-48 text-center text-sm">
                <div className="border-t border-gray-800 pt-2 font-semibold">
                  Approved By (Manager)
                </div>
                <div className="text-gray-500 mt-1 text-xs">Signature & Date</div>
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
