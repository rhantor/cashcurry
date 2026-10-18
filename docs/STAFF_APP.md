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

## 4. Build order

1. Login by phone / IC + PIN, long sessions, manager PIN reset, email optional.
2. The settings page (above), with the rules for what staff may change.
3. The staff app's screens (home, salary, advances / loan balance, attendance, requests, chat, issues, profile) in the new design.
4. The Android wrapper (Capacitor): native push, fingerprint, Play Store listing.
