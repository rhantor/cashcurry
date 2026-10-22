'use client'

import { HandOutSheet } from '@/app/components/payouts/PayoutSheets'
import { can } from '@/lib/authz/permissions'
import { businessToday } from "@/lib/region";
import { formatMoney } from '@/lib/region/currency'
import React, { useEffect, useMemo, useState } from 'react'
import { skipToken } from '@reduxjs/toolkit/query'
import { useRouter } from 'next/navigation'
import { Edit3, AlertCircle, Trash2, Eye, Paperclip, ChevronRight, PartyPopper } from 'lucide-react'

import useResolvedCompanyBranch from '@/app/hooks/useResolvedCompanyBranch'
import { useGetSingleBranchQuery } from '@/lib/redux/api/branchApiSlice'
import {
  useGetVendorBillsQuery,
  useUpdateVendorBillMutation,
  useDeleteVendorBillMutation
} from '@/lib/redux/api/vendorBillsApiSlice'
import { useGetVendorsQuery } from '@/lib/redux/api/vendorsApiSlice'
import { payVendorBills } from '@/lib/purchases/payVendorBills'
// components
import DueBillsHeader from './components/DueBillsHeader'
import { makeDueBillsExports } from './exportDueBills'
import StatusBadge from './components/StatusBadge'
import EditBillModal from './components/EditBillModal'
import DueBillsFilters from './components/DueBillsFilters'
import ViewBillModal from './components/ViewBillModal'
import ExportBillsModal from './components/ExportBillsModal'
import PayBillsModal from '@/app/components/purchases/PayBillsModal'
import { uploadInvoiceFile } from "@/lib/storage/uploadInvoice"
import useCurrency from '@/app/hooks/useCurrency'
import { toast, confirmDialog } from "@/app/components/ui/notify";
import { Badge, DataTable } from '@/app/components/ui'
import { format, parseISO } from 'date-fns'

// --- Helper Functions ---
function daysBetween (aISO, bISO) {
  const [ay, am, ad] = aISO.split('-').map(Number)
  const [by, bm, bd] = bISO.split('-').map(Number)
  const a = Date.UTC(ay, am - 1, ad)
  const b = Date.UTC(by, bm - 1, bd)
  return Math.round((a - b) / 86400000)
}

// the branch's money, written the way the rest of the app writes it
const makeFmtRM = (currency) => v => formatMoney(Number(v ?? 0), currency)


// --- Main Page Component ---
export default function DueBillsPage () {
  const router = useRouter()
  const { ready, user, companyId, branchId } = useResolvedCompanyBranch()
  const currency = useCurrency()
  const fmtRM = makeFmtRM(currency)
  const pdfRM = v => formatMoney(Number(v ?? 0), currency, { plain: true }) // PDF fonts have no ৳ or ₹

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
  // from a vendor's page (?vendor=…): their bills
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get('vendor')
    if (v) setSelectedVendor(v)
  }, [])

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
    const today = businessToday()
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
        reasons: emergencyReason,
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
  // "Send cash": a pay-out for the ticked bills — whoever takes it brings the receipt back (4.10)
  const [sendCash, setSendCash] = useState(false)
  const cashPreset = useMemo(
    () => (sendCash && selectedBills.length ? { vendorId: selectedBills[0].vendorId, vendorName: selectedBills[0].vendorName, bills: selectedBills } : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sendCash, selectedIds.join(',')]
  )
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
    const bill = allBills.find(b => b.id === billId)
    const paidOn = Number(bill?.paid || 0)
    if (paidOn > 0) {
      toast.warning(`${fmtRM(paidOn)} has been paid on ${bill?.invoiceNo || 'this bill'}, so it can't be deleted. To close it, edit its total down to ${fmtRM(paidOn)}.`)
      return
    }
    const ok = await confirmDialog({
      title: `Delete bill ${bill?.invoiceNo || ''}?`.replace(' ?', '?'),
      message: `${bill?.vendorName || 'The vendor'} will no longer be owed ${fmtRM(bill?.total)} for it.`,
      confirmLabel: 'Delete bill',
      danger: true
    })
    if (!ok) return
    try {
      await deleteBill({ companyId, branchId, billId }).unwrap()
      setSelectedIds(prev => prev.filter(id => id !== billId))
      toast.success('Bill deleted')
    } catch (err) {
      console.error('Failed to delete bill:', err)
      toast.error(err?.message ? `Couldn't delete the bill: ${err.message}` : "Couldn't delete the bill.")
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
    toast.success('Bill saved')
  } catch (err) {
    console.error('Failed to update bill:', err)
    toast.error(err?.message ? `Couldn't save the bill: ${err.message}` : "Couldn't save the bill.")
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
            invoiceDate: businessToday(),
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

      const paid = await payVendorBills({
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
      const asked = allocations.reduce((n, a) => n + Number(a.amount || 0), 0)
      if (paid && paid.total < Math.round(asked * 100) / 100) {
        toast.warning(`Paid ${fmtRM(paid.total)} — part of a bill had been paid already, so only what was still owed was taken.`)
      } else {
        toast.success(`Paid ${fmtRM(paid?.total ?? asked)} to ${vendorName}`)
      }
      router.refresh?.()
    } catch (e) {
      console.error(e)
      toast.error(e?.message ? `Couldn't record the payment: ${e.message}` : "Couldn't record the payment.")
    }
  }

  const [isExporting, setIsExporting] = useState(false);

  const { generateSummaryPDF, generateSingleVendorPDF, exportExcel } = makeDueBillsExports({ pdfRM, selectedVendor, filteredBills, vendorSummaryData, branchData, vendorList });

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

  const handleExportExcel = () => exportExcel();

  // --- Render Guards ---
  if (!ready)
    return (
      <div className='p-8 text-center text-muted animate-pulse'>
        Loading workspace...
      </div>
    )
  if (!companyId)
    return (
      <div className='p-8 text-center text-danger'>
        Access Denied: No Company Resolved
      </div>
    )

  return (
    <div className='mx-auto max-w-7xl px-4 py-5 pb-28 sm:px-6 sm:py-6'>
      <HandOutSheet
        open={sendCash}
        onClose={() => {
          setSendCash(false)
          setSelectedIds([])
        }}
        companyId={companyId}
        branchId={branchId}
        user={user}
        preset={cashPreset}
      />
      {/* Header Section */}
      <DueBillsHeader
        bills={allBills}
        selectedCount={selectedBills.length}
        canPay={canPay}
        totalSelectedBalance={totalSelectedBalance}
        onPayClick={() => setPayOpen(true)}
        onSendCash={can(user?.role, 'payouts.handOut') ? () => setSendCash(true) : undefined}
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
        <div className='mb-6 p-4 bg-danger-soft border border-danger/30 rounded-xl text-danger text-sm flex items-center gap-2'>
          <AlertCircle className='w-4 h-4' /> Error loading bills. Please
          refresh.
        </div>
      )}

      <div className='bg-surface border rounded-xl shadow-sm overflow-hidden'>
        {!selectedVendor ? (
          <DataTable
            className='rounded-none border-0'
            rows={vendorSummaryData}
            onRowClick={v => setSelectedVendor(v.id)}
            pageSize={0}
            empty={{ icon: PartyPopper, title: 'Nothing owed', description: searchTerm ? 'No unpaid bill matches the search.' : 'Every vendor bill is paid.' }}
            columns={[
              {
                key: 'name',
                label: 'Vendor',
                primary: true,
                sortable: true,
                render: v => (
                  <div className='min-w-0'>
                    <p className='truncate font-semibold text-fg'>{v.name}</p>
                    {v.code && <p className='text-[11px] font-normal text-muted'>{v.code}</p>}
                  </div>
                )
              },
              { key: 'billsCount', label: 'Unpaid bills', sortable: true, render: v => v.billsCount },
              {
                key: 'last',
                label: 'Last bill',
                sortValue: v => v.lastPurchaseTimestamp,
                render: v => (v.lastPurchaseTimestamp ? format(new Date(v.lastPurchaseTimestamp), 'd MMM yyyy') : '—')
              },
              {
                key: 'reasons',
                label: 'Needs',
                render: v =>
                  v.reasons.length ? (
                    <span className='inline-flex flex-wrap gap-1'>
                      {v.reasons.map(r => (
                        <Badge key={r} tone={r === 'Overdue' ? 'danger' : 'warning'}>
                          {r === 'Overdue' ? 'Overdue' : 'At bill limit'}
                        </Badge>
                      ))}
                    </span>
                  ) : (
                    <span className='text-subtle'>—</span>
                  )
              },
              { key: 'totalPending', label: 'Owed', align: 'right', aside: true, sortable: true, render: v => <span className='font-semibold'>{fmtRM(v.totalPending)}</span> },
              { key: 'go', label: '', align: 'right', hideOnMobile: true, render: () => <ChevronRight className='ml-auto size-4 text-subtle' /> }
            ]}
          />
        ) : (
          <>
        {/* Desktop Table View */}
        <div className='hidden md:block overflow-x-auto'>
          <table className='w-full text-left text-sm'>
            <thead className='bg-surface-2/60 border-b'>
              <tr>
                <th className='w-12 px-6 py-4'>
                  <input
                    type='checkbox'
                    className='rounded border-line text-brand focus:ring-[var(--cc-ring)]'
                    onChange={toggleAll}
                    checked={
                      filteredBills.length > 0 &&
                      selectedIds.length === filteredBills.length
                    }
                  />
                </th>
                <th className='px-6 py-4 font-semibold text-fg'>
                  Invoice
                </th>
                <th className='px-6 py-4 font-semibold text-fg'>
                  Status
                </th>
                <th className='px-6 py-4 font-semibold text-fg text-right'>
                  Still owed
                </th>
                <th className='px-6 py-4 font-semibold text-fg text-right'>
                  Due Date
                </th>
                <th className='px-6 py-4 font-semibold text-fg text-center'>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className='divide-y divide-line'>
              {filteredBills.length === 0 ? (
                <tr>
                  <td
                    colSpan='6'
                    className='px-6 py-12 text-center text-muted'
                  >
                    No bills found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredBills.map(bill => (
                  <tr
                    key={bill.id}
                    className={`group hover:bg-surface-2 transition-colors ${
                      selectedIds.includes(bill.id) ? 'bg-brand-soft/50' : ''
                    }`}
                  >
                    <td className='px-6 py-4'>
                      <input
                        type='checkbox'
                        className='rounded border-line text-brand focus:ring-[var(--cc-ring)] cursor-pointer'
                        checked={selectedIds.includes(bill.id)}
                        onChange={() => toggleOne(bill.id)}
                      />
                    </td>
                    <td className='px-6 py-4'>
                      <div className='font-semibold text-fg'>
                        {bill.invoiceNo || bill.reference || 'No invoice no.'}
                      </div>
                      <div className='text-xs text-muted mt-0.5'>
                        {bill.vendorName}
                        {bill.invoiceDate ? ` · dated ${format(parseISO(bill.invoiceDate), 'd MMM')}` : ''}
                      </div>
                    </td>
                    <td className='px-6 py-4'>
                      <StatusBadge dueDays={bill.__dueInDays} />
                    </td>
                    <td className='px-6 py-4 text-right'>
                      <div className='font-bold text-fg'>
                        {fmtRM(bill.balance)}
                      </div>
                      {Number(bill.paid) > 0 && (
                        <div className='text-xs text-subtle'>
                          {fmtRM(bill.paid)} paid of {fmtRM(bill.total)}
                        </div>
                      )}
                    </td>
                    <td className='px-6 py-4 text-right text-muted'>
                      {bill.dueDate ? format(parseISO(bill.dueDate), 'd MMM yyyy') : '—'}
                    </td>
                    <td className='px-6 py-4 text-center'>
                      <div className='flex items-center justify-center gap-1'>
                        <button
                          onClick={() => handleViewClick(bill)}
                          title='View Details'
                          className='p-2 hover:bg-surface-2 rounded-full text-muted hover:text-info transition-all'
                        >
                          <Eye className='w-4 h-4' />
                        </button>
                        <button
                          onClick={() => handleEditClick(bill)}
                          className='p-2 hover:bg-surface-2 rounded-full text-muted hover:text-brand transition-all'
                          title='Edit Details'
                        >
                          <Edit3 className='w-4 h-4' />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(bill.id)}
                          className='p-2 hover:bg-danger-soft rounded-full text-subtle hover:text-danger transition-all'
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
        <div className='md:hidden divide-y divide-line'>
          {filteredBills.map(bill => (
            <div
              key={bill.id}
              className={`p-4 transition-colors ${
                selectedIds.includes(bill.id) ? 'bg-brand-soft/30' : ''
              }`}
            >
              <div className='flex items-start gap-3'>
                <input
                  type='checkbox'
                  className='mt-1 rounded border-line text-brand focus:ring-[var(--cc-ring)]'
                  checked={selectedIds.includes(bill.id)}
                  onChange={() => toggleOne(bill.id)}
                />
                <div className='flex-1 min-w-0'>

                  {/* Top row: vendor name + action buttons */}
                  <div className='flex justify-between items-start mb-1 gap-2'>
                    <span className='font-semibold text-fg truncate leading-tight'>
                      {bill.vendorName}
                    </span>
                    <div className='flex items-center gap-0.5 flex-shrink-0'>
                      <button
                        onClick={() => handleViewClick(bill)}
                        className='text-subtle hover:text-info p-1.5 hover:bg-info-soft rounded-full transition-colors'
                        title='View Details'
                      >
                        <Eye className='w-4 h-4' />
                      </button>
                      <button
                        onClick={() => handleEditClick(bill)}
                        className='text-subtle hover:text-brand p-1.5 hover:bg-brand-soft rounded-full transition-colors'
                        title='Edit Bill'
                      >
                        <Edit3 className='w-4 h-4' />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(bill.id)}
                        className='text-subtle hover:text-danger p-1.5 hover:bg-danger-soft rounded-full transition-colors'
                        title='Delete Bill'
                      >
                        <Trash2 className='w-4 h-4' />
                      </button>
                    </div>
                  </div>

                  {/* Reference */}
                  <div className='text-xs text-muted mb-3'>
                    {bill.invoiceNo || bill.reference || 'No invoice no.'}
                    {bill.invoiceDate ? ` · dated ${format(parseISO(bill.invoiceDate), 'd MMM')}` : ''}
                  </div>

                  {/* Bottom row: status + due date (left) | amounts (right) */}
                  <div className='flex justify-between items-end'>
                    <div className='space-y-1'>
                      <StatusBadge dueDays={bill.__dueInDays} />
                      <div className='text-xs text-subtle'>
                        Due {bill.dueDate ? format(parseISO(bill.dueDate), 'd MMM yyyy') : '—'}
                      </div>
                    </div>
                    <div className='text-right'>
                      <div className='font-bold text-fg text-lg tabular-nums'>
                        {fmtRM(bill.balance)}
                      </div>
                      {Number(bill.paid) > 0 && (
                        <div className='text-xs text-subtle'>
                          {fmtRM(bill.paid)} paid of {fmtRM(bill.total)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Attachment indicator */}
                  {bill.attachments?.length > 0 && (
                    <div className='mt-2.5 flex items-center gap-1 text-xs text-subtle'>
                      <Paperclip className='w-3 h-3' />
                      {bill.attachments.length} attachment{bill.attachments.length > 1 ? 's' : ''}
                    </div>
                  )}

                </div>
              </div>
            </div>
          ))}

          {filteredBills.length === 0 && (
            <div className='p-8 text-center text-muted text-sm'>
              No bills found.
            </div>
          )}
        </div>
        </>
        )}
      </div>

      {/* Footer Info */}
      <div className='mt-4 text-center text-xs text-subtle'>
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
