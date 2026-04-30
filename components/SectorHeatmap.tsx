"use client";

import { useEffect, useState, useCallback } from "react";
import { LayoutDashboard, RefreshCw } from "lucide-react";

/* ── SectorHeatmap ──────────────────────────────────────────
   Market-wide visual scanner. Shows the major US indices on
   top, then the 11 GICS sector SPDR ETFs as a colored grid.
   Tile color intensity scales with today's % change so a
   green-saturated tile = strong sector, red = weak. Click any
   tile to open the dedicated /stock/[ticker] page.
   Auto-refreshes every 60 seconds when visible.
*/

const POLYGON_KEY = process.env.NEXT_PUBLIC_POLYGON_API_KEY ?? "1xwzcvUOF9pft6PRNylO2Xc6X2QeQCGr";

interface Tile {
  ticker: string;
  name: string;
  group: "index" | "sector";
}

const TILES: Tile[] = [
  // Indices (top row)
  { ticker: "SPY", name: "S&P 500",     group: "index" },
  { ticker: "QQQ", name: "Nasdaq 100",  group: "index" },
  { ticker: "DIA", name: "Dow 30",      group: "index" },
  { ticker: "IWM", name: "Russell 2000",group: "index" },

  // 11 GICS sectors (SPDR Select)
  { ticker: "XLK",  name: "Technology",          group: "sector" },
  { ticker: "XLF",  name: "Financials",          group: "sector" },
  { ticker: "XLV",  name: "Healthcare",          group: "sector" },
  { ticker: "XLY",  name: "Consumer Disc.",      group: "sector" },
  { ticker: "XLP",  name: "Consumer Staples",    group: "sector" },
  { ticker: "XLE",  name: "Energy",              group: "sector" },
  { ticker: "XLI",  name: "Industrials",         group: "sector" },
  { ticker: "XLU",  name: "Utilities",           group: "sector" },
  { ticker: "XLB",  name: "Materials",           group: "sector" },
  { ticker: "XLRE", name: "Real Estate",         group: "sector" },
  { ticker: "XLC",  name: "Communications",      group: "sector" },
];

interface Quote { price: number; change: number; changePct: number; }

async function fetchQuotes(tickers: string[]): Promise<Record<string, Quote>> {
  if (!tickers.length) return {};
  try {
    const r = await fetch(
      `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${tickers.join(",")}&apiKey=${POLYGON_KEY}`
    );
    if (!r.ok) return {};
    const d = await r.json() as { tickers?: Array<{ ticker: string; day: { c: number }; prevDay: { c: number } }> };
    const out: Record<string, Quote> = {};
    for (const t of d.tickers ?? []) {
      if (t.day?.c > 0 && t.prevDay?.c > 0) {
        const change = +(t.day.c - t.prevDay.c).toFixed(2);
        out[t.ticker] = {
          price: t.day.c,
          change,
          changePct: +((change / t.prevDay.c) * 100).toFixed(2),
        };
      }
    }
    return out;
  } catch { return {}; }
}

const f$ = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fp = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;

/* Color intensity scales by |% change|. Saturates at ±3% for visual
   readability — anything stronger than 3% just stays at full saturation
   rather than blowing out. Returns CSS background + border tuple. */
function tileColors(changePct: number | undefined): { bg: string; border: string; text: string } {
  if (changePct == null || isNaN(changePct)) {
    return { bg: "rgba(255,255,255,0.025)", border: "var(--border,rgba(60,48,100,0.5))", text: "var(--ink3,#3D5A7A)" };
  }
  const intensity = Math.min(1, Math.abs(changePct) / 3);
  const alpha = 0.10 + intensity * 0.30; // 0.10 to 0.40
  const borderAlpha = 0.20 + intensity * 0.40; // 0.20 to 0.60
  if (changePct >= 0) {
    return {
      bg: `rgba(0,229,160,${alpha.toFixed(3)})`,
      border: `rgba(0,229,160,${borderAlpha.toFixed(3)})`,
      text: "var(--gain,#00e5a0)",
    };
  }
  return {
    bg: `rgba(255,69,96,${alpha.toFixed(3)})`,
    border: `rgba(255,69,96,${borderAlpha.toFixed(3)})`,
    text: "var(--loss,#ff4560)",
  };
}

const mono: React.CSSProperties = { fontFamily: "'DM Mono','Courier New',monospace" };
const display: React.CSSProperties = { fontFamily: "'Cabinet Grotesk','Syne',system-ui,sans-serif" };

export default function SectorHeatmap() {
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    const data = await fetchQuotes(TILES.map(t => t.ticker));
    setQuotes(data);
    setLastUpdate(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    // Auto-refresh every 60 seconds when the tab is visible
    let interval: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (interval) clearInterval(interval);
      interval = setInterval(() => {
        if (document.visibilityState === "visible") refresh();
      }, 60_000);
    };
    start();
    const onVis = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      if (interval) clearInterval(interval);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refresh]);

  const indices = TILES.filter(t => t.group === "index");
  const sectors = TILES.filter(t => t.group === "sector");

  const cardStyle: React.CSSProperties = {
    background: "linear-gradient(145deg,rgba(255,255,255,0.030) 0%,rgba(255,255,255,0.010) 100%)",
    border: "1px solid var(--border,rgba(60,48,100,0.5))",
    borderRadius: 18,
    overflow: "hidden",
  };

  return (
    <div style={cardStyle}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 22px 10px", borderBottom: "1px solid var(--border,rgba(60,48,100,0.5))", flexWrap: "wrap" }}>
        <LayoutDashboard size={14} color="var(--gold,#f0a500)" />
        <h2 style={{ ...display, fontSize: 14, fontWeight: 700, color: "var(--ink0,#f4f0ff)", margin: 0 }}>
          Sector Heatmap
        </h2>
        <span style={{ ...mono, fontSize: 9, color: "var(--ink4,#1F3550)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
          Today · 11 sectors + 4 indices
        </span>
        <button onClick={refresh}
          title="Refresh now"
          style={{
            marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 5,
            background: "rgba(255,255,255,0.04)", border: "1px solid var(--border,rgba(60,48,100,0.5))",
            color: "var(--ink2,#7A9CBF)", borderRadius: 7, padding: "5px 10px",
            cursor: "pointer", ...mono, fontSize: 10,
          }}>
          <RefreshCw size={10} /> {lastUpdate ? lastUpdate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
        </button>
      </div>

      {/* Indices row */}
      <div style={{ padding: "14px 18px 8px" }}>
        <p style={{ ...mono, fontSize: 9, color: "var(--ink4,#1F3550)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
          Indices
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
          {indices.map(t => {
            const q = quotes[t.ticker];
            const colors = tileColors(q?.changePct);
            return (
              <a key={t.ticker} href={`/stock/${t.ticker}`}
                style={{
                  display: "flex", flexDirection: "column", justifyContent: "space-between",
                  padding: "10px 12px", borderRadius: 10,
                  background: colors.bg, border: `1px solid ${colors.border}`,
                  textDecoration: "none", minHeight: 64,
                  transition: "transform 0.15s, background 0.3s",
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.02)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 6 }}>
                  <span style={{ ...mono, fontSize: 13, fontWeight: 500, color: "var(--ink0,#f4f0ff)" }}>{t.ticker}</span>
                  <span style={{ ...mono, fontSize: 12, fontWeight: 600, color: colors.text }}>
                    {q ? fp(q.changePct) : "—"}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 6, marginTop: 4 }}>
                  <span style={{ fontSize: 10, color: "var(--ink3,#3D5A7A)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</span>
                  <span style={{ ...mono, fontSize: 10, color: "var(--ink2,#7A9CBF)" }}>
                    {q ? f$(q.price) : (loading ? "…" : "—")}
                  </span>
                </div>
              </a>
            );
          })}
        </div>
      </div>

      {/* Sectors grid */}
      <div style={{ padding: "10px 18px 18px" }}>
        <p style={{ ...mono, fontSize: 9, color: "var(--ink4,#1F3550)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
          Sectors (SPDR Select ETFs)
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
          {sectors.map(t => {
            const q = quotes[t.ticker];
            const colors = tileColors(q?.changePct);
            return (
              <a key={t.ticker} href={`/stock/${t.ticker}`}
                style={{
                  display: "flex", flexDirection: "column", justifyContent: "space-between",
                  padding: "10px 12px", borderRadius: 10,
                  background: colors.bg, border: `1px solid ${colors.border}`,
                  textDecoration: "none", minHeight: 70,
                  transition: "transform 0.15s, background 0.3s",
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.02)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 6 }}>
                  <span style={{ ...mono, fontSize: 13, fontWeight: 500, color: "var(--ink0,#f4f0ff)" }}>{t.ticker}</span>
                  <span style={{ ...mono, fontSize: 12, fontWeight: 600, color: colors.text }}>
                    {q ? fp(q.changePct) : "—"}
                  </span>
                </div>
                <div style={{ marginTop: 4 }}>
                  <p style={{ fontSize: 11, color: "var(--ink1,#cdc7e0)", margin: 0, lineHeight: 1.2, fontWeight: 500 }}>{t.name}</p>
                  <p style={{ ...mono, fontSize: 9, color: "var(--ink3,#3D5A7A)", margin: "2px 0 0" }}>
                    {q ? f$(q.price) : (loading ? "…" : "—")}
                  </p>
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}
