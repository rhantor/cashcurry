/* eslint-disable react/prop-types */
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useLoginMutation } from "@/lib/redux/api/authApiSlice";
import { USE_EMULATOR } from "@/lib/firebase";
import { signedIn } from "@/lib/session";

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

function LocalAccounts({ onPick, disabled }) {
  if (!USE_EMULATOR || !LOCAL_PASSWORD || !LOCAL_ACCOUNTS.length) return null;
  return (
    <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4">
      <p className="text-sm font-semibold text-amber-800">Local demo accounts</p>
      <p className="mb-3 text-xs text-amber-700">Click one to log in. Only shown on local data.</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {LOCAL_ACCOUNTS.map((a) => (
          <button
            key={a.login}
            type="button"
            disabled={disabled}
            onClick={() => onPick(a.login)}
            className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-left text-sm hover:border-amber-400 hover:bg-amber-100 disabled:opacity-60"
          >
            <span className="block font-medium text-gray-800">{a.login}</span>
            <span className="block text-xs text-gray-500">
              {a.role}
              {a.branch && !a.branch.startsWith("—") ? ` · ${a.branch}` : " · company"}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function LoginPage() {
  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  const [login, { isLoading }] = useLoginMutation();
  const router = useRouter();

  const handleSubmit = (e) => {
    e.preventDefault();
    signIn(usernameOrEmail, password);
  };

  const signIn = async (usernameOrEmail, password) => {
    setMsg("");

    try {
      const res = await login({ usernameOrEmail, password });

      if (!res?.data) {
        throw new Error(res?.error?.error || "Login failed");
      }

      // The session caches the profile and sets the routing cookies.
      signedIn(res.data.user);

      router.replace("/");
    } catch (err) {
      setMsg(err.message || "Login failed");
    }
  };

  return (
    <div className="min-h-screen flex bg-gray-100">
      {/* LEFT SIDE (SVG / Illustration) */}
      <div className="hidden lg:flex w-1/2 items-center justify-center bg-mint-500">
        <div className="max-w-md text-center text-white px-8">
          {/* Example SVG */}
          <svg
            viewBox="0 0 512 512"
            className="w-72 mx-auto mb-6"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle cx="256" cy="256" r="256" fill="white" opacity="0.15" />
            <path
              d="M256 128c53 0 96 43 96 96s-43 96-96 96-96-43-96-96 43-96 96-96z"
              fill="white"
            />
            <path
              d="M128 384c0-70.7 57.3-128 128-128s128 57.3 128 128"
              fill="white"
            />
          </svg>

          <h2 className="text-3xl font-bold">Welcome Back</h2>
          <p className="mt-2 text-mint-100">
            Login to manage your POS system, inventory, and sales
          </p>
        </div>
      </div>

      {/* RIGHT SIDE (FORM) */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
          <h1 className="text-2xl font-bold text-center text-mint-500 mb-6">
            Login to your account
          </h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              placeholder="Username or Email"
              value={usernameOrEmail}
              onChange={(e) => setUsernameOrEmail(e.target.value)}
              className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-mint-400 outline-none"
              required
            />

            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-mint-400 outline-none"
              required
            />

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-mint-500 text-white py-3 rounded-lg font-medium hover:bg-mint-600 transition disabled:opacity-60"
            >
              {isLoading ? "Logging in..." : "Login"}
            </button>
          </form>

          {msg && (
            <p className="text-center mt-4 text-sm text-red-600">{msg}</p>
          )}

          <p className="mt-4 text-center text-sm">
            <a
              href="/reset-password"
              className="text-mint-500 hover:underline"
            >
              Forgot your password?
            </a>
          </p>

          <p className="mt-2 text-center text-sm text-gray-500">
            Don&apos;t have an account?{" "}
            <a href="/signup" className="text-mint-500 hover:underline">
              Sign up here
            </a>
          </p>

          <LocalAccounts disabled={isLoading} onPick={(u) => signIn(u, LOCAL_PASSWORD)} />
        </div>
      </div>
    </div>
  );
}
