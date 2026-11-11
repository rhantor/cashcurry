"use client";
// Retry a query that failed, a few times (11 Nov 2026): a page opened straight
// after another can send its first read before Firebase has the sign-in, and
// the rules refuse it; RTK Query doesn't try again by itself.
import { useEffect, useRef } from "react";

export default function useRetryOnError({ isError, refetch }, { times = 5, ms = 1500 } = {}) {
  const tries = useRef(0);
  useEffect(() => {
    if (!isError || tries.current >= times) return;
    const t = setTimeout(() => {
      tries.current += 1;
      refetch?.();
    }, ms);
    return () => clearTimeout(t);
  }, [isError, refetch, times, ms]);
}
