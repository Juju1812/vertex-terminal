"use client";

/**
 * CountdownBar — self-contained, zero-flicker countdown timer.
 *
 * ARCHITECTURE:
 *   All timer state lives INSIDE this component.
 *   The parent never receives secondsLeft/pct/refreshing as state —
 *   it only passes a stable `onRefresh` callback.
 *   The callback is captured in a ref so changing it never restarts the timer.
 *   Result: the parent re-renders exactly zero times per second.
 */

import { useState, useEffect, useRef, useCallback, memo } from "react";
import { RefreshCw, Clock } from "lucide-react";

const INTERVAL_MS  = 15 * 60 * 1000;   // 15 minutes
const TOTAL_SECS   = INTERVAL_MS / 1000;

/* ── Design tokens (local copy — no import needed) ── */
const V = {
  w1: "rgba(130,180,255,0.055)",
  w2: "rgba(130,180,255,0.10)",
  w3: "rgba(130,180,255,0.16)",
  ink0: "#F2F6FF",
  ink3: "#3D5A7A",
  ink4: "#1F3550",
  gain: "#00C896",
  gainDim: "rgba(0,200,150,0.08)",
  gainWire: "rgba(0,200,150,0.20)",
  arc: "#4F8EF7",
  arcDim: "rgba(79,142,247,0.10)",
  arcWire: "rgba(79,142,247,0.22)",
  gold: "#E8A030",
};
const mono: React.CSSProperties = {
  fontFamily: "'Geist Mono','Courier New',monospace",
};

/* ── Helpers ── */
function fmt(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0
    ? `${m}m ${s.toString().padStart(2, "0")}s`
    : `${s}s`;
}

function trackColor(pct: number): string {
  if (pct < 50) return V.gain;
  if (pct < 80) return V.gold;
  return V.arc;
}

/* ── Props ── */
export interface CountdownBarProps {
  /** Called when the timer fires or the user clicks "Refresh Now".
   *  Should return a Promise that resolves when the data is fresh.
   *  Wrap in useCallback with correct deps in the parent — but changing
   *  this reference will NOT restart the timer or cause a re-render. */
  onRefresh: () => Promise<void>;
  label?: string;
}

/**
 * CountdownBar
 * Drop this anywhere. It manages its own countdown entirely.
 * The parent is never re-rendered by the timer ticking.
 */
export const CountdownBar = memo(function CountdownBar({
  onRefresh,
  label = "Next market update",
}: CountdownBarProps) {
  /* All timer state is LOCAL — never lifted to parent */
  const [secsLeft,    setSecsLeft]    = useState(TOTAL_SECS);
  const [refreshing,  setRefreshing]  = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  /* Capture the latest callback without restarting the interval */
  const callbackRef = useRef(onRefresh);
  useEffect(() => { callbackRef.current = onRefresh; }, [onRefresh]);

  /* Track when the next auto-fire should happen */
  const nextFireRef = useRef(Date.now() + INTERVAL_MS);

  /* ── The one and only interval — never recreated ── */
  useEffect(() => {
    const id = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.round((nextFireRef.current - Date.now()) / 1000)
      );
      setSecsLeft(remaining);

      if (remaining === 0) {
        /* Reset before firing so the countdown doesn't stall at 0 */
        nextFireRef.current = Date.now() + INTERVAL_MS;
        setSecsLeft(TOTAL_SECS);
        setRefreshing(true);
        callbackRef.current()
          .then(() => setLastUpdated(new Date()))
          .finally(() => setRefreshing(false));
      }
    }, 1000);

    return () => clearInterval(id);
    /* empty deps — runs once, reads callback via ref */
  }, []);

  /* ── Manual refresh ── */
  const handleRefresh = useCallback(() => {
    if (refreshing) return;
    nextFireRef.current = Date.now() + INTERVAL_MS;
    setSecsLeft(TOTAL_SECS);
    setRefreshing(true);
    callbackRef.current()
      .then(() => setLastUpdated(new Date()))
      .finally(() => setRefreshing(false));
  }, [refreshing]);

  /* ── Derived display values ── */
  const pct    = ((TOTAL_SECS - secsLeft) / TOTAL_SECS) * 100;
  const color  = trackColor(pct);
  const urgent = secsLeft < 60;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 18px",
        background:
          "linear-gradient(90deg, rgba(255,255,255,0.018) 0%, rgba(255,255,255,0.008) 100%)",
        border: `1px solid ${V.w2}`,
        borderRadius: 12,
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        boxShadow:
          "0 2px 8px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.05)",
        flexWrap: "wrap",
        rowGap: 8,
      }}
    >
      {/* Clock icon */}
      <div
        style={{
          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
          background: urgent ? "rgba(79,142,247,0.12)" : V.gainDim,
          border: `1px solid ${urgent ? V.arcWire : V.gainWire}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "background 0.6s, border-color 0.6s",
        }}
      >
        <Clock size={13} color={urgent ? V.arc : V.gain} />
      </div>

      {/* Text + progress */}
      <div style={{ flex: 1, minWidth: 140 }}>
        <div
          style={{
            display: "flex", alignItems: "baseline",
            gap: 6, marginBottom: 5, flexWrap: "wrap",
          }}
        >
          <span
            style={{
              ...mono, fontSize: 10, color: V.ink3,
              textTransform: "uppercase", letterSpacing: "0.08em",
            }}
          >
            {label} in
          </span>

          {/* Only this span changes every second */}
          <span
            style={{
              ...mono, fontSize: 15, fontWeight: 500,
              letterSpacing: "-0.02em",
              color: urgent ? V.arc : V.ink0,
              transition: "color 0.6s",
              animation: urgent ? "vx-cdUrgent 1s ease-in-out infinite" : "none",
            }}
          >
            {fmt(secsLeft)}
          </span>

          {lastUpdated && (
            <span style={{ ...mono, fontSize: 9, color: V.ink4 }}>
              ·&nbsp;last&nbsp;
              {lastUpdated.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
        </div>

        {/* Progress track — CSS transition does the smooth animation */}
        <div
          style={{
            height: 3, background: "rgba(255,255,255,0.05)",
            borderRadius: 99, overflow: "hidden", position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute", left: 0, top: 0,
              height: "100%",
              width: `${pct}%`,
              background: `linear-gradient(90deg, ${color}55, ${color})`,
              borderRadius: 99,
              /* 1 s linear keeps the bar perfectly in sync with the tick */
              transition: "width 1s linear, background 3s ease",
              boxShadow: pct > 88 ? `0 0 5px ${color}` : "none",
            }}
          />
        </div>
      </div>

      {/* Refresh Now button */}
      <button
        onClick={handleRefresh}
        disabled={refreshing}
        style={{
          display: "flex", alignItems: "center", gap: 5,
          padding: "6px 13px",
          background: refreshing ? "rgba(255,255,255,0.04)" : V.arcDim,
          border: `1px solid ${refreshing ? V.w1 : V.arcWire}`,
          borderRadius: 8,
          color: refreshing ? V.ink4 : "#7EB6FF",
          cursor: refreshing ? "not-allowed" : "pointer",
          fontFamily: "'Bricolage Grotesque',system-ui,sans-serif",
          fontSize: 12, fontWeight: 500,
          transition: "all 0.2s",
          flexShrink: 0, whiteSpace: "nowrap",
        }}
        onMouseEnter={e => {
          if (!refreshing)
            e.currentTarget.style.background = "rgba(79,142,247,0.16)";
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = refreshing
            ? "rgba(255,255,255,0.04)"
            : V.arcDim;
        }}
      >
        <RefreshCw
          size={11}
          style={{
            animation: refreshing ? "vx-spin 1s linear infinite" : "none",
          }}
        />
        {refreshing ? "Updating…" : "Refresh Now"}
      </button>

      <style>{`
        @keyframes vx-cdUrgent {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.5; }
        }
        @keyframes vx-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
});
