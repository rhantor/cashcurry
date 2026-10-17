"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Eye, EyeOff, FlaskConical, KeyRound, Landmark, Lock, ShieldCheck, TrendingUp, UserRound, Wallet } from "lucide-react";
import { useLoginMutation } from "@/lib/redux/api/authApiSlice";
import { USE_EMULATOR } from "@/lib/firebase";
import { signedIn } from "@/lib/session";
import { Button, cn } from "@/app/components/ui";

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
const friendly = (message = "") => {
  const m = message.toLowerCase();
  if (/wrong-password|invalid-credential|invalid-login|user-not-found|not found|invalid password|incorrect/.test(m)) return "That username or password isn't right.";
  if (/too-many-requests/.test(m)) return "Too many tries. Wait a minute, then try again.";
  if (/network|offline|unavailable/.test(m)) return "Can't reach the server. Check the internet connection.";
  return message || "Couldn't sign in. Try again.";
};

/* ── the brand side: a calm, moving picture of what the app does ─────────── */

function FloatingCard({ icon: Icon, label, value, note, tone, className, delay = 0, drift = 10 }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, type: "spring", stiffness: 160, damping: 20 }}
      className={cn("absolute", className)}
    >
      <motion.div
        animate={reduce ? undefined : { y: [0, -drift, 0] }}
        transition={{ duration: 6 + delay * 2, repeat: Infinity, ease: "easeInOut" }}
        className="flex items-center gap-3 rounded-2xl border border-white/20 bg-white/15 px-4 py-3 text-white shadow-[0_20px_50px_-20px_rgba(0,0,0,0.45)] backdrop-blur-md"
      >
        <span className={cn("flex size-10 items-center justify-center rounded-xl", tone)}>
          <Icon className="size-5" />
        </span>
        <span>
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-white/70">{label}</span>
          <span className="block text-lg font-bold tabular-nums leading-tight">{value}</span>
          {note && <span className="block text-[11px] font-semibold text-[#a9e9d1]">{note}</span>}
        </span>
      </motion.div>
    </motion.div>
  );
}

/** A sales line that draws itself, then breathes. */
function Sparkline() {
  const reduce = useReducedMotion();
  const d = "M0 70 C 30 66, 45 40, 75 46 S 120 72, 150 50 S 200 18, 230 30 S 280 8, 320 12";
  return (
    <svg viewBox="0 0 320 90" className="h-[clamp(3.5rem,10vh,6rem)] w-full" fill="none" aria-hidden>
      <defs>
        <linearGradient id="lg-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path
        d={`${d} L 320 90 L 0 90 Z`}
        fill="url(#lg-fill)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 1 }}
      />
      <motion.path
        d={d}
        stroke="#ffffff"
        strokeWidth="3"
        strokeLinecap="round"
        initial={{ pathLength: reduce ? 1 : 0 }}
        animate={{ pathLength: 1 }}
        transition={{ delay: 0.4, duration: 1.6, ease: "easeInOut" }}
      />
      <motion.circle
        cx="320"
        cy="12"
        r="5"
        fill="#ffffff"
        initial={{ scale: 0 }}
        animate={reduce ? { scale: 1 } : { scale: [0, 1.4, 1] }}
        transition={{ delay: 2, duration: 0.6 }}
      />
    </svg>
  );
}

function BrandPanel() {
  const reduce = useReducedMotion();
  return (
    <div className="relative hidden overflow-hidden bg-gradient-to-br from-[#1f9a7c] via-[#14806a] to-[#0b4d40] lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-[52%] lg:flex-col lg:justify-between lg:gap-6 lg:p-10 xl:p-12">
      {/* soft moving light */}
      <motion.div
        aria-hidden
        className="absolute -left-32 -top-32 size-[28rem] rounded-full bg-[#75d6b8]/25 blur-3xl"
        animate={reduce ? undefined : { x: [0, 60, 0], y: [0, 40, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="absolute -bottom-40 right-0 size-[32rem] rounded-full bg-white/10 blur-3xl"
        animate={reduce ? undefined : { x: [0, -50, 0], y: [0, -30, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* faint dots */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.12]"
        style={{ backgroundImage: "radial-gradient(#ffffff 1px, transparent 1px)", backgroundSize: "22px 22px" }}
      />

      <div className="relative flex items-center gap-3 text-white">
        <span className="flex size-11 items-center justify-center rounded-2xl bg-white text-lg font-black text-[#14806a] shadow-lg">C</span>
        <span className="text-xl font-bold tracking-tight">Cash Curry</span>
      </div>

      <div className="relative">
        <div className="relative mx-auto h-[clamp(11rem,34vh,19rem)] max-w-md">
          <FloatingCard icon={TrendingUp} label="Today's sales" value="RM 2,250.50" note="▲ 12% vs last week" tone="bg-white/20" className="left-0 top-2" delay={0.2} />
          <FloatingCard icon={Wallet} label="Cash in hand" value="RM 2,050.00" tone="bg-[#a9e9d1]/30" className="right-0 top-24" delay={0.45} drift={8} />
          <FloatingCard icon={Landmark} label="Bank" value="+ RM 3,900.00" tone="bg-[#9cc3ff]/30" className="bottom-0 left-10" delay={0.7} drift={12} />
        </div>
        <div className="mt-4 max-w-md">
          <Sparkline />
        </div>
      </div>

      <div className="relative max-w-md text-white">
        <motion.h2 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="text-2xl font-bold leading-tight tracking-tight xl:text-3xl">
          Every ringgit, every branch — in one place.
        </motion.h2>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="mt-3 text-sm text-white/75">
          Sales, costs, cash and the bank for all your restaurants, the moment they happen.
        </motion.p>
      </div>
    </div>
  );
}

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
 * Sign in. The brand side tells, at a glance, what Cash Curry is for; the
 * form takes a username or email and a password (show/hide, Caps Lock
 * warning), shakes with a clear message when they're wrong and draws a check
 * before opening the app when they're right.
 */
export default function LoginPage() {
  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [caps, setCaps] = useState(false);
  const [error, setError] = useState("");
  const [tries, setTries] = useState(0); // shakes the form on each failed try
  const [done, setDone] = useState(false);
  const [login, { isLoading }] = useLoginMutation();
  const router = useRouter();

  useEffect(() => {
    router.prefetch?.("/");
  }, [router]);

  const signIn = async (user, pass) => {
    setError("");
    try {
      const res = await login({ usernameOrEmail: user, password: pass });
      if (!res?.data) throw new Error(res?.error?.error || res?.error?.message || "Login failed");
      // The session caches the profile and sets the routing cookies.
      signedIn(res.data.user);
      setDone(true);
      setTimeout(() => router.replace("/"), 650);
    } catch (err) {
      setError(friendly(err.message));
      setTries((t) => t + 1);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    if (!usernameOrEmail.trim() || !password) {
      setError("Enter your username or email and your password.");
      setTries((t) => t + 1);
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
        <div className="relative overflow-hidden bg-gradient-to-br from-[#1f9a7c] to-[#0b4d40] px-6 pb-16 pt-10 text-white lg:hidden">
          <div aria-hidden className="absolute -right-16 -top-16 size-56 rounded-full bg-white/10 blur-2xl" />
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="relative flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-white text-base font-black text-[#14806a]">C</span>
            <span className="text-lg font-bold">Cash Curry</span>
          </motion.div>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="relative mt-6 text-2xl font-bold leading-tight">
            Every ringgit, every branch.
          </motion.p>
        </div>

        <div className="relative -mt-8 flex flex-1 items-start justify-center rounded-t-3xl bg-bg px-5 pb-10 pt-8 sm:px-8 lg:mt-0 lg:items-center lg:rounded-none">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 180, damping: 22, delay: 0.1 }}
            className="w-full max-w-sm"
          >
            <h1 className="text-2xl font-bold tracking-tight text-fg sm:text-3xl">Welcome back</h1>
            <p className="mt-1.5 text-sm text-muted">Sign in to see today&apos;s numbers.</p>

            <motion.form
              key={tries}
              onSubmit={submit}
              animate={tries ? { x: [0, -10, 10, -6, 6, -2, 0] } : undefined}
              transition={{ duration: 0.45 }}
              className="mt-8 space-y-4"
              noValidate
            >
              <div>
                <label htmlFor="login-user" className="mb-1.5 block text-xs font-semibold text-muted">
                  Username or email
                </label>
                <FieldBox icon={UserRound} invalid={!!error}>
                  <input
                    id="login-user"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    value={usernameOrEmail}
                    onChange={(e) => setUsernameOrEmail(e.target.value)}
                    placeholder="e.g. kl_manager"
                    className="h-full min-w-0 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-subtle"
                  />
                </FieldBox>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label htmlFor="login-pass" className="text-xs font-semibold text-muted">
                    Password
                  </label>
                  <Link href="/reset-password" className="text-xs font-semibold text-brand hover:underline">
                    Forgot it?
                  </Link>
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
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyUp={capsCheck}
                    onKeyDown={capsCheck}
                    placeholder="••••••••"
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

              <AnimatePresence>
                {error && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    role="alert"
                    className="overflow-hidden rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm font-medium text-danger"
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
