"use client";
import React, { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Retired screen.
 *
 * This page used to write to the very same `requisitions` collection that
 * /purchases/purchase-orders reads, but with a different status vocabulary
 * (Pending / Approved / Sent / Rejected instead of Pending / Sent / Received /
 * Cancelled). A document approved here would land on the Purchase Orders board
 * with an unrecognised status and no available actions, so the two screens are
 * now consolidated into one.
 *
 * It was never linked from the sidebar, so this redirect only catches old
 * bookmarks and direct links. The Purchase Orders page maps the legacy statuses
 * onto its own pipeline, so documents created here remain usable.
 */
export default function RequisitionsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/purchases/purchase-orders");
  }, [router]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)] py-16 text-center">
        <h1 className="text-lg font-bold text-slate-700">Requisitions have moved</h1>
        <p className="text-slate-500 mt-1">Taking you to Purchase Orders…</p>
      </div>
    </div>
  );
}
