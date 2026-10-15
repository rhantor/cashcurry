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
| 0.2 | Local Firebase emulator, seeded from the Saffron Empire backup, so development never touches live data — see [LOCAL_DEV.md](LOCAL_DEV.md) | ✅ |
| 0.3 | Test setup (Vitest) + **golden finance tests**: hand-in-cash per branch per month, company total, must equal today's verified numbers — see [TESTING.md](TESTING.md) | ✅ |

- **0.2 How you check:** `npm run dev:local` opens the app with real-looking data; changes you make there do not appear in production.
- **0.3 How you check:** `npm test` prints the 36 branch-months and company totals, all passing.

## Phase 1 — Finance correctness

| # | Task | Status |
|---|------|--------|
| 1.1 | Fix "Last 7 / Last 30 Days" dropping the first day from dashboard cash on hand; date label and pickers showed the day before (UTC) | ✅ |
| 1.2 | **One finance engine** (`lib/finance/`) used by the summary report and both dashboards — replaces the three copies | ✅ |
| 1.3 | **Time zone, currency and business day per company/branch** (Malaysia = Asia/Kuala_Lumpur, RM; Bangladesh = Asia/Dhaka, ৳). Optional day cut-off for restaurants that close after midnight. Replaces every UTC "today" | ✅ |
| 1.4 | **Money request lifecycle**: requested → approved / rejected → **paid** (who paid, when, from front cash or bank). Only *paid* moves cash; payroll deducts only paid. Manager entering directly = approve + pay in one step (today's workflow keeps working). Existing records count as paid on their date, so today's numbers stay the same | ✅ |
| 1.5 | ~~Promotion in Total Sales~~ — **decided: keep as is.** Promotion is free food served after an order and the owners want it counted; each branch's "include in total" setting stays in control | ✅ |

- **1.1 How you check:** branch dashboard, Lazeez BB, "Last 7 Days" shows the same cash as the summary report for the same dates.
- **1.2 How you check:** summary report, branch dashboard and company dashboard show the
  same cash and bank for the same dates; `npm test` proves it for every branch × month.
  Also fixed: the cash books read only the newest 100 loan records; the company dashboard
  dated salaries by entry time. One figure changed on purpose — see "Open decisions"
  (banked sales follow the branch settings).
- **1.3 How you check:** Branch Settings → General → "Region & business day" shows the branch's
  clock, the date new entries default to, and how money is written; with "Day ends at 05:00",
  a sale form opened at 1:30am defaults to the previous day. Settings live in existing fields
  (`attendance.dayCutoffTime` is the same cut-off the POS uses); a branch with no cut-off
  stays on midnight. The company dashboard warns when branches use different currencies.
- **1.4 How you check:** a cashier's advance request appears in Requested Panel; approving it moves it to
  "Waiting to be paid" (Requested Panel and Advance & Loan page) and changes no figure; "Mark paid"
  (date + till/bank) moves the money on that date. Pending staff loans can now be approved too (they had
  no approval screen). Payroll deducts only paid-out advances/loans. Also fixed: an advance's "paid from
  bank" was never saved, so every advance counted as cash; advances/loans paid by transfer now reduce the bank.

## Phase 2 — Speed and security foundation

Needed before staff phones get direct access to the database (Phase 4).

| # | Task | Status |
|---|------|--------|
| 2.1 | **Real access control** — the database and storage rules are the security boundary (screens and middleware only hide buttons). One shared rules file for v2 + POS; closed: anyone could make themselves owner of any company, staff could read all finances and colleagues' personal data, anyone could approve/pay their own advance, anyone could claim usernames, open create-staff and image-proxy endpoints. 46 rules tests (`npm run test:rules`). Login-token claims deferred: not needed for security now that rules are tight | ✅ |
| 2.2 | One shared "current user / company / branch" source (`lib/session`, `useSession`), replacing 44 separate browser-storage reads in 37 files and three helpers. Profile comes from the database (a changed role/branch applies on next load); one active branch for every screen; signing out anywhere returns to login | ✅ |
| 2.3 | **Fast dashboards.** The server keeps each branch's monthly totals with the app's own finance engine (bundled into the Cloud Functions), recomputing the whole month on every change, with retry and a nightly pass. The old rollups (which broke the money rules and drifted) are gone. The branch and company dashboards and the summary report check those totals against server-side record counts and, when they cover everything earlier, load only the period's months; anything missing or stale → the full download, as before. Proven equal to the full download for every branch, month and filter on the real data; **1,744 → 230 document reads (−87%)** for the Sep 2026 dashboards. Loans between branches are now dated on the branch's clock (Malaysia by default), not the device's, so the server and every screen agree | ✅ |
| 2.4 | **Screens ask for what they show.** The list reports already loaded by date range; the rest of the app did not. The requests panel re-downloaded every advance, staff loan, branch loan and OT request every 5 seconds — now only pending ones (Lazeez BB: ~1,920 → 48 reads a minute while open). Pay-out queue: only approved-unpaid. Payroll/salary sheet: only approved. Supervisor panel: only their own. Deposit entry: the latest five (it was showing the five *oldest*). **Staff pages fixed:** since 2.1 staff may read only their own records, but their pages asked for the whole branch, so they would have shown nothing. Each staff login now records which staff record it is (`users.staffId`, set by create-staff, locked like role); staff read their own advances, loans, punches and OT requests — asked by them or entered for them. Demo company has a staff login (`ali`) | ✅ |
| 2.5 | **Dead and unsafe code removed.** `onShiftClosed` (watched an old POS path; if anything wrote there it added a UTC-dated sale with no payment breakdown). 22 files nothing used — incl. a 709-line second copy of the summary math. Three unreachable pages: `/cost-report` (duplicate), `/offline`, and the old salary sheet `/entry-data/salary-sheet` (replaced by Payroll; it deducted approved-but-unpaid advances). `functions/node_modules` no longer in git (5,481 files). Dashboard charts group by the same day as the money figures (wrong days west of UTC and for late-night timestamps before). Lint: 70 unused variables/imports and 127 stale disable-comments gone; both lint configs agree | ✅ |

- **2.1 How you check:** `npm run test:rules` — 46 statements about who may read/write what, run against the
  emulator (e.g. "a stranger cannot make themselves owner of an existing company", "a cashier marks an approved
  advance paid — once"). Cashiers can now "Mark paid". Staff logins get a random one-time password.
- **2.4 How you check:** log in as `ali` (staff): Requests shows the RM 100 advance the KL admin entered for him. As
  `kl_manager`: Requested panel shows only Kumar's pending RM 150; as `kl_cashier`: "Waiting to be paid" shows Siti's RM 600.
  `npm run test:rules` includes "staff see their own … and no one else's".
- **2.3 How you check:** `npm run dev:local`, open a dashboard — same figures as before. Add a cost dated last month in
  the app: a few seconds later `summaries/{month}` in the emulator UI (localhost:4000) shows it. `npm test` proves
  fast == full for every branch, month and filter; `CC_TEST_TZ=UTC npm test` runs it as the server would.

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

- [ ] Fix the backup export script first: it writes `{ id: doc.id, ...data }`, so any
      document with its own `id` field loses its real id (payroll salary entries —
      42 of them collapsed in the Sep 2026 backup). Export the id separately.
- [ ] Back up production with the fixed script, and test-restore it locally
- [ ] Optional data fix: write `paidOut` on existing approved/closed advances and staff loans (the engine
      already treats them as paid on their date, so figures don't change either way)
- [ ] Branch settings: set each branch's time zone (Asia/Kuala_Lumpur) and confirm its
      "day ends at" — Lazeez BB and Lazeez Bistro have 05:00; the two Eggcellence branches have
      none (midnight). Note: until now every form defaulted to the UTC date, which in Malaysia
      behaved like an 08:00 cut-off.
- [ ] Rules: v2 and the POS share one Firebase project, and both repos had their own firestore.rules —
      deploying either one would lock the other app out. Deploy ONLY v2's firestore.rules and storage.rules
      (they include the POS sections); retire the POS repo's copy. First download the live rules and diff
      them against v2's, to catch anything deployed from elsewhere.
- [ ] Deploy indexes (`firebase deploy --only firestore:indexes` — additive, safe; wait until they finish building)
- [ ] Right after the rules: `npm run staff:link -- --project <id> --confirm` — records on each existing staff
      login which staff record it is. Until then those staff see only requests they raised themselves
- [ ] Deploy Cloud Functions (`firebase deploy --only functions` builds the finance engine first). This
      removes the old rollup functions — confirm the deletion when the CLI asks
- [ ] Right after: `npm run summaries:rebuild -- --project <id> --confirm` (needs
      `gcloud auth application-default login`). Until it runs, dashboards just use the full download
- [ ] Merge `dev` into `main` and push (Vercel deploys the web app)
- [ ] Re-run the golden check against production numbers

## Open decisions

| Decision | Needed before |
|---|---|
| Were any past advances actually paid by bank transfer? The form asked, but the answer was never saved, so all 136 counted as cash. If some were by bank, they can be corrected | release |
| Do the Eggcellence branches trade past midnight? (sets their "day ends at") | release |
| A company with branches in two countries: one company per country, or company dashboard per currency? (today it warns) | 5.x |
| Banked sales: follow the branch settings (now, as the summary report always did) or the flag saved on each sale? Only Eggcellence BB Jan 2026 differs (RM 70) | any time — one line in `lib/finance` |
| Staff app technology and login method | 4.0 |
| Separate staging Firebase project (recommended before Phase 4) | 4.x deploys |
