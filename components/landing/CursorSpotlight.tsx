"use client";

import { useEffect, useRef } from "react";

/* ── CursorSpotlight ─────────────────────────────────────────
   Soft gold radial glow that follows the cursor across the
   hero. Pointer-events none, additive blend. Disables on
   coarse pointers (touch devices) and reduced motion.
*/
export default function CursorSpotlight() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (coarse || reduced) {
      el.style.display = "none";
      return;
    }

    let raf = 0;
    let tx = window.innerWidth / 2;
    let ty = window.innerHeight / 2;
    let cx = tx;
    let cy = ty;

    const onMove = (e: PointerEvent) => {
      tx = e.clientX;
      ty = e.clientY;
    };

    const tick = () => {
      cx += (tx - cx) * 0.15;
      cy += (ty - cy) * 0.15;
      el.style.transform = `translate3d(${cx - 240}px, ${cy - 240}px, 0)`;
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", onMove);
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: 480,
        height: 480,
        pointerEvents: "none",
        zIndex: 4,
        background:
          "radial-gradient(circle, rgba(255,200,100,0.18) 0%, rgba(255,160,60,0.08) 30%, transparent 70%)",
        mixBlendMode: "screen",
        filter: "blur(20px)",
        willChange: "transform",
      }}
    />
  );
}
