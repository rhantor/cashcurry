"use client";
import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { MailOpen, RotateCw } from "lucide-react";
import { useFinalizeSignupMutation, useResendVerificationMutation } from "@/lib/redux/api/authApiSlice";
import { auth } from "@/lib/firebase";
import AuthFrame from "@/app/components/auth/AuthFrame";
import { Button } from "@/app/components/ui";
import { signedIn } from "@/lib/session";
import { clearPendingSignup, readPendingSignup } from "@/lib/signupPending";

/**
 * Waiting for the new owner to click the link in the verification email.
 * Checks every few seconds; once verified, makes the company and opens the
 * app. The email can be sent again after a short wait.
 */
function VerifySignup() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // from the address, or — if the page was closed and opened again — from
  // the sign-up kept on this device
  const [pending] = useState(() => (typeof window === "undefined" ? null : readPendingSignup()));
  const pick = (k) => searchParams.get(k) || pending?.[k] || "";
  const uid = pick("uid");
  const email = pick("email");
  const companyName = pick("company");
  const userName = pick("username");
  const name = pick("name");
  const inviteCode = pick("inviteCode");

  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(30); // the resend button waits 30s at first
  const [finalizeSignup] = useFinalizeSignupMutation();
  const [resendVerification, { isLoading: resendLoading }] = useResendVerificationMutation();

  // check for the verified email every 4 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        await auth.currentUser?.reload();
        if (auth.currentUser?.emailVerified) {
          clearInterval(interval);
          const res = await finalizeSignup({ uid, email, userName, name, companyName, inviteCode });
          if (res.data) {
            // the app's session (and its routing cookies) learns who this is,
            // as after a normal sign-in — before, the app opened without a role
            signedIn({ uid: res.data.uid, email, username: userName, userName, name: name || userName, role: "owner", companyId: res.data.companyId, branchId: null });
            clearPendingSignup();
            router.replace("/");
          } else {
            setError(res.error?.error || "Couldn't finish setting up the company.");
          }
        }
      } catch (err) {
        console.error("Verify check failed:", err);
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [uid, email, companyName, userName, name, inviteCode, finalizeSignup, router]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleResend = async () => {
    if (cooldown > 0) return;
    setError("");
    const res = await resendVerification();
    if (res.data === "sent") {
      setMsg("Sent again — check your inbox.");
      setCooldown(30);
    } else {
      setError(res.error?.error || "Couldn't send the email again.");
    }
  };

  return (
    <AuthFrame title="Check your email" subtitle={email ? `We sent a link to ${email}.` : "We sent you a link."}>
      <div className="rounded-2xl bg-brand-soft p-5 text-center">
        <motion.span animate={{ y: [0, -4, 0] }} transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }} className="inline-flex">
          <MailOpen className="size-9 text-brand" />
        </motion.span>
        <p className="mt-2 text-sm font-semibold text-fg">Open the email and tap the link</p>
        <p className="mt-1 text-xs text-muted">This page carries on by itself once you have — no need to come back and press anything.</p>
        <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-brand">
          <span className="size-1.5 animate-pulse rounded-full bg-brand" /> Waiting for the link…
        </p>
      </div>
      {msg && <p className="mt-4 text-center text-sm text-brand">{msg}</p>}
      {error && <p className="mt-4 rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-danger">{error}</p>}
      <Button variant="secondary" size="lg" icon={RotateCw} className="mt-5 w-full" onClick={handleResend} loading={resendLoading} disabled={cooldown > 0}>
        {cooldown > 0 ? `Send again in ${cooldown}s` : "Send the email again"}
      </Button>
      <p className="mt-3 text-center text-xs text-subtle">Nothing yet? Check spam or promotions.</p>
    </AuthFrame>
  );
}

export default function VerifySignupPage() {
  return (
    <Suspense fallback={null}>
      <VerifySignup />
    </Suspense>
  );
}
