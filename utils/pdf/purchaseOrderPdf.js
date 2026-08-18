import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatMoney } from "@/utils/formatMoney";

/**
 * Purchase order PDF.
 *
 * This document leaves the building — a supplier reads it and delivers against
 * it — so it has to say who is buying, who is being bought from, where to
 * deliver, and what was agreed. The previous version printed a bare title, the
 * vendor's name and a table, at fixed coordinates that collided as soon as
 * there were notes.
 */

const MARGIN = 14;
const PAGE_W = 210; // A4 portrait, mm
const RIGHT = PAGE_W - MARGIN;
const INK = [15, 23, 42];
const MUTED = [100, 116, 139];
const MINT = [34, 160, 130];
const LINE = [226, 232, 240];

const text = (v) => String(v ?? "").trim();

/** Squash an address object (or string) into printable lines. */
function addressLines(address) {
  if (!address) return [];
  if (typeof address === "string") return address.split("\n").map(text).filter(Boolean);

  const { line1, line2, city, state, postcode, country } = address;
  const cityLine = [postcode, city].filter(Boolean).join(" ");
  return [line1, line2, cityLine, state, country].map(text).filter(Boolean);
}

/**
 * Fetch the company logo as a data URL.
 *
 * Returns null on any failure — a missing or CORS-blocked logo must never stop
 * someone printing a purchase order.
 */
export async function loadLogo(url) {
  if (!url) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;

    const blob = await res.blob();
    if (!blob.type.startsWith("image/")) return null;

    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Heading above a block of details. */
function blockHeading(doc, label, x, y) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text(label.toUpperCase(), x, y);
  return y + 4.5;
}

/** Name in bold followed by muted detail lines. Returns the y it ended at. */
function detailBlock(doc, x, y, name, lines, width = 82) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...INK);
  const nameLines = doc.splitTextToSize(text(name) || "—", width);
  doc.text(nameLines, x, y);
  let cursor = y + nameLines.length * 4.6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  lines.filter(Boolean).forEach((line) => {
    const wrapped = doc.splitTextToSize(text(line), width);
    doc.text(wrapped, x, cursor);
    cursor += wrapped.length * 4;
  });

  return cursor;
}

/**
 * Build and save the PDF.
 *
 * Everything is optional except `order` — a company that has not filled in its
 * details still gets a usable document, just a plainer one.
 */
export default function buildPurchaseOrderPdf({
  order,
  vendor,
  company,
  branch,
  branchBasic,
  currency = "RM",
  logoDataUrl = null,
}) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const received = order.status === "Received";
  const lines = received && order.receivedItems?.length ? order.receivedItems : order.items || [];

  /* ------------------------------- letterhead ------------------------------ */
  let leftY = MARGIN + 4;

  if (logoDataUrl) {
    try {
      // Fitted into a 26×14 box so a tall or wide logo cannot shove the
      // address off the page.
      doc.addImage(logoDataUrl, MARGIN, MARGIN, 26, 14, undefined, "FAST");
      leftY = MARGIN + 19;
    } catch {
      /* an unreadable image is not worth failing the document over */
    }
  }

  const companyName = text(company?.name) || text(branchBasic?.companyName) || text(branch?.name);
  if (companyName) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...INK);
    doc.text(companyName, MARGIN, leftY);
    leftY += 5;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);

  const branchLabel = [text(branch?.name), text(branch?.code) && `(${text(branch.code)})`]
    .filter(Boolean)
    .join(" ");
  const companyLines = [
    branchLabel,
    ...addressLines(branchBasic?.address),
    [text(branchBasic?.phone), text(branchBasic?.email)].filter(Boolean).join("  ·  "),
    text(branchBasic?.companyRegistration) && `Reg. No: ${text(branchBasic.companyRegistration)}`,
  ].filter(Boolean);

  companyLines.forEach((line) => {
    doc.text(line, MARGIN, leftY);
    leftY += 4;
  });

  /* --------------------------- document identity --------------------------- */
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...INK);
  doc.text("PURCHASE ORDER", RIGHT, MARGIN + 6, { align: "right" });

  const created = order.createdAt?.seconds ? new Date(order.createdAt.seconds * 1000) : null;
  const meta = [
    ["No.", text(order.poNo) || order.id],
    ["Date", created ? created.toLocaleDateString() : "—"],
    ["Status", text(order.status) || "Pending"],
  ];
  if (received && order.invoiceNo) meta.push(["Invoice", text(order.invoiceNo)]);

  let metaY = MARGIN + 13;
  meta.forEach(([label, value]) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED);
    doc.text(label, RIGHT - 34, metaY, { align: "right" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    doc.text(text(value), RIGHT, metaY, { align: "right" });
    metaY += 5;
  });

  /* ------------------------------- party blocks ---------------------------- */
  let y = Math.max(leftY, metaY) + 5;

  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, RIGHT, y);
  y += 7;

  const colTwo = MARGIN + 96;

  const supplierY = detailBlock(
    doc,
    MARGIN,
    blockHeading(doc, "Supplier", MARGIN, y),
    order.vendorName,
    [
      ...addressLines(vendor?.address),
      text(vendor?.phone) && `Tel: ${text(vendor.phone)}`,
      text(vendor?.email),
      text(vendor?.taxNumber) && `Tax No: ${text(vendor.taxNumber)}`,
    ]
  );

  const deliverY = detailBlock(
    doc,
    colTwo,
    blockHeading(doc, "Deliver to", colTwo, y),
    branchLabel || companyName,
    [
      ...addressLines(branchBasic?.address),
      text(branchBasic?.phone) && `Tel: ${text(branchBasic.phone)}`,
    ]
  );

  y = Math.max(supplierY, deliverY) + 4;

  /* --------------------------------- items --------------------------------- */
  // On a received order the supplier's actual figures are what matters, so the
  // ordered quantity becomes a reference column instead of the headline.
  const head = received
    ? [["#", "Item", "Ordered", "Received", "Unit Price", "Amount"]]
    : [["#", "Item", "Quantity", "Unit Price", "Amount"]];

  const body = lines.map((i, index) => {
    const qty = received ? Number(i.receivedQty || 0) : Number(i.requestedQty || 0);
    const price = received ? Number(i.finalPrice || 0) : Number(i.estPrice || 0);
    const name = [text(i.name), text(i.category)].filter(Boolean).join("\n");

    return received
      ? [
          index + 1,
          name,
          `${Number(i.requestedQty || 0)} ${text(i.unit)}`,
          `${qty} ${text(i.unit)}`,
          formatMoney(price, currency),
          formatMoney(qty * price, currency),
        ]
      : [
          index + 1,
          name,
          `${qty} ${text(i.unit)}`,
          formatMoney(price, currency),
          formatMoney(qty * price, currency),
        ];
  });

  const numericCols = received
    ? { 0: { halign: "center", cellWidth: 8 }, 2: { halign: "center" }, 3: { halign: "center" }, 4: { halign: "right" }, 5: { halign: "right" } }
    : { 0: { halign: "center", cellWidth: 8 }, 2: { halign: "center" }, 3: { halign: "right" }, 4: { halign: "right" } };

  autoTable(doc, {
    startY: y,
    head,
    body,
    theme: "striped",
    margin: { left: MARGIN, right: MARGIN, bottom: 24 },
    styles: { fontSize: 8.5, cellPadding: 2.5, textColor: INK, lineColor: LINE, lineWidth: 0.1 },
    headStyles: { fillColor: MINT, textColor: 255, fontStyle: "bold", fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: numericCols,
  });

  y = doc.lastAutoTable.finalY + 8;

  /* --------------------------------- totals -------------------------------- */
  // Keep the totals, terms and signatures together rather than orphaning a
  // signature line at the top of a page on its own.
  const tailHeight = 62;
  if (y + tailHeight > 297 - 20) {
    doc.addPage();
    y = MARGIN + 4;
  }

  const total = received
    ? Number(order.finalTotal || 0)
    : Number(order.totalEst || 0);

  doc.setFillColor(248, 250, 252);
  doc.roundedRect(RIGHT - 76, y - 5, 76, 14, 2, 2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(received ? "INVOICE TOTAL" : "ESTIMATED TOTAL", RIGHT - 72, y + 1);

  doc.setFontSize(13);
  doc.setTextColor(...INK);
  doc.text(formatMoney(total, currency), RIGHT - 4, y + 2.5, { align: "right" });

  /* ------------------------- terms, notes, signatures ---------------------- */
  let leftBlockY = y;
  const termsDays = Number(vendor?.termsDays ?? vendor?.creditDays ?? 0);

  if (termsDays > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text("PAYMENT TERMS", MARGIN, leftBlockY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...INK);
    doc.text(`${termsDays} days from invoice date`, MARGIN, leftBlockY + 4.5);
    leftBlockY += 12;
  }

  if (text(order.notes)) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text("NOTES", MARGIN, leftBlockY);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...INK);
    const wrapped = doc.splitTextToSize(text(order.notes), 105);
    doc.text(wrapped, MARGIN, leftBlockY + 4.5);
    leftBlockY += 4.5 + wrapped.length * 4 + 4;
  }

  const signY = Math.max(leftBlockY, y + 20) + 12;
  const signWidth = 62;

  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.3);

  const signatures = [
    { label: "Prepared by", name: order.createdByName },
    { label: "Approved by", name: order.approvedByName },
  ];

  signatures.forEach((sig, index) => {
    const x = MARGIN + index * (signWidth + 14);
    doc.line(x, signY, x + signWidth, signY);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(sig.label, x, signY + 4);

    if (text(sig.name)) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...INK);
      doc.text(text(sig.name), x, signY + 8.5);
    }
  });

  /* --------------------------------- footer -------------------------------- */
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, 283, RIGHT, 283);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(
      `${text(order.poNo) || order.id}  ·  Generated ${new Date().toLocaleDateString()}`,
      MARGIN,
      288
    );
    doc.text(`Page ${page} of ${pages}`, RIGHT, 288, { align: "right" });
  }

  const safeName = (text(order.poNo) || `PO_${text(order.vendorName)}`).replace(/[^\w-]+/g, "_");
  doc.save(`${safeName}.pdf`);
}
