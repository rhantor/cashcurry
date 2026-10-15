# Cash Curry — Roadmap

Goal: turn Cash Curry v2 from a finance web app into a **restaurant workspace**.
Management runs finance, approvals and reports on the web. Every staff member has
an app for requests (advance, loan, leave), issues, and chat (group and personal).
Every approved money movement lands in the finance books. Access is by role.
Part two (after this roadmap) is the POS.

**Rules we follow on every task**

1. **The money numbers must not change unless we mean them to.** Before any task
   that touches finance, the golden tests (Task 0.3) must pass with the same
   results. If a number changes on purpose, the task says so and why.
2. **Production is untouched until the project is finished.** All work lives on
   the local `dev` branch; nothing is pushed to GitHub or merged into `main`
   until you decide to release. Each task is its own branch off `dev`, merged
   back after you review and try it.
3. **Production Firebase is never touched from development.** We work against a
   local copy (Task 0.2). Rules, functions and data migrations are deployed only
   when you approve, one at a time.
4. Each task lists **"How you check"**: what you open and what you should see.

Status: ⬜ not started · 🔄 in progress · ✅ done · ⏸ waiting on a decision

---

## Phase 0 — Safety net

Nothing here changes what users see. It lets us change things without fear.

| # | Task | Status |
|---|------|--------|
| 0.1 | Tidy git: commit the two pending access fixes (supervisor kiosk / attendance menu), start the local `dev` branch | ✅ |
| 0.2 | Local Firebase emulator, seeded from the Saffron Empire backup, so development never touches live data | ⬜ |
| 0.3 | Test setup (Vitest) + **golden finance tests**: hand-in-cash per branch per month, company total, must equal today's verified numbers | ⬜ |

- **0.2 How you check:** `npm run dev:local` opens the app with real-looking data; changes you make there do not appear in production.
- **0.3 How you check:** `npm test` prints the 36 branch-months and company totals, all passing.

## Phase 1 — Finance correctness

| # | Task | Status |
|---|------|--------|
| 1.1 | Fix "Last 7 / Last 30 Days" dropping the first day from dashboard cash on hand | ⬜ |
| 1.2 | **One finance engine** (`lib/finance/`) used by the summary report and both dashboards — replaces the three copies | ⬜ |
| 1.3 | **Time zone, currency and business day per company/branch** (Malaysia = Asia/Kuala_Lumpur, RM; Bangladesh = Asia/Dhaka, ৳). Optional day cut-off for restaurants that close after midnight. Replaces every UTC "today" | ⬜ |
| 1.4 | **Money request lifecycle**: requested → approved / rejected → **paid** (who paid, when, from front cash or bank). Only *paid* moves cash; payroll deducts only paid. Manager entering directly = approve + pay in one step (today's workflow keeps working). Existing records count as paid on their date, so today's numbers stay the same | ⬜ |
| 1.5 | ~~Promotion in Total Sales~~ — **decided: keep as is.** Promotion is free food served after an order and the owners want it counted; each branch's "include in total" setting stays in control | ✅ |

- **1.1 How you check:** branch dashboard, Lazeez BB, "Last 7 Days" shows the same cash as the summary report for the same dates.
- **1.2 How you check:** golden tests unchanged; dashboards and summary show identical numbers; dashboards load faster.
- **1.3 How you check:** settings page has time zone / currency / day cut-off; a sale entered at 1am lands on the right business day.
- **1.4 How you check:** a rejected advance does not change hand-in-cash; an approved one changes it only after "Mark paid".

## Phase 2 — Speed and security foundation

Needed before staff phones get direct access to the database (Phase 4).

| # | Task | Status |
|---|------|--------|
| 2.1 | **Real access control**: role, company and branch stored in the login token (Firebase custom claims); database rules check the token, not browser cookies. Close the "no branchId → can read all branches" gap | ⬜ |
| 2.2 | One shared "current user / company / branch" source, replacing 34 separate browser-storage reads | ⬜ |
| 2.3 | Dashboards read the monthly totals the server already keeps + only the current month's records (no more downloading all history) | ⬜ |
| 2.4 | Reports load by date range with paging | ⬜ |
| 2.5 | Remove dead/unsafe code (old `onShiftClosed` function, unused helpers) | ⬜ |

- **2.1 How you check:** a cashier account cannot open or read finance pages/data even by editing cookies.
- **2.3 How you check:** company dashboard opens in about a second; Firebase read count drops sharply (we'll compare before/after).

## Phase 3 — New UI

| # | Task | Status |
|---|------|--------|
| 3.1 | **Design system**: colours, type, spacing (light + dark), components — button, input, select, date picker, dialog, bottom sheet, toast, table, badge, empty state, skeleton. One icon set. A `/ui` preview page to review them | ⬜ |
| 3.2 | **App shell**: new sidebar + top bar, branch switcher, search/command bar (Ctrl+K), mobile bottom navigation, instant page frame while data loads | ⬜ |
| 3.3 | Replace all 113 `alert()` and 21 `confirm()` with toasts and proper dialogs | ⬜ |
| 3.4 | Redesign screens, one pull request each: dashboards → sales & cost entry → summary/reports → approvals → staff → payroll → purchases → settings | ⬜ |
| 3.5 | Split the largest files (appointment letter 2.7k lines, payroll, purchase orders…) as each screen is redesigned | ⬜ |

- **3.1 How you check:** open `/ui`, review every component on desktop and phone before any real screen changes.

## Phase 4 — Staff workspace

| # | Task | Status |
|---|------|--------|
| 4.0 | **Decision doc**: staff app technology (installable web app vs Android/iOS app via Capacitor like the POS), login method (email vs phone OTP — phone suits Bangladesh), shared code layout | ⏸ |
| 4.1 | **Roles & permissions matrix** written down and enforced in one place (UI, routes, database rules) | ⬜ |
| 4.2 | **Requests engine**: one model for advance, staff loan, leave, and later other types; approval chain by role; "mark paid" posts to finance (uses 1.4) | ⬜ |
| 4.3 | **Approvals inbox** for managers (web + app) with push notifications | ⬜ |
| 4.4 | **Chat**: branch/company/custom groups, personal messages, photos/files, read receipts, push. Replaces today's basic branch chat | ⬜ |
| 4.5 | **Issues**: staff raise an issue → assigned → resolved, with photos and its own thread | ⬜ |
| 4.6 | **Staff app**: home, my salary/advances/loan balance, attendance, requests, chat, issues, profile. Android first | ⬜ |
| 4.7 | Retire the old staff portal pages once the app replaces them | ⬜ |

## Phase 5 — Bangladesh launch kit

| # | Task | Status |
|---|------|--------|
| 5.1 | Payment type presets for Bangladesh (bKash, Nagad, Rocket, Foodpanda, Pathao Food, card) | ⬜ |
| 5.2 | Bangla language for the staff app (and web if needed); ৳ and lakh/crore number format | ⬜ |
| 5.3 | Payroll deductions and holidays configured for Bangladesh | ⬜ |
| 5.4 | New-company setup flow so a new restaurant can start without manual Firebase work | ⬜ |

## Part two — POS

Starts after this roadmap: align the POS with the shared finance engine, design
system and permissions, and plan its own improvements.

---

## Release checklist (built up as we go, run once at the end)

Things that must happen on production at release time, in order. Each one is
rehearsed on the local copy first.

- [ ] Back up production (same export as `backup_saffron_empire`)
- [ ] Data fix: mark existing advances / staff loans as paid on their date (1.4)
- [ ] Deploy new database rules and Cloud Functions
- [ ] Merge `dev` into `main` and push (Vercel deploys the web app)
- [ ] Re-run the golden check against production numbers

## Open decisions

| Decision | Needed before |
|---|---|
| Staff app technology and login method | 4.0 |
| Separate staging Firebase project (recommended before Phase 4) | 4.x deploys |
