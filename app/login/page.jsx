"use client";

import { looksLikeStaffId } from "@/lib/staffLogin";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import { ArrowRight, Eye, EyeOff, FlaskConical, KeyRound, Lock, ShieldCheck, UserRound } from "lucide-react";
import { useLoginMutation } from "@/lib/redux/api/authApiSlice";
import { USE_EMULATOR } from "@/lib/firebase";
import { signedIn } from "@/lib/session";
import { readPendingSignup } from "@/lib/signupPending";
import BrandPanel, { Globe } from "@/app/components/auth/BrandPanel";
import { Button, Logo, cn } from "@/app/components/ui";

// Local development only. `npm run dev:local` passes the seeded accounts and
// their shared local password; production builds never set these variables,
// and the box is hidden unless the app is on the emulators.
const LOCAL_PASSWORD = process.env.NEXT_PUBLIC_LOCAL_PASSWORD || "";
const LOCAL_ACCOUNTS = (() => {
  try {
    return JSON.parse(process.env.NEXT_PUBLIC_LOCAL_ACCOUNTS || "[]");
  } catch {
    return [];
  }
})();

/** Firebase's wording → something a person can act on. */
const friendly = (message = "", staff = false) => {
  const m = message.toLowerCase();
  if (/no login with that phone or ic/.test(m)) return "No staff login with that phone or IC number. Ask your manager.";
  if (/wrong-password|invalid-credential|invalid-login|user-not-found|not found|invalid username|invalid password|incorrect/.test(m)) return staff ? "That PIN isn't right." : "That username or password isn't right.";
  if (/too-many-requests/.test(m)) return "Too many tries. Wait a minute, then try again.";
  if (/metadata not found/.test(m)) return "This account's sign-up didn't finish. Go to Create an account and use the same email and password to finish it.";
  if (/network|offline|unavailable/.test(m)) return "Can't reach the server. Check the internet connection.";
  return message || "Couldn't sign in. Try again.";
};

/* ── the form ─────────────────────────────────────────────────────────────── */

function FieldBox({ icon: Icon, invalid, children, trailing }) {
  return (
    <div
      className={cn(
        "flex h-12 items-center gap-2.5 rounded-xl border bg-surface px-3.5 transition focus-within:border-brand focus-within:ring-4 focus-within:ring-[var(--cc-ring)]",
        invalid ? "border-danger" : "border-line"
      )}
    >
      <Icon className="size-4 shrink-0 text-subtle" />
      {children}
      {trailing}
    </div>
  );
}

function LocalAccounts({ onPick, disabled }) {
  if (!USE_EMULATOR || !LOCAL_PASSWORD || !LOCAL_ACCOUNTS.length) return null;
  return (
    <div className="mt-8 rounded-2xl border border-dashed border-warning/50 bg-warning-soft/50 p-4">
      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-warning">
        <FlaskConical className="size-3.5" /> Local demo accounts
      </p>
      <p className="mb-3 mt-0.5 text-xs text-muted">Tap one to sign in. Only shown on local data.</p>
      <div className="grid grid-cols-2 gap-2">
        {LOCAL_ACCOUNTS.map((a) => (
          <button
            key={a.login}
            type="button"
            disabled={disabled}
            onClick={() => onPick(a.login)}
            className="rounded-xl border border-line bg-surface px-3 py-2 text-left transition hover:border-brand/50 hover:bg-brand-soft/40 disabled:opacity-60"
          >
            <span className="block truncate text-sm font-semibold text-fg">{a.login}</span>
            <span className="block truncate text-[11px] text-muted">
              {a.role}
              {a.branch && !a.branch.startsWith("—") ? ` · ${a.branch}` : " · company"}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Sign in. The brand side (a receipt printing a day's close around the
 * world) tells, at a glance, what Cash Curry is for; the
 * form takes a username or email and a password (show/hide, Caps Lock
 * warning), shakes with a clear message when they're wrong and draws a check
 * before opening the app when they're right.
 */
export default function LoginPage() {
  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  // a phone or IC number: a staff member, who logs in with a 6-digit PIN (docs/STAFF_APP.md)
  const staffLogin = looksLikeStaffId(usernameOrEmail);
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [caps, setCaps] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [login, { isLoading }] = useLoginMutation();
  const router = useRouter();
  const shake = useAnimationControls(); // the form shakes on each failed try
  const fail = (message) => {
    setError(message);
    shake.start({ x: [0, -10, 10, -6, 6, -2, 0], transition: { duration: 0.45 } });
  };

  useEffect(() => {
    router.prefetch?.("/");
  }, [router]);

  const signIn = async (user, pass) => {
    setError("");
    try {
      const res = await login({ usernameOrEmail: user, password: pass });
      // a sign-up from this device that stopped before its company was made: finish it
      if (res?.error?.status === "NO_METADATA" && readPendingSignup()) return router.push("/signup/verify");
      if (!res?.data) throw new Error(res?.error?.error || res?.error?.message || "Login failed");
      // The session caches the profile and sets the routing cookies.
      signedIn(res.data.user);
      setDone(true);
      setTimeout(() => router.replace("/"), 650);
    } catch (err) {
      fail(friendly(err.message, looksLikeStaffId(user)));
    }
  };

  const submit = (e) => {
    e.preventDefault();
    if (!usernameOrEmail.trim() || !password) {
      fail("Enter your username or email and your password.");
      return;
    }
    signIn(usernameOrEmail.trim(), password);
  };

  const capsCheck = (e) => setCaps(!!e.getModifierState?.("CapsLock"));

  return (
    <div className="flex min-h-screen bg-bg">
      <BrandPanel />

      <div className="relative flex w-full flex-col lg:w-[48%]">
        {/* phones: the brand on top */}
        <div className="relative overflow-hidden bg-gradient-to-br from-[#0e5a4a] to-[#052a22] px-6 pb-16 pt-10 text-white lg:hidden">
          <div aria-hidden className="absolute -right-16 -top-16 size-56 rounded-full bg-white/10 blur-2xl" />
          {/* the turning globe, faint, on the right */}
          <Globe className="pointer-events-none absolute -right-14 top-1/2 size-60 -translate-y-1/2 opacity-[0.18]" />
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="relative flex items-center gap-3">
            <Logo inverse size={40} />
          </motion.div>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="relative mt-6 text-2xl font-bold leading-tight">
            Every till, every branch, every country.
          </motion.p>
        </div>

        <div className="relative -mt-8 flex flex-1 items-start justify-center overflow-hidden rounded-t-3xl bg-bg px-5 pb-10 pt-8 sm:px-8 lg:mt-0 lg:items-center lg:rounded-none lg:py-12">
          {/* computers: the same mint light and dots as the brand side, much softer */}
          <div aria-hidden className="pointer-events-none absolute -right-40 -top-40 hidden size-[34rem] rounded-full bg-[#22a082]/10 blur-3xl lg:block" />
          <div aria-hidden className="pointer-events-none absolute -bottom-48 left-10 hidden size-[28rem] rounded-full bg-[#75d6b8]/10 blur-3xl lg:block" />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 hidden opacity-[0.35] lg:block"
            style={{ backgroundImage: "radial-gradient(rgba(34,160,130,0.18) 1px, transparent 1px)", backgroundSize: "22px 22px" }}
          />
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 180, damping: 22, delay: 0.1 }}
            className="relative w-full max-w-sm lg:max-w-md lg:rounded-[2rem] lg:border lg:border-line lg:bg-surface/90 lg:p-9 lg:shadow-float lg:backdrop-blur"
          >
            <p className="mb-4 hidden w-max items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand lg:inline-flex">
              <span className="size-1.5 rounded-full bg-brand" /> Cash Curry
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-fg sm:text-3xl">Welcome back</h1>
            <p className="mt-1.5 text-sm text-muted">Sign in to see today&apos;s numbers.</p>

            <motion.form
              onSubmit={submit}
              animate={shake}
              className="mt-8 space-y-4"
              noValidate
            >
              <div>
                <label htmlFor="login-user" className="mb-1.5 block text-xs font-semibold text-muted">
                  Username, email, phone or IC
                </label>
                <FieldBox icon={UserRound} invalid={!!error}>
                  <input
                    id="login-user"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    value={usernameOrEmail}
                    onChange={(e) => setUsernameOrEmail(e.target.value)}
                    placeholder="e.g. kl_manager or 012-345 6789"
                    className="h-full min-w-0 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-subtle"
                  />
                </FieldBox>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label htmlFor="login-pass" className="text-xs font-semibold text-muted">
                    {staffLogin ? "PIN" : "Password"}
                  </label>
                  {staffLogin ? (
                    <span className="text-xs text-subtle">Forgot it? Ask your manager to reset it</span>
                  ) : (
                    <Link href="/reset-password" className="text-xs font-semibold text-brand hover:underline">
                      Forgot it?
                    </Link>
                  )}
                </div>
                <FieldBox
                  icon={Lock}
                  invalid={!!error}
                  trailing={
                    <button
                      type="button"
                      onClick={() => setShow((s) => !s)}
                      aria-label={show ? "Hide password" : "Show password"}
                      className="-mr-1.5 rounded-lg p-1.5 text-subtle transition hover:bg-surface-2 hover:text-fg"
                    >
                      {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  }
                >
                  <input
                    id="login-pass"
                    type={show ? "text" : "password"}
                    autoComplete="current-password"
                    // staff (phone / IC) type a 6-digit PIN: the number pad on phones
                    inputMode={staffLogin ? "numeric" : undefined}
                    maxLength={staffLogin ? 6 : undefined}
                    value={password}
                    onChange={(e) => setPassword(staffLogin ? e.target.value.replace(/\D/g, "") : e.target.value)}
                    onKeyUp={capsCheck}
                    onKeyDown={capsCheck}
                    placeholder={staffLogin ? "6-digit PIN" : "••••••••"}
                    className="h-full min-w-0 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-subtle"
                  />
                </FieldBox>
                <AnimatePresence>
                  {caps && (
                    <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-1.5 flex items-center gap-1 text-xs font-medium text-warning">
                      <KeyRound className="size-3.5" /> Caps Lock is on
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              <AnimatePresence mode="wait" initial={false}>
                {error && (
                  <motion.p
                    key={error}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, transition: { duration: 0.1 } }}
                    role="alert"
                    className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-danger"
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>

              <Button type="submit" size="lg" className="w-full" loading={isLoading && !done} success={done}>
                Sign in <ArrowRight className="size-4" />
              </Button>
            </motion.form>

            <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-subtle">
              <ShieldCheck className="size-3.5" /> Your connection is secure
            </p>
            <p className="mt-3 text-center text-sm text-muted">
              New restaurant?{" "}
              <Link href="/signup" className="font-semibold text-brand hover:underline">
                Create an account
              </Link>
            </p>

            <LocalAccounts disabled={isLoading || done} onPick={(u) => signIn(u, LOCAL_PASSWORD)} />
          </motion.div>
        </div>
      </div>
    </div>
  );
}
