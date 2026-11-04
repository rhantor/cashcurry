"use client";
// On a phone: starts the saved copy of the app, and says so when what's on
// screen is that copy and not the latest. Money totals read from a saved copy
// can be short, so nobody should take them for the real figure. Computers keep
// no copy and render nothing here (lib/device/model.js).
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { CloudOff } from "lucide-react";
import { db } from "@/lib/firebase";
import { startPageCopy } from "@/lib/device/client";
import { deviceKeepsCopy, OFFLINE_AFTER_MS } from "@/lib/device/model";

export default function DeviceCopy({ uid }) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (uid) startPageCopy();
  }, [uid]);

  useEffect(() => {
    if (!uid || !deviceKeepsCopy()) return;
    let timer = null;
    const stopWaiting = () => {
      clearTimeout(timer);
      timer = null;
    };
    const stop = onSnapshot(
      doc(db, "users", uid),
      { includeMetadataChanges: true },
      (snap) => {
        if (!snap.metadata.fromCache) {
          stopWaiting();
          setSaved(false);
        } else if (!navigator.onLine) {
          stopWaiting();
          setSaved(true);
        } else if (!timer) {
          timer = setTimeout(() => setSaved(true), OFFLINE_AFTER_MS);
        }
      },
      () => {}
    );
    const lost = () => setSaved(true);
    window.addEventListener("offline", lost);
    return () => {
      stop();
      stopWaiting();
      window.removeEventListener("offline", lost);
    };
  }, [uid]);

  if (!saved) return null;
  return (
    <div role="status" className="fixed inset-x-0 top-0 z-[90] flex items-center justify-center gap-2 bg-warning px-3 pb-1.5 pt-[calc(env(safe-area-inset-top,0px)+0.375rem)] text-center text-xs font-semibold text-white">
      <CloudOff className="size-3.5 shrink-0" aria-hidden />
      <span>No connection. Showing saved data, so totals may be out of date. New entries may not save.</span>
    </div>
  );
}
