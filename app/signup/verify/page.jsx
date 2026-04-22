"use client";
import React, { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  useFinalizeSignupMutation,
  useResendVerificationMutation,
} from "@/lib/redux/api/authApiSlice";
import { auth } from "@/lib/firebase";
import Cookies from "js-cookie";

export default function VerifySignupPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const uid = searchParams.get("uid");
  const email = searchParams.get("email");
  const companyName = searchParams.get("company");
  const userName = searchParams.get("username");
  const inviteCode = searchParams.get("inviteCode");

  const [msg, setMsg] = useState(
    "Check your email. We’re waiting for you to verify…"
  );
  const [cooldown, setCooldown] = useState(30); // button disabled first 30s
  const [finalizeSignup] = useFinalizeSignupMutation();
  const [resendVerification, { isLoading: resendLoading }] =
    useResendVerificationMutation();

  // Auto check email verification
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        await auth.currentUser?.reload();
        if (auth.currentUser?.emailVerified) {
          clearInterval(interval);

          const res = await finalizeSignup({
            uid,
            email,
            userName,
            companyName,
            inviteCode,
          });

          if (res.data) {
            Cookies.set("isLoggedIn", "true", { path: "/", expires: 7 });
            Cookies.set("role", "owner", { path: "/", expires: 7 });
            Cookies.set("uid", res.data.uid, { path: "/", expires: 7 });
            Cookies.set("companyId", res.data.companyId, {
              path: "/",
              expires: 7,
            });
            localStorage.setItem(
              "user",
              JSON.stringify({
                uid: res.data.uid,
                companyId: res.data.companyId,
                userName,
                role: "owner",
              })
            );
            router.replace("/");
          } else {
            setMsg(res.error?.error || "Finalize failed");
          }
        }
      } catch (err) {
        console.error("Verify check failed:", err);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [uid, email, companyName, userName, inviteCode, finalizeSignup, router]);

  // Countdown for resend button
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleResend = async () => {
    if (cooldown > 0) return;
    const res = await resendVerification();
    if (res.data === "sent") {
      setMsg("Verification email resent. Please check your inbox.");
      setCooldown(30);
    } else {
      setMsg(res.error?.error || "Failed to resend email");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white shadow-lg rounded-2xl p-6 text-center">
        <h1 className="text-xl font-bold text-mint-500 mb-6">
          Verify Your Email
        </h1>
        <p className="text-gray-600">{msg}</p>
        <p className="text-sm text-gray-400 mb-4">
          This page will continue automatically once you verify your email.
        </p>

        <button
          onClick={handleResend}
          disabled={resendLoading || cooldown > 0}
          className="w-full bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {resendLoading
            ? "Resending..."
            : cooldown > 0
            ? `Resend in ${cooldown}s`
            : "Resend Verification Email"}
        </button>
      </div>
    </div>
  );
}
