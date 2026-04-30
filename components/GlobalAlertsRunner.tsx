"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/* ── GlobalAlertsRunner ───────────────────────────────────────
   Runs price-alert polling app-wide instead of just on the
   Watchlist tab. Mounts once at the page shell level (not
   under a tab), polls every 5 min while visible (every 15 min
   when hidden), checks current prices against any saved alerts
   in localStorage, fires the Resend email + web-push, marks
   them triggered, and shows an in-app toast for immediate
   feedback when the user has the site open.

   No backend cron required — alerts fire as long as the user
   has any ArbibX tab open in any browser. To get true offline
   alerts you'd need a Vercel cron job (separate effort).
*/

interface PriceAlert {
  id: string;
  ticker: string;
  condition: "above" | "below";
  targetPrice: number;
  email: string;
  triggered: boolean;
  createdAt: string;
}

interface Toast {
  id: string;
  ticker: string;
  condition: "above" | "below";
  targetPrice: number;
  currentPrice: number;
}

const POLYGON_KEY = process.env.NEXT_PUBLIC_POLYGON_API_KEY ?? "1xwzcvUOF9pft6PRNylO2Xc6X2QeQCGr";
const ALERTS_KEY  = "arbibx-price-alerts";

async function fetchPricesBulk(tickers: string[]): Promise<Record<string, number>> {
  if (!tickers.length) return {};
  try {
    const r = await fetch(
      `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${tickers.join(",")}&apiKey=${POLYGON_KEY}`
    );
    if (!r.ok) return {};
    const d = await r.json() as { tickers?: Array<{ ticker: string; day: { c: number } }> };
    const out: Record<string, number> = {};
    for (const t of d.tickers ?? []) if (t.day?.c > 0) out[t.ticker] = t.day.c;
    return out;
  } catch { return {}; }
}

export default function GlobalAlertsRunner({ active }: { active: boolean }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const lastRunRef = useRef(0);

  useEffect(() => {
    if (!active) return;

    const tick = async () => {
      // Throttle: never run more than once per 30 seconds even on
      // visibilitychange storms or rapid re-renders.
      if (Date.now() - lastRunRef.current < 30_000) return;
      lastRunRef.current = Date.now();

      // For logged-in users, the Vercel cron job hits Supabase every 5
      // minutes during market hours and fires their alerts directly —
      // skipping the in-app poller entirely avoids double-firing emails
      // or pushes when both run within the same window.
      try {
        if (localStorage.getItem("arbibx-auth-user")) return;
      } catch { /* */ }

      // Load alerts from localStorage (guests only at this point)
      let alerts: PriceAlert[] = [];
      try { alerts = JSON.parse(localStorage.getItem(ALERTS_KEY) ?? "[]") as PriceAlert[]; } catch { return; }
      const pending = alerts.filter(a => !a.triggered);
      if (!pending.length) return;

      // Bulk-fetch prices for all unique tickers in pending alerts
      const tickers = [...new Set(pending.map(a => a.ticker))];
      const prices  = await fetchPricesBulk(tickers);
      if (!Object.keys(prices).length) return;

      // Check each pending alert
      const updated = [...alerts];
      const newToasts: Toast[] = [];
      let changed = false;
      for (let i = 0; i < updated.length; i++) {
        const a = updated[i];
        if (a.triggered) continue;
        const cur = prices[a.ticker];
        if (!cur) continue;
        const hit =
          (a.condition === "above" && cur >= a.targetPrice) ||
          (a.condition === "below" && cur <= a.targetPrice);
        if (!hit) continue;

        // Fire email + push (the API also dispatches push internally)
        try {
          await fetch("/api/send-alert", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: a.email,
              ticker: a.ticker,
              condition: a.condition,
              targetPrice: a.targetPrice,
              currentPrice: cur,
            }),
          });
        } catch { /* non-fatal */ }

        updated[i] = { ...a, triggered: true };
        changed = true;
        newToasts.push({
          id: a.id,
          ticker: a.ticker,
          condition: a.condition,
          targetPrice: a.targetPrice,
          currentPrice: cur,
        });
      }

      if (changed) {
        try { localStorage.setItem(ALERTS_KEY, JSON.stringify(updated)); } catch { /* */ }
      }
      if (newToasts.length) {
        setToasts(t => [...t, ...newToasts]);
        // Auto-dismiss after 8s each
        newToasts.forEach(toast => {
          setTimeout(() => setToasts(t => t.filter(x => x.id !== toast.id)), 8_000);
        });
      }
    };

    // Initial run after 3s (let other things settle), then interval
    const initialTimer = setTimeout(tick, 3_000);
    const visibleInterval  = 5  * 60 * 1000;
    const hiddenInterval   = 15 * 60 * 1000;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    const startInterval = () => {
      if (intervalId) clearInterval(intervalId);
      const ms = document.visibilityState === "visible" ? visibleInterval : hiddenInterval;
      intervalId = setInterval(tick, ms);
    };
    startInterval();
    const onVis = () => { startInterval(); if (document.visibilityState === "visible") tick(); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearTimeout(initialTimer);
      if (intervalId) clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [active]);

  const dismiss = (id: string) => setToasts(t => t.filter(x => x.id !== id));

  return (
    <div
      aria-live="polite"
      style={{
        position: "fixed",
        top: "max(80px, env(safe-area-inset-top, 0px))",
        right: 16,
        zIndex: 9500,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        pointerEvents: "none",
        maxWidth: "min(380px, calc(100vw - 32px))",
      }}
    >
      <AnimatePresence>
        {toasts.map(t => {
          const above = t.condition === "above";
          const color = above ? "var(--gain,#00e5a0)" : "var(--loss,#ff4560)";
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 24, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 24, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              style={{
                pointerEvents: "auto",
                background: "rgba(8,6,16,0.96)",
                backdropFilter: "blur(40px) saturate(1.5)",
                WebkitBackdropFilter: "blur(40px) saturate(1.5)",
                border: `1px solid ${above ? "rgba(0,229,160,0.30)" : "rgba(255,69,96,0.30)"}`,
                borderRadius: 14,
                padding: "12px 14px 12px 16px",
                boxShadow: `0 12px 40px rgba(0,0,0,0.55), 0 0 24px ${above ? "rgba(0,229,160,0.18)" : "rgba(255,69,96,0.18)"}`,
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                color: "var(--ink0,#f4f0ff)",
                fontFamily: "'Syne',system-ui,sans-serif",
              }}
            >
              <div style={{
                width: 32, height: 32, borderRadius: 9,
                background: above ? "rgba(0,229,160,0.10)" : "rgba(255,69,96,0.10)",
                border: `1px solid ${above ? "rgba(0,229,160,0.30)" : "rgba(255,69,96,0.30)"}`,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                color,
              }}>
                <CheckCircle size={16} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 9, fontFamily: "'DM Mono',monospace", color, textTransform: "uppercase", letterSpacing: "0.14em", margin: "0 0 3px", fontWeight: 600 }}>
                  Price alert · {above ? "↑ Hit above" : "↓ Hit below"}
                </p>
                <p style={{ fontSize: 14, fontWeight: 600, margin: "0 0 4px" }}>
                  <span style={{ fontFamily: "'DM Mono',monospace" }}>{t.ticker}</span>
                  {" "}is {above ? "above" : "below"}{" "}
                  <span style={{ fontFamily: "'DM Mono',monospace", color }}>${t.targetPrice.toFixed(2)}</span>
                </p>
                <p style={{ fontSize: 11, color: "var(--ink2,#8a82a8)", margin: 0, fontFamily: "'DM Mono',monospace" }}>
                  Current: ${t.currentPrice.toFixed(2)} · Email + push sent
                </p>
              </div>
              <button onClick={() => dismiss(t.id)}
                aria-label="Dismiss"
                style={{
                  background: "none", border: "none", color: "var(--ink3,#4a4468)",
                  cursor: "pointer", padding: 2, display: "flex", flexShrink: 0,
                }}>
                <X size={14} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
