"use client";

import React from "react";
import { useLetter } from "./LetterContext";

export default function LetterPreview() {
  const { letterRef, templateType, logo, stamp, companyDetails, letterMeta, employeeDetails, jobTerms, allowances, signatory, clauses, signatorySignature, employeeSignature, stylingOptions, formatCurrency, fontClass } = useLetter();
  return (
    <>
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
          {templateType === "applicationForm" ? (
            <div className="flex-1 flex flex-col text-left text-slate-800 text-[11px] leading-relaxed relative font-sans p-2 select-none">
              
              {/* PAGE 1: APPLICATION FORM */}
              <div className="flex flex-col min-h-[280mm] relative">
                {/* Header */}
                <div className="flex items-start justify-between border-b pb-4 mb-4">
                  <div>
                    {logo ? (
                      <img src={logo} alt="Company Logo" className="h-12 max-w-[200px] object-contain object-left mb-2" />
                    ) : (
                      <div className="h-10 w-24 bg-slate-100 border border-dashed rounded flex items-center justify-center text-[8px] text-slate-400 mb-2">Company Logo</div>
                    )}
                    <h1 className="font-bold text-[14px] uppercase">{companyDetails.name}</h1>
                    <p className="text-[9px] text-slate-500 font-semibold">Reg No: {companyDetails.registrationNo} | {companyDetails.addressLine1}, {companyDetails.addressLine2}</p>
                  </div>
                  <span className="text-[8px] bg-slate-800 text-white px-2 py-1 rounded font-bold tracking-widest uppercase">Page 1</span>
                </div>

                <div className="text-center mb-4">
                  <h2 className="text-sm font-black tracking-wide border-b border-slate-300 pb-1 uppercase">Employment Application Form</h2>
                  <p className="text-[9px] text-slate-500 italic mt-1">Please fill in all sections in BLOCK letters. This information will remain strictly confidential.</p>
                </div>

                {/* Section A: Personal Details */}
                <div className="mb-4">
                  <div className="bg-slate-800 text-white text-[9px] font-bold px-3 py-1 uppercase rounded-t tracking-wider">Section A: Personal Details</div>
                  <div className="border border-slate-300 grid grid-cols-2 text-[9px]">
                    <div className="col-span-2 border-b border-slate-300 p-2 min-h-[10mm]">
                      <span className="block font-bold text-slate-400 uppercase text-[7px]">Full Name (as per IC / Passport)</span>
                      <div className="h-4"></div>
                    </div>
                    <div className="border-r border-b border-slate-300 p-2 min-h-[10mm]">
                      <span className="block font-bold text-slate-400 uppercase text-[7px]">IC / Passport Number</span>
                      <div className="h-4"></div>
                    </div>
                    <div className="border-b border-slate-300 p-2 min-h-[10mm]">
                      <span className="block font-bold text-slate-400 uppercase text-[7px]">Contact Number (Mobile/WhatsApp)</span>
                      <div className="h-4"></div>
                    </div>
                    <div className="border-r border-slate-300 p-2 min-h-[10mm]">
                      <span className="block font-bold text-slate-400 uppercase text-[7px]">Email Address</span>
                      <div className="h-4"></div>
                    </div>
                    <div className="p-2 min-h-[10mm]">
                      <span className="block font-bold text-slate-400 uppercase text-[7px]">Emergency Contact Name & Phone</span>
                      <div className="h-4"></div>
                    </div>
                    <div className="col-span-2 border-t border-slate-300 p-2 min-h-[12mm]">
                      <span className="block font-bold text-slate-400 uppercase text-[7px]">Residential Address</span>
                      <div className="h-6"></div>
                    </div>
                  </div>
                </div>

                {/* Section B: Position & Expectations */}
                <div className="mb-4">
                  <div className="bg-slate-800 text-white text-[9px] font-bold px-3 py-1 uppercase rounded-t tracking-wider">Section B: Position & Expectations</div>
                  <div className="border border-slate-300 grid grid-cols-2 text-[9px]">
                    <div className="border-r border-b border-slate-300 p-2 min-h-[11mm]">
                      <span className="block font-bold text-slate-400 uppercase text-[7px]">Position Applied For</span>
                      <div className="font-bold text-slate-900 mt-0.5">{[jobTerms.title, jobTerms.department].filter(Boolean).join(" - ") || "Service Crew"}</div>
                    </div>
                    <div className="border-b border-slate-300 p-2 min-h-[11mm]">
                      <span className="block font-bold text-slate-400 uppercase text-[7px]">Expected Monthly Salary (RM)</span>
                      <div className="h-4"></div>
                    </div>
                    <div className="border-r border-slate-300 p-2 min-h-[11mm]">
                      <span className="block font-bold text-slate-400 uppercase text-[7px]">Earliest Commencement Date</span>
                      <div className="h-4"></div>
                    </div>
                    <div className="p-2 min-h-[11mm]">
                      <span className="block font-bold text-slate-400 uppercase text-[7px]">Availability (e.g., Immediate / Notice Period)</span>
                      <div className="h-4"></div>
                    </div>
                  </div>
                </div>

                {/* Section C: Academic Qualifications */}
                <div className="mb-4">
                  <div className="bg-slate-800 text-white text-[9px] font-bold px-3 py-1 uppercase rounded-t tracking-wider">Section C: Academic Qualifications</div>
                  <table className="w-full border-collapse border border-slate-300 text-[8.5px]">
                    <thead>
                      <tr className="bg-slate-100 font-bold border-b border-slate-300 text-slate-700">
                        <th className="border-r border-slate-300 p-1.5 text-left w-[30%]">Level / Degree</th>
                        <th className="border-r border-slate-300 p-1.5 text-left w-[40%]">School / University / Institution</th>
                        <th className="border-r border-slate-300 p-1.5 text-left w-[15%]">Year Graduated</th>
                        <th className="p-1.5 text-left w-[15%]">Grade / GPA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[1, 2, 3].map(i => (
                        <tr key={i} className="border-b border-slate-200">
                          <td className="border-r border-slate-300 p-3"></td>
                          <td className="border-r border-slate-300 p-3"></td>
                          <td className="border-r border-slate-300 p-3"></td>
                          <td className="p-3"></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Section D: Employment History */}
                <div className="mb-4">
                  <div className="bg-slate-800 text-white text-[9px] font-bold px-3 py-1 uppercase rounded-t tracking-wider">Section D: Employment History (Most Recent First)</div>
                  <table className="w-full border-collapse border border-slate-300 text-[8.5px]">
                    <thead>
                      <tr className="bg-slate-100 font-bold border-b border-slate-300 text-slate-700">
                        <th className="border-r border-slate-300 p-1.5 text-left w-[30%]">Company Name</th>
                        <th className="border-r border-slate-300 p-1.5 text-left w-[25%]">Designation</th>
                        <th className="border-r border-slate-300 p-1.5 text-left w-[15%]">Duration</th>
                        <th className="border-r border-slate-300 p-1.5 text-left w-[12%]">Last Salary</th>
                        <th className="p-1.5 text-left w-[18%]">Reason for Leaving</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[1, 2, 3, 4].map(i => (
                        <tr key={i} className="border-b border-slate-200">
                          <td className="border-r border-slate-300 p-3"></td>
                          <td className="border-r border-slate-300 p-3"></td>
                          <td className="border-r border-slate-300 p-3"></td>
                          <td className="border-r border-slate-300 p-3"></td>
                          <td className="p-3"></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Section E: Declaration */}
                <div className="mt-auto pt-4">
                  <div className="bg-slate-800 text-white text-[9px] font-bold px-3 py-1 uppercase rounded-t tracking-wider">Section E: Candidate Declaration</div>
                  <div className="border border-slate-300 p-3 rounded-b bg-slate-50/50 text-[8px] text-slate-600 text-justify">
                    I hereby declare that the information provided in this application is true, complete, and accurate to the best of my knowledge. I understand that any false statement, misrepresentation, or omission of facts may be grounds for immediate rejection of this application or subsequent termination of employment if hired.
                    <div className="flex justify-between items-end mt-6 pt-4 border-t border-slate-200/80">
                      <div className="w-[180px] border-t border-slate-500 text-center pt-1 text-[7px] font-bold text-slate-400 uppercase">Candidate Signature</div>
                      <div className="w-[120px] border-t border-slate-500 text-center pt-1 text-[7px] font-bold text-slate-400 uppercase">Date</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* DOTTED PAGE BREAK SEPARATOR */}
              <div className="my-8 border-t-2 border-dashed border-red-300 flex items-center justify-center relative select-none pdf-exclude">
                <span className="absolute bg-red-50 text-red-500 text-[9px] font-bold px-3 py-1 rounded-full border border-red-100 uppercase tracking-widest shadow-sm">Page 1 / Page 2 Break</span>
              </div>

              {/* PAGE 2: INTERVIEW & EVALUATION */}
              <div className="flex flex-col min-h-[280mm] relative">
                {/* Header */}
                <div className="flex items-start justify-between border-b pb-4 mb-4">
                  <div>
                    <h1 className="font-bold text-[14px] uppercase text-slate-900">{companyDetails.name}</h1>
                    <h2 className="font-bold text-[11px] text-slate-800 uppercase tracking-tight mt-0.5">Interview Evaluation & Negotiation Record</h2>
                    <p className="text-[8px] text-red-500 font-bold uppercase tracking-wider mt-1">For Management Use Only — Do Not Show to Candidate</p>
                  </div>
                  <span className="text-[8px] bg-slate-800 text-white px-2 py-1 rounded font-bold tracking-widest uppercase">Page 2</span>
                </div>

                {/* Candidate & Interviewer Metadata Box */}
                <div className="border border-slate-300 grid grid-cols-2 text-[9px] mb-4">
                  <div className="border-r border-b border-slate-300 p-2 min-h-[10mm]">
                    <span className="block font-bold text-slate-400 uppercase text-[7px]">Candidate Name</span>
                    <div className="h-4"></div>
                  </div>
                  <div className="border-b border-slate-300 p-2 min-h-[10mm]">
                    <span className="block font-bold text-slate-400 uppercase text-[7px]">Date of Interview</span>
                    <div className="h-4"></div>
                  </div>
                  <div className="border-r border-slate-300 p-2 min-h-[10mm]">
                    <span className="block font-bold text-slate-400 uppercase text-[7px]">Interviewer Name(s)</span>
                    <div className="h-4"></div>
                  </div>
                  <div className="p-2 min-h-[10mm]">
                    <span className="block font-bold text-slate-400 uppercase text-[7px]">Proposed Position & Department</span>
                    <div className="font-bold text-slate-900 mt-0.5">{[jobTerms.title, jobTerms.department].filter(Boolean).join(" - ") || "Service Crew"}</div>
                  </div>
                </div>

                {/* Assessment Matrix */}
                <div className="mb-4">
                  <div className="bg-slate-800 text-white text-[9px] font-bold px-3 py-1 uppercase rounded-t tracking-wider">1. Candidate Assessment Matrix</div>
                  <table className="w-full border-collapse border border-slate-300 text-[8.5px]">
                    <thead>
                      <tr className="bg-slate-100 font-bold border-b border-slate-300 text-slate-700">
                        <th className="border-r border-slate-300 p-2 text-left w-[35%]">Evaluation Criteria</th>
                        <th className="border-r border-slate-300 p-2 text-center w-[12%]">Excellent</th>
                        <th className="border-r border-slate-300 p-2 text-center w-[12%]">Good</th>
                        <th className="border-r border-slate-300 p-2 text-center w-[12%]">Average</th>
                        <th className="border-r border-slate-300 p-2 text-center w-[12%]">Poor</th>
                        <th className="p-2 text-left w-[17%]">Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        "Communication & Language",
                        "Appearance & Professionalism",
                        "Technical Skills & Job Knowledge",
                        "Relevant Experience & Background",
                        "Attitude, Motivation & Values"
                      ].map((criterion, idx) => (
                        <tr key={idx} className="border-b border-slate-200">
                          <td className="border-r border-slate-300 p-2 font-semibold text-slate-800">{criterion}</td>
                          <td className="border-r border-slate-300 p-2 text-center text-slate-300 courier font-bold">[ ]</td>
                          <td className="border-r border-slate-300 p-2 text-center text-slate-300 courier font-bold">[ ]</td>
                          <td className="border-r border-slate-300 p-2 text-center text-slate-300 courier font-bold">[ ]</td>
                          <td className="border-r border-slate-300 p-2 text-center text-slate-300 courier font-bold">[ ]</td>
                          <td className="p-2"></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Interview Notes & Salary Negotiation */}
                <div className="mb-4">
                  <div className="bg-slate-800 text-white text-[9px] font-bold px-3 py-1 uppercase rounded-t tracking-wider">2. Interview Notes & Salary Negotiation (Handwritten)</div>
                  <div className="border border-slate-300 p-4 min-h-[35mm] rounded-b bg-slate-50/20 flex flex-col justify-between">
                    {[1, 2, 3, 4, 5].map(i => (
                      <div key={i} className="border-b border-slate-200/60 h-6 w-full"></div>
                    ))}
                  </div>
                </div>

                {/* Final Decision */}
                <div className="mb-4 mt-auto">
                  <div className="bg-slate-800 text-white text-[9px] font-bold px-3 py-1 uppercase rounded-t tracking-wider">3. Final Hiring Decision</div>
                  <div className="border border-slate-300 text-[9px]">
                    <div className="border-b border-slate-300 p-3 bg-slate-50/50">
                      <span className="font-bold text-slate-500 mr-4">STATUS / DECISION:</span>
                      <span className="font-mono text-[10px] font-bold text-slate-400">[ ] APPROVED / HIRE &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; [ ] SHORTLISTED / HOLD &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; [ ] REJECTED</span>
                    </div>
                    <div className="grid grid-cols-2">
                      <div className="border-r border-b border-slate-300 p-2 min-h-[10mm]">
                        <span className="block font-bold text-slate-400 uppercase text-[7px]">Approved Job Title</span>
                        <div className="h-3"></div>
                      </div>
                      <div className="border-b border-slate-300 p-2 min-h-[10mm]">
                        <span className="block font-bold text-slate-400 uppercase text-[7px]">Approved Monthly Basic Salary (RM)</span>
                        <div className="h-3"></div>
                      </div>
                      <div className="border-r border-slate-300 p-2 min-h-[10mm]">
                        <span className="block font-bold text-slate-400 uppercase text-[7px]">Approved Allowances & Probation Terms</span>
                        <div className="h-3"></div>
                      </div>
                      <div className="p-2 min-h-[10mm]">
                        <span className="block font-bold text-slate-400 uppercase text-[7px]">Agreed Commencement Date</span>
                        <div className="h-3"></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Management Sign-offs */}
                <div className="border border-slate-300 grid grid-cols-2 text-[9px]">
                  <div className="border-r p-3 min-h-[22mm] flex flex-col justify-between">
                    <span className="block font-bold text-slate-500 uppercase text-[7px]">Interviewer Sign-Off</span>
                    <div className="flex justify-between items-end border-t border-slate-300 pt-1 text-[7px] font-bold text-slate-400 uppercase">
                      <span>Interviewer Signature</span>
                      <span>Date</span>
                    </div>
                  </div>
                  <div className="p-3 min-h-[22mm] flex flex-col justify-between">
                    <span className="block font-bold text-slate-500 uppercase text-[7px]">Authorized Management Approval</span>
                    <div className="flex justify-between items-end border-t border-slate-300 pt-1 text-[7px] font-bold text-slate-400 uppercase">
                      <span>Authorized Signature</span>
                      <span>Date</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
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
            </>
          )}
          
        </div>
      </div>
    </>
  );
}
