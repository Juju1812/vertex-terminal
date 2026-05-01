"use client";

import { useEffect, useState, useMemo } from "react";
import { TrendingUp, TrendingDown, Trophy, Minus, Activity, Award, Target, BarChart2, Sparkles, ArrowUpRight, ArrowDownRight } from "lucide-react";

/* ── TrackRecord ─────────────────────────────────────────────
   Rolling performance dashboard for the AI's BUY picks vs SPY.
   Hero stats up top, best/worst showcase in the middle, and a
   sortable picks history below. Designed as its own dedicated
   tab so users can answer "is this AI any good?" in one glance.
*/

interface PickReturn {
  ticker:        string;
  signal:        string;
  confidence:    number;
  pickedAt:      string;
  pickedPrice:   number;
  currentPrice:  number;
  returnPct:     number;
  daysHeld:      number;
}

interface TrackRecordResp {
  snapshotCount: number;
  days:          number;
  picks:         PickReturn[];
  aggregate: {
    totalPicks: number;
    wins:       number; losses: number; flat: number;
    winRate:    number;
    avgReturn:  number;
    best:       PickReturn[];
    worst:      PickReturn[];
  } | null;
  spyBenchmark: { startPrice: number; currentPrice: number; returnPct: number; sinceIso: string } | null;
  vsBenchmark:  number | null;
  message?:     string;
}

interface Props { onSelectTicker?: (t: string) => void; }

const fp = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1mo ago" : `${months}mo ago`;
}

const mono: React.CSSProperties = { fontFamily: "'DM Mono','Courier New',monospace" };
const display: React.CSSProperties = { fontFamily: "'Cabinet Grotesk','Syne',system-ui,sans-serif" };

export default function TrackRecord({ onSelectTicker }: Props) {
  const [data, setData] = useState<TrackRecordResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState<7 | 30 | 90 | 365>(90);
  const [sortBy, setSortBy] = useState<"recency" | "best" | "worst">("recency");
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

  const sortedPicks = useMemo(() => {
    if (!data?.picks) return [];
    const copy = [...data.picks];
    if (sortBy === "recency") return copy.sort((a, b) => +new Date(b.pickedAt) - +new Date(a.pickedAt));
    if (sortBy === "best")    return copy.sort((a, b) => b.returnPct - a.returnPct);
    return copy.sort((a, b) => a.returnPct - b.returnPct);
  }, [data?.picks, sortBy]);

  const visiblePicks = showAll ? sortedPicks : sortedPicks.slice(0, 12);

  // Empty state
  if (!loading && (!data || data.snapshotCount === 0 || !data.aggregate)) {
    return (
      <div style={{ padding: "32px 20px", maxWidth: 1080, margin: "0 auto" }}>
        <div style={{
          padding: "60px 30px", textAlign: "center", borderRadius: 18,
          background: "linear-gradient(180deg, rgba(240,165,0,0.04) 0%, rgba(155,114,245,0.03) 100%)",
          border: "1px solid var(--border, rgba(60,48,100,0.5))",
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14, margin: "0 auto 14px",
            background: "rgba(240,165,0,0.10)", border: "1px solid rgba(240,165,0,0.30)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
          }}>
            <Activity size={26} color="var(--gold, #f0a500)" />
          </div>
          <h2 style={{ ...display, fontSize: 22, fontWeight: 700, color: "var(--ink0, #f4f0ff)", margin: "0 0 6px", letterSpacing: "-0.02em" }}>
            Track record building…
          </h2>
          <p style={{ fontSize: 13, color: "var(--ink2, #7A9CBF)", margin: "0 auto", maxWidth: 460, lineHeight: 1.55 }}>
            {data?.message ?? "Track record will populate as the AI runs each analysis. Open the Top 15 tab and trigger a fresh run to seed the first snapshot."}
          </p>
        </div>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div style={{ padding: "32px 20px", maxWidth: 1080, margin: "0 auto" }}>
        <div className="skel" style={{ height: 38, width: 280, marginBottom: 24, borderRadius: 8 }} />
        <div className="skel" style={{ height: 220, marginBottom: 18, borderRadius: 14 }} />
        <div className="skel" style={{ height: 140, marginBottom: 18, borderRadius: 14 }} />
        <div className="skel" style={{ height: 320, borderRadius: 14 }} />
      </div>
    );
  }

  const agg = data.aggregate!;
  const beatBenchmark = data.vsBenchmark != null && data.vsBenchmark > 0;
  const benchmarkColor = beatBenchmark ? "var(--gain, #00e5a0)" : data.vsBenchmark != null && data.vsBenchmark < 0 ? "var(--loss, #ff4560)" : "var(--ink2, #7A9CBF)";
  const avgPositive = agg.avgReturn >= 0;
  const avgColor = avgPositive ? "var(--gain, #00e5a0)" : "var(--loss, #ff4560)";

  // Bar magnitude for visual "win bar" — relative to the biggest absolute move
  const maxAbs = Math.max(...sortedPicks.map(p => Math.abs(p.returnPct)), 1);

  return (
    <div style={{ padding: "24px 20px 60px", maxWidth: 1080, margin: "0 auto" }}>

      {/* Page header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 22, gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: "linear-gradient(135deg, rgba(240,165,0,0.15), rgba(240,165,0,0.06))",
            border: "1px solid rgba(240,165,0,0.32)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <Trophy size={22} color="var(--gold, #f0a500)" />
          </div>
          <div>
            <h1 style={{ ...display, fontSize: 22, fontWeight: 700, color: "var(--ink0, #f4f0ff)", margin: 0, letterSpacing: "-0.02em" }}>
              AI Track Record
            </h1>
            <p style={{ ...mono, fontSize: 9, color: "var(--ink4, #1F3550)", margin: "3px 0 0", textTransform: "uppercase", letterSpacing: "0.10em" }}>
              {agg.totalPicks} BUY picks · {data.snapshotCount} runs · last {days === 365 ? "year" : `${days} days`}
            </p>
          </div>
        </div>

        {/* Range selector */}
        <div style={{ display: "flex", gap: 4, padding: 3, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid var(--border, rgba(60,48,100,0.5))" }}>
          {([7, 30, 90, 365] as const).map(d => (
            <button key={d} onClick={() => setDays(d)}
              style={{
                ...mono, fontSize: 11, padding: "6px 13px", borderRadius: 7,
                background: days === d ? "linear-gradient(135deg, rgba(240,165,0,0.18), rgba(240,165,0,0.10))" : "transparent",
                border: `1px solid ${days === d ? "rgba(240,165,0,0.40)" : "transparent"}`,
                color: days === d ? "var(--gold, #f0a500)" : "var(--ink3, #3D5A7A)",
                cursor: "pointer", fontWeight: days === d ? 700 : 500,
                transition: "all 0.15s",
              }}>
              {d === 365 ? "1y" : `${d}d`}
            </button>
          ))}
        </div>
      </div>

      {/* HERO: huge avg return + vs SPY badge */}
      <div style={{
        marginBottom: 18,
        padding: "30px 30px",
        borderRadius: 18,
        background: avgPositive
          ? "linear-gradient(135deg, rgba(0,229,160,0.10) 0%, rgba(0,229,160,0.02) 70%, transparent 100%)"
          : "linear-gradient(135deg, rgba(255,69,96,0.10) 0%, rgba(255,69,96,0.02) 70%, transparent 100%)",
        border: `1px solid ${avgPositive ? "rgba(0,229,160,0.32)" : "rgba(255,69,96,0.32)"}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 24,
        flexWrap: "wrap",
      }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <p style={{ ...mono, fontSize: 10, color: "var(--ink3, #3D5A7A)", textTransform: "uppercase", letterSpacing: "0.16em", margin: "0 0 8px", fontWeight: 600 }}>
            Average return per BUY pick
          </p>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
            <span style={{ ...display, fontSize: "clamp(48px, 8vw, 80px)", fontWeight: 900, color: avgColor, letterSpacing: "-0.04em", lineHeight: 1 }}>
              {fp(agg.avgReturn)}
            </span>
            {data.vsBenchmark != null && (
              <span style={{
                ...mono, fontSize: 12, fontWeight: 700,
                padding: "6px 12px", borderRadius: 99,
                background: beatBenchmark ? "rgba(0,229,160,0.14)" : "rgba(255,69,96,0.14)",
                border: `1px solid ${beatBenchmark ? "rgba(0,229,160,0.40)" : "rgba(255,69,96,0.40)"}`,
                color: benchmarkColor,
                display: "inline-flex", alignItems: "center", gap: 5,
              }}>
                {beatBenchmark ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                {fp(data.vsBenchmark)} vs S&amp;P 500
              </span>
            )}
          </div>
          {data.spyBenchmark && (
            <p style={{ ...mono, fontSize: 11, color: "var(--ink3, #3D5A7A)", margin: "10px 0 0", letterSpacing: "0.04em" }}>
              SPY benchmark: {fp(data.spyBenchmark.returnPct)} over the same window
            </p>
          )}
        </div>

        {/* Win-rate visual */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10, minWidth: 200 }}>
          <p style={{ ...mono, fontSize: 10, color: "var(--ink3, #3D5A7A)", textTransform: "uppercase", letterSpacing: "0.16em", margin: 0, fontWeight: 600 }}>
            Hit rate
          </p>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ ...display, fontSize: 56, fontWeight: 900, color: "var(--ink0, #f4f0ff)", letterSpacing: "-0.04em", lineHeight: 1 }}>
              {agg.winRate}
            </span>
            <span style={{ ...mono, fontSize: 18, fontWeight: 700, color: "var(--ink3, #3D5A7A)" }}>%</span>
          </div>
          {/* Win/loss/flat bar */}
          <div style={{ display: "flex", width: 200, height: 6, borderRadius: 99, overflow: "hidden", background: "rgba(255,255,255,0.06)" }}>
            <div style={{ flex: agg.wins,   background: "var(--gain, #00e5a0)" }} />
            <div style={{ flex: agg.flat,   background: "var(--ink3, #3D5A7A)" }} />
            <div style={{ flex: agg.losses, background: "var(--loss, #ff4560)" }} />
          </div>
          <p style={{ ...mono, fontSize: 10, color: "var(--ink3, #3D5A7A)", margin: 0, letterSpacing: "0.04em" }}>
            <span style={{ color: "var(--gain, #00e5a0)", fontWeight: 700 }}>{agg.wins}W</span>
            {" · "}
            <span style={{ color: "var(--ink2, #7A9CBF)", fontWeight: 700 }}>{agg.flat} flat</span>
            {" · "}
            <span style={{ color: "var(--loss, #ff4560)", fontWeight: 700 }}>{agg.losses}L</span>
          </p>
        </div>
      </div>

      {/* Best & worst pick spotlight */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18,
      }} className="vx-tr-bw">
        {agg.best[0] && (
          <SpotlightCard
            label="Best pick"
            kind="best"
            pick={agg.best[0]}
            onSelect={onSelectTicker}
          />
        )}
        {agg.worst[0] && (
          <SpotlightCard
            label="Worst pick"
            kind="worst"
            pick={agg.worst[0]}
            onSelect={onSelectTicker}
          />
        )}
      </div>

      {/* Top 5 winners + losers (compact) */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18,
      }} className="vx-tr-tl">
        <TopList title="Top 5 winners"  picks={agg.best.slice(0, 5)}  variant="win"  onSelect={onSelectTicker} />
        <TopList title="Top 5 laggers"  picks={agg.worst.slice(0, 5)} variant="loss" onSelect={onSelectTicker} />
      </div>

      {/* Full picks history */}
      <div style={{
        borderRadius: 14,
        background: "rgba(255,255,255,0.02)",
        border: "1px solid var(--border, rgba(60,48,100,0.5))",
        overflow: "hidden",
      }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border, rgba(60,48,100,0.4))", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <BarChart2 size={16} color="var(--gold, #f0a500)" />
            <h3 style={{ ...display, fontSize: 14, fontWeight: 700, color: "var(--ink0, #f4f0ff)", margin: 0, letterSpacing: "-0.01em" }}>
              All picks · {sortedPicks.length}
            </h3>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {([
              { id: "recency", label: "Most recent" },
              { id: "best",    label: "Best first"  },
              { id: "worst",   label: "Worst first" },
            ] as const).map(opt => (
              <button key={opt.id} onClick={() => setSortBy(opt.id)}
                style={{
                  ...mono, fontSize: 10, padding: "5px 11px", borderRadius: 7,
                  background: sortBy === opt.id ? "rgba(240,165,0,0.10)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${sortBy === opt.id ? "rgba(240,165,0,0.32)" : "var(--border, rgba(60,48,100,0.4))"}`,
                  color: sortBy === opt.id ? "var(--gold, #f0a500)" : "var(--ink2, #7A9CBF)",
                  cursor: "pointer", fontWeight: sortBy === opt.id ? 700 : 500,
                  transition: "all 0.15s",
                }}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Header row */}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(70px, 90px) 1fr minmax(80px, 110px) minmax(120px, 1fr) minmax(80px, 110px)", gap: 10, padding: "10px 20px", background: "rgba(255,255,255,0.02)", borderBottom: "1px solid var(--border, rgba(60,48,100,0.4))" }}>
          {["Ticker", "Return bar", "Return %", "When · held · conf", "Price"].map((h) => (
            <span key={h} style={{ ...mono, fontSize: 9, color: "var(--ink3, #3D5A7A)", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 600 }}>
              {h}
            </span>
          ))}
        </div>

        <div>
          {visiblePicks.map((p, i) => {
            const win = p.returnPct > 0;
            const flat = p.returnPct === 0;
            const color = flat ? "var(--ink2, #7A9CBF)" : win ? "var(--gain, #00e5a0)" : "var(--loss, #ff4560)";
            const barWidth = Math.min(100, (Math.abs(p.returnPct) / maxAbs) * 100);
            return (
              <button key={`${p.ticker}-${p.pickedAt}-${i}`}
                onClick={() => onSelectTicker?.(p.ticker)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(70px, 90px) 1fr minmax(80px, 110px) minmax(120px, 1fr) minmax(80px, 110px)",
                  gap: 10, alignItems: "center",
                  width: "100%", padding: "13px 20px",
                  background: "transparent", border: "none",
                  borderTop: i === 0 ? "none" : "1px solid var(--border, rgba(60,48,100,0.25))",
                  cursor: "pointer", textAlign: "left",
                  transition: "background 0.12s",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <span style={{ ...mono, fontSize: 13, fontWeight: 700, color: "var(--ticker-blue, #7EB6FF)", letterSpacing: "0.04em" }}>
                  {p.ticker}
                </span>
                {/* Return bar */}
                <div style={{ height: 6, background: "rgba(255,255,255,0.04)", borderRadius: 99, overflow: "hidden", display: "flex", alignItems: "center" }}>
                  <div style={{
                    width: `${barWidth}%`,
                    height: "100%",
                    background: flat ? "var(--ink3, #3D5A7A)" : win ? "linear-gradient(90deg, var(--gain, #00e5a0), rgba(0,229,160,0.5))" : "linear-gradient(90deg, var(--loss, #ff4560), rgba(255,69,96,0.5))",
                    borderRadius: 99,
                    transition: "width 0.4s ease",
                  }} />
                </div>
                <span style={{ ...mono, fontSize: 13, fontWeight: 700, color, display: "inline-flex", alignItems: "center", gap: 4 }}>
                  {flat ? <Minus size={12} /> : win ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {fp(p.returnPct)}
                </span>
                <span style={{ ...mono, fontSize: 10, color: "var(--ink3, #3D5A7A)" }}>
                  {relTime(p.pickedAt)} · {p.daysHeld}d held · {p.confidence}% conf
                </span>
                <span style={{ ...mono, fontSize: 11, color: "var(--ink2, #7A9CBF)", textAlign: "right" }}>
                  ${p.pickedPrice.toFixed(2)} → ${p.currentPrice.toFixed(2)}
                </span>
              </button>
            );
          })}
        </div>

        {sortedPicks.length > 12 && (
          <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border, rgba(60,48,100,0.4))", textAlign: "center" }}>
            <button onClick={() => setShowAll(s => !s)}
              style={{ ...mono, fontSize: 11, color: "var(--gold, #f0a500)", background: "none", border: "none", cursor: "pointer", padding: "4px 0", fontWeight: 600 }}>
              {showAll ? "Show top 12" : `Show all ${sortedPicks.length} picks`}
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <p style={{ ...mono, fontSize: 9, color: "var(--ink4, #1F3550)", margin: "16px 0 0", textAlign: "center", textTransform: "uppercase", letterSpacing: "0.12em" }}>
        Tracked automatically · Past performance ≠ future results
      </p>

      <style>{`
        @media (max-width: 720px) {
          .vx-tr-bw, .vx-tr-tl { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

/* ── Spotlight card (best / worst) ───────────────────────────── */

function SpotlightCard({ label, kind, pick, onSelect }: {
  label: string;
  kind: "best" | "worst";
  pick: PickReturn;
  onSelect?: (t: string) => void;
}) {
  const positive = pick.returnPct >= 0;
  const isBest = kind === "best";
  const accent = isBest ? "var(--gain, #00e5a0)" : "var(--loss, #ff4560)";
  const accentDim = isBest ? "rgba(0,229,160,0.10)" : "rgba(255,69,96,0.10)";
  const accentWire = isBest ? "rgba(0,229,160,0.32)" : "rgba(255,69,96,0.32)";

  return (
    <button onClick={() => onSelect?.(pick.ticker)}
      style={{
        textAlign: "left", width: "100%",
        padding: "20px 22px", borderRadius: 14,
        background: `linear-gradient(135deg, ${accentDim} 0%, rgba(255,255,255,0.02) 80%)`,
        border: `1px solid ${accentWire}`,
        cursor: "pointer", color: "inherit",
        display: "flex", flexDirection: "column", gap: 10,
        transition: "transform 0.18s ease, box-shadow 0.18s ease",
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 8px 32px ${accentDim}`; }}
      onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {isBest ? <Award size={14} color={accent} /> : <Target size={14} color={accent} />}
        <span style={{ ...mono, fontSize: 9, color: accent, textTransform: "uppercase", letterSpacing: "0.16em", fontWeight: 700 }}>
          {label}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <span style={{ ...mono, fontSize: 24, fontWeight: 700, color: "var(--ticker-blue, #7EB6FF)", letterSpacing: "0.02em" }}>
          {pick.ticker}
        </span>
        <span style={{ ...display, fontSize: 32, fontWeight: 800, color: accent, letterSpacing: "-0.02em" }}>
          {fp(pick.returnPct)}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "var(--ink3, #3D5A7A)", ...mono, flexWrap: "wrap" }}>
        <span>{relTime(pick.pickedAt)}</span>
        <span>·</span>
        <span>{pick.daysHeld}d held</span>
        <span>·</span>
        <span>{pick.confidence}% conf</span>
        <span>·</span>
        <span>${pick.pickedPrice.toFixed(2)} → ${pick.currentPrice.toFixed(2)}</span>
      </div>
      <span style={{ ...mono, fontSize: 10, color: accent, marginTop: 4, display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 600 }}>
        Open {pick.ticker} <Sparkles size={10} />
      </span>
    </button>
  );
}

/* ── Top 5 winners / laggers list ────────────────────────────── */

function TopList({ title, picks, variant, onSelect }: {
  title: string;
  picks: PickReturn[];
  variant: "win" | "loss";
  onSelect?: (t: string) => void;
}) {
  const accent = variant === "win" ? "var(--gain, #00e5a0)" : "var(--loss, #ff4560)";

  return (
    <div style={{
      borderRadius: 14,
      background: "rgba(255,255,255,0.02)",
      border: "1px solid var(--border, rgba(60,48,100,0.5))",
      overflow: "hidden",
    }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border, rgba(60,48,100,0.4))", display: "flex", alignItems: "center", gap: 8 }}>
        {variant === "win" ? <TrendingUp size={13} color={accent} /> : <TrendingDown size={13} color={accent} />}
        <span style={{ ...mono, fontSize: 10, color: accent, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700 }}>
          {title}
        </span>
      </div>
      <div>
        {picks.length === 0 ? (
          <p style={{ padding: "16px", fontSize: 12, color: "var(--ink3, #3D5A7A)", textAlign: "center", margin: 0, ...mono }}>—</p>
        ) : (
          picks.map((p, i) => {
            const positive = p.returnPct >= 0;
            const color = positive ? "var(--gain, #00e5a0)" : "var(--loss, #ff4560)";
            return (
              <button key={`${p.ticker}-${p.pickedAt}-${i}`}
                onClick={() => onSelect?.(p.ticker)}
                style={{
                  display: "grid", gridTemplateColumns: "16px 1fr auto", gap: 10,
                  width: "100%", padding: "10px 16px",
                  background: "transparent", border: "none",
                  borderTop: i === 0 ? "none" : "1px solid var(--border, rgba(60,48,100,0.25))",
                  cursor: "pointer", textAlign: "left", color: "inherit",
                  transition: "background 0.12s",
                  alignItems: "center",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.025)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <span style={{ ...mono, fontSize: 9, color: "var(--ink4, #1F3550)", fontWeight: 700, textAlign: "right" }}>
                  {i + 1}
                </span>
                <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                  <span style={{ ...mono, fontSize: 12, fontWeight: 600, color: "var(--ticker-blue, #7EB6FF)" }}>{p.ticker}</span>
                  <span style={{ ...mono, fontSize: 9, color: "var(--ink4, #1F3550)" }}>{relTime(p.pickedAt)} · {p.daysHeld}d</span>
                </span>
                <span style={{ ...mono, fontSize: 13, fontWeight: 700, color, textAlign: "right" }}>
                  {fp(p.returnPct)}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
