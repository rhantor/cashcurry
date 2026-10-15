"use client";
import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { cn } from "./cn";
import Popover from "./Popover";

/**
 * A dropdown of actions. Arrow keys move, Enter picks, Esc closes.
 *
 *   <Menu trigger={(p) => <Button {...p}>…</Button>}
 *         items={[{ label: "Edit", icon: Pencil, onSelect }, "divider", { label: "Delete", danger: true, onSelect }]} />
 *
 * `trigger` gets { ref, onClick, "aria-expanded" } to spread on its button.
 */
export default function Menu({ trigger, items, align = "start", width = 220 }) {
  return (
    <Popover
      align={align}
      width={width}
      trigger={({ open, toggle, ref }) =>
        trigger({ ref, onClick: toggle, "aria-haspopup": "menu", "aria-expanded": open })
      }
    >
      {({ close }) => <MenuList items={items} close={close} />}
    </Popover>
  );
}

function MenuList({ items, close }) {
  const list = useRef(null);
  // Keyboard users start on the first item.
  useEffect(() => {
    list.current?.querySelector("button:not([disabled])")?.focus({ preventScroll: true });
  }, []);
  const move = (e) => {
    const buttons = [...(list.current?.querySelectorAll("button:not([disabled])") || [])];
    const i = buttons.indexOf(document.activeElement);
    if (e.key === "ArrowDown") buttons[(i + 1) % buttons.length]?.focus();
    else if (e.key === "ArrowUp") buttons[(i - 1 + buttons.length) % buttons.length]?.focus();
    else return;
    e.preventDefault();
  };
  return (
    <div role="menu" ref={list} onKeyDown={move}>
      {items.map((it, i) =>
        it === "divider" ? (
          <div key={i} className="my-1 h-px bg-line" />
        ) : (
          <motion.button
            key={it.label}
            type="button"
            role="menuitem"
            disabled={it.disabled}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0, transition: { delay: i * 0.02 } }}
            onClick={() => {
              close();
              it.onSelect?.();
            }}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium outline-none transition-colors",
              "focus:bg-surface-2 hover:bg-surface-2 disabled:opacity-50",
              it.danger ? "text-danger" : "text-fg"
            )}
          >
            {it.icon && <it.icon className="size-4 shrink-0 opacity-70" aria-hidden="true" />}
            <span className="flex-1">{it.label}</span>
            {it.hint && <span className="text-xs text-subtle">{it.hint}</span>}
          </motion.button>
        )
      )}
    </div>
  );
}
