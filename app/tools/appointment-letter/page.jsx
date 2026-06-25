"use client";

import React, { useState, useRef, useEffect } from "react";
import { jsPDF } from "jspdf";
import { toPng } from "html-to-image";
import Cookies from "js-cookie";
import { useGetBranchSettingsQuery } from "@/lib/redux/api/branchSettingsApiSlice";
import { useGetSingleBranchQuery } from "@/lib/redux/api/branchApiSlice";
import { 
  FileText, 
  Upload, 
  Trash2, 
  Plus, 
  Printer, 
  Building, 
  User, 
  Briefcase, 
  DollarSign, 
  Palette, 
  Save, 
  PenTool, 
  Check, 
  FileCheck, 
  Layers, 
  Info
} from "lucide-react";

// Predefined templates for different employment types
const TEMPLATES = {
  fullTime: {
    title: "Full-Time Employment",
    jobTerms: {
      title: "Assistant Branch Manager",
      department: "Operations - Bangsar Branch",
      commencementDate: "1st July 2026",
      basicSalary: "3800.00",
      probationPeriod: "3",
      probationSalary: "3500.00",
      noticeProbation: "2 weeks",
      noticeConfirmed: "1 month",
      workingHours: "9:00 AM to 6:00 PM, Monday to Friday",
      salaryLabel: "Monthly Basic Salary",
      durationLabel: "Probation Period"
    },
    clauses: {
      intro: "We are pleased to offer you employment with CASH CURRY SDN. BHD. (the 'Company') under the following terms and conditions of service:",
      duties: "You shall perform such duties and responsibilities as are customary for your position and any other duties that may be assigned to you by the Management from time to time. You will report directly to the Branch Manager or any other person designated by the Company.",
      confidentiality: "You shall maintain strict confidentiality and shall not, during your employment or at any time thereafter, disclose to any unauthorized person any trade secrets, customer details, financial data, or business operations of the Company.",
      compliance: "You shall comply with all rules, regulations, guidelines, and policies established by the Company. The Company reserves the right to amend these policies at its discretion.",
      closing: "Please signify your acceptance of this offer by signing and returning the duplicate copy of this letter to the HR Department within seven (7) days from the date of this letter, failing which this offer shall automatically lapse.",
    }
  },
  partTime: {
    title: "Part-Time Crew",
    jobTerms: {
      title: "Part-Time Service Crew",
      department: "Service Department - Bangsar Branch",
      commencementDate: "1st July 2026",
      basicSalary: "12.00", // Hourly
      probationPeriod: "1",
      probationSalary: "12.00",
      noticeProbation: "1 week",
      noticeConfirmed: "1 week",
      workingHours: "Flexible shifts, up to 20 hours per week, scheduled weekly",
      salaryLabel: "Hourly Wage",
      durationLabel: "Trial Period"
    },
    clauses: {
      intro: "We are pleased to offer you employment with CASH CURRY SDN. BHD. (the 'Company') as a Part-Time Crew member. Your employment is subject to the following terms and conditions:",
      duties: "You will be responsible for customer service, cash handling, maintaining cleanliness, and assisting in daily operations under the supervision of the Duty Manager. Your weekly schedule will be planned in coordination with store requirements.",
      confidentiality: "You agree to keep all recipes, operational guides, and customer information confidential. You will not share proprietary materials with external parties.",
      compliance: "You shall adhere to store guidelines, safety protocols, and standard operating procedures at all times during your working shifts.",
      closing: "To accept these part-time terms, please sign and return the copy of this letter within five (5) days.",
    }
  },
  internship: {
    title: "Internship Program",
    jobTerms: {
      title: "Operations & HR Intern",
      department: "Human Resources - HQ Office",
      commencementDate: "1st July 2026",
      basicSalary: "800.00", // Stipend
      probationPeriod: "3", // Duration of internship
      probationSalary: "0.00",
      noticeProbation: "1 week",
      noticeConfirmed: "1 week",
      workingHours: "9:00 AM to 6:00 PM, Monday to Friday",
      salaryLabel: "Monthly Stipend",
      durationLabel: "Internship Duration"
    },
    clauses: {
      intro: "We are pleased to offer you an internship training placement with CASH CURRY SDN. BHD. (the 'Company') under our corporate training scheme. The terms of your internship are detailed below:",
      duties: "This placement is for educational and practical training purposes. You will assist in administrative workflows, attend operational briefings, and participate in projects under the direct mentorship of the HR Lead. This placement does not constitute a contract of employment.",
      confidentiality: "During your placement, you will have access to sensitive business processes. You must maintain absolute confidentiality and must not disclose any proprietary information during or after your internship.",
      compliance: "You are expected to observe the Company's working hours, rules, dress codes, and safety procedures during your training period.",
      closing: "If you accept this internship placement, please sign the acknowledgement and return it to the HR office within seven (7) days.",
    }
  },
  contractor: {
    title: "Independent Contractor",
    jobTerms: {
      title: "Independent Delivery Partner",
      department: "Logistics & Delivery Operations",
      commencementDate: "1st July 2026",
      basicSalary: "4500.00", // Monthly retainer / fee
      probationPeriod: "6", // Contract term in months
      probationSalary: "0.00",
      noticeProbation: "2 weeks",
      noticeConfirmed: "2 weeks",
      workingHours: "Flexible hours, task-based deliverables",
      salaryLabel: "Contract Service Fee",
      durationLabel: "Contract Term"
    },
    clauses: {
      intro: "This letter outlines the terms of engagement under which CASH CURRY SDN. BHD. (the 'Company') retains you as an Independent Service Contractor for logistics and delivery services:",
      duties: "You are engaged to provide professional delivery support. You shall perform the services independently, using your own equipment, vehicle, and methods. This agreement represents a contract for services, not a contract of service (employment). You are not entitled to statutory EPF/SOCSO deductions or standard employment benefits.",
      confidentiality: "You must safeguard all customer delivery addresses, contact details, and route data. You shall not share or utilize customer database information for any purpose other than executing delivery orders.",
      compliance: "You shall perform all services in a safe, professional manner, complying with road safety laws and the Company's partner code of conduct.",
      closing: "Please sign and return this service contract within seven (7) days to confirm your agreement with these contractor terms.",
    }
  }
};

export default function AppointmentLetterGenerator() {
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
        const raw = localStorage.getItem("user");
        if (raw) {
          const u = JSON.parse(raw);
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
    if (!dbSettings) return;
    
    const settingsBasic = dbSettings.basic || {};
    const branchBasic = dbBranch || {};

    setCompanyDetails(prev => {
      let addressLine1 = prev.addressLine1;
      let addressLine2 = prev.addressLine2;
      
      const addr = branchBasic.address || settingsBasic.address || {};
      if (addr.line1) {
        addressLine1 = addr.line1;
        const cityStatePostcode = [addr.postcode, addr.city, addr.state].filter(Boolean).join(", ");
        addressLine2 = cityStatePostcode || addr.city || "";
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
        name: settingsBasic.companyName || prev.name,
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
      // Clean allowances if internship or contractor as default
      if (type === "internship" || type === "contractor") {
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

  const formatCurrency = (amount) => {
    const parsed = parseFloat(amount);
    if (isNaN(parsed)) return "RM0.00";
    
    // Hourly rates show decimal, stipend/basic salary might be cleaner
    if (templateType === "partTime") {
      return `RM${parsed.toFixed(2)}/hour`;
    }
    return `RM${parsed.toFixed(2)}`;
  };

  // --- Draft Storage Logic ---
  const handleSaveDraft = () => {
    if (!draftName.trim()) {
      alert("Please enter a name for the draft.");
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
    alert(`Draft "${newDraft.name}" saved successfully!`);
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
      alert(`Draft "${draft.name}" loaded successfully.`);
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
      alert("Please draw your signature before saving.");
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

  // --- PDF Generation Logic ---
  const handlePrint = async () => {
    if (!letterRef.current) return;
    setIsGenerating(true);

    try {
      // Render the A4 container to a PNG, filtering out the visual page break lines
      const dataUrl = await toPng(letterRef.current, { 
        quality: 1.0, 
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        filter: (node) => {
          if (node.classList && node.classList.contains('pdf-exclude')) {
            return false;
          }
          return true;
        }
      });
      
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });
      
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      const imgWidth = pageWidth;
      const imgHeight = (letterRef.current.offsetHeight * imgWidth) / letterRef.current.offsetWidth;
      
      let heightLeft = imgHeight;
      let position = 0;
      let pageNum = 1;

      // Add the first A4 page
      pdf.addImage(dataUrl, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      
      // If the content overflows, add subsequent standard A4 pages
      while (heightLeft > 0) {
        position = - (pageNum * pageHeight);
        pdf.addPage();
        pdf.addImage(dataUrl, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
        pageNum++;
      }
      
      const sanitizedName = employeeDetails.name.toLowerCase().replace(/[^a-z0-9]/g, "_");
      pdf.save(`appointment_letter_${sanitizedName}.pdf`);
    } catch (err) {
      console.error('Failed to generate PDF', err);
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
    <div className="min-h-screen bg-slate-50/60 p-4 md:p-6 flex flex-col xl:flex-row gap-6 print:bg-white print:p-0 print:m-0">
      
      {/* 1. Left Panel - Premium SaaS Dashboard Form */}
      <div className="w-full xl:w-[460px] shrink-0 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col h-fit xl:max-h-[92vh] print:hidden">
        
        {/* Header bar */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/30 rounded-t-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-mint-500 text-white shadow-sm shadow-mint-200">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800 tracking-tight">Contract Builder</h2>
              <p className="text-[11px] text-slate-500 font-medium">Create premium corporate letters</p>
            </div>
          </div>
          <span className="text-[10px] bg-mint-50 text-mint-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">v2.0</span>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-100 bg-slate-50/10 text-xs font-semibold overflow-x-auto select-none styled-scrollbar shrink-0">
          <button 
            onClick={() => setActiveTab("style")}
            className={`flex-1 min-w-[75px] py-3 text-center border-b-2 transition-colors cursor-pointer ${
              activeTab === "style" ? "border-mint-600 text-mint-700 bg-mint-50/10" : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50/50"
            }`}
          >
            <Palette className="w-3.5 h-3.5 mx-auto mb-1" />
            Style & Draft
          </button>
          <button 
            onClick={() => setActiveTab("parties")}
            className={`flex-1 min-w-[75px] py-3 text-center border-b-2 transition-colors cursor-pointer ${
              activeTab === "parties" ? "border-mint-600 text-mint-700 bg-mint-50/10" : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50/50"
            }`}
          >
            <Building className="w-3.5 h-3.5 mx-auto mb-1" />
            Parties
          </button>
          <button 
            onClick={() => setActiveTab("terms")}
            className={`flex-1 min-w-[75px] py-3 text-center border-b-2 transition-colors cursor-pointer ${
              activeTab === "terms" ? "border-mint-600 text-mint-700 bg-mint-50/10" : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50/50"
            }`}
          >
            <Briefcase className="w-3.5 h-3.5 mx-auto mb-1" />
            Job Terms
          </button>
          <button 
            onClick={() => setActiveTab("signatures")}
            className={`flex-1 min-w-[75px] py-3 text-center border-b-2 transition-colors cursor-pointer ${
              activeTab === "signatures" ? "border-mint-600 text-mint-700 bg-mint-50/10" : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50/50"
            }`}
          >
            <PenTool className="w-3.5 h-3.5 mx-auto mb-1" />
            Signature
          </button>
          <button 
            onClick={() => setActiveTab("clauses")}
            className={`flex-1 min-w-[75px] py-3 text-center border-b-2 transition-colors cursor-pointer ${
              activeTab === "clauses" ? "border-mint-600 text-mint-700 bg-mint-50/10" : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50/50"
            }`}
          >
            <Layers className="w-3.5 h-3.5 mx-auto mb-1" />
            Clauses
          </button>
        </div>

        {/* Tab Content Panels */}
        <div className="p-5 space-y-4 overflow-y-auto max-h-[60vh] xl:max-h-[62vh] styled-scrollbar flex-1">
          
          {/* TAB: STYLE & DRAFT */}
          {activeTab === "style" && (
            <div className="space-y-5">
              {/* Template Selection */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Contract Template</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.keys(TEMPLATES).map((key) => (
                    <button
                      key={key}
                      onClick={() => handleTemplateChange(key)}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-semibold text-left transition-all cursor-pointer ${
                        templateType === key
                          ? "border-mint-600 bg-mint-50/20 text-mint-800 shadow-sm"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-800"
                      }`}
                    >
                      {TEMPLATES[key].title}
                    </button>
                  ))}
                </div>
              </div>

              {/* Typography & Layout styling */}
              <div className="border-t border-slate-100 pt-4 space-y-3">
                <h3 className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5"><Palette className="w-4 h-4 text-mint-600" /> Document Typography & Margin</h3>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Font Family</label>
                    <select 
                      value={stylingOptions.fontFamily}
                      onChange={(e) => setStylingOptions({...stylingOptions, fontFamily: e.target.value})}
                      className="w-full text-xs font-semibold border border-slate-200 p-2 rounded-lg bg-white outline-none focus:border-mint-500"
                    >
                      <option value="serif">Elegant Serif (Times)</option>
                      <option value="sans">Modern Sans (Inter)</option>
                      <option value="mono">Clean Monospace (Courier)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Font Size</label>
                    <select 
                      value={stylingOptions.fontSize}
                      onChange={(e) => setStylingOptions({...stylingOptions, fontSize: e.target.value})}
                      className="w-full text-xs font-semibold border border-slate-200 p-2 rounded-lg bg-white outline-none focus:border-mint-500"
                    >
                      <option value="12px">Small (12px)</option>
                      <option value="13px">Medium (13px)</option>
                      <option value="14px">Large (14px)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Page Margin</label>
                    <select 
                      value={stylingOptions.marginSize}
                      onChange={(e) => setStylingOptions({...stylingOptions, marginSize: e.target.value})}
                      className="w-full text-xs font-semibold border border-slate-200 p-2 rounded-lg bg-white outline-none focus:border-mint-500"
                    >
                      <option value="15mm">Compact (15mm)</option>
                      <option value="20mm">Standard (20mm)</option>
                      <option value="25mm">Wide (25mm)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Accent Line Color</label>
                    <select 
                      value={stylingOptions.accentColor}
                      onChange={(e) => setStylingOptions({...stylingOptions, accentColor: e.target.value})}
                      className="w-full text-xs font-semibold border border-slate-200 p-2 rounded-lg bg-white outline-none focus:border-mint-500"
                    >
                      <option value="#059669">Mint Green</option>
                      <option value="#1e293b">Dark Slate</option>
                      <option value="#1e3a8a">Royal Navy</option>
                      <option value="#000000">Deep Black</option>
                      <option value="transparent">None (Invisible)</option>
                    </select>
                  </div>
                </div>

                {/* Toggles */}
                <div className="flex flex-col gap-2 pt-1">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={stylingOptions.showWatermark}
                      onChange={(e) => setStylingOptions({...stylingOptions, showWatermark: e.target.checked})}
                      className="rounded text-mint-600 focus:ring-mint-500 w-4 h-4 cursor-pointer"
                    />
                    Enable Slanted Background Watermark
                  </label>
                  
                  {stylingOptions.showWatermark && (
                    <input 
                      type="text" 
                      className="ml-6 text-xs font-medium border border-slate-200 p-2 rounded-lg text-black bg-white focus:ring-2 focus:ring-mint-500/10 focus:border-mint-500 outline-none" 
                      placeholder="Watermark Text" 
                      value={letterMeta.watermarkText} 
                      onChange={(e) => setLetterMeta({...letterMeta, watermarkText: e.target.value})} 
                    />
                  )}

                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={stylingOptions.showLetterheadBorder}
                      onChange={(e) => setStylingOptions({...stylingOptions, showLetterheadBorder: e.target.checked})}
                      className="rounded text-mint-600 focus:ring-mint-500 w-4 h-4 cursor-pointer"
                    />
                    Show Divider Line on Letterhead
                  </label>
                </div>
              </div>

              {/* Draft Save & Load panel */}
              <div className="border-t border-slate-100 pt-4 space-y-3">
                <h3 className="text-xs font-bold text-slate-800 mb-1.5 flex items-center gap-1.5"><Save className="w-4 h-4 text-mint-600" /> Save / Load Contract Drafts</h3>
                
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    className="flex-1 text-xs font-semibold border border-slate-200 p-2.5 rounded-lg text-black bg-white focus:ring-2 focus:ring-mint-500/10 focus:border-mint-500 outline-none" 
                    placeholder="Enter Draft Name (e.g. Faiz PM)" 
                    value={draftName} 
                    onChange={(e) => setDraftName(e.target.value)} 
                  />
                  <button 
                    onClick={handleSaveDraft}
                    className="bg-mint-600 hover:bg-mint-700 text-white text-xs font-bold px-4 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" /> Save
                  </button>
                </div>

                {savedDrafts.length > 0 ? (
                  <div className="border border-slate-100 rounded-xl max-h-36 overflow-y-auto divide-y divide-slate-100 styled-scrollbar">
                    {savedDrafts.map((draft) => (
                      <div 
                        key={draft.id}
                        onClick={() => handleLoadDraft(draft.id)}
                        className={`p-2.5 flex justify-between items-center hover:bg-slate-50 cursor-pointer transition-colors ${
                          selectedDraft === draft.id ? "bg-mint-50/30" : ""
                        }`}
                      >
                        <div className="text-left">
                          <p className="text-xs font-semibold text-slate-800">{draft.name}</p>
                          <p className="text-[9px] text-slate-400 font-medium">Saved: {draft.savedAt}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[8px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded uppercase font-bold">
                            {draft.templateType}
                          </span>
                          <button
                            onClick={(e) => handleDeleteDraft(draft.id, e)}
                            className="text-slate-400 hover:text-red-500 p-1 rounded transition-colors cursor-pointer"
                            title="Delete draft"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400 font-medium italic text-center py-2 bg-slate-50/50 rounded-lg border border-dashed border-slate-100">
                    No saved drafts found in your browser
                  </p>
                )}
              </div>
            </div>
          )}

          {/* TAB: PARTIES */}
          {activeTab === "parties" && (
            <div className="space-y-4">
              {/* Company Details Card */}
              <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 space-y-3 text-left">
                <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5"><Building className="w-4 h-4 text-mint-600" /> Employer Details (Letterhead)</h3>
                
                {/* Logo Upload */}
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Company Logo</label>
                  {logo ? (
                    <div className="flex items-center gap-3 p-2 bg-white border border-slate-100 rounded-lg">
                      
                      <img src={logo} alt="Logo" className="h-10 w-16 object-contain border rounded bg-slate-50" />
                      <button 
                        onClick={() => setLogo(null)}
                        className="text-xs font-semibold text-red-500 hover:text-red-600 flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Remove Logo
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center border border-dashed border-slate-200 bg-white rounded-xl p-3 hover:bg-slate-50 transition-colors cursor-pointer group">
                      <Upload className="w-4.5 h-4.5 text-slate-400 group-hover:text-mint-600 mb-1" />
                      <span className="text-xs font-medium text-slate-600">Upload corporate logo</span>
                      <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                    </label>
                  )}
                </div>

                <input 
                  type="text" 
                  className="w-full text-xs font-medium border border-slate-200 p-2.5 rounded-lg text-black bg-white focus:ring-2 focus:ring-mint-500/10 focus:border-mint-500 outline-none" 
                  placeholder="Company Name" 
                  value={companyDetails.name} 
                  onChange={(e) => setCompanyDetails({...companyDetails, name: e.target.value})} 
                />
                <input 
                  type="text" 
                  className="w-full text-xs font-medium border border-slate-200 p-2.5 rounded-lg text-black bg-white focus:ring-2 focus:ring-mint-500/10 focus:border-mint-500 outline-none" 
                  placeholder="Registration No." 
                  value={companyDetails.registrationNo} 
                  onChange={(e) => setCompanyDetails({...companyDetails, registrationNo: e.target.value})} 
                />
                <input 
                  type="text" 
                  className="w-full text-xs font-medium border border-slate-200 p-2.5 rounded-lg text-black bg-white focus:ring-2 focus:ring-mint-500/10 focus:border-mint-500 outline-none" 
                  placeholder="Address Line 1" 
                  value={companyDetails.addressLine1} 
                  onChange={(e) => setCompanyDetails({...companyDetails, addressLine1: e.target.value})} 
                />
                <input 
                  type="text" 
                  className="w-full text-xs font-medium border border-slate-200 p-2.5 rounded-lg text-black bg-white focus:ring-2 focus:ring-mint-500/10 focus:border-mint-500 outline-none" 
                  placeholder="Address Line 2" 
                  value={companyDetails.addressLine2} 
                  onChange={(e) => setCompanyDetails({...companyDetails, addressLine2: e.target.value})} 
                />
                <input 
                  type="text" 
                  className="w-full text-xs font-medium border border-slate-200 p-2.5 rounded-lg text-black bg-white focus:ring-2 focus:ring-mint-500/10 focus:border-mint-500 outline-none" 
                  placeholder="Contact details" 
                  value={companyDetails.phoneEmail} 
                  onChange={(e) => setCompanyDetails({...companyDetails, phoneEmail: e.target.value})} 
                />
              </div>

              {/* Employee Details Card */}
              <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 space-y-3 text-left">
                <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5"><User className="w-4 h-4 text-mint-600" /> Employee / Candidate Details</h3>
                <input 
                  type="text" 
                  className="w-full text-xs font-medium border border-slate-200 p-2.5 rounded-lg text-black bg-white focus:ring-2 focus:ring-mint-500/10 focus:border-mint-500 outline-none" 
                  placeholder="Full Name (as per IC / Passport)" 
                  value={employeeDetails.name} 
                  onChange={(e) => setEmployeeDetails({...employeeDetails, name: e.target.value})} 
                />
                <input 
                  type="text" 
                  className="w-full text-xs font-medium border border-slate-200 p-2.5 rounded-lg text-black bg-white focus:ring-2 focus:ring-mint-500/10 focus:border-mint-500 outline-none" 
                  placeholder="IC / Passport Number" 
                  value={employeeDetails.icPassport} 
                  onChange={(e) => setEmployeeDetails({...employeeDetails, icPassport: e.target.value})} 
                />
                <input 
                  type="text" 
                  className="w-full text-xs font-medium border border-slate-200 p-2.5 rounded-lg text-black bg-white focus:ring-2 focus:ring-mint-500/10 focus:border-mint-500 outline-none" 
                  placeholder="Residential Address Line 1" 
                  value={employeeDetails.addressLine1} 
                  onChange={(e) => setEmployeeDetails({...employeeDetails, addressLine1: e.target.value})} 
                />
                <input 
                  type="text" 
                  className="w-full text-xs font-medium border border-slate-200 p-2.5 rounded-lg text-black bg-white focus:ring-2 focus:ring-mint-500/10 focus:border-mint-500 outline-none" 
                  placeholder="Residential Address Line 2" 
                  value={employeeDetails.addressLine2} 
                  onChange={(e) => setEmployeeDetails({...employeeDetails, addressLine2: e.target.value})} 
                />
              </div>

              {/* Meta information */}
              <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 grid grid-cols-2 gap-3 text-left">
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Ref Number</label>
                  <input 
                    type="text" 
                    className="w-full text-xs font-medium border border-slate-200 p-2.5 rounded-lg text-black bg-white focus:ring-2 focus:ring-mint-500/10" 
                    value={letterMeta.refNo} 
                    onChange={(e) => setLetterMeta({...letterMeta, refNo: e.target.value})} 
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Letter Date</label>
                  <input 
                    type="text" 
                    className="w-full text-xs font-medium border border-slate-200 p-2.5 rounded-lg text-black bg-white focus:ring-2 focus:ring-mint-500/10" 
                    value={letterMeta.date} 
                    onChange={(e) => setLetterMeta({...letterMeta, date: e.target.value})} 
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB: TERMS & SALARY */}
          {activeTab === "terms" && (
            <div className="space-y-4">
              
              {/* Job Terms Card */}
              <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 space-y-3 text-left">
                <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5"><Briefcase className="w-4 h-4 text-mint-600" /> Position & Service Details</h3>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Job Title</label>
                    <input 
                      type="text" 
                      className="w-full text-xs font-medium border border-slate-200 p-2.5 rounded-lg text-black bg-white focus:ring-2" 
                      value={jobTerms.title} 
                      onChange={(e) => setJobTerms({...jobTerms, title: e.target.value})} 
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Branch / Dept</label>
                    <input 
                      type="text" 
                      className="w-full text-xs font-medium border border-slate-200 p-2.5 rounded-lg text-black bg-white focus:ring-2" 
                      value={jobTerms.department} 
                      onChange={(e) => setJobTerms({...jobTerms, department: e.target.value})} 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Start Date</label>
                    <input 
                      type="text" 
                      className="w-full text-xs font-medium border border-slate-200 p-2.5 rounded-lg text-black bg-white focus:ring-2" 
                      value={jobTerms.commencementDate} 
                      onChange={(e) => setJobTerms({...jobTerms, commencementDate: e.target.value})} 
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">{jobTerms.durationLabel || "Duration"}</label>
                    <input 
                      type="text" 
                      className="w-full text-xs font-medium border border-slate-200 p-2.5 rounded-lg text-black bg-white focus:ring-2" 
                      placeholder="e.g. 3 months" 
                      value={jobTerms.probationPeriod} 
                      onChange={(e) => setJobTerms({...jobTerms, probationPeriod: e.target.value})} 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">{jobTerms.salaryLabel || "Salary"} (RM)</label>
                    <input 
                      type="number" 
                      className="w-full text-xs font-medium border border-slate-200 p-2.5 rounded-lg text-black bg-white focus:ring-2" 
                      value={jobTerms.basicSalary} 
                      onChange={(e) => setJobTerms({...jobTerms, basicSalary: e.target.value})} 
                    />
                  </div>
                  {templateType !== "internship" && templateType !== "contractor" && (
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Probation Basic (RM)</label>
                      <input 
                        type="number" 
                        className="w-full text-xs font-medium border border-slate-200 p-2.5 rounded-lg text-black bg-white focus:ring-2" 
                        value={jobTerms.probationSalary} 
                        onChange={(e) => setJobTerms({...jobTerms, probationSalary: e.target.value})} 
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Working Hours Details</label>
                  <input 
                    type="text" 
                    className="w-full text-xs font-medium border border-slate-200 p-2.5 rounded-lg text-black bg-white focus:ring-2" 
                    value={jobTerms.workingHours} 
                    onChange={(e) => setJobTerms({...jobTerms, workingHours: e.target.value})} 
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Notice (Trial / Prob.)</label>
                    <input 
                      type="text" 
                      className="w-full text-xs font-medium border border-slate-200 p-2.5 rounded-lg text-black bg-white focus:ring-2" 
                      value={jobTerms.noticeProbation} 
                      onChange={(e) => setJobTerms({...jobTerms, noticeProbation: e.target.value})} 
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Notice (Confirmed / Term)</label>
                    <input 
                      type="text" 
                      className="w-full text-xs font-medium border border-slate-200 p-2.5 rounded-lg text-black bg-white focus:ring-2" 
                      value={jobTerms.noticeConfirmed} 
                      onChange={(e) => setJobTerms({...jobTerms, noticeConfirmed: e.target.value})} 
                    />
                  </div>
                </div>
              </div>

              {/* Allowances Card */}
              {templateType !== "internship" && templateType !== "contractor" && (
                <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 space-y-3 text-left">
                  <h3 className="text-xs font-bold text-slate-800 flex items-center justify-between">
                    <span className="flex items-center gap-1.5"><DollarSign className="w-4 h-4 text-mint-600" /> Monthly Allowances</span>
                    <button 
                      onClick={addAllowance} 
                      className="bg-mint-600 hover:bg-mint-700 text-white text-[10px] font-bold px-2 py-1 rounded flex items-center gap-0.5 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3 h-3" /> Add
                    </button>
                  </h3>

                  {allowances.length > 0 ? (
                    <div className="space-y-2">
                      {allowances.map((al, idx) => (
                        <div key={idx} className="flex gap-2 items-center bg-white p-2 rounded-lg border border-slate-100">
                          <input 
                            type="text" 
                            className="w-3/5 text-xs font-medium border border-slate-200 p-2 rounded-lg text-black outline-none focus:border-mint-500" 
                            placeholder="e.g. Travel" 
                            value={al.name} 
                            onChange={(e) => handleAllowanceChange(idx, "name", e.target.value)} 
                          />
                          <input 
                            type="number" 
                            className="w-2/5 text-xs font-medium border border-slate-200 p-2 rounded-lg text-black outline-none focus:border-mint-500" 
                            placeholder="RM" 
                            value={al.amount} 
                            onChange={(e) => handleAllowanceChange(idx, "amount", e.target.value)} 
                          />
                          <button 
                            onClick={() => removeAllowance(idx)} 
                            className="text-slate-400 hover:text-red-500 p-1 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400 font-medium italic text-center py-2 bg-white rounded-lg border border-dashed border-slate-100">
                      No allowances added yet. Click Add to insert one.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB: SIGNATURES & STAMP */}
          {activeTab === "signatures" && (
            <div className="space-y-4">
              
              {/* Authorized Signatory Details */}
              <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 space-y-3 text-left">
                <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5"><FileCheck className="w-4 h-4 text-mint-600" /> Employer Sign-Off Details</h3>
                
                <input 
                  type="text" 
                  className="w-full text-xs font-medium border border-slate-200 p-2.5 rounded-lg text-black bg-white focus:ring-2" 
                  placeholder="Manager's Full Name" 
                  value={signatory.name} 
                  onChange={(e) => setSignatory({...signatory, name: e.target.value})} 
                />
                <input 
                  type="text" 
                  className="w-full text-xs font-medium border border-slate-200 p-2.5 rounded-lg text-black bg-white focus:ring-2" 
                  placeholder="Designation (e.g. HR Director)" 
                  value={signatory.title} 
                  onChange={(e) => setSignatory({...signatory, title: e.target.value})} 
                />

                {/* Draw Signatory Signature */}
                <div className="pt-2">
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Employer Signature (Digital)</label>
                  {signatorySignature ? (
                    <div className="flex items-center gap-3 p-2 bg-white border border-slate-100 rounded-lg">
                      
                      <img src={signatorySignature} alt="Employer Sign" className="h-10 w-24 object-contain border rounded bg-slate-50" />
                      <button 
                        onClick={() => setSignatorySignature(null)}
                        className="text-xs font-semibold text-red-500 hover:text-red-600 flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Remove
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => openSignaturePad("signatory")}
                      className="w-full py-2 bg-white border border-dashed border-slate-200 hover:bg-mint-50 hover:text-mint-700 text-slate-600 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <PenTool className="w-4 h-4" /> Draw Digital Signature
                    </button>
                  )}
                </div>
              </div>

              {/* Employee Signature Details */}
              <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 space-y-3 text-left">
                <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5"><User className="w-4 h-4 text-mint-600" /> Employee Signature (Digital)</h3>
                <p className="text-[10px] text-slate-400 font-medium leading-normal">
                  If the candidate is signing in person (e.g. at a branch kiosk), they can sign directly on screen to be embedded into the contract immediately.
                </p>
                
                {employeeSignature ? (
                  <div className="flex items-center gap-3 p-2 bg-white border border-slate-100 rounded-lg">
                    
                    <img src={employeeSignature} alt="Employee Sign" className="h-10 w-24 object-contain border rounded bg-slate-50" />
                    <button 
                      onClick={() => setEmployeeSignature(null)}
                      className="text-xs font-semibold text-red-500 hover:text-red-600 flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Remove
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => openSignaturePad("employee")}
                    className="w-full py-2 bg-white border border-dashed border-slate-200 hover:bg-mint-50 hover:text-mint-700 text-slate-600 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <PenTool className="w-4 h-4" /> Candidate Sign Here
                  </button>
                )}
              </div>

              {/* Corporate Stamp / Seal Upload */}
              <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 space-y-3 text-left">
                <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5"><Building className="w-4 h-4 text-mint-600" /> Official Corporate Stamp / Seal</h3>
                <p className="text-[10px] text-slate-400 font-medium leading-normal">
                  Upload a transparent PNG stamp or seal image. It will be stamped over the employer signature block with a realistic offset.
                </p>

                {stamp ? (
                  <div className="flex items-center gap-3 p-2 bg-white border border-slate-100 rounded-lg">
                    
                    <img src={stamp} alt="Corporate Stamp" className="h-12 w-12 object-contain border rounded bg-slate-50" />
                    <button 
                      onClick={() => setStamp(null)}
                      className="text-xs font-semibold text-red-500 hover:text-red-600 flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Remove Stamp
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center border border-dashed border-slate-200 bg-white rounded-xl p-3 hover:bg-slate-50 transition-colors cursor-pointer group">
                    <Upload className="w-4.5 h-4.5 text-slate-400 group-hover:text-mint-600 mb-1" />
                    <span className="text-xs font-medium text-slate-600">Upload corporate stamp image</span>
                    <input type="file" accept="image/*" onChange={handleStampUpload} className="hidden" />
                  </label>
                )}
              </div>
            </div>
          )}

          {/* TAB: CLAUSES */}
          {activeTab === "clauses" && (
            <div className="space-y-4 text-left">
              <div className="flex items-center gap-2 text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-100">
                <Info className="w-5 h-5 text-mint-600 shrink-0" />
                <p className="text-[10px] font-medium leading-normal">
                  These paragraphs form the core of the contract body. You can modify their texts below to fit your company policies.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Introduction Clause</label>
                  <textarea 
                    className="w-full text-xs font-medium border border-slate-200 p-2 rounded-lg text-black bg-white focus:ring-2 outline-none focus:border-mint-500" 
                    rows={3} 
                    value={clauses.intro} 
                    onChange={(e) => setClauses({...clauses, intro: e.target.value})} 
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Duties & Performance Clause</label>
                  <textarea 
                    className="w-full text-xs font-medium border border-slate-200 p-2 rounded-lg text-black bg-white focus:ring-2 outline-none focus:border-mint-500" 
                    rows={4} 
                    value={clauses.duties} 
                    onChange={(e) => setClauses({...clauses, duties: e.target.value})} 
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Confidentiality Clause</label>
                  <textarea 
                    className="w-full text-xs font-medium border border-slate-200 p-2 rounded-lg text-black bg-white focus:ring-2 outline-none focus:border-mint-500" 
                    rows={4} 
                    value={clauses.confidentiality} 
                    onChange={(e) => setClauses({...clauses, confidentiality: e.target.value})} 
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Rules & Guidelines Compliance</label>
                  <textarea 
                    className="w-full text-xs font-medium border border-slate-200 p-2 rounded-lg text-black bg-white focus:ring-2 outline-none focus:border-mint-500" 
                    rows={3} 
                    value={clauses.compliance} 
                    onChange={(e) => setClauses({...clauses, compliance: e.target.value})} 
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Acceptance Closing Block</label>
                  <textarea 
                    className="w-full text-xs font-medium border border-slate-200 p-2 rounded-lg text-black bg-white focus:ring-2 outline-none focus:border-mint-500" 
                    rows={3} 
                    value={clauses.closing} 
                    onChange={(e) => setClauses({...clauses, closing: e.target.value})} 
                  />
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer print action button */}
        <div className="p-5 border-t border-slate-100 bg-slate-50/20 rounded-b-2xl shrink-0">
          <button 
            onClick={handlePrint} 
            disabled={isGenerating}
            className={`w-full text-white font-bold py-3.5 px-4 rounded-xl shadow-sm flex items-center justify-center gap-2 transition-all duration-300 cursor-pointer ${
              isGenerating 
                ? 'bg-slate-400 cursor-not-allowed' 
                : 'bg-mint-600 hover:bg-mint-700 hover:shadow-md'
            }`}
          >
            <Printer className="w-5 h-5" />
            {isGenerating ? 'Generating PDF...' : 'Print / Save as PDF'}
          </button>
        </div>
      </div>

      {/* 2. Right Panel - Beautiful A4 Live Preview Pane */}
      <div className="flex-1 flex justify-center overflow-x-auto p-2 bg-slate-100/30 border border-slate-200/40 rounded-2xl print:bg-white print:p-0 print:border-none print:w-full print:block">
        
        {/* A4 Virtual Page Container */}
        <div 
          ref={letterRef} 
          className={`bg-white shadow-md print:shadow-none w-[210mm] min-h-[297mm] box-border text-black leading-relaxed flex flex-col relative ${fontClass}`} 
          style={{ 
            backgroundColor: 'white',
            padding: stylingOptions.marginSize,
            fontSize: stylingOptions.fontSize,
            lineHeight: stylingOptions.lineHeight
          }}
        >
          {/* Visual Page Break Guidelines in Editor (Hidden in Print and PDF) */}
          <div className="absolute inset-0 pointer-events-none z-30 print:hidden select-none pdf-exclude">
            {/* Page 1 Break at 297mm */}
            <div 
              className="absolute left-0 right-0 border-t border-dashed border-red-300 flex justify-end" 
              style={{ top: "297mm" }}
            >
              <span className="bg-red-50 text-red-500 text-[9px] font-bold px-2 py-0.5 rounded-bl border-l border-b border-red-100 uppercase tracking-wider shadow-sm">
                Page 1 / Page 2 Break
              </span>
            </div>
            
            {/* Page 2 Break at 594mm */}
            <div 
              className="absolute left-0 right-0 border-t border-dashed border-red-300 flex justify-end" 
              style={{ top: "594mm" }}
            >
              <span className="bg-red-50 text-red-500 text-[9px] font-bold px-2 py-0.5 rounded-bl border-l border-b border-red-100 uppercase tracking-wider shadow-sm">
                Page 2 / Page 3 Break
              </span>
            </div>
          </div>
          
          {/* Background Slanted Watermark */}
          {stylingOptions.showWatermark && letterMeta.watermarkText && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden z-0">
              <div 
                className="font-sans font-black tracking-[0.15em] text-slate-400/8 text-[82px] uppercase whitespace-nowrap rotate-[-40deg] opacity-60"
                style={{ transform: "rotate(-40deg) scale(1.1)" }}
              >
                {letterMeta.watermarkText}
              </div>
            </div>
          )}

          {/* Letterhead Header Section */}
          <div 
            className="flex items-start justify-between pb-5 mb-6 z-10"
            style={{ 
              borderBottomWidth: stylingOptions.showLetterheadBorder ? "2px" : "0px",
              borderColor: stylingOptions.accentColor 
            }}
          >
            <div className="flex-1 text-left">
              {logo ? (
                
                <img src={logo} alt="Company Logo" className="h-14 max-w-[220px] object-contain object-left mb-3" />
              ) : (
                <div className="h-12 w-32 bg-slate-100 border border-slate-200 border-dashed rounded-lg flex items-center justify-center text-[10px] font-sans text-slate-400 mb-3 print:hidden select-none">
                  Letterhead Logo Place
                </div>
              )}
              
              <h1 className="font-bold text-[16px] leading-tight tracking-tight uppercase">
                {companyDetails.name}
              </h1>
              <p className="text-[9.5px] font-sans text-slate-600 font-semibold tracking-wide mt-0.5">
                Company Registration No: {companyDetails.registrationNo}
              </p>
              <div className="text-[9.5px] font-sans text-slate-500 mt-1 leading-normal">
                <p>{companyDetails.addressLine1}, {companyDetails.addressLine2}</p>
                <p className="mt-0.5 font-medium">{companyDetails.phoneEmail}</p>
              </div>
            </div>
            
            {/* Elegant confidentiality tag */}
            <div className="text-right flex flex-col justify-between h-full pt-1 select-none">
              <span className="font-sans text-[9px] font-bold tracking-[0.25em] text-slate-300 uppercase">
                Strictly Private
              </span>
            </div>
          </div>

          {/* Letter Meta Details */}
          <div className="flex justify-between items-start mb-5 font-sans text-[11.5px] text-slate-700 z-10">
            <div>
              <p><span className="font-semibold">Ref:</span> {letterMeta.refNo || "N/A"}</p>
            </div>
            <div className="text-right">
              <p><span className="font-semibold">Date:</span> {letterMeta.date || "N/A"}</p>
            </div>
          </div>

          {/* Employee Info Block */}
          <div className="mb-5 leading-normal text-left z-10">
            <p className="font-bold uppercase text-[12.5px] tracking-tight">{employeeDetails.name}</p>
            <p className="text-slate-500 font-semibold font-sans text-[11px]">IC / Passport No: {employeeDetails.icPassport}</p>
            <div className="text-slate-700 mt-1">
              <p>{employeeDetails.addressLine1}</p>
              <p>{employeeDetails.addressLine2}</p>
            </div>
          </div>

          {/* Salutation */}
          <div className="mb-4 text-left z-10">
            <p>Dear {employeeDetails.name ? employeeDetails.name.split(" ")[0] : "Candidate"},</p>
          </div>

          {/* Subject Block */}
          <div className="mb-5 border-b border-black/80 pb-1.5 text-left z-10">
            <h2 className="font-bold uppercase tracking-tight text-[13.5px] text-slate-900">
              LETTER OF APPOINTMENT AS {jobTerms.title}
            </h2>
          </div>

          {/* Core Content Body */}
          <div className="space-y-4 text-justify leading-relaxed z-10">
            <p>{clauses.intro}</p>

            {/* Employment Terms Table */}
            <table className="w-full border-collapse my-4 text-[12px] font-sans text-slate-800">
              <tbody>
                <tr className="border-b border-slate-100 align-top">
                  <td className="w-1/3 py-2 pr-2 font-bold text-slate-500 text-[10.5px] uppercase tracking-wider">1. Designation & Dept</td>
                  <td className="w-2/3 py-2 font-semibold text-black">
                    <span className="font-bold text-[12.5px]">{jobTerms.title}</span> &nbsp;|&nbsp; {jobTerms.department}
                  </td>
                </tr>
                <tr className="border-b border-slate-100 align-top">
                  <td className="w-1/3 py-2 pr-2 font-bold text-slate-500 text-[10.5px] uppercase tracking-wider">2. Start Date</td>
                  <td className="w-2/3 py-2 font-semibold text-black">{jobTerms.commencementDate}</td>
                </tr>
                <tr className="border-b border-slate-100 align-top">
                  <td className="w-1/3 py-2 pr-2 font-bold text-slate-500 text-[10.5px] uppercase tracking-wider">
                    3. {jobTerms.salaryLabel || "Monthly Basic"}
                  </td>
                  <td className="w-2/3 py-2 text-black">
                    <span className="font-bold text-[13px]">{formatCurrency(jobTerms.basicSalary)}</span>
                    {templateType === "fullTime" && jobTerms.probationPeriod && parseFloat(jobTerms.probationSalary) > 0 && (
                      <span className="text-slate-500 text-[11px] block mt-0.5 font-medium">
                        (Reduced basic during probation: {formatCurrency(jobTerms.probationSalary)}/month)
                      </span>
                    )}
                    {templateType === "fullTime" && (
                      <span className="text-slate-400 text-[10px] block mt-0.5 font-sans font-semibold uppercase tracking-wider">
                        Subject to statutory EPF / SOCSO deductions
                      </span>
                    )}
                  </td>
                </tr>
                
                {templateType !== "internship" && templateType !== "contractor" && allowances.length > 0 && (
                  <tr className="border-b border-slate-100 align-top">
                    <td className="w-1/3 py-2 pr-2 font-bold text-slate-500 text-[10.5px] uppercase tracking-wider">4. Allowance Packages</td>
                    <td className="w-2/3 py-2 text-black">
                      <ul className="list-disc pl-4 space-y-0.5 font-semibold text-[12px]">
                        {allowances.map((al, idx) => (
                          al.name ? (
                            <li key={idx}>
                              {al.name}: <span className="font-bold">{formatCurrency(al.amount)}</span> per month
                            </li>
                          ) : null
                        ))}
                      </ul>
                    </td>
                  </tr>
                )}
                
                <tr className="border-b border-slate-100 align-top">
                  <td className="w-1/3 py-2 pr-2 font-bold text-slate-500 text-[10.5px] uppercase tracking-wider">
                    5. {jobTerms.durationLabel || "Probation Period"}
                  </td>
                  <td className="w-2/3 py-2 font-semibold text-black">
                    {templateType === "fullTime" || templateType === "partTime" ? `${jobTerms.probationPeriod} Months` : jobTerms.probationPeriod}
                  </td>
                </tr>
                <tr className="border-b border-slate-100 align-top">
                  <td className="w-1/3 py-2 pr-2 font-bold text-slate-500 text-[10.5px] uppercase tracking-wider">6. Service Notice Period</td>
                  <td className="w-2/3 py-2 text-slate-800 text-[11px] leading-normal font-semibold">
                    <p><span className="font-bold text-black text-[11px]">Under Trial/Probation:</span> {jobTerms.noticeProbation} written notice</p>
                    <p className="mt-0.5"><span className="font-bold text-black text-[11px]">Upon Confirmation:</span> {jobTerms.noticeConfirmed} written notice</p>
                  </td>
                </tr>
                <tr className="border-b border-slate-100 align-top">
                  <td className="w-1/3 py-2 pr-2 font-bold text-slate-500 text-[10.5px] uppercase tracking-wider">7. Prescribed Hours</td>
                  <td className="w-2/3 py-2 font-semibold text-black">{jobTerms.workingHours}</td>
                </tr>
              </tbody>
            </table>

            <p><span className="font-bold">8. Duties & Responsibilities:</span> {clauses.duties}</p>
            <p><span className="font-bold">9. Professional Confidentiality:</span> {clauses.confidentiality}</p>
            <p><span className="font-bold">10. Policy Compliance:</span> {clauses.compliance}</p>
            <p>{clauses.closing}</p>
          </div>

          {/* Signatures & Acceptance Section */}
          <div className="mt-auto pt-8 z-10 relative">
            
            {/* Signature Blocks Layout */}
            <div className="grid grid-cols-2 gap-8 pt-8">
              
              {/* Employer Signature Block */}
              <div className="text-left flex flex-col justify-between min-h-[125px] relative">
                <div>
                  <p className="font-medium">Yours sincerely,</p>
                  <p className="font-bold uppercase text-[11px] mt-0.5 text-slate-800">For {companyDetails.name}</p>
                </div>
                
                {/* Embedded drawn signatory signature */}
                <div className="absolute bottom-10 left-4 h-16 w-32 pointer-events-none">
                  {signatorySignature && (
                    
                    <img src={signatorySignature} alt="Employer Signature" className="h-full w-full object-contain" />
                  )}
                </div>

                {/* Overlapping corporate stamp */}
                {stamp && (
                  <div 
                    className="absolute bottom-4 left-20 w-20 h-20 pointer-events-none opacity-85"
                    style={{ transform: "rotate(-8deg)" }}
                  >
                    
                    <img src={stamp} alt="Corporate Stamp" className="h-full w-full object-contain" />
                  </div>
                )}

                <div className="pt-12">
                  <div className="border-b border-black w-48 mb-1"></div>
                  <p className="font-bold text-[11.5px] leading-none">{signatory.name}</p>
                  <p className="text-[9.5px] text-slate-500 font-bold uppercase font-sans tracking-tight mt-1">{signatory.title}</p>
                </div>
              </div>

              {/* Candidate Acceptance Block */}
              <div className="text-left flex flex-col justify-between min-h-[125px] bg-slate-50/35 p-3 rounded-xl border border-slate-100/70 relative print:bg-white print:p-0 print:border-none">
                <div>
                  <p className="font-bold text-[10.5px] uppercase text-slate-800 tracking-wide border-b border-slate-200/80 pb-1 mb-1.5 print:border-none">Acknowledgement & Acceptance</p>
                  <p className="text-[9.5px] leading-relaxed text-slate-500 font-medium font-sans">
                    I, the undersigned, hereby confirm that I have read, understood, and accept this appointment under the terms and conditions outlined in this letter.
                  </p>
                </div>
                
                {/* Embedded drawn employee signature */}
                <div className="absolute bottom-10 left-10 h-16 w-32 pointer-events-none">
                  {employeeSignature && (
                    
                    <img src={employeeSignature} alt="Employee Signature" className="h-full w-full object-contain" />
                  )}
                </div>

                <div className="pt-8">
                  <div className="flex gap-4 mb-2">
                    <div className="flex-1">
                      <div className="border-b border-black w-full mb-1"></div>
                      <p className="text-[8px] font-sans font-bold text-slate-400 uppercase tracking-wider">Candidate Signature</p>
                    </div>
                    <div className="w-24">
                      <div className="border-b border-black w-full mb-1"></div>
                      <p className="text-[8px] font-sans font-bold text-slate-400 uppercase tracking-wider">Date</p>
                    </div>
                  </div>
                </div>
              </div>

            </div>

          </div>
          
        </div>
      </div>

      {/* 3. HTML5 Canvas Signature Pad Drawing Modal */}
      {signatureModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xl w-full max-w-[480px] text-center space-y-4">
            
            {/* Header */}
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 text-left">
              <div>
                <h3 className="text-sm font-bold text-gray-800">
                  Draw Digital Signature
                </h3>
                <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                  Sign using your mouse, trackpad, or touch-screen device
                </p>
              </div>
              <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold capitalize">
                {signatureModal.target === "signatory" ? "Employer" : "Candidate"}
              </span>
            </div>

            {/* Ink Settings */}
            <div className="flex justify-between items-center text-xs font-semibold">
              <span className="text-slate-500">Ink Color:</span>
              <div className="flex gap-2">
                <button 
                  onClick={() => setSignatureModal({ ...signatureModal, inkColor: "#0000ff" })}
                  className={`px-3 py-1 rounded-full border transition-all cursor-pointer ${
                    signatureModal.inkColor === "#0000ff" 
                      ? "border-blue-600 bg-blue-50 text-blue-800" 
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  🔵 Professional Blue
                </button>
                <button 
                  onClick={() => setSignatureModal({ ...signatureModal, inkColor: "#000000" })}
                  className={`px-3 py-1 rounded-full border transition-all cursor-pointer ${
                    signatureModal.inkColor === "#000000" 
                      ? "border-black bg-slate-50 text-black" 
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  ⚫ Official Black
                </button>
              </div>
            </div>

            {/* Canvas Drawing Area */}
            <div className="border border-slate-200 rounded-xl bg-slate-50/50 overflow-hidden relative group">
              <canvas
                ref={canvasRef}
                width={432}
                height={200}
                className="bg-white cursor-crosshair block w-full touch-none"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
              <div className="absolute top-2 right-2 pointer-events-none select-none font-mono text-[9px] font-bold text-slate-300 uppercase border border-slate-100 px-1.5 py-0.5 rounded bg-white/60 backdrop-blur-sm group-hover:opacity-0 transition-opacity">
                Signature Pad
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={clearCanvas}
                className="w-1/4 py-2 border border-slate-200 text-slate-600 text-xs font-bold rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Clear Pad
              </button>
              <button
                onClick={() => setSignatureModal({ ...signatureModal, isOpen: false })}
                className="w-1/4 py-2 border border-slate-200 text-slate-600 text-xs font-bold rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={saveSignature}
                className="w-2/4 py-2 bg-mint-600 hover:bg-mint-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1 transition-colors cursor-pointer"
              >
                <Check className="w-4 h-4" /> Apply Signature
              </button>
            </div>

          </div>
        </div>
      )}

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
  );
}
