// exportAdvanceData: the share part (moved from exportAdvanceData.js unchanged).
 
import { format } from 'date-fns'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { toast } from "@/app/components/ui/notify";

import { personName } from "@/lib/people";
/* ==========================================================
   Helpers
========================================================== */
import { getCreatedAtText } from "./helpers";

export const shareAdvance = async (advance, branchData) => {
  try {
    if (!advance) return toast.warning('No advance data!')

    const branchName = branchData?.name || 'N/A'
    const fileName = `advance-${advance.date || 'unknown'}.pdf`
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const marginLeft = 14
    let cursorY = 20

    // Header
    doc.setFontSize(16)
    doc.text('Advance Report', marginLeft, cursorY)
    doc.setFontSize(12)
    doc.text(
      advance.date ? format(new Date(advance.date), 'dd/MM/yyyy') : '—',
      200 - marginLeft,
      cursorY,
      { align: 'right' }
    )
    cursorY += 10

    const createdTime = getCreatedAtText(advance)
    doc.setFontSize(11)
    doc.text(`Branch: ${branchName}`, marginLeft, cursorY)
    doc.text(`Created At: ${createdTime}`, 200 - marginLeft, cursorY, {
      align: 'right'
    })
    cursorY += 8

    const tableData = [
      ['Staff', advance.staffName || '-'],
      ['Amount (RM)', (Number(advance.amount) || 0).toFixed(2)],
      ['Reason', advance.reason || '-'],
      ['Status', advance.status || '-'],
      ['Created By', personName(advance.createdBy) || '-'],
      ['Role', advance.createdBy?.role || '-']
    ]

    autoTable(doc, {
      startY: cursorY + 4,
      head: [['Field', 'Value']],
      body: tableData,
      styles: { cellPadding: 4, fontSize: 10 },
      headStyles: { fillColor: [255, 165, 0] }, // orange
      margin: { left: marginLeft, right: marginLeft }
    })

    let finalY = doc.lastAutoTable?.finalY || cursorY + 20

    // Optional file link
    if (advance.fileURL) {
      doc.setFontSize(12)
      doc.setTextColor(0, 0, 255)
      doc.textWithLink('📎 View Proof File', marginLeft, finalY + 12, {
        url: advance.fileURL
      })
      doc.setTextColor(0, 0, 0)
    }

    const pdfBlob = doc.output('blob')
    const file = new File([pdfBlob], fileName, { type: 'application/pdf' })

    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        title: 'Advance Report',
        text: 'Here is the advance report',
        files: [file]
      })
    } else {
      const link = `${window.location.origin}/advance/${advance.id || ''}`
      await navigator.clipboard.writeText(link)
      toast.success('Link copied to clipboard ✅ (paste it into WhatsApp/Email)')
    }
  } catch (err) {
    console.error("Export failed:", err);
    toast.error("Failed to export. Please try again.");
  }
}
