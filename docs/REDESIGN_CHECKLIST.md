# Redesign checklist (Phase 3.4)

Every screen in the app, so none is missed. A screen is done when it uses the
UI kit (tokens, cards, fields, toasts, sheets), works on a phone and a
computer, has its own loading look, and its old modals are redone too.
✅ done · 🟡 started · ⬜ not yet. Update this file in the same commit as the screen.

## 3.4.1 Dashboards and home
- ✅ `/` Home
- ✅ `/dashboard` Branch dashboard
- ✅ `/company/dashboard` Company dashboard

## 3.4.2 Entry screens
- ✅ `/entry-data/sales-entry` Sales entry (+ the day's sales sheet, shared with the sales report)
- ✅ `/entry-data/cost-entry` Cost entry (scanner inside is still the old look — 3.5)
- ✅ `/entry-data/deposit-entry` Cash deposit (+ its record sheet)
- ✅ `/entry-data/cash-withdraw` Cash withdrawal (+ its record sheet)
- ⬜ `/entry-data/advance-entry` Advance entry
- ⬜ `/entry-data/salary-entry` Salary entry
- ⬜ `/cash-tracker` Daily cash tracker

## 3.4.3 Reports
- ⬜ `/reports` Summary report
- ⬜ `/reports/sales-report` Sales report (its day sheet ✅)
- ⬜ `/reports/cost-report` Cost report (+ edit cost, attachments)
- ⬜ `/reports/deposit-report` Deposit report
- ⬜ `/reports/withdrawal-report` Withdrawal report
- ⬜ `/reports/advance-report` Advance report
- ⬜ `/reports/salary-report` Salary report
- ⬜ `/reports/staff-loan-report` Staff loan report (not in the menu yet — decide)
- ⬜ `/reports/yearly-summary` Yearly summary
- ⬜ `/reports/yearly-summary/[period]` Yearly statement

## 3.4.4 Approvals and loans
- ⬜ `/requested-panel` Requested panel (advances, staff loans, branch loans, OT)
- ⬜ `/supervisor-panel` My requests (supervisor)
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
- ⬜ `/login`, `/signup`, `/signup/verify`, `/reset-password` Sign-in screens
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
