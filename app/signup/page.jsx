/* eslint-disable react/react-in-jsx-scope */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSignupMutation } from "@/lib/redux/api/authApiSlice";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function SignupPage() {
  const [companyName, setCompanyName] = useState("");
  const [userName, setUserName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [msg, setMsg] = useState("");

  const [signup, { isLoading }] = useSignupMutation();
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg("");

    // Validate invite code before creating Firebase Auth user
    const codeKey = inviteCode.trim().toLowerCase();
    let codeSnap;
    try {
      codeSnap = await getDoc(doc(db, "signupInvites", codeKey));
    } catch {
      setMsg("Failed to validate invite code. Please try again.");
      return;
    }

    if (!codeSnap.exists() || codeSnap.data().used === true) {
      setMsg("Invalid or already used invite code.");
      return;
    }

    const res = await signup({ email, password });

    if (res.data) {
      router.push(
        `/signup/verify?uid=${res.data.uid}&email=${encodeURIComponent(
          email
        )}&company=${encodeURIComponent(
          companyName
        )}&username=${encodeURIComponent(userName)}&inviteCode=${encodeURIComponent(codeKey)}`
      );
    } else {
      setMsg(res.error?.error || "Signup failed");
    }
  };

  return (
    <div className="min-h-screen flex bg-gray-100">
      {/* LEFT SIDE (SVG / BRANDING) */}
      <div className="hidden lg:flex w-1/2 items-center justify-center bg-mint-500">
        <div className="max-w-md text-center text-white px-8">
          <svg
            viewBox="0 0 512 512"
            className="w-72 mx-auto mb-6"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle cx="256" cy="256" r="256" fill="white" opacity="0.15" />
            <rect
              x="156"
              y="150"
              width="200"
              height="200"
              rx="20"
              fill="white"
            />
            <path
              d="M200 260h112M200 300h112"
              stroke="#F97316"
              strokeWidth="10"
              strokeLinecap="round"
            />
          </svg>

          <h2 className="text-3xl font-bold">Create Your Company</h2>
          <p className="mt-2 text-mint-100">
            Start managing sales, inventory, and staff in one system
          </p>
        </div>
      </div>

      {/* RIGHT SIDE (FORM) */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-white shadow-xl rounded-2xl p-8">
          <h1 className="text-2xl font-bold text-center text-mint-500 mb-6">
            Create Company Account
          </h1>

          {msg && (
            <p className="text-red-500 text-sm text-center mb-3">{msg}</p>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              placeholder="Invite Code"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-mint-400 outline-none"
              required
            />

            <input
              type="text"
              placeholder="Company Name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-mint-400 outline-none"
              required
            />

            <input
              type="text"
              placeholder="Username"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="w-full border border-gray-300 p-3 rounded-lg focus:ring-2 focus:ring-mint-400 outline-none"
              required
            />

            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
              {isLoading ? "Validating..." : "Sign Up"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
