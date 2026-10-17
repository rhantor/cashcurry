"use client";
import React from "react";
import { Sheet } from "@/app/components/ui";

/**
 * The older screens' modal, now the app's own sheet: a bottom sheet on a
 * phone, centred on a computer, in the app's colours (dark mode too).
 * Rendered only while open, so it is always open. Props: title, children,
 * onClose, maxWidth (wide ones get the large sheet).
 */
export default function Modal({ title, children, onClose, maxWidth = "max-w-md" }) {
  const wide = /max-w-(2xl|3xl|4xl|5xl|6xl|7xl|full)/.test(maxWidth);
  return (
    <Sheet open onClose={onClose} title={title} size={wide ? "lg" : "md"}>
      {children}
    </Sheet>
  );
}
