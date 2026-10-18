// Predefined templates for different employment types
export const TEMPLATES = {
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
  },
  applicationForm: {
    title: "Job Application Form",
    jobTerms: {
      title: "Service Crew",
      department: "Service Department",
      commencementDate: "",
      basicSalary: "",
      probationPeriod: "",
      probationSalary: "",
      noticeProbation: "",
      noticeConfirmed: "",
      workingHours: "",
      salaryLabel: "",
      durationLabel: ""
    },
    clauses: {
      intro: "",
      duties: "",
      confidentiality: "",
      compliance: "",
      closing: ""
    }
  }
};
