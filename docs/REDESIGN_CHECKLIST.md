# Redesign checklist (Phase 3.4)

Every screen in the app, so none is missed. A screen is done when it uses the
UI kit (tokens, cards, fields, toasts, sheets), works on a phone and a
computer, has its own loading look, and its old modals are redone too.
✅ done · 🟡 started · ⬜ not yet · ⏸ left for later. Update this file in the same commit as the screen.

## 3.4.1 Dashboards and home
- ✅ `/` Home
- ✅ `/dashboard` Branch dashboard
- ✅ `/company/dashboard` Company dashboard

## 3.4.2 Entry screens
- ✅ `/entry-data/sales-entry` Sales entry (+ the day's sales sheet, shared with the sales report)
- ✅ `/entry-data/cost-entry` Cost entry (scanner inside is still the old look — 3.5)
- ✅ `/entry-data/deposit-entry` Cash to bank (was "Cash deposit") (+ its record sheet)
- ✅ `/entry-data/cash-withdraw` Bank to cash (was "Cash withdrawal") (+ its record sheet)
- ✅ `/entry-data/advance-entry` Advance & staff loan (+ "waiting to be paid", shared with the requested panel)
- ✅ `/entry-data/salary-entry` Salary entry (salaries outside payroll; guards against counting a month twice, also on payroll's Mark as paid). Moving it under Payroll in the menu waits for 4.1 (Payroll is managers-only today)
- ⏸ `/cash-tracker` Daily cash tracker — skipped for now (owner, 17 Oct 2026); comes back with 4.10 pay-outs (daily cash check)

## 3.4.3 Reports
- ✅ `/reports` Summary report
- ✅ `/reports/sales-report` Sales report (+ day sheet, + change sales sheet)
- ✅ `/reports/cost-report` Cost report (+ edit cost, attachments)
- ✅ `/reports/deposit-report` Cash to bank report
- ✅ `/reports/withdrawal-report` Bank to cash report
- ✅ `/reports/advance-report` Advance report
- ✅ `/reports/salary-report` Salary report
- ✅ `/reports/staff-loan-report` Staff loan report (in the Reports menu)
- ✅ `/reports/yearly-summary` Yearly summary
- ✅ `/reports/yearly-summary/[period]` Yearly statement

## 3.4.4 Approvals and loans
- ✅ `/requested-panel` Requested panel (advances, staff loans, branch loans, OT)
- ✅ `/supervisor-panel` My requests (supervisor)
- ⬜ `/staff-loans` Staff loan tracker
- ⬜ `/loans/request-loan` Request a branch loan
- ⬜ `/loans/loan-updates` Loan updates
- ⬜ `/loans/loan-summary` Loan summary

## 3.4.5 Staff and attendance
- ⬜ `/staff-management` Staff management
- ⬜ `/attendance-log` Attendance log
- ⬜ `/kiosk`, `/kiosk/[branchId]` Kiosk (replaced later by 4.8)

## 3.4.6 Payroll
- ⬜ `/payroll` Run payroll
- ⬜ `/payroll/history` Payroll history

## 3.4.7 Purchases
- ⬜ `/purchases/order-guides` Order guides
- ⬜ `/purchases/purchase-orders` Purchase orders
- ⬜ `/purchases/requisitions` Requisitions
- ⬜ `/purchases/new-bill` New vendor bill
- ⬜ `/purchases/due-bills` Due bills (+ pay bills, edit bill, export)
- ⬜ `/purchases/payments` Payments
- ⬜ `/purchases/vendors` Vendors
- ⬜ `/purchases/items` Items catalog
- ⬜ `/purchases/reports` Purchase report

## 3.4.8 Settings, admin, sign-in, tools
- ⬜ `/settings` Settings (company)
- ⬜ `/settings/user-management` User management
- ⬜ `/branch-settings` Branch settings (owner saw UI problems — 4.1 notes)
- ⬜ `/branches/branch-management`, `/branches/[branchId]` Branches
- ⬜ `/audit-log`, `/branch-audit` Audit logs
- ✅ `/login` Sign in (animated brand side, show/hide password, Caps Lock warning, shake on a wrong try, check before opening)
- ⬜ `/signup`, `/signup/verify`, `/reset-password` Sign-up and password reset
- ⬜ `/unauthorized` — **missing page**: middleware sends people here, today they get the 404
- ⬜ Error and not-found screens (`app/error.jsx`, `app/not-found.jsx`, section `error.js` files)
- ⬜ `/tools/invoice-generator` Invoice generator
- ⬜ `/tools/appointment-letter` Appointment letter (2.7k lines — 3.5)
- ⬜ `/support` Support
- ⬜ `/branch-chat`, `/feeds` Branch chat and feeds (replaced later by 4.4)

## Staff app (Phase 4.6 rebuilds these; restyle only if needed before)
- ⬜ `/staff-portal`, `/requests`, `/chat`, `/profile`

## Not a screen for users
- `/ui` — the kit's preview page
