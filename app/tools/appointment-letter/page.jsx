"use client";

import React, { useState, useRef, useEffect } from "react";
import Cookies from "js-cookie";
import { useGetBranchSettingsQuery } from "@/lib/redux/api/branchSettingsApiSlice";
import { useGetSingleBranchQuery } from "@/lib/redux/api/branchApiSlice";
import { FileText, Printer, Building, Briefcase, Palette, PenTool, Layers } from "lucide-react";
import { getSessionUser } from "@/lib/session";
import { toast } from "@/app/components/ui/notify";
import { TEMPLATES } from "./templates";
import { buildLetterPdf } from "./buildLetterPdf";
import useCurrency from "@/app/hooks/useCurrency";
import { formatMoney } from "@/lib/region/currency";
import { LetterContext } from "./LetterContext";
import StylePanel from "./panels/StylePanel";
import PartiesPanel from "./panels/PartiesPanel";
import TermsPanel from "./panels/TermsPanel";
import SignaturesPanel from "./panels/SignaturesPanel";
import ClausesPanel from "./panels/ClausesPanel";
import LetterPreview from "./LetterPreview";
import SignaturePad from "./SignaturePad";
import { useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { format, parseISO } from "date-fns";
import { UserPlus } from "lucide-react";
import { db } from "@/lib/firebase";
import { getLetter, saveLetter } from "@/lib/hires/client";
import { hireName } from "@/lib/hires/model";
import { roleLabelOf } from "@/app/staff-management/lib/constants";
import { Button } from "@/app/components/ui";
import { LETTER_KEYS } from "./letterForHire";



export default function AppointmentLetterGenerator() {
  const currency = useCurrency();
  const letterRef = useRef(null);
  const canvasRef = useRef(null);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState("style"); // style, parties, terms, signatures, clauses
  
  // Active Branch / User Session States
  const [companyId, setCompanyId] = useState(null);
  const [branchId, setBranchId] = useState(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = getSessionUser();
        if (raw) {
          const u = raw;
          setCompanyId(u.companyId);
          
          // Get active branch from cookies or fallback to user's default branchId
          const cookieKey = u.companyId ? `activeBranch_${u.companyId}` : "activeBranch";
          const activeBranchId = Cookies.get(cookieKey) || u.branchId;
          setBranchId(activeBranchId);
        }
      } catch (e) {
        console.error("Failed to read user session", e);
      }
    }
  }, []);

  // RTK Query hooks for database settings & branch info
  const skip = !companyId || !branchId;
  const { data: dbSettings } = useGetBranchSettingsQuery(
    { companyId, branchId },
    { skip }
  );
  const { data: dbBranch } = useGetSingleBranchQuery(
    { companyId, branchId },
    { skip }
  );

  // Signature Drawing Modal State
  const [signatureModal, setSignatureModal] = useState({
    isOpen: false,
    target: "", // 'signatory' or 'employee'
    inkColor: "#0000ff" // Blue ink by default
  });
  
  const [isDrawing, setIsDrawing] = useState(false);
  
  // Local storage drafts state
  const [draftName, setDraftName] = useState("");
  const [savedDrafts, setSavedDrafts] = useState([]);
  const [selectedDraft, setSelectedDraft] = useState("");

  // --- States ---
  const [templateType, setTemplateType] = useState("fullTime");
  const [logo, setLogo] = useState(null);
  const [stamp, setStamp] = useState(null); // Corporate stamp/seal
  
  const [companyDetails, setCompanyDetails] = useState({
    name: "CASH CURRY SDN. BHD.",
    registrationNo: "202401012345 (1234567-A)",
    addressLine1: "Level 15, Menara Shell",
    addressLine2: "Jalan Tun Sambanthan, 50470 Kuala Lumpur",
    phoneEmail: "Tel: +603-2276 8888 | Email: hr@cashcurry.com",
  });

  // Auto-populate company details from database once loaded
  useEffect(() => {
    if (!dbSettings && !dbBranch) return;
    
    const settingsBasic = dbSettings?.basic || {};
    const branchBasic = dbBranch || {};

    setCompanyDetails(prev => {
      let addressLine1 = prev.addressLine1;
      let addressLine2 = prev.addressLine2;
      
      const branchAddress = branchBasic.address;
      const settingsAddress = settingsBasic.address;

      if (typeof branchAddress === "string" && branchAddress.trim() !== "") {
        const trimmed = branchAddress.trim();
        const parts = trimmed.split(",");
        if (parts.length > 1) {
          // Split address string into two lines for cleaner letterhead styling
          addressLine1 = parts[0].trim();
          addressLine2 = parts.slice(1).join(", ").trim();
        } else {
          addressLine1 = trimmed;
          addressLine2 = "";
        }
      } else if (settingsAddress && typeof settingsAddress === "object") {
        if (settingsAddress.line1) {
          addressLine1 = settingsAddress.line1;
          const cityStatePostcode = [settingsAddress.postcode, settingsAddress.city, settingsAddress.state].filter(Boolean).join(", ");
          addressLine2 = cityStatePostcode || settingsAddress.city || "";
        }
      } else if (typeof settingsAddress === "string" && settingsAddress.trim() !== "") {
        const trimmed = settingsAddress.trim();
        const parts = trimmed.split(",");
        if (parts.length > 1) {
          addressLine1 = parts[0].trim();
          addressLine2 = parts.slice(1).join(", ").trim();
        } else {
          addressLine1 = trimmed;
          addressLine2 = "";
        }
      }

      let phoneEmail = prev.phoneEmail;
      const phone = settingsBasic.phone || branchBasic.phone || "";
      const email = settingsBasic.email || branchBasic.email || "";
      if (phone || email) {
        const parts = [];
        if (phone) parts.push(`Tel: ${phone}`);
        if (email) parts.push(`Email: ${email}`);
        phoneEmail = parts.join(" | ");
      }

      return {
        name: settingsBasic.companyName || branchBasic.name || prev.name,
        registrationNo: settingsBasic.companyRegistration || prev.registrationNo,
        addressLine1,
        addressLine2,
        phoneEmail
      };
    });
  }, [dbSettings, dbBranch]);

  const [letterMeta, setLetterMeta] = useState({
    refNo: "CC/HR/APP/2026/089",
    date: new Date().toLocaleDateString("en-MY", {
      day: "numeric",
      month: "long",
      year: "numeric"
    }),
    watermarkText: "CONFIDENTIAL" // Slanted background watermark
  });

  const [employeeDetails, setEmployeeDetails] = useState({
    name: "Muhammad Faiz bin Rahman",
    icPassport: "960812-14-5567",
    addressLine1: "No. 45, Jalan Setia Bakti 3",
    addressLine2: "Bukit Damansara, 50490 Kuala Lumpur",
  });

  // Dynamic employment terms based on template
  const [jobTerms, setJobTerms] = useState(TEMPLATES.fullTime.jobTerms);
  const [allowances, setAllowances] = useState([
    { name: "Travel Allowance", amount: "300.00" },
    { name: "Mobile Allowance", amount: "100.00" }
  ]);

  const [signatory, setSignatory] = useState({
    name: "Sarah Lim",
    title: "Head of Human Resources",
  });

  // Paragraph clauses based on template
  const [clauses, setClauses] = useState(TEMPLATES.fullTime.clauses);
  
  // Custom Signatures
  const [signatorySignature, setSignatorySignature] = useState(null);
  const [employeeSignature, setEmployeeSignature] = useState(null);

  // Custom Typography & Document Styling Options
  const [stylingOptions, setStylingOptions] = useState({
    fontFamily: "serif", // serif, sans, mono
    fontSize: "13px", // 12px, 13px, 14px
    marginSize: "20mm", // 15mm, 20mm, 25mm
    lineHeight: "1.6", // 1.4, 1.6, 1.8
    accentColor: "#059669", // Mint accent border color
    showWatermark: true,
    showLetterheadBorder: true
  });

  // Load saved drafts on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const drafts = JSON.parse(localStorage.getItem("cc_appointment_letter_drafts") || "[]");
      setSavedDrafts(drafts);
    }
  }, []);

  // Update fields when template type changes
  const handleTemplateChange = (type) => {
    setTemplateType(type);
    const selected = TEMPLATES[type];
    if (selected) {
      setJobTerms(selected.jobTerms);
      setClauses(selected.clauses);
      
      // Auto tab reset for Job Application Form (hides Signatures & Clauses tabs)
      if (type === "applicationForm") {
        setAllowances([]);
        if (activeTab === "signatures" || activeTab === "clauses") {
          setActiveTab("style");
        }
      } else if (type === "internship" || type === "contractor") {
        setAllowances([]);
      } else {
        setAllowances([
          { name: "Travel Allowance", amount: "300.00" },
          { name: "Mobile Allowance", amount: "100.00" }
        ]);
      }
    }
  };

  // --- Handlers for uploads ---
  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setLogo(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleStampUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setStamp(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleAllowanceChange = (index, field, value) => {
    const updated = [...allowances];
    updated[index][field] = value;
    setAllowances(updated);
  };

  const addAllowance = () => {
    setAllowances([...allowances, { name: "", amount: "0.00" }]);
  };

  const removeAllowance = (index) => {
    setAllowances(allowances.filter((_, i) => i !== index));
  };

  // The branch's currency, in plain letters (RM, Tk…) — the same text goes into
  // the PDF, whose fonts have no ৳ or ₹.
  const formatCurrency = (amount) => {
    const parsed = parseFloat(amount);
    const text = formatMoney(isNaN(parsed) ? 0 : parsed, currency, { plain: true });
    return templateType === "partTime" ? `${text}/hour` : text;
  };

  // --- A new hire's letter (30 Oct) ---
  // ?hire=<id> (from Staff → a new hire → Prepare the letter): the job, start
  // day and pay come from the new hire; "Save for …" keeps the letter for them
  // to read and sign on their join link (their own details go in as they fill them).
  const router = useRouter();
  const [hire, setHire] = useState(null);
  const [savingForHire, setSavingForHire] = useState(false);
  const applyLetter = (d) => {
    setTemplateType(d.templateType || "fullTime");
    setLogo(d.logo || null);
    setStamp(d.stamp || null);
    setCompanyDetails(d.companyDetails);
    setLetterMeta(d.letterMeta);
    setEmployeeDetails(d.employeeDetails);
    setJobTerms(d.jobTerms);
    setAllowances(d.allowances || []);
    setSignatory(d.signatory);
    setClauses(d.clauses);
    setSignatorySignature(d.signatorySignature || null);
    if (d.stylingOptions) setStylingOptions(d.stylingOptions);
  };
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("hire");
    if (!id || !companyId || !branchId) return;
    let live = true;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "companies", companyId, "branches", branchId, "newHires", id));
        if (!live) return;
        if (!snap.exists()) return toast.error("That new hire is no longer here");
        const h = { id, ...snap.data() };
        setHire(h);
        const saved = await getLetter(companyId, branchId, id);
        if (!live) return;
        if (saved) return applyLetter(saved);
        setEmployeeDetails({ name: hireName(h), icPassport: "", addressLine1: "", addressLine2: "" });
        setJobTerms((t) => ({
          ...t,
          title: roleLabelOf(h.role) || t.title,
          department: h.department || t.department,
          commencementDate: h.startDate ? format(parseISO(h.startDate), "do MMMM yyyy") : t.commencementDate,
          basicSalary: h.basicSalary !== "" && h.basicSalary != null ? Number(h.basicSalary).toFixed(2) : t.basicSalary,
        }));
      } catch (e) {
        toast.error("Couldn't open the new hire", { description: e.message });
      }
    })();
    return () => {
      live = false;
    };
  }, [companyId, branchId]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveForHire = async () => {
    if (!hire) return;
    const state = { templateType, logo, stamp, companyDetails, letterMeta, employeeDetails, jobTerms, allowances, signatory, clauses, signatorySignature, stylingOptions };
    const letter = Object.fromEntries(LETTER_KEYS.map((k) => [k, state[k] ?? null]));
    if (JSON.stringify(letter).length > 900000) return toast.error("The logo or stamp is too big to save", { description: "Use a smaller image (under about 300 KB)." });
    setSavingForHire(true);
    try {
      await saveLetter(companyId, branchId, hire.id, letter);
      toast.success(`Letter saved for ${hireName(hire)}`, { description: "They read and sign it on their join link." });
      router.push(`/staff-management?hire=${hire.id}`);
    } catch (e) {
      toast.error("Couldn't save the letter", { description: hire.signed ? "They have signed it already — it can't change now." : e.message });
    } finally {
      setSavingForHire(false);
    }
  };

  // --- Draft Storage Logic ---
  const handleSaveDraft = () => {
    if (!draftName.trim()) {
      toast.warning("Please enter a name for the draft.");
      return;
    }
    
    const newDraft = {
      id: Date.now().toString(),
      name: draftName,
      templateType,
      logo,
      stamp,
      companyDetails,
      letterMeta,
      employeeDetails,
      jobTerms,
      allowances,
      signatory,
      clauses,
      signatorySignature,
      employeeSignature,
      stylingOptions,
      savedAt: new Date().toLocaleString()
    };

    const updated = [...savedDrafts.filter(d => d.name !== draftName), newDraft];
    setSavedDrafts(updated);
    localStorage.setItem("cc_appointment_letter_drafts", JSON.stringify(updated));
    setDraftName("");
    toast.success(`Draft "${newDraft.name}" saved successfully!`);
  };

  const handleLoadDraft = (id) => {
    const draft = savedDrafts.find(d => d.id === id);
    if (draft) {
      setTemplateType(draft.templateType || "fullTime");
      setLogo(draft.logo || null);
      setStamp(draft.stamp || null);
      setCompanyDetails(draft.companyDetails);
      setLetterMeta(draft.letterMeta);
      setEmployeeDetails(draft.employeeDetails);
      setJobTerms(draft.jobTerms);
      setAllowances(draft.allowances || []);
      setSignatory(draft.signatory);
      setClauses(draft.clauses);
      setSignatorySignature(draft.signatorySignature || null);
      setEmployeeSignature(draft.employeeSignature || null);
      setStylingOptions(draft.stylingOptions || stylingOptions);
      setSelectedDraft(id);
      toast.success(`Draft "${draft.name}" loaded successfully.`);
    }
  };

  const handleDeleteDraft = (id, e) => {
    e.stopPropagation();
    const updated = savedDrafts.filter(d => d.id !== id);
    setSavedDrafts(updated);
    localStorage.setItem("cc_appointment_letter_drafts", JSON.stringify(updated));
    if (selectedDraft === id) {
      setSelectedDraft("");
    }
  };

  // --- HTML5 Canvas Signature Pad Logic ---
  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    
    // Smooth rendering settings
    ctx.strokeStyle = signatureModal.inkColor;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    e.preventDefault();
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    ctx.lineTo(x, y);
    ctx.stroke();
    e.preventDefault();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const openSignaturePad = (target) => {
    setSignatureModal({
      isOpen: true,
      target,
      inkColor: "#0000ff"
    });
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Check if canvas is blank
    const buffer = new Uint32Array(canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data.buffer);
    const isBlank = !buffer.some(color => color !== 0);
    
    if (isBlank) {
      toast.warning("Please draw your signature before saving.");
      return;
    }

    const dataUrl = canvas.toDataURL("image/png");
    if (signatureModal.target === "signatory") {
      setSignatorySignature(dataUrl);
    } else {
      setEmployeeSignature(dataUrl);
    }
    
    setSignatureModal({ ...signatureModal, isOpen: false });
  };

  // --- PDF Generation Logic (Native Vector jsPDF) ---
  // --- PDF Generation Logic (Native Vector jsPDF) ---
  const handlePrint = async () => {
    setIsGenerating(true);
    try {
      const { pdf, fileName } = buildLetterPdf({ stylingOptions, companyDetails, letterMeta, employeeDetails, jobTerms, allowances, signatory, clauses, signatorySignature, employeeSignature, logo, stamp, templateType, formatCurrency });
      pdf.save(fileName);
    } catch (err) {
      console.error('Failed to generate PDF natively, falling back to window.print', err);
      window.print();
    } finally {
      setIsGenerating(false);
    }
  };

  // CSS fonts classes mapping
  const fontClass = {
    serif: "font-serif",
    sans: "font-sans",
    mono: "font-mono"
  }[stylingOptions.fontFamily] || "font-serif";

  return (
    <LetterContext.Provider value={{ letterRef, canvasRef, isGenerating, setIsGenerating, activeTab, setActiveTab, companyId, setCompanyId, branchId, setBranchId, skip, signatureModal, setSignatureModal, isDrawing, setIsDrawing, draftName, setDraftName, savedDrafts, setSavedDrafts, selectedDraft, setSelectedDraft, templateType, setTemplateType, logo, setLogo, stamp, setStamp, companyDetails, setCompanyDetails, letterMeta, setLetterMeta, employeeDetails, setEmployeeDetails, jobTerms, setJobTerms, allowances, setAllowances, signatory, setSignatory, clauses, setClauses, signatorySignature, setSignatorySignature, employeeSignature, setEmployeeSignature, stylingOptions, setStylingOptions, handleTemplateChange, handleLogoUpload, handleStampUpload, handleAllowanceChange, addAllowance, removeAllowance, formatCurrency, handleSaveDraft, handleLoadDraft, handleDeleteDraft, startDrawing, draw, stopDrawing, clearCanvas, openSignaturePad, saveSignature, handlePrint, fontClass }}>
    <div className="min-h-screen bg-surface-2/60/60 p-4 md:p-6 flex flex-col xl:flex-row gap-6 print:bg-surface print:p-0 print:m-0">
      
      {/* 1. Left Panel - Premium SaaS Dashboard Form */}
      <div className="w-full xl:w-[460px] shrink-0 bg-surface rounded-2xl border border-line shadow-sm flex flex-col h-fit xl:max-h-[92vh] print:hidden">
        
        {/* Header bar */}
        <div className="p-5 border-b border-line bg-surface-2/60/30 rounded-t-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-brand text-brand-fg shadow-sm shadow-mint-200">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-fg tracking-tight">Contract Builder</h2>
              <p className="text-[11px] text-muted font-medium">Create premium corporate letters</p>
            </div>
          </div>
          <span className="text-[10px] bg-brand-soft text-brand px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">v2.0</span>
        </div>

        {hire && (
          <div className="flex items-center gap-3 border-b border-line bg-brand-soft/40 px-5 py-3">
            <UserPlus className="size-4 shrink-0 text-brand" />
            <p className="min-w-0 flex-1 text-xs text-fg">
              Letter for new hire <b>{hireName(hire)}</b> — they add their IC and address and sign it on their link.
            </p>
            <Button size="sm" loading={savingForHire} onClick={saveForHire}>Save for {hire.firstName || "them"}</Button>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-line bg-surface-2/60/10 text-xs font-semibold overflow-x-auto select-none styled-scrollbar shrink-0">
          <button 
            onClick={() => setActiveTab("style")}
            className={`flex-1 min-w-[75px] py-3 text-center border-b-2 transition-colors cursor-pointer ${
              activeTab === "style" ? "border-brand text-brand bg-brand-soft/10" : "border-transparent text-muted hover:text-fg hover:bg-surface-2/50"
            }`}
          >
            <Palette className="w-3.5 h-3.5 mx-auto mb-1" />
            Style & Draft
          </button>
          <button 
            onClick={() => setActiveTab("parties")}
            className={`flex-1 min-w-[75px] py-3 text-center border-b-2 transition-colors cursor-pointer ${
              activeTab === "parties" ? "border-brand text-brand bg-brand-soft/10" : "border-transparent text-muted hover:text-fg hover:bg-surface-2/50"
            }`}
          >
            <Building className="w-3.5 h-3.5 mx-auto mb-1" />
            Parties
          </button>
          <button 
            onClick={() => setActiveTab("terms")}
            className={`flex-1 min-w-[75px] py-3 text-center border-b-2 transition-colors cursor-pointer ${
              activeTab === "terms" ? "border-brand text-brand bg-brand-soft/10" : "border-transparent text-muted hover:text-fg hover:bg-surface-2/50"
            }`}
          >
            <Briefcase className="w-3.5 h-3.5 mx-auto mb-1" />
            Job Terms
          </button>
          {templateType !== "applicationForm" && (
            <>
              <button 
                onClick={() => setActiveTab("signatures")}
                className={`flex-1 min-w-[75px] py-3 text-center border-b-2 transition-colors cursor-pointer ${
                  activeTab === "signatures" ? "border-brand text-brand bg-brand-soft/10" : "border-transparent text-muted hover:text-fg hover:bg-surface-2/50"
                }`}
              >
                <PenTool className="w-3.5 h-3.5 mx-auto mb-1" />
                Signature
              </button>
              <button 
                onClick={() => setActiveTab("clauses")}
                className={`flex-1 min-w-[75px] py-3 text-center border-b-2 transition-colors cursor-pointer ${
                  activeTab === "clauses" ? "border-brand text-brand bg-brand-soft/10" : "border-transparent text-muted hover:text-fg hover:bg-surface-2/50"
                }`}
              >
                <Layers className="w-3.5 h-3.5 mx-auto mb-1" />
                Clauses
              </button>
            </>
          )}
        </div>

        {/* Tab Content Panels */}
        <div className="p-5 space-y-4 overflow-y-auto max-h-[60vh] xl:max-h-[62vh] styled-scrollbar flex-1">
          
          <StylePanel />

          <PartiesPanel />

          <TermsPanel />

          <SignaturesPanel />

          <ClausesPanel />

        </div>

        {/* Footer print action button */}
        <div className="p-5 border-t border-line bg-surface-2/60/20 rounded-b-2xl shrink-0">
          <button 
            onClick={handlePrint} 
            disabled={isGenerating}
            className={`w-full text-brand-fg font-bold py-3.5 px-4 rounded-xl shadow-sm flex items-center justify-center gap-2 transition-all duration-300 cursor-pointer ${
              isGenerating 
                ? 'bg-slate-400 cursor-not-allowed' 
                : 'bg-brand hover:brightness-105 hover:shadow-md'
            }`}
          >
            <Printer className="w-5 h-5" />
            {isGenerating ? 'Generating PDF...' : 'Print / Save as PDF'}
          </button>
        </div>
      </div>

      <LetterPreview />

      <SignaturePad />

      {/* Global CSS for printing adjustments and fade animations */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:block, .print\\:block * {
            visibility: visible;
          }
          .print\\:block {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            height: 100% !important;
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          @page {
            size: A4;
            margin: 0;
          }
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.97); }
          to { opacity: 1; transform: scale(1); }
        }
        
        .animate-fade-in {
          animation: fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}} />
    </div>
    </LetterContext.Provider>
  );
}
