'use client'

import React, { useMemo, useState } from 'react'
import { skipToken } from '@reduxjs/toolkit/query'
import { useRouter } from 'next/navigation'
import { Edit3, AlertCircle, Trash2, Eye, Paperclip } from 'lucide-react'

import useResolvedCompanyBranch from '@/utils/useResolvedCompanyBranch'
import { useGetSingleBranchQuery } from '@/lib/redux/api/branchApiSlice'
import {
  useGetVendorBillsQuery,
  useUpdateVendorBillMutation,
  useDeleteVendorBillMutation
} from '@/lib/redux/api/vendorBillsApiSlice'
import { useGetVendorsQuery } from '@/lib/redux/api/vendorsApiSlice'
import { payVendorBills } from '@/utils/payVendorBills'
// components
import DueBillsHeader from './components/DueBillsHeader'
import StatusBadge from './components/StatusBadge'
import EditBillModal from './components/EditBillModal'
import DueBillsFilters from './components/DueBillsFilters'
import ViewBillModal from './components/ViewBillModal'
import ExportBillsModal from './components/ExportBillsModal'
import PayBillsModal from '@/app/components/purchases/PayBillsModal'
import { uploadInvoiceFile } from "../../../utils/storage/uploadInvoice"
import useCurrency from '@/app/hooks/useCurrency'
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import * as XLSX from "xlsx"
import { PDFDocument } from 'pdf-lib'

// --- Helper Functions ---
function daysBetween (aISO, bISO) {
  const [ay, am, ad] = aISO.split('-').map(Number)
  const [by, bm, bd] = bISO.split('-').map(Number)
  const a = Date.UTC(ay, am - 1, ad)
  const b = Date.UTC(by, bm - 1, bd)
  return Math.round((a - b) / 86400000)
}

const makeFmtRM = (currency) => v =>
  `${currency} ${Number(v ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`

const addAttachmentToPdf = async (doc, url, vendorName, refLabel, attachmentIndex, totalAttachments) => {
  return new Promise(async (resolve) => {
    const isPdf = url.toLowerCase().split('?')[0].endsWith('.pdf');
    const pdfWidth = doc.internal.pageSize.getWidth();
    const pdfHeight = doc.internal.pageSize.getHeight();
    
    doc.addPage();
    
    // Simple, clean title
    doc.setFontSize(14);
    doc.setTextColor(33, 37, 41);
    doc.setFont("helvetica", "bold");
    const title = `Vendor: ${vendorName || 'Unknown Vendor'} | Ref: ${refLabel || 'N/A'} (${attachmentIndex})`;
    doc.text(title, 14, 20);

    if (isPdf) {
      doc.setFontSize(12);
      doc.setTextColor(100, 116, 139); // subtle gray
      doc.text("The attached PDF document follows on the next page.", 14, 30);
      resolve({ type: 'pdf', url: url });
      return;
    }

    // It's an image. We'll try loading it.
    const img = new window.Image();
    img.crossOrigin = "Anonymous";
    
    img.onload = () => {
      const startY = 30;
      const imgRatio = img.width / img.height;
      let finalW = pdfWidth - 28;
      let finalH = finalW / imgRatio;
      const maxH = pdfHeight - startY - 14;
      
      if (finalH > maxH) {
        finalH = maxH;
        finalW = finalH * imgRatio;
      }
      const xPos = (pdfWidth - finalW) / 2;
      
      try {
        doc.addImage(img, 'JPEG', xPos, startY, finalW, finalH);
      } catch (e) {
        try {
          doc.addImage(img, 'PNG', xPos, startY, finalW, finalH);
        } catch (err) {
          doc.setFontSize(10);
          doc.setTextColor(220, 38, 38);
          doc.text("Failed to embed image. Click to view:", 14, startY + 10);
          doc.setTextColor(59, 130, 246);
          doc.textWithLink("Open Image", 14, startY + 20, { url });
        }
      }
      resolve(true);
    };

    img.onerror = () => {
      doc.setFontSize(10);
      doc.setTextColor(220, 38, 38);
      doc.text("Could not embed image directly due to browser security.", 14, 40);
      doc.setTextColor(59, 130, 246);
      doc.text("Click here to open the attachment.", 14, 50);
      doc.textWithLink(url.substring(0, 50) + "...", 14, 60, { url: url });
      resolve(false);
    };

    // Use our internal proxy to bypass Firebase Storage CORS restrictions
    img.src = `/api/proxy-image?url=${encodeURIComponent(url)}`;
  });
};

// --- Main Page Component ---
export default function DueBillsPage () {
  const router = useRouter()
  const { ready, user, companyId, branchId } = useResolvedCompanyBranch()
  const currency = useCurrency()
  const fmtRM = makeFmtRM(currency)

  // --- State ---
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [payOpen, setPayOpen] = useState(false)
  const [viewModalOpen, setViewModalOpen] = useState(false)
  const [billToView, setBillToView] = useState(null)
  const [exportModalOpen, setExportModalOpen] = useState(false)

  // Edit State
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [billToEdit, setBillToEdit] = useState(null)
  const [selectedVendor, setSelectedVendor] = useState(null)

  // --- Queries & Mutations ---
  const baseArgs =
    ready && companyId && branchId ? { companyId, branchId } : skipToken
  const { data: branchData } = useGetSingleBranchQuery(baseArgs)
  const { data: vendorList = [] } = useGetVendorsQuery(baseArgs)

  // 3. Using the correct Hook Name
  const {
    data: unpaid = [],
    error: err1,
    refetch: refetchUnpaid
  } = useGetVendorBillsQuery(
    baseArgs === skipToken ? skipToken : { ...baseArgs, status: 'unpaid' }
  )

  const {
    data: partial = [],
    error: err2,
    refetch: refetchPartial
  } = useGetVendorBillsQuery(
    baseArgs === skipToken
      ? skipToken
      : { ...baseArgs, status: 'partially_paid' }
  )

  const [updateBill, { isLoading: isUpdating }] = useUpdateVendorBillMutation()
  const [deleteBill] = useDeleteVendorBillMutation()

  // --- Logic ---

  const allBills = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return [...unpaid, ...partial]
      .map(b => ({
        ...b,
        balance: Number(
          b.balance ?? Math.max(0, Number(b.total || 0) - Number(b.paid || 0))
        ),
        __dueInDays: b.dueDate ? daysBetween(b.dueDate, today) : 0
      }))
      .sort((a, b) => a.__dueInDays - b.__dueInDays)
  }, [unpaid, partial])

  // ───  Derive vendors list from allBills (inside useMemo or alongside it) ───
  const vendors = useMemo(() => {
    const seen = new Map()
    allBills.forEach(b => {
      if (b.vendorId && !seen.has(b.vendorId)) {
        seen.set(b.vendorId, {
          id: b.vendorId,
          name: b.vendorName || b.vendorId
        })
      }
    })
    return Array.from(seen.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    )
  }, [allBills])
  // ----- Vendor Filter Logic -----
  // const selectedVendorName = vendors.find(v => v.id === selectedVendor)?.name
  const filteredBills = useMemo(() => {
    let result = allBills
    if (selectedVendor) {
      result = result.filter(b => b.vendorId === selectedVendor)
    }
    if (searchTerm) {
      const lower = searchTerm.toLowerCase()
      result = result.filter(
        b =>
          b.vendorName?.toLowerCase().includes(lower) ||
          (b.invoiceNo || b.reference)?.toLowerCase().includes(lower)
      )
    }
    return result
  }, [allBills, searchTerm, selectedVendor])
  console.log('Filtered Bills:', filteredBills)

  const vendorSummaryData = useMemo(() => {
    if (selectedVendor) return []; // Only calculate for 'All Vendors' view
    const vendorSummaryMap = {};
    filteredBills.forEach(b => {
      if (!vendorSummaryMap[b.vendorId]) {
        vendorSummaryMap[b.vendorId] = {
          id: b.vendorId,
          name: b.vendorName || b.vendorId,
          billsCount: 0,
          totalPending: 0,
          lastPurchaseTimestamp: 0,
          hasOverdueBills: false
        };
      }
      vendorSummaryMap[b.vendorId].billsCount += 1;
      vendorSummaryMap[b.vendorId].totalPending += b.balance;
      
      if (b.__dueInDays < 0) {
        vendorSummaryMap[b.vendorId].hasOverdueBills = true;
      }
      
      let timestamp = 0;
      if (b.invoiceDate) {
         timestamp = new Date(b.invoiceDate).getTime();
      } else if (b.createdAt?.seconds) {
         timestamp = b.createdAt.seconds * 1000;
      }

      if (timestamp > vendorSummaryMap[b.vendorId].lastPurchaseTimestamp) {
        vendorSummaryMap[b.vendorId].lastPurchaseTimestamp = timestamp;
      }
    });

    return Object.values(vendorSummaryMap).map(v => {
      const vendorModel = vendorList.find(x => x.id === v.id);
      const code = vendorModel?.code || null;
      const maxOpenBills = vendorModel?.maxOpenBills || 0;
      let emergencyReason = [];
      if (v.hasOverdueBills) emergencyReason.push('Overdue');
      if (maxOpenBills > 0 && v.billsCount >= maxOpenBills) emergencyReason.push('Limit');
      
      return {
        ...v,
        code,
        isEmergency: emergencyReason.length > 0 ? '! ' + emergencyReason.join(' + ') : '-',
        emergencyLevel: emergencyReason.length
      };
    }).sort((a,b) => {
       if (b.emergencyLevel !== a.emergencyLevel) return b.emergencyLevel - a.emergencyLevel;
       return b.totalPending - a.totalPending;
    });
  }, [filteredBills, vendorList, selectedVendor]);

  // Selection Logic
  const toggleOne = id => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const toggleAll = e => {
    setSelectedIds(e.target.checked ? filteredBills.map(b => b.id) : [])
  }

  const selectedBills = filteredBills.filter(b => selectedIds.includes(b.id))
  const canPay =
    selectedBills.length > 0 &&
    new Set(selectedBills.map(b => b.vendorId)).size === 1
  const totalSelectedBalance = selectedBills.reduce((s, b) => s + b.balance, 0)

  // --- Handlers ---
  const handleEditClick = bill => {
    setBillToEdit(bill)
    setEditModalOpen(true)
  }
  const handleViewClick = bill => {
    setBillToView(bill)
    setViewModalOpen(true)
  }

  const handleDeleteClick = async billId => {
    if (
      confirm(
        'Are you sure you want to delete this bill? This will adjust the vendor balance.'
      )
    ) {
      try {
        await deleteBill({ companyId, branchId, billId }).unwrap()
        setSelectedIds(prev => prev.filter(id => id !== billId))
      } catch (err) {
        console.error('Failed to delete bill:', err)
        alert('Failed to delete bill.')
      }
    }
  }

const handleSaveEdit = async (billId, formData) => {
  try {
    let finalAttachments = formData.attachments  // existing URLs (some may have been removed)

    // Upload any new files the user added in the modal
    if (formData.newFiles?.length) {
      const bill = allBills.find(b => b.id === billId)

      const uploadedUrls = await Promise.all(
        formData.newFiles.map(file =>
          uploadInvoiceFile(
            {
              companyId,
              branchId,
              vendorId:  bill?.vendorId  || '',
              invoiceNo: formData.invoiceNo || bill?.invoiceNo || billId,
              invoiceDate: formData.invoiceDate || bill?.invoiceDate || '',
            },
            file,
            () => {}   // no progress tracking here — keep it simple
          ).then(r => r.url)
        )
      )

      finalAttachments = [...finalAttachments, ...uploadedUrls]
    }

    // Save the bill with merged attachments (removed ones are excluded, new ones appended)
    await updateBill({
      companyId,
      branchId,
      billId,
      updates: {
        invoiceNo:   formData.invoiceNo,
        invoiceDate: formData.invoiceDate,
        dueDate:     formData.dueDate,
        total:       formData.total,
        notes:       formData.notes,
        attachments: finalAttachments,
      }
    }).unwrap()

    setEditModalOpen(false)
  } catch (err) {
    console.error('Failed to update bill:', err)
    alert('Failed to update bill.')
  }
}


  const handleConfirmPayment = async ({
    vendorId,
    vendorName,
    allocations,
    paidFrom,
    paidMethod,
    note,
    file,
    paymentDate
  }) => {
    try {
      let paymentFileURL = null

      // Gather all attachments from the selected bills
      let allAttachments = []
      selectedBills.forEach(b => {
        if (b.attachments && Array.isArray(b.attachments)) {
          b.attachments.forEach(url => {
            if (url && !allAttachments.includes(url)) allAttachments.push(url)
          })
        }
      })

      if (file) {
        // Upload the payment proof
        const res = await uploadInvoiceFile(
          {
            companyId,
            branchId,
            vendorId,
            invoiceNo: `receipt_${Date.now()}`,
            invoiceDate: new Date().toISOString().slice(0, 10),
          },
          file,
          () => {} // optional progress
        )
        paymentFileURL = res.url
        allAttachments.push(paymentFileURL)
      } else {
        // Fallback to exactly what the bills had attached natively
        paymentFileURL = allAttachments[0] || null
      }

      // Enrich allocations with rich metadata for Cost Report Viewer
      const enrichedAllocations = allocations.map(a => {
        const bill = selectedBills.find(b => b.id === a.billId)
        return {
          ...a,
          invoiceNo: bill?.invoiceNo || bill?.reference || "",
          invoiceDate: bill?.invoiceDate || "",
          dueDate: bill?.dueDate || "",
          billTotal: bill?.total || 0,
        }
      })

      await payVendorBills({
        companyId,
        branchId,
        vendorId,
        vendorName,
        allocations: enrichedAllocations,
        paidFromOffice: paidFrom,
        paidMethod,
        reference: note?.trim() || '',
        createdBy: user || {},
        costCategory: 'Inventory',
        paymentFileURL,
        attachments: allAttachments,
        paymentDate
      })

      await Promise.all([refetchUnpaid(), refetchPartial()])
      setPayOpen(false)
      setSelectedIds([])
      alert('✅ Payment recorded!')
      router.refresh?.()
    } catch (e) {
      console.error(e)
      alert('❌ Failed to record payment.')
    }
  }

  const [isExporting, setIsExporting] = useState(false);

  const generateSummaryPDF = async (vendorIdsToInclude) => {
    const doc = new jsPDF();
    
    // Professional Header
    doc.setFontSize(18);
    doc.setTextColor(33, 37, 41);
    doc.text("Vendors Outstanding Statement", 14, 22);

    doc.setFontSize(10);
    doc.setTextColor(108, 117, 125);
    doc.text(`Generated: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, 14, 30);
    if (branchData?.name) doc.text(`Branch: ${branchData.name}`, 14, 36);
    
    const tableData = vendorSummaryData
      .filter(v => vendorIdsToInclude.includes(v.id))
      .map((v, i) => [
        i + 1,
        v.name,
        v.billsCount,
        v.lastPurchaseTimestamp ? new Date(v.lastPurchaseTimestamp).toLocaleDateString() : "-",
        fmtRM(v.totalPending),
        v.isEmergency
      ]);

    autoTable(doc, {
      startY: 45,
      head: [["#", "Vendor Name", "Bills", "Last Purchase", "Total Pending", "Remarks"]],
      body: tableData,
      theme: "striped",
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [46, 204, 113], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 249, 250] },
      columnStyles: { 
        0: { cellWidth: 10 },
        2: { halign: 'center' },
        4: { halign: 'right' },
        5: { fontStyle: 'bold' } 
      },
      didParseCell: function (data) {
        if (data.column.index === 5 && data.cell.text[0] !== '-' && data.section === 'body') {
          data.cell.styles.textColor = [220, 38, 38];
        }
      }
    });

    const finalY = doc.lastAutoTable.finalY || 45;
    const totalPending = vendorSummaryData
      .filter(v => vendorIdsToInclude.includes(v.id))
      .reduce((acc, curr) => acc + curr.totalPending, 0);

    doc.setDrawColor(200, 200, 200);
    doc.line(14, finalY + 8, 196, finalY + 8); // separator line

    doc.setFontSize(14);
    doc.setTextColor(33, 37, 41);
    doc.setFont("helvetica", "bold");
    doc.text("Total Outstanding Balance:", 155, finalY + 18, { align: 'right' });
    
    doc.setTextColor(46, 204, 113);
    doc.text(`${fmtRM(totalPending)}`, 195, finalY + 18, { align: 'right' });
    
    doc.save(`Vendors_Summary_${Date.now()}.pdf`);
  };

  const generateSingleVendorPDF = async (vendorId) => {
    const vendorBills = filteredBills.filter(b => b.vendorId === vendorId);
    const fullVendorObj = vendorList.find(v => v.id === vendorId);
    const vendorName = fullVendorObj?.name || "Vendor";
    const vendorCode = fullVendorObj?.code || "";

    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.setTextColor(33, 37, 41);
    doc.text("Statement of Account", 14, 22);

    doc.setFontSize(10);
    doc.setTextColor(108, 117, 125);
    doc.text(`Generated: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, 14, 30);
    if (branchData?.name) doc.text(`Branch: ${branchData.name}`, 14, 36);
    
    doc.setFontSize(10);
    doc.setTextColor(33, 37, 41);
    doc.setFont("helvetica", "bold");
    doc.text("Vendor Details:", 135, 22);
    
    doc.setFontSize(9);
    doc.setTextColor(33, 37, 41);
    
    let yPos = 28;
    doc.setFont("helvetica", "bold");
    doc.text(vendorName, 135, yPos);
    
    doc.setFont("helvetica", "normal");
    doc.setTextColor(108, 117, 125);
    yPos += 5;

    if (fullVendorObj?.ownerName) {
      doc.text(`Contact: ${fullVendorObj.ownerName}`, 135, yPos);
      yPos += 5;
    }
    if (fullVendorObj?.phone) {
      doc.text(`Phone: ${fullVendorObj.phone}`, 135, yPos);
      yPos += 5;
    }
    if (fullVendorObj?.email) {
      doc.text(`Email: ${fullVendorObj.email}`, 135, yPos);
      yPos += 5;
    }
    if (fullVendorObj?.bankName || fullVendorObj?.bankAccountNumber) {
      const bankInfo = [fullVendorObj.bankName, fullVendorObj.bankAccountNumber].filter(Boolean).join(" - ");
      doc.text(`Bank: ${bankInfo}`, 135, yPos);
      yPos += 5;
    }
    
    const tableData = vendorBills.map((b, i) => [
      i + 1,
      b.invoiceNo || b.reference || "-",
      b.createdAt?.seconds ? new Date(b.createdAt.seconds * 1000).toLocaleDateString() : "-",
      b.dueDate || "-",
      fmtRM(b.total),
      fmtRM(b.balance)
    ]);

    autoTable(doc, {
      startY: Math.max(45, yPos + 5),
      head: [["#", "Ref / Invoice", "Bill Date", "Due Date", "Total Amt", "Pending Bal"]],
      body: tableData,
      theme: "striped",
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [46, 204, 113], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 249, 250] },
      columnStyles: {
        0: { cellWidth: 10 },
        4: { halign: 'right' },
        5: { halign: 'right', fontStyle: 'bold' }
      }
    });

    const finalY = doc.lastAutoTable.finalY || 45;
    const totalPending = vendorBills.reduce((acc, curr) => acc + curr.balance, 0);

    doc.setDrawColor(200, 200, 200);
    doc.line(14, finalY + 8, 196, finalY + 8); 

    doc.setFontSize(14);
    doc.setTextColor(33, 37, 41);
    doc.setFont("helvetica", "bold");
    doc.text("Total Outstanding Balance:", 155, finalY + 18, { align: 'right' });
    
    doc.setTextColor(46, 204, 113);
    doc.text(`${fmtRM(totalPending)}`, 195, finalY + 18, { align: 'right' });

    const pdfsToMerge = [];
    for (const bill of vendorBills) {
      if (bill.attachments && Array.isArray(bill.attachments)) {
        let attachmentCount = 1;
        for (const url of bill.attachments) {
          if (url) {
            const refLabel = bill.invoiceNo || bill.reference || "Unknown";
            const result = await addAttachmentToPdf(doc, url, vendorName, refLabel, attachmentCount, bill.attachments.length);
            if (result && result.type === 'pdf') {
              pdfsToMerge.push(result.url);
            }
            attachmentCount++;
          }
        }
      }
    }

    const shortName = vendorName.length > 20 ? vendorName.substring(0, 20).trim() : vendorName;
    const safeName = shortName.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
    const safeCode = vendorCode ? `_${vendorCode.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "")}` : "";
    const filename = `${safeName}${safeCode}_Statement.pdf`;

    if (pdfsToMerge.length === 0) {
      doc.save(filename);
      return;
    }

    try {
      const jsPdfBuffer = doc.output('arraybuffer');
      const mergedPdf = await PDFDocument.load(jsPdfBuffer);

      for (const pdfUrl of pdfsToMerge) {
        const res = await fetch(`/api/proxy-image?url=${encodeURIComponent(pdfUrl)}`);
        if (!res.ok) continue;
        const pdfBytes = await res.arrayBuffer();
        const attachedPdf = await PDFDocument.load(pdfBytes);
        const copiedPages = await mergedPdf.copyPages(attachedPdf, attachedPdf.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));
      }

      const finalPdfBytes = await mergedPdf.save();
      const blob = new window.Blob([finalPdfBytes], { type: "application/pdf" });
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      link.click();
    } catch (e) {
      console.error("PDF Merge failed", e);
      doc.save(filename);
    }
  };

  const handleExportPDF = async () => {
    if (!selectedVendor) {
      setExportModalOpen(true);
      return;
    }
    
    setIsExporting(true);
    try {
      await generateSingleVendorPDF(selectedVendor);
    } finally {
      setIsExporting(false);
    }
  };

  const handleModalExportSummary = async (selectedVendorIds) => {
    setIsExporting(true);
    try {
      await generateSummaryPDF(selectedVendorIds);
      setExportModalOpen(false);
    } finally {
      setIsExporting(false);
    }
  };

  const handleModalExportIndividual = async (selectedVendorIds) => {
    setIsExporting(true);
    try {
      for (const vendorId of selectedVendorIds) {
        await generateSingleVendorPDF(vendorId);
        // Add a tiny delay to ensure browser downloads don't crash
        await new Promise(r => setTimeout(r, 500)); 
      }
      setExportModalOpen(false);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportExcel = () => {
    if (!selectedVendor) {
      const data = vendorSummaryData.map(v => ({
        "Vendor Name": v.name,
        "Bills": v.billsCount,
        "Last Purchase": v.lastPurchaseTimestamp ? new Date(v.lastPurchaseTimestamp).toLocaleDateString() : "-",
        "Total Pending": v.totalPending,
        "Remarks": v.isEmergency
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "All Vendors Summary");
      XLSX.writeFile(wb, `All_Vendors_Statement_${Date.now()}.xlsx`);
      return;
    }

    const fullVendorObj = vendorList.find(v => v.id === selectedVendor);
    const vendorName = fullVendorObj?.name || "Vendor";
    const vendorCode = fullVendorObj?.code || "";

    const data = filteredBills.map(b => ({
      "Vendor": b.vendorName,
      "Invoice / Ref": b.invoiceNo || b.reference || "-",
      "Bill Date": b.createdAt?.seconds ? new Date(b.createdAt.seconds * 1000).toLocaleDateString() : "-",
      "Due Date": b.dueDate || "-",
      "Total Amount": b.total,
      "Pending Balance": b.balance,
      "Status": b.status
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Statement");
    
    const shortName = vendorName.length > 20 ? vendorName.substring(0, 20).trim() : vendorName;
    const safeName = shortName.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
    const safeCode = vendorCode ? `_${vendorCode.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "")}` : "";
    XLSX.writeFile(wb, `${safeName}${safeCode}_Statement.xlsx`);
  };

  // --- Render Guards ---
  if (!ready)
    return (
      <div className='p-8 text-center text-gray-500 animate-pulse'>
        Loading workspace...
      </div>
    )
  if (!companyId)
    return (
      <div className='p-8 text-center text-red-500'>
        Access Denied: No Company Resolved
      </div>
    )

  return (
    <div className='min-h-screen bg-gray-50/50 p-4 md:p-6'>
      {/* Header Section */}
      <DueBillsHeader
        branchName={branchData?.name}
        canPay={canPay}
        totalSelectedBalance={totalSelectedBalance}
        onPayClick={() => setPayOpen(true)}
        fmtRM={fmtRM}
        onExportPDF={handleExportPDF}
        onExportExcel={handleExportExcel}
        isExporting={isExporting}
      />

      {/* Filters Bar */}
      <DueBillsFilters
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        selectedVendor={selectedVendor}
        setSelectedVendor={setSelectedVendor}
        vendors={vendors}
      />

      {/* Main Content Area */}
      {(err1 || err2) && (
        <div className='mb-6 p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm flex items-center gap-2'>
          <AlertCircle className='w-4 h-4' /> Error loading bills. Please
          refresh.
        </div>
      )}

      <div className='bg-white border rounded-xl shadow-sm overflow-hidden'>
        {!selectedVendor ? (
          <div className='overflow-x-auto'>
            <table className='w-full text-left text-sm'>
              <thead className='bg-gray-50 border-b'>
                <tr>
                  <th className='px-6 py-4 font-semibold text-gray-900'>Vendor Name</th>
                  <th className='px-6 py-4 font-semibold text-gray-900 text-center'>Pending Bills</th>
                  <th className='px-6 py-4 font-semibold text-gray-900 text-center'>Last Purchase</th>
                  <th className='px-6 py-4 font-semibold text-gray-900 text-right'>Total Pending</th>
                  <th className='px-6 py-4 font-semibold text-gray-900 text-center'>Remarks</th>
                  <th className='px-6 py-4 font-semibold text-gray-900 text-center'>Action</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-gray-100'>
                {vendorSummaryData.length === 0 ? (
                  <tr>
                    <td colSpan='6' className='px-6 py-12 text-center text-gray-500'>
                      No vendors with outstanding bills found.
                    </td>
                  </tr>
                ) : (
                  vendorSummaryData.map(v => (
                    <tr key={v.id} className='group hover:bg-gray-50 transition-colors cursor-pointer' onClick={() => setSelectedVendor(v.id)}>
                      <td className='px-6 py-4'>
                        <div className="font-medium text-gray-900">{v.name}</div>
                        {v.code ? (
                          <div className="text-[11px] text-gray-500 font-mono tracking-wide mt-0.5 uppercase">
                            Code: <span className="font-bold text-gray-700">{v.code}</span>
                          </div>
                        ) : (
                          <div className="text-[10px] text-gray-400 italic mt-0.5">No Code</div>
                        )}
                      </td>
                      <td className='px-6 py-4 text-center text-gray-600'>
                        {v.billsCount}
                      </td>
                      <td className='px-6 py-4 text-center text-gray-500'>
                        {v.lastPurchaseTimestamp ? new Date(v.lastPurchaseTimestamp).toLocaleDateString() : "-"}
                      </td>
                      <td className='px-6 py-4 text-right font-bold text-gray-900'>
                        {fmtRM(v.totalPending)}
                      </td>
                      <td className='px-6 py-4 text-center'>
                        {v.isEmergency !== '-' ? (
                          <span className='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800'>
                            {v.isEmergency}
                          </span>
                        ) : (
                          <span className='text-gray-400'>-</span>
                        )}
                      </td>
                      <td className='px-6 py-4 text-center'>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedVendor(v.id);
                          }}
                          className='px-3 py-1.5 text-xs font-medium bg-mint-50 text-mint-700 hover:bg-mint-100 rounded-lg transition-colors'
                        >
                          View Bills
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <>
        {/* Desktop Table View */}
        <div className='hidden md:block overflow-x-auto'>
          <table className='w-full text-left text-sm'>
            <thead className='bg-gray-50 border-b'>
              <tr>
                <th className='w-12 px-6 py-4'>
                  <input
                    type='checkbox'
                    className='rounded border-gray-300 text-mint-600 focus:ring-mint-500'
                    onChange={toggleAll}
                    checked={
                      filteredBills.length > 0 &&
                      selectedIds.length === filteredBills.length
                    }
                  />
                </th>
                <th className='px-6 py-4 font-semibold text-gray-900'>
                  Vendor & Bill Info
                </th>
                <th className='px-6 py-4 font-semibold text-gray-900'>
                  Status
                </th>
                <th className='px-6 py-4 font-semibold text-gray-900 text-right'>
                  Amount
                </th>
                <th className='px-6 py-4 font-semibold text-gray-900 text-right'>
                  Due Date
                </th>
                <th className='px-6 py-4 font-semibold text-gray-900 text-center'>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className='divide-y divide-gray-100'>
              {filteredBills.length === 0 ? (
                <tr>
                  <td
                    colSpan='6'
                    className='px-6 py-12 text-center text-gray-500'
                  >
                    No bills found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredBills.map(bill => (
                  <tr
                    key={bill.id}
                    className={`group hover:bg-gray-50 transition-colors ${
                      selectedIds.includes(bill.id) ? 'bg-mint-50/50' : ''
                    }`}
                  >
                    <td className='px-6 py-4'>
                      <input
                        type='checkbox'
                        className='rounded border-gray-300 text-mint-600 focus:ring-mint-500 cursor-pointer'
                        checked={selectedIds.includes(bill.id)}
                        onChange={() => toggleOne(bill.id)}
                      />
                    </td>
                    <td className='px-6 py-4'>
                      <div className='font-medium text-gray-900'>
                        {bill.vendorName}
                      </div>
                      <div className='text-xs text-gray-500 mt-0.5'>
                        Ref: {bill.invoiceNo || bill.reference || 'N/A'}
                      </div>
                    </td>
                    <td className='px-6 py-4'>
                      <StatusBadge dueDays={bill.__dueInDays} />
                    </td>
                    <td className='px-6 py-4 text-right'>
                      <div className='font-bold text-gray-900'>
                        {fmtRM(bill.balance)}
                      </div>
                      <div className='text-xs text-gray-400'>
                        Total: {fmtRM(bill.total)}
                      </div>
                    </td>
                    <td className='px-6 py-4 text-right text-gray-600'>
                      {bill.dueDate || '-'}
                    </td>
                    <td className='px-6 py-4 text-center'>
                      <div className='flex items-center justify-center gap-1'>
                        <button
                          onClick={() => handleViewClick(bill)}
                          title='View Details'
                          className='p-2 hover:bg-gray-200 rounded-full text-gray-500 hover:text-blue-600 transition-all'
                        >
                          <Eye className='w-4 h-4' />
                        </button>
                        <button
                          onClick={() => handleEditClick(bill)}
                          className='p-2 hover:bg-gray-200 rounded-full text-gray-500 hover:text-mint-600 transition-all'
                          title='Edit Details'
                        >
                          <Edit3 className='w-4 h-4' />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(bill.id)}
                          className='p-2 hover:bg-red-100 rounded-full text-gray-400 hover:text-red-600 transition-all'
                          title='Delete Bill'
                        >
                          <Trash2 className='w-4 h-4' />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

 {/* Mobile Card View */}
        <div className='md:hidden divide-y divide-gray-100'>
          {filteredBills.map(bill => (
            <div
              key={bill.id}
              className={`p-4 transition-colors ${
                selectedIds.includes(bill.id) ? 'bg-mint-50/30' : ''
              }`}
            >
              <div className='flex items-start gap-3'>
                <input
                  type='checkbox'
                  className='mt-1 rounded border-gray-300 text-mint-600 focus:ring-mint-500'
                  checked={selectedIds.includes(bill.id)}
                  onChange={() => toggleOne(bill.id)}
                />
                <div className='flex-1 min-w-0'>

                  {/* Top row: vendor name + action buttons */}
                  <div className='flex justify-between items-start mb-1 gap-2'>
                    <span className='font-semibold text-gray-900 truncate leading-tight'>
                      {bill.vendorName}
                    </span>
                    <div className='flex items-center gap-0.5 flex-shrink-0'>
                      <button
                        onClick={() => handleViewClick(bill)}
                        className='text-gray-400 hover:text-blue-600 p-1.5 hover:bg-blue-50 rounded-full transition-colors'
                        title='View Details'
                      >
                        <Eye className='w-4 h-4' />
                      </button>
                      <button
                        onClick={() => handleEditClick(bill)}
                        className='text-gray-400 hover:text-mint-600 p-1.5 hover:bg-mint-50 rounded-full transition-colors'
                        title='Edit Bill'
                      >
                        <Edit3 className='w-4 h-4' />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(bill.id)}
                        className='text-gray-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-full transition-colors'
                        title='Delete Bill'
                      >
                        <Trash2 className='w-4 h-4' />
                      </button>
                    </div>
                  </div>

                  {/* Reference */}
                  <div className='text-xs text-gray-500 mb-3'>
                    Ref: {bill.invoiceNo || bill.reference || 'N/A'}
                  </div>

                  {/* Bottom row: status + due date (left) | amounts (right) */}
                  <div className='flex justify-between items-end'>
                    <div className='space-y-1'>
                      <StatusBadge dueDays={bill.__dueInDays} />
                      <div className='text-xs text-gray-400'>
                        Due: {bill.dueDate || '—'}
                      </div>
                    </div>
                    <div className='text-right'>
                      <div className='font-bold text-gray-900 text-lg tabular-nums'>
                        {fmtRM(bill.balance)}
                      </div>
                      <div className='text-xs text-gray-400'>
                        of {fmtRM(bill.total)}
                      </div>
                    </div>
                  </div>

                  {/* Attachment indicator */}
                  {bill.attachments?.length > 0 && (
                    <div className='mt-2.5 flex items-center gap-1 text-xs text-gray-400'>
                      <Paperclip className='w-3 h-3' />
                      {bill.attachments.length} attachment{bill.attachments.length > 1 ? 's' : ''}
                    </div>
                  )}

                </div>
              </div>
            </div>
          ))}

          {filteredBills.length === 0 && (
            <div className='p-8 text-center text-gray-500 text-sm'>
              No bills found.
            </div>
          )}
        </div>
        </>
        )}
      </div>

      {/* Footer Info */}
      <div className='mt-4 text-center text-xs text-gray-400'>
        {!selectedVendor ? `Showing ${vendorSummaryData.length} vendors` : `Showing ${filteredBills.length} bills`}
      </div>

      {/* Modals */}
      <PayBillsModal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        bills={selectedBills}
        onConfirm={handleConfirmPayment}
        vendorName={vendors.find(v => v.id === selectedBills[0]?.vendorId)?.name || 'Multiple'}
        isSaving={isUpdating}
      />

      <ExportBillsModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        vendors={vendorSummaryData}
        onExportSummary={handleModalExportSummary}
        onExportIndividual={handleModalExportIndividual}
        isExporting={isExporting}
      />

      <EditBillModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        bill={billToEdit}
        onSave={handleSaveEdit}
        isLoading={isUpdating}
      />
      <ViewBillModal
        isOpen={viewModalOpen}
        onClose={() => setViewModalOpen(false)}
        bill={billToView}
      />
    </div>
  )
}
