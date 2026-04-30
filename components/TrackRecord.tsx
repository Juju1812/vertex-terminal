"use client";

import { useEffect, useState, useMemo } from "react";
import { TrendingUp, TrendingDown, Trophy, Minus, BarChart2, Activity } from "lucide-react";

/* ── TrackRecord ─────────────────────────────────────────────
   Renders an aggregate panel showing how the AI's BUY picks have
   performed over a rolling window (default 90 days), benchmarked
   against SPY. Sits at the top of the Top 15 tab so every visit
   shows the receipts.
*/

interface PickReturn {
  ticker: string;
  signal: string;
  confidence: number;
  pickedAt: string;
  pickedPrice: number;
  currentPrice: number;
  returnPct: number;
  daysHeld: number;
}

interface TrackRecordResp {
  snapshotCount: number;
  days: number;
  picks: PickReturn[];
  aggregate: {
    totalPicks: number;
    wins: number; losses: number; flat: number;
    winRate: number;
    avgReturn: number;
    best: PickReturn[];
    worst: PickReturn[];
  } | null;
  spyBenchmark: { startPrice: number; currentPrice: number; returnPct: number; sinceIso: string } | null;
  vsBenchmark: number | null;
  message?: string;
}

const f$ = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fp = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days < 1) return "today";
  if (days === 1) return "1d ago";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1mo ago" : `${months}mo ago`;
}

const mono: React.CSSProperties = { fontFamily: "'DM Mono','Courier New',monospace" };
const display: React.CSSProperties = { fontFamily: "'Cabinet Grotesk','Syne',system-ui,sans-serif" };

const cardStyle: React.CSSProperties = {
  background: "linear-gradient(145deg,rgba(255,255,255,0.030) 0%,rgba(255,255,255,0.010) 100%)",
  border: "1px solid var(--border,rgba(60,48,100,0.5))",
  borderRadius: 14,
  position: "relative",
  overflow: "hidden",
};

export default function TrackRecord() {
  const [data, setData] = useState<TrackRecordResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState<7 | 30 | 90 | 365>(90);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/track-record?days=${days}`)
      .then(r => r.json())
      .then((d: TrackRecordResp) => { if (!cancelled) { setData(d); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [days]);

  // Sort all picks by recency for the list view
  const sortedPicks = useMemo(() => {
    if (!data?.picks) return [];
    return [...data.picks].sort((a, b) => +new Date(b.pickedAt) - +new Date(a.pickedAt));
  }, [data?.picks]);

  const visiblePicks = showAll ? sortedPicks : sortedPicks.slice(0, 8);

  // Empty state — no snapshots yet
  if (!loading && (!data || data.snapshotCount === 0 || !data.aggregate)) {
    return (
      <div style={{ ...cardStyle, padding: "20px 22px", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <BarChart2 size={16} color="var(--gold,#f0a500)" />
          <h2 style={{ ...display, fontSize: 14, fontWeight: 700, color: "var(--ink0,#f4f0ff)", margin: 0 }}>
            Track Record
          </h2>
          <span style={{ ...mono, fontSize: 9, color: "var(--ink4,#1F3550)", textTransform: "uppercase", letterSpacing: "0.1em", marginLeft: "auto" }}>
            Building…
          </span>
        </div>
        <p style={{ fontSize: 12, color: "var(--ink2,#7A9CBF)", lineHeight: 1.6, margin: 0 }}>
          {data?.message ?? "Track record will populate as the AI logs each analysis. Click Refresh to start the first snapshot."}
        </p>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div style={{ ...cardStyle, padding: "20px 22px", marginBottom: 16 }}>
        <div className="skel" style={{ height: 18, width: 180, marginBottom: 12 }} />
        <div className="skel" style={{ height: 60 }} />
      </div>
    );
  }

  const agg = data.aggregate!;
  const beatBenchmark = data.vsBenchmark != null && data.vsBenchmark > 0;
  const benchmarkColor = beatBenchmark ? "var(--gain,#00e5a0)" : data.vsBenchmark != null && data.vsBenchmark < 0 ? "var(--loss,#ff4560)" : "var(--ink2,#7A9CBF)";

  return (
    <div style={{ ...cardStyle, marginBottom: 16, overflow: "visible" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 22px 12px", borderBottom: "1px solid var(--border,rgba(60,48,100,0.5))", flexWrap: "wrap" }}>
        <BarChart2 size={16} color="var(--gold,#f0a500)" />
        <h2 style={{ ...display, fontSize: 14, fontWeight: 700, color: "var(--ink0,#f4f0ff)", margin: 0 }}>
          AI Track Record
        </h2>
        <span style={{ ...mono, fontSize: 9, color: "var(--ink4,#1F3550)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
          {agg.totalPicks} picks · {data.snapshotCount} runs
        </span>

        {/* Range selector */}
        <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
          {([7, 30, 90, 365] as const).map(d => (
            <button key={d} onClick={() => setDays(d)}
              style={{
                ...mono, fontSize: 10, padding: "4px 10px", borderRadius: 6,
                background: days === d ? "rgba(240,165,0,0.12)" : "transparent",
                border: `1px solid ${days === d ? "rgba(240,165,0,0.32)" : "var(--border,rgba(60,48,100,0.5))"}`,
                color: days === d ? "var(--gold,#f0a500)" : "var(--ink3,#3D5A7A)",
                cursor: "pointer", fontWeight: days === d ? 600 : 400,
              }}>
              {d === 365 ? "1y" : `${d}d`}
            </button>
          ))}
        </div>
      </div>

      {/* Headline stats grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 1, background: "var(--border,rgba(60,48,100,0.5))" }}>
        {/* Avg Return */}
        <div style={{ padding: "16px 18px", background: "linear-gradient(145deg,rgba(255,255,255,0.018) 0%,rgba(255,255,255,0.005) 100%)" }}>
          <p style={{ ...mono, fontSize: 9, color: "var(--ink4,#1F3550)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Avg Return / Pick</p>
          <p style={{ ...mono, fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em", color: agg.avgReturn >= 0 ? "var(--gain,#00e5a0)" : "var(--loss,#ff4560)" }}>
            {fp(agg.avgReturn)}
          </p>
        </div>

        {/* vs SPY */}
        <div style={{ padding: "16px 18px", background: "linear-gradient(145deg,rgba(255,255,255,0.018) 0%,rgba(255,255,255,0.005) 100%)" }}>
          <p style={{ ...mono, fontSize: 9, color: "var(--ink4,#1F3550)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>vs S&P 500</p>
          {data.vsBenchmark != null ? (
            <>
              <p style={{ ...mono, fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em", color: benchmarkColor }}>
                {fp(data.vsBenchmark)}
              </p>
              {data.spyBenchmark && (
                <p style={{ ...mono, fontSize: 9, color: "var(--ink4,#1F3550)", marginTop: 2 }}>
                  SPY: {fp(data.spyBenchmark.returnPct)}
                </p>
              )}
            </>
          ) : (
            <p style={{ ...mono, fontSize: 14, color: "var(--ink3,#3D5A7A)" }}>—</p>
          )}
        </div>

        {/* Win Rate */}
        <div style={{ padding: "16px 18px", background: "linear-gradient(145deg,rgba(255,255,255,0.018) 0%,rgba(255,255,255,0.005) 100%)" }}>
          <p style={{ ...mono, fontSize: 9, color: "var(--ink4,#1F3550)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Hit Rate</p>
          <p style={{ ...mono, fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em", color: "var(--ink0,#f4f0ff)" }}>
            {agg.winRate}%
          </p>
          <p style={{ ...mono, fontSize: 9, color: "var(--ink4,#1F3550)", marginTop: 2 }}>
            {agg.wins}W · {agg.losses}L · {agg.flat}flat
          </p>
        </div>

        {/* Best pick */}
        <div style={{ padding: "16px 18px", background: "linear-gradient(145deg,rgba(255,255,255,0.018) 0%,rgba(255,255,255,0.005) 100%)" }}>
          <p style={{ ...mono, fontSize: 9, color: "var(--ink4,#1F3550)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Best Pick</p>
          {agg.best[0] ? (
            <>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <span style={{ ...mono, fontSize: 14, fontWeight: 500, color: "var(--ticker-blue,#7EB6FF)" }}>{agg.best[0].ticker}</span>
                <span style={{ ...mono, fontSize: 16, fontWeight: 600, color: "var(--gain,#00e5a0)" }}>{fp(agg.best[0].returnPct)}</span>
              </div>
              <p style={{ ...mono, fontSize: 9, color: "var(--ink4,#1F3550)", marginTop: 2 }}>{relTime(agg.best[0].pickedAt)}</p>
            </>
          ) : (
            <p style={{ ...mono, fontSize: 14, color: "var(--ink3,#3D5A7A)" }}>—</p>
          )}
        </div>
      </div>

      {/* Past picks list */}
      {sortedPicks.length > 0 && (
        <div style={{ padding: "12px 22px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <p style={{ ...mono, fontSize: 9, color: "var(--ink3,#3D5A7A)", textTransform: "uppercase", letterSpacing: "0.1em", margin: 0 }}>
              All BUY picks · last {days === 365 ? "year" : `${days} days`}
            </p>
            {sortedPicks.length > 8 && (
              <button onClick={() => setShowAll(s => !s)}
                style={{ ...mono, fontSize: 10, color: "var(--gold,#f0a500)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                {showAll ? "Show top 8" : `Show all ${sortedPicks.length}`}
              </button>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {visiblePicks.map((p, i) => {
              const win = p.returnPct > 0;
              const flat = p.returnPct === 0;
              const color = flat ? "var(--ink2,#7A9CBF)" : win ? "var(--gain,#00e5a0)" : "var(--loss,#ff4560)";
              return (
                <a key={`${p.ticker}-${p.pickedAt}-${i}`}
                  href={`/stock/${p.ticker}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(60px, 80px) minmax(70px, 1fr) minmax(80px, 1fr) minmax(60px, 80px)",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 0",
                    borderTop: i === 0 ? "none" : "1px solid var(--border,rgba(60,48,100,0.5))",
                    textDecoration: "none",
                    transition: "background 0.15s",
                  }}
                  className="row-hover">
                  <span style={{ ...mono, fontSize: 13, fontWeight: 500, color: "var(--ticker-blue,#7EB6FF)" }}>{p.ticker}</span>
                  <span style={{ ...mono, fontSize: 10, color: "var(--ink3,#3D5A7A)" }}>
                    {f$(p.pickedPrice)} → {f$(p.currentPrice)}
                  </span>
                  <span style={{ ...mono, fontSize: 10, color: "var(--ink4,#1F3550)" }}>
                    {relTime(p.pickedAt)} · {p.daysHeld}d held · {p.confidence}% conf
                  </span>
                  <span style={{ ...mono, fontSize: 13, fontWeight: 600, color, textAlign: "right", display: "inline-flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
                    {flat ? <Minus size={11} /> : win ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                    {fp(p.returnPct)}
                  </span>
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer note */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 22px 12px", borderTop: "1px solid var(--border,rgba(60,48,100,0.5))" }}>
        <Activity size={9} color="var(--ink4,#1F3550)" />
        <p style={{ ...mono, fontSize: 9, color: "var(--ink4,#1F3550)", margin: 0, letterSpacing: "0.06em" }}>
          Tracked automatically · Past performance ≠ future results
        </p>
        {agg.totalPicks > 0 && agg.best[0] && (
          <Trophy size={9} color="var(--gold,#f0a500)" style={{ marginLeft: "auto" }} />
        )}
      </div>
    </div>
  );
}
