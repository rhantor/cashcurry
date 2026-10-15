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
- A backup folder. Default: `../backup_saffron_empire` next to this repo.
  Use another one with `CC_BACKUP_DIR=path/to/backup`.

## Commands

| Command | What it does |
|---|---|
| `npm run local:seed` | Builds the local copy from the backup. **Wipes** any previous local data. Run once, or whenever you want a fresh start. |
| `npm run dev:local` | Starts the emulators + the app at http://localhost:3000. Changes you make are kept between runs. Stop with **Ctrl+C** (waits a few seconds to save). |

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

## Notes

- The backup stores dates as text; the seed restores `createdAt`-style fields
  as Firestore timestamps. Finance uses the plain `date` fields, which are
  copied exactly.
- If the seed stops with "Duplicate document path", the backup has two records
  for one document — don't work around it, it means data would be lost.
