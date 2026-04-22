/* eslint-disable no-undef */
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import { useLoginMutation } from "@/lib/redux/api/authApiSlice";

export default function LoginPage() {
  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  const [login, { isLoading }] = useLoginMutation();
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg("");

    try {
      const res = await login({ usernameOrEmail, password });

      if (!res?.data) {
        throw new Error(res?.error?.error || "Login failed");
      }

      const user = res.data.user;

      localStorage.setItem("user", JSON.stringify(user));
      window.dispatchEvent(new Event("storage"));

      const cookieOpts = {
        path: "/",
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        expires: 30,
      };

      Cookies.set("isLoggedIn", "true", cookieOpts);
      Cookies.set("role", user.role ?? "", cookieOpts);
      Cookies.set("companyId", user.companyId ?? "", cookieOpts);
      if (user.branchId) Cookies.set("branchId", user.branchId, cookieOpts);

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
        </div>
      </div>
    </div>
  );
}
