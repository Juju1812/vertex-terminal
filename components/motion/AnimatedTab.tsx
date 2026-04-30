"use client";

import { AnimatePresence, motion } from "framer-motion";
import { type ReactNode } from "react";

/* ── AnimatedTab ─────────────────────────────────────────────
   Wrap tab content with AnimatePresence keyed by tab id so each
   change cross-fades + slides. Use mode="wait" to avoid layout
   thrash when the panels have very different heights.
*/
interface Props {
  tabKey: string;
  children: ReactNode;
}

export function AnimatedTab({ tabKey, children }: Props) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={tabKey}
        initial={{ opacity: 0, y: 14, filter: "blur(6px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
        transition={{ duration: 0.32, ease: [0.23, 1, 0.32, 1] }}
        style={{ width: "100%" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
