"use client";
import { motion } from "framer-motion";
import BrandPanel, { Globe } from "@/app/components/auth/BrandPanel";
import { Logo } from "@/app/components/ui";

/**
 * The frame every sign-in screen shares with the login page: the turning
 * globe on the left on computers, the brand on top on phones, and the form in
 * a card. title / subtitle head the card; children are the form.
 */
export default function AuthFrame({ title, subtitle, tagline = "Every till, every branch, every country.", children }) {
  return (
    <div className="flex min-h-screen bg-bg">
      <BrandPanel />
      <div className="relative flex w-full flex-col lg:w-[48%]">
        {/* phones: the brand on top */}
        <div className="relative overflow-hidden bg-gradient-to-br from-[#0e5a4a] to-[#052a22] px-6 pb-16 pt-10 text-white lg:hidden">
          <div aria-hidden className="absolute -right-16 -top-16 size-56 rounded-full bg-white/10 blur-2xl" />
          <Globe className="pointer-events-none absolute -right-14 top-1/2 size-60 -translate-y-1/2 opacity-[0.18]" />
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="relative">
            <Logo inverse size={40} />
          </motion.div>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="relative mt-6 text-2xl font-bold leading-tight">
            {tagline}
          </motion.p>
        </div>

        <div className="relative -mt-8 flex flex-1 items-start justify-center overflow-hidden rounded-t-3xl bg-bg px-5 pb-10 pt-8 sm:px-8 lg:mt-0 lg:items-center lg:rounded-none lg:py-12">
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
            <h1 className="text-2xl font-bold tracking-tight text-fg sm:text-3xl">{title}</h1>
            {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
            <div className="mt-7">{children}</div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
