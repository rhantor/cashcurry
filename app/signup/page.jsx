"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { db } from "@/lib/firebase";
import { useSignupMutation } from "@/lib/redux/api/authApiSlice";
import AuthFrame from "@/app/components/auth/AuthFrame";
import { savePendingSignup } from "@/lib/signupPending";
import { Button, Field, Input } from "@/app/components/ui";

/**
 * Open a new company: an invite code and the username (both checked before
 * any account is made), the company's name, the owner's name, email and
 * password. Then the email is verified on the next screen. Signing up again
 * with the same email and password picks up a sign-up that didn't finish.
 */
export default function SignupPage() {
  const [companyName, setCompanyName] = useState("");
  const [userName, setUserName] = useState("");
  const [name, setName] = useState("");
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
    if (!name.trim()) er.name = "Enter your name";
    if (!/^[a-z0-9._-]{3,}$/i.test(userName.trim())) er.user = "3 or more letters or numbers, no spaces";
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

    // usernames are shared across the app — check this one is free
    const taken = await getDoc(doc(db, "usernames", userName.trim().toLowerCase())).catch(() => null);
    if (taken?.exists()) return setErrors({ user: "That username is taken — try another" });

    const res = await signup({ email: email.trim(), password });
    if (res.data) {
      const pending = { uid: res.data.uid, email: email.trim(), company: companyName.trim(), username: userName.trim(), name: name.trim(), inviteCode: codeKey };
      savePendingSignup(pending);
      router.push(`/signup/verify?${new URLSearchParams(pending).toString()}`);
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
        <Field label="Your name" error={errors.name}>
          {({ id, invalid }) => <Input id={id} size="lg" value={name} invalid={invalid} autoComplete="name" onChange={(e) => (setName(e.target.value), clear("name"))} placeholder="Shown on everything you enter" />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Username" error={errors.user} hint="To sign in">
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
