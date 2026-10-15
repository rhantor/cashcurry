"use client";
import { motion } from "framer-motion";
import { item, stagger } from "./motion";

/**
 * Children appear one after another (cards on a dashboard, rows in a list).
 * Wrap each child in <Stagger.Item>, or use components that already carry the
 * `rise` variant (Card).
 */
export default function Stagger({ as = "div", gap, delay, className, children }) {
  const M = motion[as] || motion.div;
  return (
    <M variants={stagger(gap, delay)} initial="hidden" animate="show" className={className}>
      {children}
    </M>
  );
}

Stagger.Item = function StaggerItem({ as = "div", className, children }) {
  const M = motion[as] || motion.div;
  return (
    <M variants={item} className={className}>
      {children}
    </M>
  );
};
