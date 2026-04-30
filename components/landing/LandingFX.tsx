"use client";

import { useRef, useState, type CSSProperties, type ReactNode, type MouseEvent } from "react";
import { motion, useMotionValue, useSpring, useTransform, type MotionStyle } from "framer-motion";

/* ── AnimatedHeadline ─────────────────────────────────────────
   Two-line headline that animates letter-by-letter on mount.
   Each character lifts in with a spring + slight rotation.
*/
interface HeadlineProps {
  lines: { text: string; gradient?: boolean }[];
  baseStyle?: CSSProperties;
  gradientStyle?: CSSProperties;
}

export function AnimatedHeadline({ lines, baseStyle, gradientStyle }: HeadlineProps) {
  let charIndex = 0;
  return (
    <div style={{ overflow: "hidden" }}>
      {lines.map((line, li) => (
        <div
          key={li}
          style={{
            display: "flex",
            justifyContent: "center",
            flexWrap: "wrap",
            ...(line.gradient ? gradientStyle : baseStyle),
          }}
          aria-label={line.text}
        >
          {Array.from(line.text).map((ch) => {
            const i = charIndex++;
            return (
              <motion.span
                key={`${li}-${i}`}
                aria-hidden
                initial={{ y: "110%", opacity: 0, rotateX: -90 }}
                animate={{ y: 0, opacity: 1, rotateX: 0 }}
                transition={{
                  delay: 0.08 + i * 0.035,
                  type: "spring",
                  damping: 14,
                  stiffness: 180,
                }}
                style={{ display: "inline-block", whiteSpace: "pre" }}
              >
                {ch === " " ? " " : ch}
              </motion.span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/* ── ParallaxLayer ────────────────────────────────────────────
   Listens to mouse position and applies a smoothed translation
   to its children. Strength controls the offset magnitude in px.
*/
interface ParallaxProps {
  children: ReactNode;
  strength?: number;
  style?: CSSProperties;
}

export function ParallaxLayer({ children, strength = 14, style }: ParallaxProps) {
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 80, damping: 18, mass: 0.6 });
  const sy = useSpring(my, { stiffness: 80, damping: 18, mass: 0.6 });
  const tx = useTransform(sx, (v) => v * strength);
  const ty = useTransform(sy, (v) => v * strength);

  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    mx.set(px);
    my.set(py);
  };

  const onLeave = () => { mx.set(0); my.set(0); };

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ x: tx, y: ty, ...(style as MotionStyle) }}
    >
      {children}
    </motion.div>
  );
}

/* ── TiltCard ─────────────────────────────────────────────────
   3D perspective tilt that follows the cursor across the card.
   Optional float prop adds a slow sinusoidal Y-bob.
*/
interface TiltProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  intensity?: number;
  float?: boolean;
  glare?: boolean;
  onClick?: () => void;
}

export function TiltCard({
  children,
  className,
  style,
  intensity = 10,
  float = false,
  glare = true,
  onClick,
}: TiltProps) {
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 200, damping: 20 });
  const sy = useSpring(my, { stiffness: 200, damping: 20 });
  const rotX = useTransform(sy, (v) => -v * intensity);
  const rotY = useTransform(sx, (v) =>  v * intensity);
  const glareBg = useTransform(
    [sx, sy] as never,
    (latest: number[]) => {
      const [x, y] = latest;
      return `radial-gradient(circle at ${50 + x * 60}% ${50 + y * 60}%, rgba(255,210,120,0.20) 0%, transparent 55%)`;
    },
  );
  const [hovering, setHovering] = useState(false);

  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  };
  const onLeave = () => { mx.set(0); my.set(0); setHovering(false); };
  const onEnter = () => setHovering(true);

  const floatAnim = float ? {
    animate: { y: [0, -6, 0] },
    transition: { duration: 5.5, repeat: Infinity, ease: "easeInOut" as const },
  } : {};

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      onMouseEnter={onEnter}
      onClick={onClick}
      whileHover={{ scale: 1.025 }}
      transition={{ type: "spring", stiffness: 220, damping: 18 }}
      className={className}
      style={{
        rotateX: rotX,
        rotateY: rotY,
        transformStyle: "preserve-3d",
        position: "relative",
        cursor: onClick ? "pointer" : "default",
        ...(style as MotionStyle),
      }}
      {...floatAnim}
    >
      <div style={{ transform: "translateZ(0)" }}>{children}</div>
      {glare && (
        <motion.div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "inherit",
            pointerEvents: "none",
            background: glareBg,
            mixBlendMode: "screen",
            opacity: hovering ? 1 : 0,
            transition: "opacity 0.25s",
          }}
        />
      )}
    </motion.div>
  );
}

/* ── SpringButton ─────────────────────────────────────────────
   Wraps an inline-flex button with spring scale + lift on
   hover/press, while preserving the visual styling passed via
   className/style. Accepts arbitrary children.
*/
interface SpringButtonProps {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  style?: CSSProperties;
  disabled?: boolean;
  type?: "button" | "submit";
}

export function SpringButton({ children, onClick, className, style, disabled, type = "button" }: SpringButtonProps) {
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={className}
      whileHover={disabled ? undefined : { scale: 1.04, y: -2 }}
      whileTap={disabled ? undefined : { scale: 0.97, y: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 22 }}
      style={style as MotionStyle}
    >
      {children}
    </motion.button>
  );
}

/* ── ScrollReveal ─────────────────────────────────────────────
   Fly-in on scroll using whileInView. y/opacity spring.
*/
interface ScrollRevealProps {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  style?: CSSProperties;
}

export function ScrollReveal({ children, delay = 0, y = 32, className, style }: ScrollRevealProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ delay, type: "spring", stiffness: 80, damping: 18 }}
      className={className}
      style={style as MotionStyle}
    >
      {children}
    </motion.div>
  );
}

/* ── AnimatedGradient ─────────────────────────────────────────
   Slow-shifting conic/linear gradient sheet. Sits behind hero.
*/
export function AnimatedGradient() {
  return (
    <motion.div
      aria-hidden
      animate={{
        backgroundPosition: ["0% 0%", "100% 50%", "0% 100%", "0% 0%"],
      }}
      transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
      style={{
        position: "absolute",
        inset: 0,
        backgroundImage:
          "radial-gradient(60% 50% at 20% 30%, rgba(240,165,0,0.18) 0%, transparent 60%)," +
          "radial-gradient(50% 60% at 80% 70%, rgba(255,107,53,0.14) 0%, transparent 60%)," +
          "radial-gradient(40% 60% at 50% 100%, rgba(120,80,200,0.10) 0%, transparent 60%)",
        backgroundSize: "200% 200%",
        filter: "blur(40px)",
        opacity: 0.85,
        pointerEvents: "none",
      }}
    />
  );
}
