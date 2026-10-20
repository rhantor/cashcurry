# How the code is laid out

One rule holds it together: **`lib/` is plain logic and data, `app/` is the
screens.** `lib/` never imports from `app/`, so every money rule can be tested
and reused (by Cloud Functions, scripts and tests) without a browser. `npm run
lint` enforces the folder rules below; a break is a lint error, not a review
comment.

## Folders

| Folder | What goes here | Must not |
|---|---|---|
| `app/<route>/` | A page (`page.jsx`) and the pieces only that page uses (`components/`, `logic/`) | be imported by another route; move a shared piece up to `app/components` or `lib/` |
| `app/components/<area>/` | UI shared by more than one page, grouped by area (`costs`, `payouts`, `shell`, `ui`…) | hold money rules — call `lib/` |
| `app/components/ui/` | The design-system parts (buttons, sheets, inputs, toast) | know about Firestore |
| `app/hooks/` | React hooks that pages share: session, currency, report data, dashboards (`app/hooks/dashboard/`) | |
| `app/export/` | Excel / PDF / share downloads (they show toasts, so they live on the app side) | |
| `app/api/` | Server routes; each one checks the caller's token (see `lib/server`) | trust anything the browser sends without checking |
| `lib/<area>/` | Logic for one area: `model.js` (pure rules, unit tested) and `client.js` (Firestore reads and writes, live hooks) | import from `app/` |
| `lib/finance/` | **The one finance engine.** Every figure on a dashboard, report or summary comes from `buildLedger` | be copied — never re-add up sales or costs anywhere else |
| `lib/redux/api/` | RTK Query slices, one per collection | |
| `lib/server/` | Admin-SDK code for API routes and scripts only | be imported by a page |
| `lib/format/` | Money and text helpers (`money.js`, `sanitize.js`) | |
| `functions/` | Cloud Functions. `engine.cjs`, `notify.cjs` and `audit.cjs` are **generated** from `lib/finance`, `lib/notify` and `lib/audit` by `node scripts/build-functions-engine.mjs` | be edited by hand |
| `scripts/` | One-off data jobs and local dev (`scripts/local`) — each says what it changes at the top | run against production without a dry run |
| `tests/` | Unit tests (`npm test`), one folder per `lib/` area | |
| `tests-rules/` | Firestore and Storage rules tests (`npm run test:rules`) | |
| `docs/` | Roadmap, roles, testing, local dev, this file | |

## Areas in `lib/`

`attendance` (incl. `biometric.js`) · `audit` (who did a change, entries in words) · `authz` (roles and permissions) · `chat` ·
`costs` (categories, vouchers) · `finance` · `format` · `issues` · `native`
(Capacitor) · `notify` (types, recipients, push) · `payouts` · `payroll`
(incl. `calculations.js`) · `purchases` · `redux` · `region` (currency) ·
`requests` · `server` · `session` · `staff` (incl. `login.js`, `private.js`) ·
`storage` · `tasks` (tasks, checklists, ratings, notes). Top-level files: `firebase.js` (the one Firebase setup),
`people.js` (names and initials), `signupPending.js`.

A new feature gets its own `lib/<area>/` with `model.js` + `client.js`, and
tests in `tests/<area>/`, like `lib/payouts`.

## Before merging to dev

```bash
npm run lint
npm test
NEXT_DIST_DIR=.next-check npm run build
```

and `npm run test:rules` when `firestore.rules` or `storage.rules` changed.
The check build goes to `.next-check/`, so it can run while the dev server
is up.

## Never in this repo

The repo is public. No client data: no backups, no real invoices or
payslips, no golden figures, no keys. Demo data lives in
`scripts/local/demo` and is made up.
