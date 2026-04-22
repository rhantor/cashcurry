/* eslint-disable react/prop-types */
"use client";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

function Portal({ children }) {
  const [mounted, setMounted] = useState(false);
  const elRef = useRef(null);
  if (!elRef.current) elRef.current = document.createElement("div");

  useEffect(() => {
    document.body.appendChild(elRef.current);
    setMounted(true);
    return () => {
      document.body.removeChild(elRef.current);
    };
  }, []);

  return mounted ? createPortal(children, elRef.current) : null;
}

export default function RowActions({ busy, onView, onEdit, onInc, onDelete }) {
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 176 });

  const place = () => {
    const btn = btnRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const menuW = pos.width;
    const gap = 8;
    let left = r.right - menuW;
    if (left < 8) left = 8;
    let top = r.bottom + gap;
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const menuH = menuRef.current?.offsetHeight || 160;
    if (top + menuH > vh - 8) top = r.top - gap - menuH;
    if (left + menuW > vw - 8) left = vw - 8 - menuW;
    setPos((p) => ({ ...p, top, left }));
  };

  useLayoutEffect(() => {
    if (open) place();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onScroll = () => place();
    const onResize = () => place();
    const onClickAway = (e) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target) &&
        !btnRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    window.addEventListener("mousedown", onClickAway);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mousedown", onClickAway);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        className="ml-auto px-2 py-1 rounded-lg bg-gray-100 hover:bg-gray-200"
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Row actions"
      >
        ⋯
      </button>

      {open && (
        <Portal>
          <div
            ref={menuRef}
            className="fixed z-50 w-44 rounded-xl border bg-white shadow-lg"
            style={{ top: pos.top, left: pos.left }}
            role="menu"
          >
            <button
              className="w-full text-left px-3 py-2 hover:bg-gray-50 text-indigo-600 font-medium"
              onClick={() => {
                onView?.();
                setOpen(false);
              }}
              role="menuitem"
            >
              View Details
            </button>
            <button
              className="w-full text-left px-3 py-2 hover:bg-gray-50"
              onClick={() => {
                onEdit?.();
                setOpen(false);
              }}
              role="menuitem"
            >
              Edit
            </button>
            <button
              className="w-full text-left px-3 py-2 hover:bg-gray-50"
              onClick={() => {
                onInc?.();
                setOpen(false);
              }}
              role="menuitem"
            >
              Increase Max Credit Bills
            </button>
            <button
              className="w-full text-left px-3 py-2 text-red-600 hover:bg-red-50"
              onClick={() => {
                onDelete?.();
                setOpen(false);
              }}
              role="menuitem"
            >
              Delete
            </button>
          </div>
        </Portal>
      )}
    </>
  );
}
