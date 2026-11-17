"use client";
// The branch's attendance rules through the server (lib/attendance/staffSettings.js),
// so the staff app counts overnight shifts the way payroll does.
import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";

/** { settings, loading } — settings is null until loaded (or when it couldn't be). */
export function useAttendanceSettings(companyId, branchId) {
  const [state, setState] = useState({ key: "", settings: null, loading: true });
  const key = companyId && branchId ? `${companyId}/${branchId}` : "";
  useEffect(() => {
    if (!key) return undefined;
    let live = true;
    (async () => {
      try {
        const idToken = await auth.currentUser?.getIdToken();
        const res = await fetch(`/api/attendance/settings?companyId=${encodeURIComponent(companyId)}&branchId=${encodeURIComponent(branchId)}`, {
          headers: { Authorization: `Bearer ${idToken || ""}` },
        });
        const body = await res.json().catch(() => ({}));
        if (live) setState({ key, settings: res.ok ? body : null, loading: false });
      } catch {
        if (live) setState({ key, settings: null, loading: false });
      }
    })();
    return () => {
      live = false;
    };
  }, [key, companyId, branchId]);
  if (!key) return { settings: null, loading: false };
  return state.key === key ? { settings: state.settings, loading: state.loading } : { settings: null, loading: true };
}
