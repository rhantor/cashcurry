/* eslint-disable react/prop-types */
"use client";
import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { FaRedo } from "react-icons/fa";

export default function GlobalError({ error, reset }) {
  return (
    <section className="flex min-h-screen flex-col items-center justify-center bg-background text-center px-6">
      <motion.h1
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-6xl sm:text-8xl font-bold text-mint-600 drop-shadow-lg"
      >
        Oops!
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
        className="mt-4 text-lg sm:text-2xl text-gray-700 max-w-lg"
      >
        {error?.message || "Something went wrong on our side. Please try again later."}
      </motion.p>

      <div className="mt-8 flex gap-4">
        <button
          onClick={() => reset()}
          className="inline-flex items-center gap-2 rounded-2xl bg-mint-500 px-5 py-3 text-white font-semibold shadow-lg hover:bg-mint-600 transition-colors"
        >
          <FaRedo /> Try Again
        </button>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-2xl bg-white border border-mint-100 px-5 py-3 text-mint-600 font-semibold shadow-sm hover:bg-mint-50 transition-colors"
        >
          Go Home
        </Link>
      </div>
    </section>
  );
}
