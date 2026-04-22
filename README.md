# Cash Curry v2 🍛

**Cash Curry** is a comprehensive Restaurant Sales and Expense Management System designed to streamline operations across multiple branches. It provides a robust suite of tools for financial tracking, staff management, and administrative oversight.

---

## 🚀 Key Features

### 📊 Financial Management
- **Sales Entry**: Secure recording of daily sales with role-based edit restrictions.
- **Cost & Expense Tracking**: Detailed logging of operational costs and vendor payments.
- **Deposit & Withdrawal Management**: Track cash flow between branches and banks.
- **Purchase Bills**: Manage vendor invoices and partial payment workflows.

### 👥 Staff & HR Portal
- **Attendance Tracking**: Secure, site-enforced clock-in/out system.
- **Advance & Loan Requests**: Dedicated portal for staff to request financial assistance.
- **Supervisor Dashboard**: Specialized tracking for supervisors to monitor the status of staff requests they've initiated.
- **Approval Workflow**: Multi-tier approval system for financial requests (Advances, Loans, Inter-branch transfers).

### 🏢 Multi-Branch Architecture
- **Branch Dashboards**: Real-time insights into branch-specific performance.
- **Company Overview**: High-level reporting for owners and GMs across all locations.
- **Inter-branch Loans**: Seamless tracking of fund transfers between branches with automated FIFO repayment allocation.

### 🛡️ Security & Roles
- **Granular RBAC**: Defined permissions for Owners, GMs, Branch Admins, Managers, Accountants, Supervisors, and Staff.
- **Middleware Protection**: Route-level security ensuring users only access authorized modules.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **Frontend**: React, Tailwind CSS
- **State Management**: Redux Toolkit (RTK Query)
- **Backend-as-a-Service**: Firebase (Firestore, Auth, Storage)
- **Icons**: Lucide React, React Icons
- **Date Utilities**: Date-fns

---

## 📦 Getting Started

### Prerequisites
- Node.js (v18+)
- Firebase Account & Project

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/cash_curry_v2.git
   cd cash_curry_v2
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env.local` file in the root directory and add your Firebase configuration:
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
   ```

4. **Run the development server**:
   ```bash
   npm run dev
   ```

5. **Access the application**:
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📱 PWA Support
Cash Curry is a Progressive Web App. You can install it on your mobile device or desktop for an app-like experience with offline capabilities for critical data.

---

## 📄 License
This project is private and proprietary. All rights reserved.
