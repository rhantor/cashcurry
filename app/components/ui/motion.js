// Motion for the whole app: one place for timing, so every screen moves alike.
// Quick and springy, never slow — most things finish in under 250 ms. Users who
// asked their device for less motion get instant changes (MotionConfig
// reducedMotion="user" in UIProvider, plus the CSS rule in globals.css).

/** Springs: `snappy` for small things (buttons, toggles), `soft` for panels. */
export const spring = {
  snappy: { type: "spring", stiffness: 520, damping: 34, mass: 0.7 },
  soft: { type: "spring", stiffness: 300, damping: 30 },
  bouncy: { type: "spring", stiffness: 420, damping: 18 },
};

export const ease = {
  out: [0.22, 1, 0.36, 1],
  snappy: [0.2, 0.8, 0.2, 1],
};

/** Fade + rise a little: page sections, cards. */
export const rise = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.28, ease: ease.out } },
  exit: { opacity: 0, y: 4, transition: { duration: 0.15 } },
};

/** A list whose items appear one after another. Put `item` on each child. */
export const stagger = (gap = 0.045, delay = 0) => ({
  hidden: {},
  show: { transition: { staggerChildren: gap, delayChildren: delay } },
});
export const item = rise;

/** Dialogs: scale up from slightly smaller. */
export const pop = {
  hidden: { opacity: 0, scale: 0.94, y: 6 },
  show: { opacity: 1, scale: 1, y: 0, transition: spring.soft },
  exit: { opacity: 0, scale: 0.97, transition: { duration: 0.12 } },
};

export const fade = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.18 } },
  exit: { opacity: 0, transition: { duration: 0.14 } },
};

/** Pressable things shrink a touch under the finger. */
export const press = { whileTap: { scale: 0.97 }, transition: spring.snappy };
