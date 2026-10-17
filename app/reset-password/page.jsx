"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, MailCheck, Send } from "lucide-react";
import { useResetPasswordMutation } from "@/lib/redux/api/authApiSlice";
import AuthFrame from "@/app/components/auth/AuthFrame";
import { Button, Field, Input } from "@/app/components/ui";

/** Forgot the password: send a reset link to the email on the account. */
export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState("");
  const [error, setError] = useState("");
  const [resetPassword, { isLoading }] = useResetPasswordMutation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email.trim()) return setError("Enter the email on your account.");
    try {
      const result = await resetPassword(email.trim()).unwrap();
      setSent(typeof result === "string" ? result : "Check your inbox for the reset link.");
    } catch (err) {
      setError(err?.message || "Couldn't send the link. Check the email and try again.");
    }
  };

  return (
    <AuthFrame title="Forgot your password?" subtitle="We'll email you a link to set a new one.">
      <AnimatePresence mode="wait" initial={false}>
        {sent ? (
          <motion.div key="sent" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-brand-soft p-5 text-center">
            <MailCheck className="mx-auto size-8 text-brand" />
            <p className="mt-2 text-sm font-semibold text-fg">Link sent to {email}</p>
            <p className="mt-1 text-xs text-muted">{sent} It can take a minute; check spam too.</p>
          </motion.div>
        ) : (
          <motion.form key="form" onSubmit={handleSubmit} className="space-y-4" noValidate>
            <Field label="Email" error={error}>
              {({ id, invalid }) => <Input id={id} size="lg" type="email" autoComplete="email" value={email} invalid={invalid} onChange={(e) => setEmail(e.target.value)} placeholder="you@restaurant.com" />}
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
