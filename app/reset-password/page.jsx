"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useResetPasswordMutation } from "@/lib/redux/api/authApiSlice";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const router = useRouter();

  const [resetPassword, { isLoading }] = useResetPasswordMutation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    try {
      const result = await resetPassword(email).unwrap();
      setMsg(`✅ ${result}`);
      setTimeout(() => router.push("/login"), 3000);
    } catch (err) {
      setMsg(`❌ ${err.message || "Something went wrong"}`);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white shadow-lg rounded-2xl p-6">
        <h1 className="text-xl font-bold text-mint-500 mb-6">
          Reset Password
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full border border-gray-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-mint-400 focus:outline-none"
          />
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-mint-500 text-white py-2 rounded-lg hover:bg-mint-600 disabled:opacity-50"
          >
            {isLoading ? "Sending..." : "Send Reset Link"}
          </button>
        </form>

        {msg && <p className="mt-4 text-sm text-gray-600">{msg}</p>}
      </div>
    </div>
  );
}
