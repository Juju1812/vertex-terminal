"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { animate, useMotionValue, useTransform, motion, type MotionStyle } from "framer-motion";

/* ── AnimatedPrice ─────────────────────────────────────────
   Smoothly tweens between price values when `value` changes.
   Briefly highlights the digits in gain-green or loss-red
   on transition so users feel the move. Pure presentational.
*/
interface Props {
  value: number;
  format?: (n: number) => string;
  style?: CSSProperties;
  duration?: number;
  flashOnChange?: boolean;
}

const defaultFormat = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n);

export default function AnimatedPrice({
  value,
  format = defaultFormat,
  style,
  duration = 0.6,
  flashOnChange = true,
}: Props) {
  const mv = useMotionValue(value);
  const display = useTransform(mv, (v) => format(v));
  const [flash, setFlash] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    const prev = mv.get();
    if (prev === value) return;
    if (flashOnChange) {
      setFlash(value >= prev ? "up" : "down");
      const t = setTimeout(() => setFlash(null), 700);
      const controls = animate(mv, value, {
        duration,
        ease: [0.2, 0.7, 0.3, 1],
      });
      return () => { controls.stop(); clearTimeout(t); };
    }
    const controls = animate(mv, value, { duration, ease: [0.2, 0.7, 0.3, 1] });
    return () => controls.stop();
  }, [value, mv, duration, flashOnChange]);

  const flashColor =
    flash === "up"   ? "var(--gain)" :
    flash === "down" ? "var(--loss)" :
    undefined;

  return (
    <motion.span
      animate={{ color: flashColor ?? (style?.color as string) ?? "currentColor" }}
      transition={{ duration: 0.4 }}
      style={{ display: "inline-block", ...(style as MotionStyle) }}
    >
      <motion.span>{display}</motion.span>
    </motion.span>
  );
}
