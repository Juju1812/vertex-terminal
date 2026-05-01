"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, X } from "lucide-react";

/* ── Onboarding tour ─────────────────────────────────────────
   Shows on first visit (not on the landing — only after the
   user enters the terminal). Walks through 5 highlight steps,
   highlights a target element with a glowing outline + tooltip
   card. Dismissible at any time, never re-appears once done.

   Persistence key: "arbibx-tour-seen" in localStorage.
   To re-trigger for testing: localStorage.removeItem("arbibx-tour-seen")
*/

interface Step {
  title: string;
  body: string;
  /** CSS selector of the element to highlight. If null, centered. */
  target: string | null;
  /** Where to anchor the tooltip relative to the target. */
  side: "top" | "bottom" | "left" | "right" | "center";
}

const STEPS: Step[] = [
  {
    title: "Welcome to ArbibX",
    body: "Your AI-powered stock terminal. Quick tour — 30 seconds. Press Esc anytime to skip.",
    target: null,
    side: "center",
  },
  {
    title: "Markets — Live charts",
    body: "Real-time prices, 90-day charts, and technicals for any ticker. Click 'Open' on the chart card to get a dedicated, shareable page.",
    target: '[data-tab="markets"]',
    side: "right",
  },
  {
    title: "AI Top 15",
    body: "Claude AI screens 250+ stocks every hour and surfaces the 15 most actionable picks — with confidence scores, target prices, and risk notes.",
    target: '[data-tab="top15"]',
    side: "right",
  },
  {
    title: "Watchlist & alerts",
    body: "Star any ticker to track it across multiple named lists. Set price alerts that email + push you when targets hit.",
    target: '[data-tab="watchlist"]',
    side: "right",
  },
  {
    title: "Portfolio & track record",
    body: "Save your positions, get an AI grade, see your P&L, and share a public snapshot of your portfolio. The Top 15 tab also shows the AI's rolling track record vs S&P 500.",
    target: '[data-tab="portfolio"]',
    side: "right",
  },
  {
    title: "Power-user shortcuts",
    body: "Press K to search, T to toggle theme, 1–8 to jump tabs, Esc to close anything. The hint pill in the corner has the cheat sheet.",
    target: ".vx-shortcut-hint",
    side: "top",
  },
];

const STORAGE_KEY = "arbibx-tour-seen";

export default function OnboardingTour({ active }: { active: boolean }) {
  const [step, setStep] = useState(0);
  const [show, setShow] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);

  // Decide whether to show on mount. Only fires when `active` is true
  // (parent controls — typically once the landing page is dismissed).
  useEffect(() => {
    if (!active) return;
    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") return;
    } catch { /* */ }
    // Small delay so the page settles before the overlay drops in
    const t = setTimeout(() => setShow(true), 800);
    return () => clearTimeout(t);
  }, [active]);

  // Recompute target rect on step change + window resize
  useEffect(() => {
    if (!show) return;
    const measure = () => {
      const sel = STEPS[step].target;
      if (!sel) { setRect(null); return; }
      // Pick the first visible match (selectors include both desktop
      // and mobile nav variants — only one is visible at a time)
      const candidates = Array.from(document.querySelectorAll(sel)) as HTMLElement[];
      const visible = candidates.find(el => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
      });
      setRect(visible ? visible.getBoundingClientRect() : null);
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [step, show]);

  // Esc to skip
  useEffect(() => {
    if (!show) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") finish(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  const finish = () => {
    setShow(false);
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch { /* */ }
  };
  const next = () => {
    if (step < STEPS.length - 1) setStep(s => s + 1);
    else finish();
  };

  if (!show) return null;
  const current = STEPS[step];

  // Compute tooltip position
  const tooltipPos = (() => {
    if (!rect || current.side === "center") {
      return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" } as const;
    }
    const margin = 16;
    if (current.side === "right") {
      return { top: rect.top + rect.height / 2, left: rect.right + margin, transform: "translateY(-50%)" } as const;
    }
    if (current.side === "left") {
      return { top: rect.top + rect.height / 2, left: rect.left - margin, transform: "translate(-100%, -50%)" } as const;
    }
    if (current.side === "top") {
      return { top: rect.top - margin, left: rect.left + rect.width / 2, transform: "translate(-50%, -100%)" } as const;
    }
    return { top: rect.bottom + margin, left: rect.left + rect.width / 2, transform: "translate(-50%, 0)" } as const;
  })();

  return (
    <AnimatePresence>
      <motion.div
        key="tour"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{ position: "fixed", inset: 0, zIndex: 10000, pointerEvents: "none" }}
      >
        {/* Dim backdrop with a cut-out around the target */}
        <svg
          width="100%" height="100%"
          style={{ position: "absolute", inset: 0, pointerEvents: "auto" }}
          onClick={next}
        >
          <defs>
            <mask id="vx-tour-mask">
              <rect width="100%" height="100%" fill="white" />
              {rect && (
                <rect
                  x={rect.left - 6}
                  y={rect.top - 6}
                  width={rect.width + 12}
                  height={rect.height + 12}
                  rx={12}
                  fill="black"
                />
              )}
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="rgba(5,4,7,0.78)" mask="url(#vx-tour-mask)" />
        </svg>

        {/* Glow ring around the target */}
        {rect && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 280, damping: 24 }}
            style={{
              position: "absolute",
              top: rect.top - 6,
              left: rect.left - 6,
              width: rect.width + 12,
              height: rect.height + 12,
              borderRadius: 12,
              border: "2px solid rgba(240,165,0,0.85)",
              boxShadow: "0 0 0 6px rgba(240,165,0,0.18), 0 0 32px rgba(240,165,0,0.45)",
              pointerEvents: "none",
            }}
          />
        )}

        {/* Tooltip card */}
        <motion.div
          key={`tip-${step}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="vx-popover"
          style={{
            position: "absolute",
            ...tooltipPos,
            maxWidth: "min(360px, calc(100vw - 32px))",
            backdropFilter: "blur(40px) saturate(1.5)",
            WebkitBackdropFilter: "blur(40px) saturate(1.5)",
            borderRadius: 14,
            padding: "16px 18px",
            pointerEvents: "auto",
          }}
        >
          {/* Step indicator */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ display: "flex", gap: 4 }}>
              {STEPS.map((_, i) => (
                <span key={i}
                  style={{
                    width: i === step ? 16 : 6,
                    height: 4,
                    borderRadius: 99,
                    background: i === step ? "var(--gold,#f0a500)" : "var(--border-hi,rgba(90,72,150,0.6))",
                    opacity: i === step ? 0.9 : 0.5,
                    transition: "all 0.25s",
                  }} />
              ))}
            </div>
            <button onClick={finish}
              style={{ background: "none", border: "none", color: "var(--ink3,#3D5A7A)", cursor: "pointer", padding: 4, display: "flex" }}
              title="Skip tour (Esc)">
              <X size={14} />
            </button>
          </div>

          <h3 style={{
            fontFamily: "'Cabinet Grotesk','Syne',system-ui,sans-serif",
            fontSize: 15, fontWeight: 700, margin: "0 0 6px",
            color: "var(--ink0,#f4f0ff)",
          }}>
            {current.title}
          </h3>
          <p style={{ fontSize: 13, lineHeight: 1.55, color: "var(--ink2,#7A9CBF)", margin: "0 0 14px" }}>
            {current.body}
          </p>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <button onClick={finish}
              style={{ background: "none", border: "none", color: "var(--ink3,#3D5A7A)", cursor: "pointer",
                fontFamily: "'DM Mono',monospace", fontSize: 11, padding: 0 }}>
              Skip
            </button>
            <button onClick={next}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "linear-gradient(135deg,#f0a500,#ffbe1a)",
                color: "#0a0800",
                fontFamily: "'Cabinet Grotesk',system-ui,sans-serif",
                fontWeight: 800, fontSize: 12,
                padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer",
                boxShadow: "0 2px 12px rgba(240,165,0,0.35)",
              }}>
              {step < STEPS.length - 1 ? "Next" : "Got it"} <ArrowRight size={12} />
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
