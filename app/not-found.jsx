// app/not-found.jsx
"use client";

import React from "react";

import Link from "next/link";
import { motion } from "framer-motion";
import { FaArrowLeft } from "react-icons/fa";

export default function NotFound() {
  return (
    <section className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-[#f2edff] via-[#ffe1e1] to-[#ffd1f1] text-center px-6">
      <motion.h1
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-7xl sm:text-9xl font-bold text-black drop-shadow-lg"
      >
        404
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
        className="mt-4 text-lg sm:text-2xl text-black/90"
      >
        Oops! The page you’re looking for doesn’t exist.
      </motion.p>

      <Link
        href="/"
        className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-black font-semibold shadow-lg hover:bg-[#f88cd8] hover:text-black transition-all duration-300"
      >
        <FaArrowLeft /> Go Back Home
      </Link>
    </section>
  );
}
