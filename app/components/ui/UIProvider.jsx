"use client";
import { useCallback, useEffect, useState } from "react";
import { MotionConfig } from "framer-motion";
import { ToastProvider } from "./Toast";
import DialogHost from "./DialogHost";

/** Everything the UI kit needs once at the top of the app: motion settings, toasts, dialogs. */
export default function UIProvider({ children }) {
  return (
    <MotionConfig reducedMotion="user">
      <ToastProvider>
        {children}
        <DialogHost />
      </ToastProvider>
    </MotionConfig>
  );
}

// ── theme ────────────────────────────────────────────────────────────────────
// "light" | "dark" | "system", remembered on this device only. Applied as the
// `dark` class on <html> (see the tokens in app/globals.css).
const KEY = "cc-theme";
const read = () => {
  try {
    return localStorage.getItem(KEY) || "system";
  } catch {
    return "system";
  }
};
const prefersDark = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;

export function applyTheme(choice) {
  const dark = choice === "dark" || (choice === "system" && prefersDark());
  document.documentElement.classList.toggle("dark", dark);
}

/** [choice, setChoice]; follows the system setting live when the choice is "system". */
export function useTheme() {
  const [choice, setChoice] = useState("system");
  useEffect(() => setChoice(read()), []);
  useEffect(() => {
    applyTheme(choice);
    if (choice !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const on = () => applyTheme("system");
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [choice]);
  const set = useCallback((c) => {
    setChoice(c);
    try {
      localStorage.setItem(KEY, c);
    } catch {
      /* private mode — still applies for this visit */
    }
  }, []);
  return [choice, set];
}
