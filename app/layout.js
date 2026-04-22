/* eslint-disable react/prop-types */
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
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ClientLayoutWrapper>{children}</ClientLayoutWrapper>
        <Analytics />
      </body>
    </html>
  );
}
