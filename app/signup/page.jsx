"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { db } from "@/lib/firebase";
import { useSignupMutation } from "@/lib/redux/api/authApiSlice";
import AuthFrame from "@/app/components/auth/AuthFrame";
import { Button, Field, Input } from "@/app/components/ui";

/**
 * Open a new company: an invite code (checked before any account is made),
 * the company's name, the owner's username, email and password. Then the
 * email is verified on the next screen.
 */
export default function SignupPage() {
  const [companyName, setCompanyName] = useState("");
  const [userName, setUserName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState({});
  const [checking, setChecking] = useState(false);
  const [signup, { isLoading }] = useSignupMutation();
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const er = {};
    if (!inviteCode.trim()) er.code = "Enter the invite code you were given";
    if (!companyName.trim()) er.company = "Enter the company's name";
    if (!userName.trim()) er.user = "Pick a username";
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) er.email = "Enter a working email";
    if (password.length < 6) er.password = "At least 6 characters";
    setErrors(er);
    if (Object.keys(er).length) return;

    // the invite code is checked before any account is made
    const codeKey = inviteCode.trim().toLowerCase();
    setChecking(true);
    let codeSnap;
    try {
      codeSnap = await getDoc(doc(db, "signupInvites", codeKey));
    } catch {
      setChecking(false);
      return setErrors({ form: "Couldn't check the invite code. Try again." });
    }
    setChecking(false);
    if (!codeSnap.exists() || codeSnap.data().used === true) return setErrors({ code: "That code isn't valid, or it has been used" });

    const res = await signup({ email: email.trim(), password });
    if (res.data) {
      router.push(
        `/signup/verify?uid=${res.data.uid}&email=${encodeURIComponent(email.trim())}&company=${encodeURIComponent(companyName.trim())}&username=${encodeURIComponent(
          userName.trim()
        )}&inviteCode=${encodeURIComponent(codeKey)}`
      );
    } else {
      setErrors({ form: res.error?.error || "Couldn't create the account. Try again." });
    }
  };

  const clear = (k) => errors[k] && setErrors((x) => ({ ...x, [k]: undefined }));

  return (
    <AuthFrame title="Open your company" subtitle="You'll be its owner. Add branches and people once you're in." tagline="Bring every branch into one place.">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Field label="Invite code" error={errors.code}>
          {({ id, invalid }) => <Input id={id} size="lg" value={inviteCode} invalid={invalid} autoCapitalize="none" onChange={(e) => (setInviteCode(e.target.value), clear("code"))} />}
        </Field>
        <Field label="Company name" error={errors.company}>
          {({ id, invalid }) => <Input id={id} size="lg" value={companyName} invalid={invalid} onChange={(e) => (setCompanyName(e.target.value), clear("company"))} placeholder="e.g. Saffron Empire Sdn Bhd" />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Your username" error={errors.user}>
            {({ id, invalid }) => <Input id={id} size="lg" value={userName} invalid={invalid} autoCapitalize="none" onChange={(e) => (setUserName(e.target.value), clear("user"))} />}
          </Field>
          <Field label="Email" error={errors.email}>
            {({ id, invalid }) => <Input id={id} size="lg" type="email" autoComplete="email" value={email} invalid={invalid} onChange={(e) => (setEmail(e.target.value), clear("email"))} />}
          </Field>
        </div>
        <Field label="Password" error={errors.password} hint="At least 6 characters">
          {({ id, invalid }) => (
            <div className="relative">
              <Input
                id={id}
                size="lg"
                type={show ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                invalid={invalid}
                onChange={(e) => (setPassword(e.target.value), clear("password"))}
                className="pr-11"
              />
              <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-subtle hover:text-fg">
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          )}
        </Field>
        {errors.form && <p className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-danger">{errors.form}</p>}
        <Button type="submit" size="lg" className="w-full" loading={checking || isLoading}>
          Create account <ArrowRight className="size-4" />
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        Already have one?{" "}
        <Link href="/login" className="font-semibold text-brand hover:underline">
          Sign in
        </Link>
      </p>
    </AuthFrame>
  );
}
