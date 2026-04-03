"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { RefreshCw, Clock } from "lucide-react";

const INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

/* ─────────────────────────────────────────────────────────────
   useAutoRefresh
   Returns: { secondsLeft, pct, forceRefresh, lastUpdated }
   Calls `onRefresh` every 15 min and on forceRefresh().
───────────────────────────────────────────────────────────── */
export function useAutoRefresh(onRefresh: () => Promise<void>) {
  const [secondsLeft, setSecondsLeft] = useState(INTERVAL_MS / 1000);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing]   = useState(false);
  const nextFireRef = useRef(Date.now() + INTERVAL_MS);

  // Tick every second
  useEffect(() => {
    const tick = setInterval(() => {
      const remaining = Math.max(0, Math.round((nextFireRef.current - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0) {
        nextFireRef.current = Date.now() + INTERVAL_MS;
        setSecondsLeft(INTERVAL_MS / 1000);
        onRefresh().then(() => setLastUpdated(new Date()));
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [onRefresh]);

  const forceRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    nextFireRef.current = Date.now() + INTERVAL_MS;
    setSecondsLeft(INTERVAL_MS / 1000);
    await onRefresh();
    setLastUpdated(new Date());
    setRefreshing(false);
  }, [onRefresh, refreshing]);

  const pct = ((INTERVAL_MS / 1000 - secondsLeft) / (INTERVAL_MS / 1000)) * 100;

  return { secondsLeft, pct, forceRefresh, refreshing, lastUpdated };
}

/* ─────────────────────────────────────────────────────────────
   CountdownBar
   A self-contained countdown strip to embed at the top of
   Markets, Top 15, and AI Signals panels.
───────────────────────────────────────────────────────────── */
interface CountdownBarProps {
  secondsLeft: number;
  pct: number;
  refreshing: boolean;
  lastUpdated: Date | null;
  onRefresh: () => void;
  label?: string;
}

const V = {
  d2: "#0C1220", d3: "#101828", dh: "#1E2D40",
  w1: "rgba(130,180,255,0.055)", w2: "rgba(130,180,255,0.10)", w3: "rgba(130,180,255,0.16)",
  ink0: "#F2F6FF", ink2: "#7A9CBF", ink3: "#3D5A7A", ink4: "#1F3550",
  gain: "#00C896", gainDim: "rgba(0,200,150,0.08)", gainWire: "rgba(0,200,150,0.20)",
  arc: "#4F8EF7", arcDim: "rgba(79,142,247,0.10)", arcWire: "rgba(79,142,247,0.22)",
  gold: "#E8A030",
};
const mono: React.CSSProperties = { fontFamily: "'Geist Mono','Courier New',monospace" };

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m > 0) return `${m}m ${s.toString().padStart(2, "0")}s`;
  return `${s}s`;
}

// Colour shifts from gain → gold → arc as time runs down
function progressColor(pct: number): string {
  if (pct < 50) return V.gain;
  if (pct < 80) return V.gold;
  return V.arc;
}

export function CountdownBar({
  secondsLeft, pct, refreshing, lastUpdated, onRefresh, label = "Next market update",
}: CountdownBarProps) {
  const color = progressColor(pct);
  const urgent = secondsLeft < 60;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 18px",
        background: `linear-gradient(90deg, rgba(255,255,255,0.018) 0%, rgba(255,255,255,0.008) 100%)`,
        border: `1px solid ${V.w2}`,
        borderRadius: 12,
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        boxShadow: `0 2px 8px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.05)`,
        flexWrap: "wrap",
        rowGap: 8,
      }}
    >
      {/* Icon */}
      <div
        style={{
          width: 28, height: 28, borderRadius: 8,
          background: urgent ? `rgba(79,142,247,0.12)` : `rgba(0,200,150,0.08)`,
          border: `1px solid ${urgent ? V.arcWire : V.gainWire}`,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}
      >
        <Clock size={13} color={urgent ? V.arc : V.gain} />
      </div>

      {/* Text block */}
      <div style={{ flex: 1, minWidth: 140 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 5, flexWrap: "wrap" }}>
          <span style={{ ...mono, fontSize: 10, color: V.ink3, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            {label} in
          </span>
          <span
            style={{
              ...mono, fontSize: 15, fontWeight: 500, letterSpacing: "-0.02em",
              color: urgent ? V.arc : V.ink0,
              transition: "color 0.5s",
              animation: urgent ? "urgentPulse 1s ease-in-out infinite" : "none",
            }}
          >
            {formatCountdown(secondsLeft)}
          </span>
          {lastUpdated && (
            <span style={{ ...mono, fontSize: 9, color: V.ink4 }}>
              · last {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>

        {/* Progress track */}
        <div
          style={{
            height: 3, background: "rgba(255,255,255,0.05)",
            borderRadius: 99, overflow: "hidden", position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute", left: 0, top: 0, height: "100%",
              width: `${pct}%`,
              background: `linear-gradient(90deg, ${color}60, ${color})`,
              borderRadius: 99,
              transition: "width 1s linear, background 2s ease",
              boxShadow: pct > 90 ? `0 0 6px ${color}` : "none",
            }}
          />
        </div>
      </div>

      {/* Refresh Now button */}
      <button
        onClick={onRefresh}
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
          flexShrink: 0,
          whiteSpace: "nowrap",
        }}
        onMouseEnter={e => { if (!refreshing) { e.currentTarget.style.background = "rgba(79,142,247,0.16)"; } }}
        onMouseLeave={e => { e.currentTarget.style.background = refreshing ? "rgba(255,255,255,0.04)" : V.arcDim; }}
      >
        <RefreshCw
          size={11}
          style={{ animation: refreshing ? "spin 1s linear infinite" : "none" }}
        />
        {refreshing ? "Updating…" : "Refresh Now"}
      </button>

      <style>{`
        @keyframes urgentPulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.55; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
