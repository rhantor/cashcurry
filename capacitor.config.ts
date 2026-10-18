// The Cash Curry staff app for Android (roadmap 4.6, docs/STAFF_APP.md).
// A Capacitor shell around the hosted web app — the same pages as the
// iPhone home-screen app — with native push and a fingerprint lock added
// (app/components/native/NativeBridge.jsx).
//
// CAP_SERVER_URL is where the app's pages live: the production address for a
// Play Store build, or this computer on the Wi-Fi for testing
// (e.g. http://192.168.1.20:3000 with `npm run dev:phone`):
//   CAP_SERVER_URL=https://<app domain> npx cap sync android
import type { CapacitorConfig } from "@capacitor/cli";

const server = process.env.CAP_SERVER_URL || "https://example.invalid";
const insecure = server.startsWith("http://");

const config: CapacitorConfig = {
  appId: "com.cashcurry.staff",
  appName: "Cash Curry Staff",
  // Shown only if the pages can't be reached (no connection).
  webDir: "cap-shell",
  server: {
    url: `${server.replace(/\/+$/, "")}/login`,
    cleartext: insecure, // plain http only for testing on the local network
    allowNavigation: [new URL(server).host],
    errorPath: "offline.html",
  },
  android: {
    allowMixedContent: insecure,
    appendUserAgent: "CashCurryStaffApp",
  },
  plugins: {
    PushNotifications: { presentationOptions: ["badge", "sound", "alert"] },
  },
};

export default config;
