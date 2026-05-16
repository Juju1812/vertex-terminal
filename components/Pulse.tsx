"use client";

import { useEffect, useMemo, useState } from "react";
import {
  TrendingUp, TrendingDown, Activity, Flame, Sparkles,
  RefreshCw, Star, ArrowRight, Zap,
} from "lucide-react";
import { useCurrency } from "./useCurrency";

/* ── Pulse — Gen-Z "For You" feed ────────────────────────────
   Card-based feed of trending tickers (gainers, losers, most
   active) with a one-line Claude take per card. Vertical scroll
   on desktop, full-screen swipeable cards on mobile (CSS scroll
   snap — no extra JS needed). Built to feel native to how
   Gen Z consumes everything else. */

interface PulseItem {
  ticker:    string;
  name:      string;
  price:     number;
  change:    number;
  changePct: number;
  volume:    number;
  category:  "gainer" | "loser" | "active";
  aiTake?:   string;
}
interface PulseResp { items: PulseItem[]; updatedAt: string; error?: string }

interface Props {
  onSelectTicker?: (t: string) => void;
  onAddToWatchlist?: (t: string) => void;
  watchlist?: string[];
}

const mono:    React.CSSProperties = { fontFamily: "'DM Mono','Courier New',monospace" };
const display: React.CSSProperties = { fontFamily: "'Cabinet Grotesk','Syne',system-ui,sans-serif" };

const CATEGORIES: { key: "all" | "gainer" | "loser" | "active"; label: string; icon: React.ReactNode }[] = [
  { key: "all",    label: "All",      icon: <Sparkles size={11}/> },
  { key: "gainer", label: "Gainers",  icon: <TrendingUp size={11}/> },
  { key: "loser",  label: "Losers",   icon: <TrendingDown size={11}/> },
  { key: "active", label: "Active",   icon: <Activity size={11}/> },
];

const fv = (n: number) =>
  n >= 1e9 ? `${(n / 1e9).toFixed(1)}B`
  : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M`
  : n >= 1e3 ? `${(n / 1e3).toFixed(0)}K`
  : String(n);

export default function Pulse({ onSelectTicker, onAddToWatchlist, watchlist = [] }: Props) {
  const { f$ } = useCurrency();
  const [data, setData] = useState<PulseResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]  = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "gainer" | "loser" | "active">("all");

  const load = async () => {
    setLoading(true); setErr(null);
    try {
      const r = await fetch("/api/pulse");
      const d = await r.json() as PulseResp;
      if (!r.ok || d.error) { setErr(d.error ?? "Failed to load"); return; }
      setData(d);
    } catch { setErr("Network error"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const items = useMemo(() => {
    const list = data?.items ?? [];
    if (filter === "all") return list;
    return list.filter(i => i.category === filter);
  }, [data, filter]);

  return (
    <div style={{ padding: "20px 16px 100px", maxWidth: 720, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12,
            background: "linear-gradient(135deg, rgba(255,107,53,0.20), rgba(240,165,0,0.10))",
            border: "1px solid rgba(255,107,53,0.32)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Flame size={20} color="#ff6b35"/>
          </div>
          <div>
            <h2 style={{ ...display, fontSize: 22, fontWeight: 800, color: "var(--ink0,#f4f0ff)", margin: 0, letterSpacing: "-0.02em" }}>
              Pulse
            </h2>
            <p style={{ ...mono, fontSize: 9, color: "var(--ink4,#1F3550)", margin: "2px 0 0", textTransform: "uppercase", letterSpacing: "0.10em" }}>
              What&apos;s moving · AI takes · {data?.updatedAt ? new Date(data.updatedAt).toLocaleTimeString() : "—"}
            </p>
          </div>
        </div>
        <button onClick={load} disabled={loading}
          title="Refresh"
          style={{
            display: "flex", alignItems: "center", gap: 6, padding: "7px 12px",
            borderRadius: 9, background: "rgba(255,255,255,0.04)",
            border: "1px solid var(--border,rgba(60,48,100,0.5))",
            color: "var(--ink2,#7A9CBF)", cursor: loading ? "not-allowed" : "pointer",
            fontSize: 11, fontFamily: "'Bricolage Grotesque',system-ui,sans-serif",
          }}>
          <RefreshCw size={11} style={{ animation: loading ? "spin 1s linear infinite" : "none" }}/>
          Refresh
        </button>
      </div>

      {/* Category chips */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none" }}>
        {CATEGORIES.map(c => {
          const active = filter === c.key;
          return (
            <button key={c.key} onClick={() => setFilter(c.key)}
              style={{
                ...mono, fontSize: 11, fontWeight: 600,
                padding: "6px 12px", borderRadius: 99,
                background: active ? "rgba(240,165,0,0.14)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${active ? "rgba(240,165,0,0.40)" : "var(--border,rgba(60,48,100,0.5))"}`,
                color: active ? "var(--gold,#f0a500)" : "var(--ink2,#7A9CBF)",
                cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
                display: "inline-flex", alignItems: "center", gap: 5,
              }}>
              {c.icon} {c.label}
            </button>
          );
        })}
      </div>

      {/* Loading skeleton */}
      {loading && !data && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[0,1,2,3].map(i => <div key={i} className="skel" style={{ height: 180, borderRadius: 16 }}/>)}
        </div>
      )}

      {/* Error */}
      {err && !loading && (
        <div style={{ padding: 24, textAlign: "center", borderRadius: 14, background: "rgba(255,69,96,0.08)", border: "1px solid rgba(255,69,96,0.32)", color: "var(--loss,#ff4560)", ...mono, fontSize: 12 }}>
          {err}
        </div>
      )}

      {/* Empty */}
      {!loading && !err && items.length === 0 && (
        <div style={{ padding: 32, textAlign: "center", borderRadius: 14, background: "rgba(255,255,255,0.02)", border: "1px solid var(--border,rgba(60,48,100,0.5))", color: "var(--ink3,#3D5A7A)", fontSize: 13 }}>
          Nothing trending in this category right now.
        </div>
      )}

      {/* Card feed — vertical scroll on desktop, snap-scroll on mobile */}
      <div className="vx-pulse-feed">
        {items.map((item, i) => (
          <PulseCard key={item.ticker + i}
            item={item} f$={f$}
            watched={watchlist.includes(item.ticker)}
            onSelect={() => onSelectTicker?.(item.ticker)}
            onWatch={() => onAddToWatchlist?.(item.ticker)}
          />
        ))}
      </div>

      <p style={{ ...mono, fontSize: 9, color: "var(--ink4,#1F3550)", textAlign: "center", marginTop: 16, textTransform: "uppercase", letterSpacing: "0.10em" }}>
        Snap-scroll the cards · Tap a ticker for full analysis · Star to add to watchlist
      </p>

      <style>{`
        .vx-pulse-feed {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        @media (max-width: 720px) {
          /* On phones, become a snap-scroll feed so each card fills
             the viewport — TikTok-style consumption pattern. */
          .vx-pulse-feed {
            scroll-snap-type: y mandatory;
            -webkit-overflow-scrolling: touch;
          }
          .vx-pulse-feed > * { scroll-snap-align: start; min-height: 320px; }
        }
      `}</style>
    </div>
  );
}

/* ── PulseCard ──────────────────────────────────────────── */
function PulseCard({ item, f$, watched, onSelect, onWatch }: {
  item: PulseItem;
  f$: (n: number, d?: number) => string;
  watched: boolean;
  onSelect: () => void;
  onWatch:  () => void;
}) {
  const up    = item.changePct >= 0;
  const color = up ? "var(--gain,#00e5a0)" : "var(--loss,#ff4560)";
  const cat = item.category === "gainer" ? { label: "GAINER", color: "var(--gain,#00e5a0)", bg: "rgba(0,229,160,0.10)" }
            : item.category === "loser"  ? { label: "LOSER",  color: "var(--loss,#ff4560)", bg: "rgba(255,69,96,0.10)" }
            : /* active */                 { label: "ACTIVE", color: "var(--gold,#f0a500)", bg: "rgba(240,165,0,0.10)" };

  return (
    <div style={{
      position: "relative",
      borderRadius: 18,
      padding: "20px 22px",
      background: `linear-gradient(135deg, ${up ? "rgba(0,229,160,0.06)" : "rgba(255,69,96,0.06)"} 0%, rgba(255,255,255,0.02) 80%)`,
      border: `1px solid ${up ? "rgba(0,229,160,0.22)" : "rgba(255,69,96,0.22)"}`,
      overflow: "hidden",
      display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 14,
    }}>
      {/* Top row — category badge + watchlist star */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <span style={{
          ...mono, fontSize: 9, fontWeight: 700, letterSpacing: "0.14em",
          padding: "4px 9px", borderRadius: 99,
          background: cat.bg, color: cat.color,
          border: `1px solid ${cat.color}`,
        }}>
          {cat.label}
        </span>
        <button onClick={onWatch}
          aria-label={watched ? "Already in watchlist" : "Add to watchlist"}
          title={watched ? "In your watchlist" : "Add to watchlist"}
          style={{
            background: watched ? "rgba(240,165,0,0.16)" : "rgba(255,255,255,0.04)",
            border: `1px solid ${watched ? "rgba(240,165,0,0.50)" : "var(--border,rgba(60,48,100,0.5))"}`,
            color: watched ? "var(--gold,#f0a500)" : "var(--ink3,#3D5A7A)",
            borderRadius: 99, padding: 7, cursor: "pointer", display: "flex",
          }}>
          <Star size={14} fill={watched ? "currentColor" : "none"}/>
        </button>
      </div>

      {/* Ticker + price */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
        <button onClick={onSelect}
          style={{
            ...display, fontSize: "clamp(28px, 6vw, 38px)", fontWeight: 900,
            color: "var(--ticker-blue,#7EB6FF)", letterSpacing: "-0.02em",
            background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left",
          }}>
          {item.ticker}
        </button>
        <span style={{
          ...mono, fontSize: 18, fontWeight: 700, color: "var(--ink0,#f4f0ff)",
        }}>
          {f$(item.price)}
        </span>
        <span style={{
          ...mono, fontSize: 14, fontWeight: 700, color,
          display: "inline-flex", alignItems: "center", gap: 4,
        }}>
          {up ? <TrendingUp size={13}/> : <TrendingDown size={13}/>}
          {up ? "+" : ""}{item.changePct.toFixed(2)}%
        </span>
      </div>
      <p style={{ fontSize: 12, color: "var(--ink2,#7A9CBF)", margin: "-6px 0 0", lineHeight: 1.4 }}>
        {item.name}
        {" · "}<span style={{ ...mono, color: "var(--ink3,#3D5A7A)" }}>vol {fv(item.volume)}</span>
      </p>

      {/* Claude take — the soul of the card */}
      {item.aiTake ? (
        <div style={{
          padding: "12px 14px", borderRadius: 12,
          background: "rgba(155,114,245,0.08)",
          border: "1px solid rgba(155,114,245,0.28)",
          display: "flex", alignItems: "flex-start", gap: 10,
        }}>
          <span style={{
            width: 22, height: 22, borderRadius: 6,
            background: "rgba(155,114,245,0.18)",
            display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <Zap size={12} color="#9B72F5" fill="#9B72F5"/>
          </span>
          <p style={{ fontSize: 13, color: "var(--ink1,#cdc7e0)", margin: 0, lineHeight: 1.5, fontStyle: "italic" }}>
            {item.aiTake}
          </p>
        </div>
      ) : (
        <p style={{ ...mono, fontSize: 10, color: "var(--ink4,#1F3550)", margin: 0, textTransform: "uppercase", letterSpacing: "0.10em" }}>
          AI take loading…
        </p>
      )}

      {/* Footer CTA */}
      <button onClick={onSelect}
        style={{
          marginTop: "auto",
          padding: "10px 14px", borderRadius: 10,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid var(--border,rgba(60,48,100,0.5))",
          color: "var(--ink1,#cdc7e0)", cursor: "pointer",
          fontSize: 12, fontWeight: 600, fontFamily: "'Bricolage Grotesque',system-ui,sans-serif",
          display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
        }}>
        Open {item.ticker} <ArrowRight size={12}/>
      </button>
    </div>
  );
}
