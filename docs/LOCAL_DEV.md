# Running Cash Curry locally (without touching production)

`npm run dev` talks to the **live** Firebase project. For development use the
local copy instead: Firebase's emulators run on your machine, loaded from a
company backup. Nothing you do there reaches production — the local project id
starts with `demo-`, which makes the emulators refuse every real Google service,
and push-notification tokens are stripped from the copy.

The app shows an orange **LOCAL DATA** badge (bottom right) whenever it is on
the local copy. No badge = production data.

## Requirements

- Node 20+
- Firebase CLI: `npm install -g firebase-tools`
- Java 11+ (the Firestore emulator needs it)
- Only for `local:seed:backup`: a backup folder. Put its path in the
  git-ignored `.local/backup-path.txt`, or use `CC_BACKUP_DIR=path/to/backup`.

The demo company is built by `scripts/local/demo/demoCompany.mjs`. Its
walkthrough figures are computed from the same list of entries, and
`npm test` checks that the app shows exactly those figures.

## Commands

| Command | What it does |
|---|---|
| `npm run local:seed` | Builds the local copy with the **demo company** (made up, no client data): two branches, 7 days ending today, round numbers. Writes a day-by-day walkthrough of what every screen should show to `.local/DEMO_GUIDE.md`. **Wipes** any previous local data. |
| `npm run local:seed:backup` | Same, but from a real company backup instead (see Requirements). |
| `npm run backup:restore -- <folder>` | Load a `backup:production` backup into running, empty emulators and check it reads back identical. `CC_EMULATOR_DATA=<folder>` runs the app on that saved copy instead of the usual local data. |
| `npm run staff:link` | Records on each staff login which staff record it is (`users.staffId`), from the `uid` on the staff record. The seed runs it. |
| `npm run summaries:rebuild` | Recomputes every branch's monthly totals in the running emulators (the seed already does this; the Cloud Functions keep them up to date as you work). |
| `npm run dev:local` | Starts the emulators + the app at http://localhost:3000. Changes you make are kept between runs (see [Saving](#saving-the-local-data)). Stop with **Ctrl+C** (waits a few seconds to save). Refuses to start if the saved data is broken. |
| `npm run local:restore-save -- <folder>` | Puts a good Firestore copy back as the local data, when `dev:local` refused to start. Without a folder it only says whether the current copy is good and lists the good copies. Run with the emulators stopped. |
| `npm run dev:phone` | Same, and phones on the same Wi-Fi can open it too: it prints the address to open (e.g. http://192.168.x.x:3000). The local data becomes reachable by anyone on that network, so only use it at home or the office. If the phone can't connect: allow Node.js and Java through Windows Firewall, and let a VPN allow local-network access (or pause it). |

Emulator dashboard (browse the data, users, function logs): http://127.0.0.1:4000

## Logging in

Every real user exists locally with the same username/email but a **local
password** (real passwords can't be exported). After `local:seed`:

- `.local/DEV_ACCOUNTS.md` — who you can log in as (role, username, branch)
- `.local/dev-password.txt` — the password for all of them

Both are git-ignored. After re-seeding, log out and in again (old sessions
belong to the previous copy).

## What is and isn't local

| Local | Not local |
|---|---|
| Firestore data, logins, file uploads, Cloud Functions (rollups, audit log) | Push notifications (disabled) |
| Database and storage security rules (same files as production) | Images/receipts uploaded **before** the backup still load from production storage (read-only) |

## Saving the local data

The local data is in `.local/emulator-data`. It is saved two ways:

- **Autosave every 5 minutes** (Firestore only). `dev.mjs` asks the Firestore
  emulator for an export into `.local/emulator-data-kept/saving`, flushes
  every file to disk (fsync), checks it, and only then swaps it in. The copy
  it replaces becomes `.local/emulator-data-kept/firestore_export.prev`. A
  save that fails or comes out broken never touches the current copy.
- **On Ctrl+C** the Firebase CLI saves everything (Firestore, logins, files)
  with `--export-on-exit`. It deletes the whole `.local/emulator-data` folder
  and moves its new export in, without flushing it to disk, so `dev.mjs`
  flushes and checks it as soon as the emulators have stopped. `local:seed`
  does the same after seeding.

The check reads every record of the export (`output-0` and the metadata are
LevelDB logs with a checksum per record): not empty, not zero bytes, nothing
cut short, and documents of the `demo-cashcurry` project inside. Code:
`scripts/local/exportSafety.mjs`, tests: `tests/local/exportSafety.test.js`.

Why: on 12 Nov 2026 the laptop stopped right after an autosave. The export
had been renamed into place before Windows wrote its contents, and `output-0`
and the metadata came back as files of zero bytes.

**If `dev:local` says the saved data is broken**, it does not start the
emulators (they would load nothing, and the next save would write that over
everything). It lists the good copies, best first:

1. `.local/emulator-data-kept/saving/firestore_export`: an autosave that
   stopped just before its swap (newest);
2. `.local/emulator-data-kept/firestore_export.prev`: the previous good save
   (at most one autosave older than the broken one, about 5–10 minutes);
3. the newest good `.local/rescue-*/firestore_export`.

Put one back with `npm run local:restore-save -- "<folder>"`. The broken copy
is moved to `.local/emulator-data-kept/firestore_export.BAD-<time>`, never
deleted.

Keep extra copies in `.local/emulator-data-kept` or `.local/rescue-*`, **never
inside `.local/emulator-data`**: the CLI deletes that whole folder on every
Ctrl+C.

## Notes

- The backup stores dates as text; the seed restores `createdAt`-style fields
  as Firestore timestamps. Finance uses the plain `date` fields, which are
  copied exactly.
- If the seed stops with "Duplicate document path", the backup has two records
  for one document — don't work around it, it means data would be lost.
