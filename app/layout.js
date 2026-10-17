import React from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ClientLayoutWrapper from "./ClientLayoutWrapper";
import { Analytics } from "@vercel/analytics/next";
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
export const viewport = {
  themeColor: "#0ea5e9", // ✅ move themeColor here
};
export const metadata = {
  title: "Cash Curry (Restaurant Finance Report)",
  description: "Multi-branch sales & finance dashboard",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {/* Link the manifest so the login page can trigger install */}
        <link rel="manifest" href="/manifest.webmanifest" />
        {/* iOS */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icons/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="theme-color" content="#0b4d40" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ClientLayoutWrapper>{children}</ClientLayoutWrapper>
        {process.env.NEXT_PUBLIC_USE_EMULATOR === "true" && (
          <div
            className="fixed bottom-20 right-3 lg:bottom-3 z-[100] pointer-events-none rounded-full bg-amber-500 px-3 py-1 text-xs font-bold tracking-wide text-white shadow-lg"
            title="Connected to the local Firebase emulators, not production"
          >
            LOCAL DATA
          </div>
        )}
        <Analytics />
      </body>
    </html>
  );
}
