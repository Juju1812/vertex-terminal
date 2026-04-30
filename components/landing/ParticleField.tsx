"use client";

import { useEffect, useRef } from "react";

/* ── Pure-canvas gold particle field ──────────────────────────
   Lightweight (no R3F dependency) so it can layer over the
   3D scene without doubling GPU cost. Particles drift slowly
   upward with subtle horizontal sway and a parallax shift on
   pointer movement. Opacity twinkles via additive blending.
*/

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  r: number;
  baseAlpha: number;
  twinklePhase: number;
  twinkleSpeed: number;
  depth: number;
}

interface Props {
  density?: number;
  color?: string;
}

export default function ParticleField({ density = 90, color = "240,165,0" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const pointer = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let particles: Particle[] = [];
    let w = 0;
    let h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const target = Math.floor((w * h) / 14000) * (density / 90);
      const count = Math.max(30, Math.min(180, Math.round(target)));
      particles = Array.from({ length: count }, () => makeParticle(w, h));
    };

    const makeParticle = (W: number, H: number): Particle => {
      const depth = Math.random();
      return {
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.12,
        vy: -0.04 - Math.random() * 0.18,
        r: 0.6 + depth * 1.8,
        baseAlpha: 0.18 + depth * 0.55,
        twinklePhase: Math.random() * Math.PI * 2,
        twinkleSpeed: 0.6 + Math.random() * 1.4,
        depth,
      };
    };

    const onPointer = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.current.x = (e.clientX - rect.left - w / 2) / w;
      pointer.current.y = (e.clientY - rect.top - h / 2) / h;
    };

    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";

      const px = pointer.current.x;
      const py = pointer.current.y;

      for (const p of particles) {
        p.x += p.vx * dt * 0.06;
        p.y += p.vy * dt * 0.06;
        p.twinklePhase += (dt / 1000) * p.twinkleSpeed;

        if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;

        const offX = px * 22 * p.depth;
        const offY = py * 14 * p.depth;
        const twinkle = 0.55 + Math.sin(p.twinklePhase) * 0.45;
        const alpha = p.baseAlpha * twinkle;

        const gx = p.x + offX;
        const gy = p.y + offY;
        const grad = ctx.createRadialGradient(gx, gy, 0, gx, gy, p.r * 6);
        grad.addColorStop(0, `rgba(${color},${alpha})`);
        grad.addColorStop(1, `rgba(${color},0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(gx, gy, p.r * 6, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalCompositeOperation = "source-over";
      rafRef.current = requestAnimationFrame(tick);
    };

    resize();
    rafRef.current = requestAnimationFrame(tick);
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onPointer);

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointer);
    };
  }, [density, color]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 1,
      }}
    />
  );
}
