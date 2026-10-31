# Cash Curry v2 — notes for Claude

Restaurant workspace: finance, approvals and reports for management, plus a
staff app (requests, issues, tasks, chat). Next.js 15 + Firebase (Firestore,
Auth, Storage, Cloud Functions), deployed on Vercel. A live client uses
`main` every day.

**This repo is public.** Never commit client data, names, backups, real
invoices or payslips, golden figures, keys or passwords. Demo data lives in
`scripts/local/demo` and is made up.

## Safety rules (always)

- **Never push or merge to `main`.** Pushing `main` deploys to the live
  client. Release only when the owner says so, using the release checklist in
  `docs/ROADMAP.md`.
- **Production Firebase is never touched from development.** No deploys of
  rules, indexes or functions, no data scripts with `--project`, and no
  writes to live data. Each production step needs the owner's explicit OK,
  one at a time.
- Work against the local emulators only (`docs/LOCAL_DEV.md`). The app shows
  an orange **LOCAL DATA** badge on local data; no badge means production.
- Sign in only with local demo accounts and the dev password in
  `.local/dev-password.txt`. Never type real credentials.
- Ask before deleting files or wiping local data. Before a reseed, back up to
  `.local/backup-…`.
- A rules change in `firestore.rules` or `storage.rules` affects every app
  that shares the project. Diff against the live rules before any deploy.

## How we work

- Each task gets its own branch off local `dev` (`task/<name>`), merged back
  with `git merge --no-ff`. Push `dev` only when asked.
- Commit WIP often (`WIP: …`). The laptop can switch off at any time.
- Propose options first, then build the one the owner picks. Finish with a
  step-by-step test checklist.
- Talk to the owner in Bangla (Banglish is fine). UI labels stay in English.
- A new feature gets `lib/<area>/model.js` (pure logic) and `client.js`
  (Firestore), tests in `tests/<area>/`, and rules tests in `tests-rules/`.
  `docs/ARCHITECTURE.md` has the layout.

## Commands

| Command | Use |
|---|---|
| `npm run local:seed` | Fresh local data: demo company plus Ops/tasks/new-hire samples. Wipes local data, so ask first. Login guide in `.local/DEMO_GUIDE.md`. |
| `npm run test:phone` | **For the owner's testing.** Builds once into `.next-fast`, then starts the emulators and `next start` on the LAN. Add `-- --no-build` to reuse the last build. Rebuild after every change before saying "ready to test". |
| `npm run dev:local` / `dev:phone` | Slow `next dev`; only for my own quick checks. |
| `npm test` | Unit and golden tests (finance numbers must not change unless intended). |
| `npm run test:rules` | Security-rules tests on their own emulators (safe while the app runs). |

Before merging to `dev`, run all of these:

```bash
npm run lint
npm test
NEXT_DIST_DIR=.next-check npm run build
```

Also run `npm run test:rules` if the rules changed.

## Where things are

- `docs/ROADMAP.md`: phases, task status, the **release checklist**, open
  decisions.
- `docs/ROLES.md`: the role and permission matrix (approved).
- `docs/STAFF_APP.md`: the staff app (Android via Capacitor, iPhone PWA).
- `docs/LOCAL_DEV.md`: emulators, seeding, phone testing.
- `docs/TESTING.md`: tests, and where the money rules live (`lib/finance`).
- `lib/finance`: the one cash and bank engine. Don't compute money anywhere
  else.
- `lib/server/*` and `app/api/*`: server routes that verify the Firebase ID
  token. Use them for anything the rules can't safely allow.

## Local emulator gotchas

- A dead dev server can leave an orphan emulator on :8080 and an empty export.
  Before restarting, export from the running emulator over REST
  (`POST …/emulator/v1/projects/<id>:export`) into `.local/rescue-…`, then
  copy that into the emulator data.
- Don't upload to the Storage emulator through the admin SDK. It crashes the
  emulator suite. Use the REST path, as `lib/server/hires.js` does.
- If the dev server is running, build into `.next-check` so the two builds
  don't collide.
