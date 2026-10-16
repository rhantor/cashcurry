"use client";
import { useMemo } from "react";
import { toast } from "@/app/components/ui/notify";

/**
 * The purchase screens' toast helpers, now shown by the app-wide toasts
 * (app/components/ui). Kept so those screens didn't need changing;
 * new code should use `toast` from "@/app/components/ui/notify" directly.
 */
export default function useToast() {
  return useMemo(
    () => ({
      toastOk: (msg) => toast.success(msg),
      toastError: (msg) => toast.error(msg),
      toastInfo: (msg) => toast.info(msg),
      toastNode: null,
    }),
    []
  );
}
