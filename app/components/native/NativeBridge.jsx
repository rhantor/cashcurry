"use client";
// Inside the staff Android app only (lib/native): the fingerprint lock screen,
// the app's push notifications (tapping one opens its page) and the phone's
// back button. In a browser this renders nothing and does nothing.
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Fingerprint, KeyRound } from "lucide-react";
import useSession from "@/app/hooks/useSession";
import { signOut } from "@/lib/session";
import { LogoMark } from "@/app/components/ui";
import { RELOCK_AFTER_MS, checkFingerprint, isNativeApp, lockEnabled, startNativePush } from "@/lib/native";

export default function NativeBridge() {
  const router = useRouter();
  const { user } = useSession();
  const [native, setNative] = useState(false);
  const [locked, setLocked] = useState(false);
  const leftAt = useRef(null);
  const checking = useRef(false);
  const signedIn = !!user?.uid;

  useEffect(() => setNative(isNativeApp()), []);

  // Locked when the app opens, if the person turned the lock on
  useEffect(() => {
    if (native && signedIn && lockEnabled()) setLocked(true);
  }, [native, signedIn]);

  const unlock = useCallback(async () => {
    if (checking.current) return;
    checking.current = true;
    const ok = await checkFingerprint();
    checking.current = false;
    if (ok) setLocked(false);
  }, []);

  // Ask straight away when the lock shows
  useEffect(() => {
    if (locked) unlock();
  }, [locked, unlock]);

  // Back in the app after a while → locked again; the phone's back button
  useEffect(() => {
    if (!native) return;
    let handles = [];
    (async () => {
      const { App } = await import("@capacitor/app");
      handles = await Promise.all([
        App.addListener("appStateChange", ({ isActive }) => {
          if (!isActive) leftAt.current = Date.now();
          else if (leftAt.current && Date.now() - leftAt.current > RELOCK_AFTER_MS && lockEnabled() && signedIn) setLocked(true);
        }),
        App.addListener("backButton", ({ canGoBack }) => (canGoBack ? window.history.back() : App.exitApp())),
      ]);
    })();
    return () => handles.forEach((h) => h.remove());
  }, [native, signedIn]);

  // Push: asked once when they first sign in to the app
  useEffect(() => {
    if (!native || !user?.uid || !user?.companyId) return;
    startNativePush({ companyId: user.companyId, uid: user.uid, ask: true, onOpen: (link) => router.push(link) }).catch(() => {});
  }, [native, user?.uid, user?.companyId, router]);

  const usePin = async () => {
    try {
      await signOut();
    } finally {
      window.location.href = "/login";
    }
  };

  if (!native || !locked) return null;
  const name = user?.firstName || "";
  return (
    <div className="fixed inset-0 z-[600] flex flex-col items-center justify-center gap-6 bg-bg px-8 text-center" role="dialog" aria-modal="true" aria-label="Locked">
      <LogoMark size={56} />
      <div>
        <h1 className="text-xl font-semibold text-fg">{name ? `Welcome back, ${name}` : "Welcome back"}</h1>
        <p className="mt-1 text-sm text-muted">Cash Curry is locked</p>
      </div>
      <button type="button" onClick={unlock} className="flex flex-col items-center gap-3 rounded-3xl px-8 py-5 text-brand active:scale-95">
        <span className="inline-flex size-20 items-center justify-center rounded-full bg-brand-soft">
          <Fingerprint className="size-10" />
        </span>
        <span className="text-sm font-semibold">Unlock with fingerprint</span>
      </button>
      <button type="button" onClick={usePin} className="inline-flex items-center gap-2 text-sm font-medium text-muted">
        <KeyRound className="size-4" /> Use my PIN instead
      </button>
    </div>
  );
}
