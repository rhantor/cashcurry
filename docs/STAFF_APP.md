# Staff app — decisions (roadmap 4.0 / 4.6)

Decided by the owner on 19 Oct 2026.

## 1. What it is

| | Android | iPhone |
|---|---|---|
| **How** | An Android app on the Play Store (the owner already has a Play Console account and an app listed) | The same app as an installable web app (add to home screen) — the App Store's cost is not possible now |
| **Code** | One code base: the web app's staff pages, wrapped with Capacitor for Android (as the POS is) | The same pages, as they are |
| **Push** | Native (Firebase Cloud Messaging) | Web push (iOS 16.4+, from the home-screen app) |
| **Fingerprint** | Yes — unlocks the app (Android biometrics) | Later, if wanted: passkeys (Face ID / Touch ID) |

An App Store version can come later from the same code (Capacitor builds iOS too) when the cost makes sense.

## 2. Logging in

- **Phone number or IC number + a 6-digit PIN.** Email is optional when adding staff (kitchen staff often have none); without one, the login gets a placeholder address behind the scenes.
- **Stays logged in, like WhatsApp:** once in, the staff member stays in until they sign out (or a manager resets their PIN). The session cookies roll forward on every open.
- **Fingerprint** (Android app): after the first login the staff member can turn on fingerprint; from then on the app opens with a fingerprint instead of the PIN. The fingerprint never leaves the phone — Android checks it and only says "yes".
- **Forgot PIN:** the manager (whoever may manage staff) sets a new one from Staff management (⋯ → Reset PIN); the new PIN is shown once and the old one stops working. (A reset link to an email on file: later, if wanted.)
- Wrong PINs: Firebase slows and then blocks repeated wrong tries.

## 3. Settings in the staff app

Staff change for themselves:

- PIN (with their current PIN), fingerprint on/off
- Profile photo, the phone number to reach them, emergency contact
- Notifications (what they get), language (Bangla with 5.2)
- Sign out

Staff **cannot** change the personal details they joined with — name, IC / passport, date of birth, address, bank details, job, pay. They see them, read-only, with "ask your manager to change these".

## 3b. What is built (19 Oct)

- Screens: Home, My pay (payslips), My attendance (29 Oct — each day's clock-ins, hours and OT, earlier periods, missing punches flagged), Requests, Chat, Issues, Me — `app/(staff)/`.
- Me: photo, contact number (changing it changes the sign-in number; a number already used by another login is refused), emergency contact, change PIN (current PIN first; 111111 / 123456 refused), notifications, sign out. Joined-with details read-only, IC and bank masked.
- Fingerprint shows as "Soon": it comes with the Android app (step 4).
- Payslips: payroll writes each person's own copy when a run is finalized or paid (`lib/payroll/payslipCopy.js`), so staff never read the run itself (it carries the branch's totals).

## 4. Build order

1. Login by phone / IC + PIN, long sessions, manager PIN reset, email optional.
2. The settings page (above), with the rules for what staff may change.
3. The staff app's screens (home, salary, advances / loan balance, attendance, requests, chat, issues, profile) in the new design.
4. The Android wrapper (Capacitor): native push, fingerprint, Play Store listing.

## 5. The Android app (step 4, built 19 Oct — not on the Play Store yet)

A Capacitor shell (`capacitor.config.ts`, `android/`) around the hosted pages — the same pages as the iPhone home-screen app, so one fix reaches both. Inside the app only (`lib/native`, `app/components/native/NativeBridge.jsx`):

- **Fingerprint unlock** — Me → "Unlock with fingerprint". Staff stay signed in; with it on, opening the app (or coming back after a minute away) asks for the fingerprint (or face, if the phone uses that). "Use my PIN instead" signs out to the PIN login. The fingerprint never leaves the phone and no PIN is stored on it.
- **Push** — the app's own notifications through Firebase Cloud Messaging; tokens go where browser tokens go, so every notification the server sends reaches the app. Asked once when they first sign in inside the app (normal for an app; the website still asks only from a button). Tapping one opens its page.
- The phone's back button goes back, and closes the app on the first screen.
- No connection → a "No connection · Try again" page (`cap-shell/offline.html`).

Build and try it (Android Studio installed):

1. `CAP_SERVER_URL=http://<this computer's Wi-Fi address>:3000 npm run android:sync` with `npm run dev:phone` running (or the address of any test site).
2. `npm run android:open`, then Run on a phone or emulator. Or `cd android && ./gradlew assembleDebug` → `android/app/build/outputs/apk/debug/app-debug.apk`.

Before the Play Store (release checklist):

- Firebase console → the project → add an **Android app** with package `com.cashcurry.staff`; put its `google-services.json` in `android/app/` (kept out of git). Without it the app works but gets no push.
- `CAP_SERVER_URL=https://<app domain> npm run android:sync`.
- ~~App icon and splash~~ — done 29 Oct: `npm run android:icons` draws them from `public/icons/icon.svg` (run again if the logo changes).
- A signing key (kept safe, never in git), then `./gradlew bundleRelease` → upload the `.aab` in Play Console under the existing developer account: new app "Cash Curry Staff", internal testing first, privacy policy page, data-safety form (name, phone, photo, pay shown to the person themselves).
