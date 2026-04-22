/* eslint-disable react/prop-types */
"use client";

import { ensureNotificationSetup } from "@/lib/notifications/ensureNotificationSetup";
import { useEffect } from "react";

export default function AutoAskAfterLogin({ enabled = true }) {
  useEffect(() => {
    if (!enabled) return;
 
    // fire and forget
    ensureNotificationSetup({ showWelcome: true });
  }, [enabled]);

  return null; // no UI
}
