"use client";
// Ops (30 Oct): today at the branch, on the phone — what needs you, the
// till, who is in, who does what (app/components/ops/OpsHome.jsx).
import { Suspense } from "react";
import { Skeleton } from "@/app/components/ui";
import OpsHome from "@/app/components/ops/OpsHome";

export default function OpsPage() {
  return (
    <Suspense fallback={<Skeleton className="m-6 h-64" rounded="rounded-2xl" />}>
      <OpsHome />
    </Suspense>
  );
}
