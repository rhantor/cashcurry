// exportData: the share part (moved from exportData.js unchanged).
 
import jsPDF from "jspdf";
import "jspdf-autotable";
import autoTable from "jspdf-autotable";
import { toast } from "@/app/components/ui/notify";

import { personName } from "@/lib/people";
import { drawImageFitting, fetchImageAsDataURL, fmt, formatDate, renderCreatedAt, tendersFromSale } from "./helpers";

/**
 * handleShare(sale, branchData, tendersOpt?)
 */
export const handleShare = async (
  sale,
  branchData,
  tendersOpt = null,
  monthTotal
) => {
  const branchName = Array.isArray(branchData)
    ? branchData
        .map((b) => b?.name)
        .filter(Boolean)
        .join(", ")
    : branchData?.name || "N/A";

  const doc = new jsPDF();
  const tenders =
    (tendersOpt && tendersOpt.length ? tendersOpt : tendersFromSale(sale)) ||
    [];

  // Header
  doc.setFontSize(16);
  doc.text("Sales Report", 14, 20);
  doc.setFontSize(12);
  doc.text(formatDate(sale.date), 150, 20);

  const createdTime = renderCreatedAt(sale.createdAt);
  doc.setFontSize(11);
  doc.text(`Branch: ${branchName}`, 14, 28);
  doc.text(`Created At: ${createdTime}`, 135, 28);

  // Table
  const tableData = tenders.map((t) => [
    t.label,
    fmt(sale?.[t.key] ?? 0),
    sale?.notes?.[t.key] || "-",
  ]);

  const computedTotalCents = tenders
    .filter((t) => t.includeInTotal)
    .reduce(
      (sum, t) => sum + Math.round((parseFloat(sale?.[t.key]) || 0) * 100),
      0
    );

  const total = sale.total ?? (computedTotalCents / 100).toFixed(2);
  tableData.push(["Sale Total", fmt(total), "-"]);

  if (monthTotal != null) {
    tableData.push(["This Month Grand Total", fmt(monthTotal), "-"]);
  }

  let endY = 36;
  autoTable(doc, {
    startY: endY,
    head: [["Field", "Value", "Note"]],
    body: tableData,

    didParseCell: (data) => {
      // ✅ Make ONLY "This Month Grand Total" row bold
      if (
        data.section === "body" &&
        data.row.raw?.[0] === "This Month Grand Total"
      ) {
        data.cell.styles.fontStyle = "bold";
      }
    },

    didDrawPage: (data) => {
      endY = data.cursor?.y ?? endY;
    },
  });

  // Added by (footer-like line)
  const pageH = doc.internal.pageSize.getHeight();
  let yPos = Math.min(endY + 6, pageH - 22);
  doc.setFontSize(11);
  doc.text(`Added By: ${personName(sale.createdBy) || "Unknown"}`, 14, yPos);
  yPos += 8;

  // Z REPORT section (same behavior as exportToPDF)
  if (sale.zReportUrl) {
    if (yPos > pageH - 30) {
      doc.addPage();
      yPos = 20;
    }
    doc.setFontSize(13);
    doc.text("Z Report", 14, yPos);
    yPos += 8;

    const dataUrl = await fetchImageAsDataURL(sale.zReportUrl);
    if (dataUrl) {
      yPos = drawImageFitting(doc, dataUrl, yPos);
    } else {
      doc.setTextColor(0, 0, 255);
      doc.textWithLink("View Z Report (link)", 14, yPos, {
        url: sale.zReportUrl,
      });
      doc.setTextColor(0, 0, 0);
    }
  }

  // ==== Share (instead of doc.save) ====
  const fileName = `sales-${sale.date}.pdf`;
  const pdfBlob = doc.output("blob");

  try {
    if (
      navigator.share &&
      navigator.canShare?.({
        files: [new File([pdfBlob], fileName, { type: "application/pdf" })],
      })
    ) {
      const file = new File([pdfBlob], fileName, { type: "application/pdf" });
      await navigator.share({
        title: "Sales Report",
        text: `Sales report for ${formatDate(sale.date)} • ${branchName}`,
        files: [file],
      });
    } else if (navigator.share) {
      // Fallback for some mobile browsers: share a data URL
      const reader = new FileReader();
      reader.onloadend = async () => {
        await navigator.share({
          title: "Sales Report",
          text: `Sales report for ${formatDate(sale.date)} • ${branchName}`,
          url: reader.result,
        });
      };
      reader.readAsDataURL(pdfBlob);
    } else {
      // Desktop fallback: copy a link (adjust to your route if needed)
      const link = `${window.location.origin}/sales/${sale.id}`;
      await navigator.clipboard.writeText(link);
      toast.success("Link copied to clipboard ✅");
    }
  } catch (err) {
    console.error("Share failed:", err);
  }
};

/**
 * handleShareImage(sale, branchData, tendersOpt?, monthTotal?)
 * Generates a PNG image of the sales report using Canvas 2D and shares it.
 */
export const handleShareImage = async (
  sale,
  branchData,
  tendersOpt = null,
  monthTotal
) => {
  const branchName = Array.isArray(branchData)
    ? branchData
        .map((b) => b?.name)
        .filter(Boolean)
        .join(", ")
    : branchData?.name || "N/A";

  try {
    const tenders =
      (tendersOpt && tendersOpt.length ? tendersOpt : tendersFromSale(sale)) ||
      [];

    const total = sale.total ?? tenders
      .filter((t) => t.includeInTotal)
      .reduce((sum, t) => sum + Math.round((parseFloat(sale?.[t.key]) || 0) * 100), 0) / 100;

    // --- Canvas drawing ---
    const scale = 3; // Bumped from 2 to 3 for ultra-crisp resolution
    const W = 420 * scale;
    const pad = 24 * scale;
    const contentW = W - pad * 2;
    let cy = pad;

    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = 3000 * scale; // Extra height for Z-report
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const setFont = (size, weight = "normal") => {
      ctx.font = `${weight} ${size * scale}px sans-serif`;
    };

    // Header (Added maxWidth to prevent overflow)
    setFont(15, "bold");
    ctx.fillStyle = "#1f2937";
    ctx.fillText(branchName, pad, cy + 15 * scale, contentW - 100 * scale);

    setFont(11, "bold");
    ctx.fillStyle = "#4b5563";
    ctx.textAlign = "right";
    ctx.fillText("Sales Report", W - pad, cy + 11 * scale);
    setFont(10, "normal");
    ctx.fillStyle = "#9ca3af";
    ctx.fillText(formatDate(sale.date), W - pad, cy + 24 * scale);
    ctx.textAlign = "left";

    cy += 36 * scale;
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 1 * scale;
    ctx.beginPath();
    ctx.moveTo(pad, cy);
    ctx.lineTo(W - pad, cy);
    ctx.stroke();
    cy += 10 * scale;

    // Tender rows
    for (const t of tenders) {
      const val = sale?.[t.key];
      setFont(12, "normal");
      ctx.fillStyle = "#374151";
      ctx.textAlign = "left";
      ctx.fillText(t.label, pad, cy + 12 * scale);

      setFont(12, "bold");
      ctx.fillStyle = "#111827";
      ctx.textAlign = "right";
      ctx.fillText(fmt(val), W - pad, cy + 12 * scale);
      ctx.textAlign = "left";
      cy += 18 * scale;

      ctx.strokeStyle = "#f3f4f6";
      ctx.lineWidth = 0.5 * scale;
      ctx.beginPath();
      ctx.moveTo(pad, cy);
      ctx.lineTo(W - pad, cy);
      ctx.stroke();
      cy += 4 * scale;
    }

    // Daily Total
    cy += 4 * scale;
    ctx.strokeStyle = "#d1d5db";
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    ctx.moveTo(pad, cy);
    ctx.lineTo(W - pad, cy);
    ctx.stroke();
    cy += 12 * scale;

    setFont(14, "bold");
    ctx.fillStyle = "#111827";
    ctx.textAlign = "left";
    ctx.fillText("Daily Total", pad, cy + 14 * scale);
    ctx.textAlign = "right";
    ctx.fillText(fmt(total), W - pad, cy + 14 * scale);
    ctx.textAlign = "left";
    cy += 24 * scale;

    // Monthly Grand Total box
    if (monthTotal != null) {
      cy += 4 * scale;
      const boxH = 44 * scale;
      ctx.fillStyle = "#ecfdf5";
      ctx.fillRect(pad, cy, contentW, boxH);
      ctx.strokeStyle = "#d1fae5";
      ctx.lineWidth = 1 * scale;
      ctx.strokeRect(pad, cy, contentW, boxH);

      setFont(9, "bold");
      ctx.fillStyle = "#059669";
      ctx.textAlign = "left";
      ctx.fillText("MONTHLY GRAND TOTAL", pad + 10 * scale, cy + boxH / 2 + 3 * scale);

      setFont(16, "bold");
      ctx.fillStyle = "#047857";
      ctx.textAlign = "right";
      ctx.fillText(`RM ${fmt(monthTotal)}`, W - pad - 10 * scale, cy + boxH / 2 + 5 * scale);
      ctx.textAlign = "left";
      cy += boxH + 10 * scale;
    }

    // Footer
    setFont(8, "normal");
    ctx.fillStyle = "#9ca3af";
    ctx.fillText(`Added By: ${personName(sale.createdBy) || "Unknown"}`, pad, cy + 8 * scale);
    cy += 20 * scale;

    // Z Report Image
    if (sale.zReportUrl) {
      cy += 8 * scale;
      ctx.setLineDash([4 * scale, 4 * scale]);
      ctx.strokeStyle = "#e5e7eb";
      ctx.lineWidth = 1 * scale;
      ctx.beginPath();
      ctx.moveTo(pad, cy);
      ctx.lineTo(W - pad, cy);
      ctx.stroke();
      ctx.setLineDash([]);
      cy += 12 * scale;

      setFont(9, "bold");
      ctx.fillStyle = "#6b7280";
      ctx.fillText("Z REPORT ATTACHED:", pad, cy + 8 * scale);
      cy += 16 * scale;

      try {
        // Fetch securely via proxy to avoid CORS
        const res = await fetch(`/api/proxy-image?url=${encodeURIComponent(sale.zReportUrl)}`);
        if (!res.ok) throw new Error("Proxy fetch failed");
        const blob = await res.blob();
        
        const base64Img = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        const img = new Image();
        img.src = base64Img;
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          if (img.complete) resolve();
        });
        
        // Let the image grow slightly bigger if it's high res
        const maxImgW = contentW;
        const maxImgH = 500 * scale; 
        let imgW = img.naturalWidth;
        let imgH = img.naturalHeight;
        const ratio = Math.min(maxImgW / imgW, maxImgH / imgH, 1);
        imgW = imgW * ratio;
        imgH = imgH * ratio;
        const imgX = pad + (contentW - imgW) / 2;
        
        // High quality rendering
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, imgX, cy, imgW, imgH);
        cy += imgH + 8 * scale;
      } catch (imgErr) {
        console.warn("Z-Report image skipped:", imgErr);
      }
    }

    // Trim canvas to content height
    const trimmed = document.createElement("canvas");
    trimmed.width = W;
    trimmed.height = cy;
    trimmed.getContext("2d").drawImage(canvas, 0, 0);

    // Convert to data URL (synchronous - won't hang)
    const dataUrl = trimmed.toDataURL("image/png");

    // Convert data URL to blob manually
    const byteString = atob(dataUrl.split(",")[1]);
    const mimeString = dataUrl.split(",")[0].split(":")[1].split(";")[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    const imgBlob = new Blob([ab], { type: mimeString });

    const fileName = `sales-report-${sale.date}.png`;
    const imgFile = new File([imgBlob], fileName, { type: "image/png" });
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    try {
      // 1. Try Native Share (Only reliable on Mobile devices)
      if (isMobile && navigator.share && navigator.canShare?.({ files: [imgFile] })) {
        await navigator.share({
          title: "Sales Report",
          text: `Sales report for ${formatDate(sale.date)} • ${branchName}`,
          files: [imgFile],
        });
        return null; // Handled by native share
      }
      throw new Error("Share skipped for desktop");
    } catch {
      // 2. Fallback: Copy to Clipboard (Great for Desktop WhatsApp/Web)
      try {
        if (navigator.clipboard && window.ClipboardItem) {
          await navigator.clipboard.write([
            new ClipboardItem({
              [imgBlob.type]: imgBlob,
            }),
          ]);
          toast.error("Image successfully copied to clipboard!\n\nYou can now right-click -> Paste (or Ctrl+V) directly into WhatsApp, Telegram, or any chat.");
          return null; // Handled by clipboard
        }
        throw new Error("Clipboard not supported");
      } catch {
        // 3. Ultimate Fallback: Return the data URL so the Modal can display it on screen
        return dataUrl;
      }
    }
  } catch (err) {
    console.error("Image share failed:", err);
    toast.error(`Failed to share image: ${err.message || err}`);
    return null;
  }
};
