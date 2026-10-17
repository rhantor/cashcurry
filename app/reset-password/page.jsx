"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, MailCheck, Send } from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useResetPasswordMutation } from "@/lib/redux/api/authApiSlice";
import AuthFrame from "@/app/components/auth/AuthFrame";
import { Button, Field, Input } from "@/app/components/ui";

// Staff added without an email get a stand-in address (app/api/auth/create-staff);
// no reset email can reach it.
const PLACEHOLDER = /@cashcurry\.local$/i;

/**
 * Forgot the password: a reset link to the email on the account, found from
 * the username or typed in. Accounts without a real email are told to ask
 * their branch admin, who can set a new password.
 */
export default function ResetPasswordPage() {
  const [who, setWho] = useState("");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState("");
  const [error, setError] = useState("");
  const [resetPassword, { isLoading }] = useResetPasswordMutation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const typed = who.trim();
    if (!typed) return setError("Enter your username or email.");
    let to = typed;
    if (!typed.includes("@")) {
      const snap = await getDoc(doc(db, "usernames", typed.toLowerCase())).catch(() => null);
      if (!snap?.exists()) return setError("There's no account with that username.");
      to = snap.data().email || "";
    }
    if (!to || PLACEHOLDER.test(to)) return setError("This account has no email to send a link to. Ask your branch admin or the owner to set a new password.");
    setEmail(to);
    try {
      const result = await resetPassword(to).unwrap();
      setSent(typeof result === "string" ? result : "Check your inbox for the reset link.");
    } catch (err) {
      setError(err?.message || "Couldn't send the link. Check the email and try again.");
    }
  };

  return (
    <AuthFrame title="Forgot your password?" subtitle="We'll email a link to set a new one.">
      <AnimatePresence mode="wait" initial={false}>
        {sent ? (
          <motion.div key="sent" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-brand-soft p-5 text-center">
            <MailCheck className="mx-auto size-8 text-brand" />
            <p className="mt-2 text-sm font-semibold text-fg">Link sent to {email.replace(/^(.{2}).*(@.*)$/, "$1•••$2")}</p>
            <p className="mt-1 text-xs text-muted">{sent} It can take a minute; check spam too.</p>
          </motion.div>
        ) : (
          <motion.form key="form" onSubmit={handleSubmit} className="space-y-4" noValidate>
            <Field label="Username or email" error={error}>
              {({ id, invalid }) => <Input id={id} size="lg" autoCapitalize="none" autoComplete="username" value={who} invalid={invalid} onChange={(e) => setWho(e.target.value)} placeholder="e.g. kl_manager" />}
            </Field>
            <Button type="submit" size="lg" icon={Send} className="w-full" loading={isLoading}>
              Send reset link
            </Button>
          </motion.form>
        )}
      </AnimatePresence>
      <Link href="/login" className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline">
        <ArrowLeft className="size-4" /> Back to sign in
      </Link>
    </AuthFrame>
  );
}
