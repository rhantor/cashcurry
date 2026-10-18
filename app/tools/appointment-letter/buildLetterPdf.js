// The appointment letter / job application as a vector PDF (jsPDF), drawn
// from the editor's state. Moved out of page.jsx unchanged.
import { jsPDF } from "jspdf";

// Draw an image scaled to fit inside a box without distorting it, then return
// the height it actually used. addImage() stretches to whatever width/height it
// is handed, so a near-square logo dropped into a wide letterhead box comes out
// smeared. This mirrors the on-screen preview's `object-contain object-left`:
// aspect preserved, pinned to the left edge, centred vertically in the box.
const drawImageContained = (pdf, dataUrl, format, x, y, boxW, boxH) => {
  let w = boxW;
  let h = boxH;

  try {
    const props = pdf.getImageProperties(dataUrl);
    if (props?.width > 0 && props?.height > 0) {
      const scale = Math.min(boxW / props.width, boxH / props.height);
      w = props.width * scale;
      h = props.height * scale;
    }
  } catch (e) {
    // Unreadable header — fall back to filling the box, as before.
    console.error("Could not read image dimensions:", e);
  }

  pdf.addImage(dataUrl, format, x, y + (boxH - h) / 2, w, h, undefined, 'FAST');
  return boxH;
};

/** Draws the letter. Returns the jsPDF document and the file name to save it as. */
export function buildLetterPdf({ stylingOptions, companyDetails, letterMeta, employeeDetails, jobTerms, allowances, signatory, clauses, signatorySignature, employeeSignature, logo, stamp, templateType, formatCurrency }) {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const fontFamilyMap = {
    serif: "times",
    sans: "helvetica",
    mono: "courier"
  };
  const fontFamily = fontFamilyMap[stylingOptions.fontFamily] || "times";
  const fontSize = parseInt(stylingOptions.fontSize) || 12;
  const lineHeightRatio = parseFloat(stylingOptions.lineHeight) || 1.6;
  const lineHeight = fontSize * lineHeightRatio * 0.3528;
  const margin = parseInt(stylingOptions.marginSize) || 20;

  let y = margin;

  const drawWatermark = () => {
    if (stylingOptions.showWatermark && letterMeta.watermarkText) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(75);
      pdf.setTextColor(245, 245, 245); // Very light grey, elegant
      pdf.text(letterMeta.watermarkText.toUpperCase(), 105, 148.5, {
        align: 'center',
        angle: 315
      });
    }
  };

  const checkPageBreak = (heightNeeded) => {
    if (y + heightNeeded > 297 - margin) {
      pdf.addPage();
      drawWatermark();
      y = margin;
    }
  };

  // Draw watermark on the first page
  drawWatermark();

  if (templateType === "applicationForm") {
    // =====================================================================
    // NATIVE PDF GENERATION: printable Job Application & Interview Form
    // =====================================================================
    
    // --- Header Section ---
    if (logo) {
      try {
        drawImageContained(pdf, logo, 'PNG', margin, y, 40, 13);
        y += 15;
      } catch (e) {
        console.error("Error adding logo to application PDF:", e);
        y += 3;
      }
    }
    
    pdf.setFont(fontFamily, 'bold');
    pdf.setFontSize(13);
    pdf.setTextColor(30, 41, 59); // slate-800
    pdf.text(companyDetails.name.toUpperCase(), margin, y);
    y += 5;
    
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(71, 85, 105); // slate-600
    const detailsStr = `Company Registration No: ${companyDetails.registrationNo}  |  ${companyDetails.addressLine1}, ${companyDetails.addressLine2}`;
    const detailsLines = pdf.splitTextToSize(detailsStr, 210 - 2 * margin);
    for (const line of detailsLines) {
      pdf.text(line, margin, y);
      y += 4;
    }
    y += 2;
    
    // Header divider line
    pdf.setDrawColor(203, 213, 225); // slate-300
    pdf.setLineWidth(0.4);
    pdf.line(margin, y, 210 - margin, y);
    y += 6;
    
    // Form Title
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.setTextColor(15, 23, 42); // slate-900
    pdf.text("EMPLOYMENT APPLICATION FORM", 105, y, { align: 'center' });
    y += 4.5;
    
    // Subtext
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(8);
    pdf.setTextColor(100, 116, 139); // slate-500
    pdf.text("Please complete all sections in BLOCK letters. All information will be treated in strict confidence.", 105, y, { align: 'center' });
    y += 6;
    
    const drawSectionHeader = (title) => {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      pdf.setTextColor(255, 255, 255);
      pdf.setFillColor(30, 41, 59); // slate-800
      pdf.rect(margin, y, 210 - 2 * margin, 5.5, 'F');
      pdf.text(title.toUpperCase(), margin + 3, y + 3.8);
      y += 5.5 + 3; // height + gap
    };
    
    // --- Section A: Personal Details ---
    drawSectionHeader("Section A: Personal Details");
    
    const detailsBoxHeight = 32;
    pdf.setDrawColor(148, 163, 184); // slate-400
    pdf.setLineWidth(0.3);
    pdf.rect(margin, y, 210 - 2 * margin, detailsBoxHeight);
    
    // Horizontal grid lines
    pdf.line(margin, y + 8, 210 - margin, y + 8);
    pdf.line(margin, y + 16, 210 - margin, y + 16);
    pdf.line(margin, y + 24, 210 - margin, y + 24);
    
    // Vertical grid lines
    pdf.line(margin + 90, y + 8, margin + 90, y + 24);
    
    // Labels
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    pdf.setTextColor(100, 116, 139);
    
    pdf.text("FULL NAME (As per IC / Passport):", margin + 2, y + 3);
    pdf.text("IC / PASSPORT NUMBER:", margin + 2, y + 11);
    pdf.text("CONTACT NUMBER (Mobile/WhatsApp):", margin + 92, y + 11);
    pdf.text("EMAIL ADDRESS:", margin + 2, y + 19);
    pdf.text("EMERGENCY CONTACT NAME & PHONE:", margin + 92, y + 19);
    pdf.text("RESIDENTIAL ADDRESS:", margin + 2, y + 27);
    
    y += detailsBoxHeight + 6;
    
    // --- Section B: Position & Expectations ---
    drawSectionHeader("Section B: Position & Expectations");
    
    const expBoxHeight = 16;
    pdf.rect(margin, y, 210 - 2 * margin, expBoxHeight);
    pdf.line(margin, y + 8, 210 - margin, y + 8);
    pdf.line(margin + 90, y, margin + 90, y + 16);
    
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    pdf.setTextColor(100, 116, 139);
    
    pdf.text("POSITION APPLIED FOR:", margin + 2, y + 3);
    pdf.text("EXPECTED MONTHLY SALARY (RM):", margin + 92, y + 3);
    pdf.text("EARLIEST COMMENCEMENT DATE:", margin + 2, y + 11);
    pdf.text("AVAILABILITY (e.g., Immediate / Notice Period):", margin + 92, y + 11);
    
    // Pre-fill position if HR configured it
    if (jobTerms.title || jobTerms.department) {
      pdf.setFont(fontFamily, 'bold');
      pdf.setFontSize(9);
      pdf.setTextColor(15, 23, 42);
      const proposedPos = [jobTerms.title, jobTerms.department].filter(Boolean).join(" - ");
      pdf.text(proposedPos, margin + 2, y + 6.5);
    }
    
    y += expBoxHeight + 6;
    
    // --- Section C: Academic Qualifications ---
    drawSectionHeader("Section C: Academic Qualifications");
    
    const writableWidth = 210 - 2 * margin;
    const col1 = writableWidth * 0.3;
    const col2 = writableWidth * 0.4;
    const col3 = writableWidth * 0.15;
    
    // Table Header & Board
    pdf.setFillColor(241, 245, 249); // slate-100
    pdf.rect(margin, y, writableWidth, 6, 'F');
    pdf.rect(margin, y, writableWidth, 24); 
    
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.5);
    pdf.setTextColor(51, 65, 85);
    pdf.text("LEVEL / DEGREE", margin + 2, y + 4);
    pdf.text("SCHOOL / UNIVERSITY / INSTITUTION", margin + col1 + 2, y + 4);
    pdf.text("YEAR GRADUATED", margin + col1 + col2 + 2, y + 4);
    pdf.text("GRADE / GPA", margin + col1 + col2 + col3 + 2, y + 4);
    
    // Vertical lines
    pdf.line(margin + col1, y, margin + col1, y + 24);
    pdf.line(margin + col1 + col2, y, margin + col1 + col2, y + 24);
    pdf.line(margin + col1 + col2 + col3, y, margin + col1 + col2 + col3, y + 24);
    
    // Horizontal lines (3 empty rows)
    pdf.line(margin, y + 6, 210 - margin, y + 6);
    pdf.line(margin, y + 12, 210 - margin, y + 12);
    pdf.line(margin, y + 18, 210 - margin, y + 18);
    
    y += 30;
    
    // --- Section D: Employment History ---
    drawSectionHeader("Section D: Employment History (Start from most recent)");
    
    const w1 = writableWidth * 0.3;
    const w2 = writableWidth * 0.25;
    const w3 = writableWidth * 0.15;
    const w4 = writableWidth * 0.12;
    
    // Table Header & Board
    pdf.setFillColor(241, 245, 249);
    pdf.rect(margin, y, writableWidth, 6, 'F');
    pdf.rect(margin, y, writableWidth, 30); 
    
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.5);
    pdf.setTextColor(51, 65, 85);
    pdf.text("COMPANY NAME", margin + 2, y + 4);
    pdf.text("DESIGNATION", margin + w1 + 2, y + 4);
    pdf.text("DURATION", margin + w1 + w2 + 2, y + 4);
    pdf.text("LAST SALARY", margin + w1 + w2 + w3 + 2, y + 4);
    pdf.text("REASON FOR LEAVING", margin + w1 + w2 + w3 + w4 + 2, y + 4);
    
    // Vertical lines
    pdf.line(margin + w1, y, margin + w1, y + 30);
    pdf.line(margin + w1 + w2, y, margin + w1 + w2, y + 30);
    pdf.line(margin + w1 + w2 + w3, y, margin + w1 + w2 + w3, y + 30);
    pdf.line(margin + w1 + w2 + w3 + w4, y, margin + w1 + w2 + w3 + w4, y + 30);
    
    // Horizontal lines (4 empty rows)
    pdf.line(margin, y + 6, 210 - margin, y + 6);
    pdf.line(margin, y + 12, 210 - margin, y + 12);
    pdf.line(margin, y + 18, 210 - margin, y + 18);
    pdf.line(margin, y + 24, 210 - margin, y + 24);
    
    y += 36;
    
    // --- Section E: Declaration ---
    drawSectionHeader("Section E: Candidate Declaration");
    
    pdf.setFont(fontFamily, 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(71, 85, 105);
    const decText = "I hereby declare that the information provided in this application is true, complete, and accurate to the best of my knowledge. I understand that any false statement, misrepresentation, or omission of facts may be grounds for immediate rejection of this application or subsequent termination of employment if hired.";
    const decLines = pdf.splitTextToSize(decText, writableWidth);
    for (const line of decLines) {
      pdf.text(line, margin, y);
      y += 3.8;
    }
    y += 4;
    
    // Signature lines
    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.3);
    pdf.line(margin, y + 12, margin + 50, y + 12);
    pdf.line(210 - margin - 40, y + 12, 210 - margin, y + 12);
    
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    pdf.setTextColor(148, 163, 184);
    pdf.text("CANDIDATE SIGNATURE", margin, y + 15);
    pdf.text("DATE", 210 - margin - 40, y + 15);
    
    // =====================================================================
    // PAGE 2: Interview Evaluation & Negotiation Record
    // =====================================================================
    pdf.addPage();
    drawWatermark();
    y = margin;
    
    // Header Page 2
    pdf.setFont(fontFamily, 'bold');
    pdf.setFontSize(13);
    pdf.setTextColor(30, 41, 59);
    pdf.text(companyDetails.name.toUpperCase(), margin, y);
    y += 5.5;
    
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(15, 23, 42);
    pdf.text("INTERVIEW EVALUATION & NEGOTIATION RECORD", margin, y);
    y += 4.5;
    
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.5);
    pdf.setTextColor(239, 68, 68); // red-500
    pdf.text("FOR MANAGEMENT & INTERVIEWER USE ONLY — DO NOT HAND TO CANDIDATE", margin, y);
    y += 3;
    
    // Divider
    pdf.setDrawColor(30, 41, 59);
    pdf.setLineWidth(0.5);
    pdf.line(margin, y, 210 - margin, y);
    y += 6;
    
    // Metadata Box
    pdf.setDrawColor(148, 163, 184);
    pdf.setLineWidth(0.3);
    pdf.rect(margin, y, writableWidth, 14);
    pdf.line(margin, y + 7, 210 - margin, y + 7);
    pdf.line(margin + 90, y, margin + 90, y + 14);
    
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.5);
    pdf.setTextColor(100, 116, 139);
    
    pdf.text("CANDIDATE NAME:", margin + 2, y + 3);
    pdf.text("DATE OF INTERVIEW:", margin + 92, y + 3);
    pdf.text("INTERVIEWER NAME(S):", margin + 2, y + 10);
    pdf.text("PROPOSED POSITION & DEPT:", margin + 92, y + 10);
    
    if (jobTerms.title || jobTerms.department) {
      pdf.setFont(fontFamily, 'bold');
      pdf.setFontSize(9);
      pdf.setTextColor(15, 23, 42);
      const proposed = [jobTerms.title, jobTerms.department].filter(Boolean).join(" - ");
      pdf.text(proposed, margin + 92, y + 13.2);
    }
    
    y += 20;
    
    // --- Section 1: Evaluation Matrix ---
    drawSectionHeader("1. Candidate Assessment Matrix");
    
    const cw1 = 45;
    const cw2 = 18;
    
    // Table Header & Board
    pdf.setFillColor(241, 245, 249);
    pdf.rect(margin, y, writableWidth, 7, 'F');
    pdf.rect(margin, y, writableWidth, 42); // 6 rows of 7mm (1 header + 5 criteria)
    
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.5);
    pdf.setTextColor(51, 65, 85);
    pdf.text("EVALUATION CRITERIA", margin + 2, y + 4.5);
    pdf.text("EXCELLENT", margin + cw1 + 1.5, y + 4.5);
    pdf.text("GOOD", margin + cw1 + cw2 + 4.5, y + 4.5);
    pdf.text("AVERAGE", margin + cw1 + cw2 * 2 + 2.5, y + 4.5);
    pdf.text("POOR", margin + cw1 + cw2 * 3 + 4.5, y + 4.5);
    pdf.text("INTERVIEWER REMARKS & EVIDENCE", margin + cw1 + cw2 * 4 + 2, y + 4.5);
    
    // Vertical lines
    pdf.line(margin + cw1, y, margin + cw1, y + 42);
    pdf.line(margin + cw1 + cw2, y, margin + cw1 + cw2, y + 42);
    pdf.line(margin + cw1 + cw2 * 2, y, margin + cw1 + cw2 * 2, y + 42);
    pdf.line(margin + cw1 + cw2 * 3, y, margin + cw1 + cw2 * 3, y + 42);
    pdf.line(margin + cw1 + cw2 * 4, y, margin + cw1 + cw2 * 4, y + 42);
    
    // Rows
    const criteria = [
      "Communication & Language",
      "Appearance & Professionalism",
      "Technical Skills & Job Knowledge",
      "Relevant Experience & Background",
      "Attitude, Motivation & Values"
    ];
    
    pdf.setFont('helvetica', 'semibold');
    pdf.setFontSize(8);
    pdf.setTextColor(15, 23, 42);
    
    for (let i = 0; i < criteria.length; i++) {
      const rowY = y + 7 * (i + 1);
      pdf.line(margin, rowY, 210 - margin, rowY);
      pdf.text(criteria[i], margin + 2, rowY + 4.5);
      
      // Draw checkboxes
      pdf.setFont('courier', 'bold');
      pdf.setFontSize(9);
      pdf.setTextColor(148, 163, 184);
      pdf.text("[ ]", margin + cw1 + 7, rowY + 4.5);
      pdf.text("[ ]", margin + cw1 + cw2 + 7, rowY + 4.5);
      pdf.text("[ ]", margin + cw1 + cw2 * 2 + 7, rowY + 4.5);
      pdf.text("[ ]", margin + cw1 + cw2 * 3 + 7, rowY + 4.5);
      
      pdf.setFont('helvetica', 'semibold');
      pdf.setFontSize(8);
      pdf.setTextColor(15, 23, 42);
    }
    
    y += 48;
    
    // --- Section 2: Interview Notes & Salary Negotiation ---
    drawSectionHeader("2. Interview Notes & Salary Negotiation (Handwritten)");
    
    const notesHeight = 32;
    pdf.setDrawColor(148, 163, 184);
    pdf.rect(margin, y, writableWidth, notesHeight);
    
    // Ruled lines
    pdf.setDrawColor(226, 232, 240);
    pdf.setLineWidth(0.2);
    for (let lY = y + 6; lY < y + notesHeight; lY += 6) {
      pdf.line(margin + 1, lY, 210 - margin - 1, lY);
    }
    
    y += notesHeight + 6;
    
    // --- Section 3: Final Hiring Decision ---
    drawSectionHeader("3. Final Hiring Decision");
    
    const decisionHeight = 24;
    pdf.setDrawColor(148, 163, 184);
    pdf.setLineWidth(0.3);
    pdf.rect(margin, y, writableWidth, decisionHeight);
    
    pdf.line(margin, y + 8, 210 - margin, y + 8);
    pdf.line(margin + 90, y + 8, margin + 90, y + 24);
    
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.5);
    pdf.setTextColor(100, 116, 139);
    
    pdf.text("STATUS / DECISION:", margin + 2, y + 3);
    pdf.setFont('courier', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(15, 23, 42);
    pdf.text("[ ] APPROVED / HIRE   [ ] SHORTLISTED / HOLD   [ ] REJECTED", margin + 35, y + 5.2);
    
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.5);
    pdf.setTextColor(100, 116, 139);
    pdf.text("APPROVED JOB TITLE:", margin + 2, y + 11);
    pdf.text("APPROVED MONTHLY BASIC (RM):", margin + 92, y + 11);
    pdf.text("APPROVED ALLOWANCES & PROBATION:", margin + 2, y + 19);
    pdf.text("AGREED COMMENCEMENT DATE:", margin + 92, y + 19);
    
    y += decisionHeight + 8;
    
    // --- Section 4: Approvals ---
    pdf.setDrawColor(148, 163, 184);
    pdf.rect(margin, y, writableWidth, 24);
    pdf.line(margin + 90, y, margin + 90, y + 24);
    
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.5);
    pdf.setTextColor(100, 116, 139);
    
    pdf.text("INTERVIEWER SIGN-OFF:", margin + 2, y + 3);
    pdf.text("AUTHORIZED MANAGEMENT APPROVAL:", margin + 92, y + 3);
    
    pdf.line(margin + 5, y + 17, margin + 65, y + 17);
    pdf.line(margin + 95, y + 17, margin + 160, y + 17);
    
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    pdf.setTextColor(148, 163, 184);
    pdf.text("Signature & Date", margin + 5, y + 21);
    pdf.text("Signature & Date", margin + 95, y + 21);
    
    const sanitizedName = (jobTerms.title || "job").toLowerCase().replace(/[^a-z0-9]/g, "_");
    pdf.save(`employment_application_${sanitizedName}.pdf`);
  } else {
    // =====================================================================
    // NATIVE PDF GENERATION: standard Appointment Letter
    // =====================================================================

    // 1. Letterhead Section
    if (logo) {
      try {
        // Place logo at top-left
        drawImageContained(pdf, logo, 'PNG', margin, y, 45, 15);
        y += 18;
      } catch (e) {
        console.error("Error adding logo to PDF:", e);
        y += 5;
      }
    }

    pdf.setFont(fontFamily, 'bold');
    pdf.setFontSize(14);
    pdf.setTextColor(30, 41, 59); // slate-800
    pdf.text(companyDetails.name, margin, y);
    y += 5.5;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(71, 85, 105); // slate-600
    pdf.text(`Company Registration No: ${companyDetails.registrationNo}`, margin, y);
    y += 4.5;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(100, 116, 139); // slate-500
    pdf.text(`${companyDetails.addressLine1}, ${companyDetails.addressLine2}`, margin, y);
    y += 4.5;

    pdf.text(companyDetails.phoneEmail, margin, y);
    y += 6;

    // Letterhead divider line
    if (stylingOptions.showLetterheadBorder && stylingOptions.accentColor !== 'transparent') {
      const hex = stylingOptions.accentColor || '#059669';
      const r = parseInt(hex.slice(1, 3), 16) || 5;
      const g = parseInt(hex.slice(3, 5), 16) || 150;
      const b = parseInt(hex.slice(5, 7), 16) || 105;
      pdf.setDrawColor(r, g, b);
      pdf.setLineWidth(0.8);
      pdf.line(margin, y, 210 - margin, y);
      y += 8;
    } else {
      y += 4;
    }

    // 2. Letter Meta Details (Ref & Date)
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(71, 85, 105);
    pdf.text(`Ref: ${letterMeta.refNo || "N/A"}`, margin, y);
    pdf.text(`Date: ${letterMeta.date || "N/A"}`, 210 - margin, y, { align: 'right' });
    y += 8;

    // 3. Employee Info Block
    pdf.setFont(fontFamily, 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(15, 23, 42); // slate-900
    pdf.text(employeeDetails.name.toUpperCase(), margin, y);
    y += 5;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9.5);
    pdf.setTextColor(71, 85, 105);
    pdf.text(`IC / Passport No: ${employeeDetails.icPassport}`, margin, y);
    y += 4.5;

    pdf.setFont(fontFamily, 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(51, 65, 85); // slate-700
    pdf.text(employeeDetails.addressLine1, margin, y);
    y += 4.5;
    pdf.text(employeeDetails.addressLine2, margin, y);
    y += 9;

    // 4. Salutation
    pdf.setFont(fontFamily, 'normal');
    pdf.setFontSize(10.5);
    pdf.setTextColor(0, 0, 0);
    const salName = employeeDetails.name ? employeeDetails.name.split(" ")[0] : "Candidate";
    pdf.text(`Dear ${salName},`, margin, y);
    y += 8;

    // 5. Subject Line
    pdf.setFont(fontFamily, 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(15, 23, 42);
    const subjectText = `LETTER OF APPOINTMENT AS ${jobTerms.title.toUpperCase()}`;
    pdf.text(subjectText, margin, y);
    const textWidth = pdf.getTextWidth(subjectText);
    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.4);
    pdf.line(margin, y + 1.5, margin + textWidth, y + 1.5);
    y += 9;

    // 6. Clauses and Job Terms Table
    const drawParagraph = (text, isBold = false) => {
      pdf.setFont(fontFamily, isBold ? 'bold' : 'normal');
      pdf.setFontSize(fontSize);
      pdf.setTextColor(0, 0, 0);
      
      const lines = pdf.splitTextToSize(text, 210 - 2 * margin);
      for (const line of lines) {
        checkPageBreak(lineHeight);
        pdf.text(line, margin, y);
        y += lineHeight;
      }
      y += 4; // Space between paragraphs
    };

    const drawTableRow = (label, valueContent) => {
      const labelWidth = 50; 
      const valWidth = (210 - 2 * margin) - 55; 
      
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8.5);
      const labelLines = pdf.splitTextToSize(label.toUpperCase(), labelWidth);
      
      pdf.setFont(fontFamily, 'normal');
      pdf.setFontSize(10);
      
      let valLines = [];
      if (Array.isArray(valueContent)) {
        valLines = valueContent;
      } else {
        valLines = pdf.splitTextToSize(valueContent, valWidth);
      }
      
      const labelHeight = labelLines.length * 4.5;
      const valHeight = valLines.length * 4.5;
      const rowHeight = Math.max(labelHeight, valHeight) + 4; 
      
      checkPageBreak(rowHeight);
      
      pdf.setDrawColor(241, 245, 249); // slate-100
      pdf.setLineWidth(0.3);
      pdf.line(margin, y + rowHeight, 210 - margin, y + rowHeight);
      
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8.5);
      pdf.setTextColor(100, 116, 139); // slate-500
      let currentY = y + 3;
      for (const line of labelLines) {
        pdf.text(line, margin, currentY);
        currentY += 4.5;
      }
      
      pdf.setFont(fontFamily, 'semibold');
      pdf.setFontSize(9.5);
      pdf.setTextColor(15, 23, 42); // slate-900
      currentY = y + 3;
      for (const line of valLines) {
        pdf.text(line, margin + 52, currentY);
        currentY += 4.5;
      }
      
      y += rowHeight;
    };

    const drawClause = (number, title, text) => {
      checkPageBreak(lineHeight + 6);
      pdf.setFont(fontFamily, 'bold');
      pdf.setFontSize(fontSize);
      pdf.setTextColor(15, 23, 42);
      pdf.text(`${number}. ${title}`, margin, y);
      y += 4.5;
      
      pdf.setFont(fontFamily, 'normal');
      pdf.setFontSize(fontSize - 0.5);
      pdf.setTextColor(51, 65, 85); // slate-700
      
      const lines = pdf.splitTextToSize(text, 210 - 2 * margin);
      for (const line of lines) {
        checkPageBreak(lineHeight);
        pdf.text(line, margin, y);
        y += lineHeight;
      }
      y += 4.5;
    };

    // Introduction
    drawParagraph(clauses.intro);

    // Terms Table
    const salaryStr = formatCurrency(jobTerms.basicSalary);
    const salaryLines = [salaryStr];
    if (templateType === "fullTime" && jobTerms.probationPeriod && parseFloat(jobTerms.probationSalary) > 0) {
      salaryLines.push(`(Reduced basic during probation: ${formatCurrency(jobTerms.probationSalary)}/month)`);
    }
    if (templateType === "fullTime") {
      salaryLines.push(`Subject to statutory EPF / SOCSO deductions`);
    }

    const allowanceLines = [];
    allowances.forEach(al => {
      if (al.name) {
        allowanceLines.push(`• ${al.name}: ${formatCurrency(al.amount)} per month`);
      }
    });

    const probVal = (templateType === "fullTime" || templateType === "partTime") ? `${jobTerms.probationPeriod} Months` : jobTerms.probationPeriod;

    const noticeLines = [
      `Under Trial/Probation: ${jobTerms.noticeProbation} written notice`,
      `Upon Confirmation: ${jobTerms.noticeConfirmed} written notice`
    ];

    // Draw table rows
    drawTableRow("1. Designation & Dept", `${jobTerms.title}  |  ${jobTerms.department}`);
    drawTableRow("2. Start Date", jobTerms.commencementDate);
    drawTableRow(`3. ${jobTerms.salaryLabel || "Monthly Basic"}`, salaryLines);
    if (templateType !== "internship" && templateType !== "contractor" && allowanceLines.length > 0) {
      drawTableRow("4. Allowance Packages", allowanceLines);
    }
    drawTableRow(`5. ${jobTerms.durationLabel || "Probation Period"}`, probVal);
    drawTableRow("6. Service Notice Period", noticeLines);
    drawTableRow("7. Prescribed Hours", jobTerms.workingHours);
    y += 6; // Space after table

    // Clauses
    drawClause("8", "Duties & Responsibilities", clauses.duties);
    drawClause("9", "Professional Confidentiality", clauses.confidentiality);
    drawClause("10", "Policy Compliance", clauses.compliance);

    // Closing paragraph
    drawParagraph(clauses.closing);

    // 7. Signatures & Acceptance Block
    checkPageBreak(65); // Make sure the entire signatures section is kept together on the same page
    
    const sigYStart = y;

    // Employer signature (left)
    pdf.setFont(fontFamily, 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(0, 0, 0);
    pdf.text("Yours sincerely,", margin, y);
    y += 4.5;
    
    pdf.setFont(fontFamily, 'bold');
    pdf.setFontSize(9.5);
    pdf.setTextColor(51, 65, 85);
    pdf.text(`For ${companyDetails.name}`, margin, y);
    
    const signatureY = y + 4;
    if (signatorySignature) {
      try {
        pdf.addImage(signatorySignature, 'PNG', margin + 2, signatureY, 32, 16, undefined, 'FAST');
      } catch (e) {
        console.error("Error adding signatory signature to PDF:", e);
      }
    }
    if (stamp) {
      try {
        pdf.addImage(stamp, 'PNG', margin + 20, signatureY - 3, 18, 18, undefined, 'FAST');
      } catch (e) {
        console.error("Error adding stamp to PDF:", e);
      }
    }
    
    const detailsY = signatureY + 19;
    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.3);
    pdf.line(margin, detailsY, margin + 45, detailsY); // signature line
    
    pdf.setFont(fontFamily, 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(15, 23, 42);
    pdf.text(signatory.name, margin, detailsY + 4);
    
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(100, 116, 139);
    pdf.text(signatory.title.toUpperCase(), margin, detailsY + 7.5);

    // Candidate signature (right)
    y = sigYStart;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9.5);
    pdf.setTextColor(15, 23, 42);
    pdf.text("ACKNOWLEDGEMENT & ACCEPTANCE", 115, y);
    
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(71, 85, 105);
    const acceptText = "I hereby confirm that I have read, understood, and accept this appointment under the terms and conditions outlined in this letter.";
    const acceptLines = pdf.splitTextToSize(acceptText, 210 - margin - 115);
    let acceptY = y + 4.5;
    for (const line of acceptLines) {
      pdf.text(line, 115, acceptY);
      acceptY += 4;
    }
    
    const empSigY = acceptY + 3;
    if (employeeSignature) {
      try {
        pdf.addImage(employeeSignature, 'PNG', 125, empSigY, 32, 16, undefined, 'FAST');
      } catch (e) {
        console.error("Error adding employee signature to PDF:", e);
      }
    }
    
    const empLineY = empSigY + 19;
    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.3);
    pdf.line(115, empLineY, 115 + 45, empLineY); // signature line
    pdf.line(170, empLineY, 210 - margin, empLineY); // date line
    
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.5);
    pdf.setTextColor(148, 163, 184); // slate-400
    pdf.text("CANDIDATE SIGNATURE", 115, empLineY + 4);
    pdf.text("DATE", 170, empLineY + 4);
  }

  const fileSuffix = templateType === "applicationForm" ? "job_application" : "appointment_letter";
  const sanitizedName = (templateType === "applicationForm" ? (jobTerms.title || "job") : employeeDetails.name).toLowerCase().replace(/[^a-z0-9]/g, "_");
  return { pdf, fileName: `${fileSuffix}_${sanitizedName}.pdf` };
}
