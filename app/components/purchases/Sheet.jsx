"use client";
import { Sheet as KitSheet } from "@/app/components/ui";

/**
 * The purchase screens' sheet, now the app's own (app/components/ui): a
 * bottom sheet on a phone with a drag handle, centred on a computer; the
 * title and the footer stay put while the content scrolls; Esc and the
 * backdrop close it; the page behind doesn't scroll.
 * Same props as before: open, title, subtitle, onClose, children, footer, maxWidth.
 */
export default function Sheet({ open, title, subtitle, onClose, children, footer, maxWidth = "max-w-3xl" }) {
  const wide = /max-w-(3xl|4xl|5xl|6xl|7xl|full)/.test(maxWidth);
  return (
    <KitSheet open={open} onClose={onClose} title={title} description={subtitle} footer={footer} size={wide ? "lg" : "md"}>
      {children}
    </KitSheet>
  );
}
