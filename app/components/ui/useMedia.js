"use client";
import { useSyncExternalStore } from "react";

/** True while the CSS media query matches; false on the server. */
export function useMedia(query) {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false
  );
}

/** Phone-sized screen (below Tailwind's `sm`): pickers open as bottom sheets there. */
export const useIsPhone = () => useMedia("(max-width: 639px)");
