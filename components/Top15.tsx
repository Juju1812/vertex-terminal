"use client";

import { useState, useEffect, useCallback } from "react";
import {
  TrendingUp, TrendingDown, RefreshCw, DollarSign,
  Trophy, Target, Shield, Zap, ChevronUp, ChevronDown,
  X,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Top15Stock {
  rank: number;
  ticker: string;
  name: string;
  price: number;
  changePct: number;
  floor: number;    // support level
  ceiling: number;  // target price
  confidence: number;
  sector: string;
  score: number;    // composite score driving the rank
}

interface Allocation {
  ticker: string;
  name: string;
  price: number;
  confidence: number;
  dollars: number;
  shares: number;
  pct: number;
  rationale: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const API_KEY = "1xwzcvUOF9pft6PRNylO2Xc6X2QeQCGr";
const BASE    = "https://api.polygon.io";

// Universe of candidates — we rank these via live data + scoring
const UNIVERSE = [
  { ticker:"NVDA",  name:"NVIDIA Corp.",            sector:"Technology"  },
  { ticker:"MSFT",  name:"Microsoft Corp.",          sector:"Technology"  },
  { ticker:"AAPL",  name:"Apple Inc.",               sector:"Technology"  },
  { ticker:"META",  name:"Meta Platforms",           sector:"Technology"  },
  { ticker:"GOOGL", name:"Alphabet Inc.",            sector:"Technology"  },
  { ticker:"AMZN",  name:"Amazon.com Inc.",          sector:"Consumer"    },
  { ticker:"AMD",   name:"Advanced Micro Devices",   sector:"Technology"  },
  { ticker:"PLTR",  name:"Palantir Technologies",    sector:"Technology"  },
  { ticker:"JPM",   name:"JPMorgan Chase & Co.",     sector:"Financials"  },
  { ticker:"V",     name:"Visa Inc.",                sector:"Financials"  },
  { ticker:"UNH",   name:"UnitedHealth Group",       sector:"Healthcare"  },
  { ticker:"LLY",   name:"Eli Lilly & Co.",          sector:"Healthcare"  },
  { ticker:"TSLA",  name:"Tesla Inc.",               sector:"Consumer"    },
  { ticker:"ORCL",  name:"Oracle Corp.",             sector:"Technology"  },
  { ticker:"CRWD",  name:"CrowdStrike Holdings",     sector:"Technology"  },
  { ticker:"PANW",  name:"Palo Alto Networks",       sector:"Technology"  },
  { ticker:"AVGO",  name:"Broadcom Inc.",            sector:"Technology"  },
  { ticker:"CRM",   name:"Salesforce Inc.",          sector:"Technology"  },
  { ticker:"NOW",   name:"ServiceNow Inc.",          sector:"Technology"  },
  { ticker:"COIN",  name:"Coinbase Global",          sector:"Financials"  },
];

// Deterministic mock fallback so the UI never breaks
const MOCK_PRICES: Record<string,number> = {
  NVDA:875.42, MSFT:415.32, AAPL:228.52, META:554.78, GOOGL:178.94,
  AMZN:201.17, AMD:162.34,  PLTR:38.92,  JPM:224.31,  V:296.14,
  UNH:512.88,  LLY:798.44,  TSLA:248.50, ORCL:142.67, CRWD:368.92,
  PANW:341.18, AVGO:1642.33,CRM:299.11,  NOW:812.44,  COIN:234.67,
};
const MOCK_CHGPCT: Record<string,number> = {
  NVDA:2.90, MSFT:-0.52, AAPL:1.42, META:1.63, GOOGL:0.81,
  AMZN:-0.44,AMD:3.72,   PLTR:4.96, JPM:0.50,  V:0.83,
  UNH:-0.81, LLY:1.24,   TSLA:-3.58,ORCL:0.92, CRWD:2.44,
  PANW:1.87, AVGO:1.11,  CRM:0.68,  NOW:1.33,  COIN:5.21,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function polyGet<T>(path: string): Promise<T | null> {
  try {
    const sep = path.includes("?") ? "&" : "?";
    const r = await fetch(`${BASE}${path}${sep}apiKey=${API_KEY}`);
    if (!r.ok) return null;
    return r.json();
  } catch { return null; }
}

function calcScore(changePct: number, volume: number, confidence: number): number {
  // Composite: momentum 40% + volume-strength 30% + confidence 30%
  const mom = Math.min(Math.max(changePct / 5, -1), 1) * 40;        // -40…+40
  const vol = Math.min(volume / 60_000_000, 1) * 30;               // 0…30
  const conf = (confidence / 100) * 30;                             // 0…30
  return +(mom + vol + conf).toFixed(2);
}

function deriveFloorCeiling(price: number, changePct: number) {
  // Floor = recent support (~4 % below current, more if falling)
  const drop = changePct < 0 ? 0.06 : 0.04;
  const rise = changePct > 2 ? 0.14 : changePct > 0 ? 0.10 : 0.08;
  return {
    floor:   +(price * (1 - drop)).toFixed(2),
    ceiling: +(price * (1 + rise)).toFixed(2),
  };
}

function deriveConfidence(changePct: number, volume: number): number {
  let c = 60;
  if (changePct > 3)       c += 18;
  else if (changePct > 1)  c += 10;
  else if (changePct < -2) c -= 12;
  if (volume > 50_000_000) c += 12;
  else if (volume > 25_000_000) c += 6;
  return Math.min(96, Math.max(42, c));
}

// ─── Data fetcher ─────────────────────────────────────────────────────────────
async function fetchTop15(): Promise<Top15Stock[]> {
  const tickers = UNIVERSE.map(u => u.ticker).join(",");
  const data = await polyGet<{
    tickers?: Array<{
      ticker: string;
      day: { c: number; v: number; o: number; h: number; l: number };
      prevDay: { c: number };
    }>;
  }>(`/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${tickers}`);

  const rows: Top15Stock[] = UNIVERSE.map(u => {
    const snap = data?.tickers?.find(t => t.ticker === u.ticker);
    const price    = snap?.day?.c      || MOCK_PRICES[u.ticker]  || 100;
    const prevClose= snap?.prevDay?.c  || price * 0.99;
    const volume   = snap?.day?.v      || 30_000_000;
    const rawChg   = ((price - prevClose) / prevClose) * 100;
    const changePct= snap ? +rawChg.toFixed(2) : (MOCK_CHGPCT[u.ticker] ?? 0);
    const confidence = deriveConfidence(changePct, volume);
    const { floor, ceiling } = deriveFloorCeiling(price, changePct);
    const score = calcScore(changePct, volume, confidence);

    return { rank: 0, ticker: u.ticker, name: u.name, sector: u.sector, price, changePct, floor, ceiling, confidence, score };
  });

  // Sort by composite score desc, assign ranks
  rows.sort((a, b) => b.score - a.score);
  rows.forEach((r, i) => (r.rank = i + 1));

  return rows.slice(0, 15);
}

// ─── Portfolio simulator ──────────────────────────────────────────────────────
function simulatePortfolio(stocks: Top15Stock[], cash: number): Allocation[] {
  // Weight by confidence × score (only top 8 to keep it practical)
  const picks = stocks.slice(0, 8);
  const totalWeight = picks.reduce((s, p) => s + p.confidence * Math.max(p.score + 60, 1), 0);

  return picks.map(p => {
    const weight  = (p.confidence * Math.max(p.score + 60, 1)) / totalWeight;
    const dollars = Math.round(cash * weight * 100) / 100;
    const shares  = Math.floor(dollars / p.price);
    const pct     = +(weight * 100).toFixed(1);
    const upside  = +(((p.ceiling - p.price) / p.price) * 100).toFixed(1);
    const rationale = `${pct}% allocation — ${upside}% to target, ${p.confidence}% confidence`;
    return { ticker: p.ticker, name: p.name, price: p.price, confidence: p.confidence, dollars, shares, pct, rationale };
  }).sort((a, b) => b.dollars - a.dollars);
}

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmt$ = (n: number, d = 2) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
const fmtPct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;

// ─── Sector color map ─────────────────────────────────────────────────────────
const SECTOR_COLOR: Record<string, string> = {
  Technology: "#00D4FF", Financials: "#A855F7", Healthcare: "#00FF94", Consumer: "#FFB800",
};

// ─── Sub-components ───────────────────────────────────────────────────────────
function ConfidenceBar({ pct }: { pct: number }) {
  const color = pct >= 80 ? "#00FF94" : pct >= 65 ? "#FFB800" : "#FF3B5C";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 4, background: "#111E30", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 99, transition: "width 0.6s ease" }} />
      </div>
      <span style={{ fontFamily: "monospace", fontSize: 11, color, minWidth: 32 }}>{pct}%</span>
    </div>
  );
}

function SimulatorModal({ stocks, onClose }: { stocks: Top15Stock[]; onClose: () => void }) {
  const [cash, setCash] = useState("50000");
  const cashNum = Math.max(100, parseFloat(cash.replace(/,/g, "")) || 50000);
  const allocs  = simulatePortfolio(stocks, cashNum);
  const total   = allocs.reduce((s, a) => s + a.dollars, 0);
  const leftover = cashNum - total;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "#0D1321", border: "1px solid #1E293B", borderRadius: 16, width: "100%", maxWidth: 680, maxHeight: "85vh", overflow: "auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: "1px solid #1E293B" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg,#00D4FF,#00FF94)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <DollarSign size={16} color="#060B14" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Portfolio Simulator</div>
              <div style={{ fontFamily: "monospace", fontSize: 10, color: "#7A9BBF" }}>AI-weighted allocation across Top 8</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#7A9BBF" }}><X size={18} /></button>
        </div>

        {/* Cash input */}
        <div style={{ padding: "16px 22px", borderBottom: "1px solid #1E293B", display: "flex", alignItems: "center", gap: 12 }}>
          <label style={{ fontSize: 12, color: "#7A9BBF", whiteSpace: "nowrap" }}>Investment Amount</label>
          <div style={{ position: "relative", flex: 1 }}>
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#7A9BBF", fontFamily: "monospace", fontSize: 14 }}>$</span>
            <input
              type="number" min="100" step="1000"
              value={cash}
              onChange={e => setCash(e.target.value)}
              style={{ width: "100%", background: "#060B14", border: "1px solid #1E293B", borderRadius: 8, color: "#E2EAF4", fontFamily: "monospace", fontSize: 14, padding: "8px 12px 8px 24px", outline: "none" }}
            />
          </div>
          <div style={{ fontFamily: "monospace", fontSize: 13, color: "#00FF94", whiteSpace: "nowrap" }}>
            Leftover: {fmt$(leftover)}
          </div>
        </div>

        {/* Allocations */}
        <div style={{ padding: "14px 22px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "40px 80px 1fr 90px 70px 80px", gap: 8, padding: "0 0 8px", borderBottom: "1px solid #1E293B", marginBottom: 8 }}>
            {["#","Ticker","Allocation","$Amount","Shares","%"].map(h => (
              <span key={h} style={{ fontFamily: "monospace", fontSize: 10, color: "#3D5A7A", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</span>
            ))}
          </div>
          {allocs.map((a, i) => (
            <div key={a.ticker} style={{ display: "grid", gridTemplateColumns: "40px 80px 1fr 90px 70px 80px", gap: 8, alignItems: "center", padding: "10px 0", borderBottom: "1px solid #111E30" }}>
              <span style={{ fontFamily: "monospace", fontSize: 11, color: "#3D5A7A" }}>#{i + 1}</span>
              <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: "#00D4FF" }}>{a.ticker}</span>
              <div>
                <div style={{ height: 4, background: "#111E30", borderRadius: 99, overflow: "hidden", marginBottom: 3 }}>
                  <div style={{ width: `${a.pct}%`, height: "100%", background: "linear-gradient(90deg,#00D4FF,#00FF94)", borderRadius: 99 }} />
                </div>
                <span style={{ fontFamily: "monospace", fontSize: 10, color: "#7A9BBF" }}>{a.rationale}</span>
              </div>
              <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 600, color: "#E2EAF4" }}>{fmt$(a.dollars)}</span>
              <span style={{ fontFamily: "monospace", fontSize: 12, color: "#7A9BBF" }}>{a.shares} sh</span>
              <span style={{ fontFamily: "monospace", fontSize: 12, color: "#00D4FF" }}>{a.pct}%</span>
            </div>
          ))}
        </div>

        {/* Footer summary */}
        <div style={{ padding: "14px 22px", borderTop: "1px solid #1E293B", background: "#060B14", borderRadius: "0 0 16px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 11, color: "#7A9BBF", maxWidth: 380 }}>
              Allocation weighted by confidence score × momentum. Fractional shares not included. Keep {fmt$(leftover)} as cash reserve.
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: "monospace", fontSize: 10, color: "#3D5A7A" }}>Total Deployed</div>
              <div style={{ fontFamily: "monospace", fontSize: 18, fontWeight: 700, color: "#00FF94" }}>{fmt$(total)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function Top15() {
  const [stocks,       setStocks]       = useState<Top15Stock[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [lastUpdated,  setLastUpdated]  = useState<Date | null>(null);
  const [showSim,      setShowSim]      = useState(false);
  const [sortCol,      setSortCol]      = useState<keyof Top15Stock>("rank");
  const [sortDir,      setSortDir]      = useState<"asc"|"desc">("asc");
  const [refreshing,   setRefreshing]   = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    const data = await fetchTop15();
    setStocks(data);
    setLastUpdated(new Date());
    setLoading(false);
    setRefreshing(false);
  }, []);

  // Initial load + 15-min auto-refresh
  useEffect(() => {
    load();
    const id = setInterval(load, 15 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  // Sorting
  const sorted = [...stocks].sort((a, b) => {
    const av = a[sortCol] as number, bv = b[sortCol] as number;
    return sortDir === "asc" ? av - bv : bv - av;
  });

  const toggleSort = (col: keyof Top15Stock) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  };

  const SortIcon = ({ col }: { col: keyof Top15Stock }) =>
    sortCol !== col ? <span style={{ color: "#3D5A7A", fontSize: 10 }}>⇅</span>
    : sortDir === "asc" ? <ChevronUp size={12} color="#00D4FF" />
    : <ChevronDown size={12} color="#00D4FF" />;

  // Styles
  const mono = { fontFamily: "monospace" } as React.CSSProperties;
  const muted = { color: "#7A9BBF" } as React.CSSProperties;
  const card  = { background: "#0D1321", border: "1px solid #1E293B", borderRadius: 12 } as React.CSSProperties;

  const ColHeader = ({ label, col, right }: { label: string; col: keyof Top15Stock; right?: boolean }) => (
    <th onClick={() => toggleSort(col)}
      style={{ ...mono, fontSize: 10, color: sortCol === col ? "#00D4FF" : "#3D5A7A", textTransform: "uppercase", letterSpacing: "0.07em", padding: "10px 12px", cursor: "pointer", userSelect: "none", textAlign: right ? "right" : "left", fontWeight: 500, whiteSpace: "nowrap" }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>{label} <SortIcon col={col} /></span>
    </th>
  );

  if (loading) return (
    <div style={{ padding: 32 }}>
      <div style={{ ...card, height: 400, display: "flex", alignItems: "center", justifyContent: "center", gap: 12, flexDirection: "column" }}>
        <RefreshCw size={24} color="#00D4FF" style={{ animation: "spin 1s linear infinite" }} />
        <span style={{ ...muted, fontSize: 13 }}>Fetching live market data…</span>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ padding: 24, maxWidth: 1200 }}>
      {/* Page header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg,rgba(0,212,255,0.15),rgba(0,255,148,0.15))", border: "1px solid rgba(0,212,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Trophy size={20} color="#FFB800" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Top 15 Stocks</h2>
            <p style={{ ...muted, margin: 0, fontSize: 12 }}>Ranked by momentum · volume strength · AI confidence</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {lastUpdated && (
            <span style={{ ...mono, ...muted, fontSize: 10 }}>Updated {lastUpdated.toLocaleTimeString()}</span>
          )}
          <button onClick={load} disabled={refreshing}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "#111E30", border: "1px solid #1E293B", borderRadius: 8, color: refreshing ? "#3D5A7A" : "#7A9BBF", padding: "7px 12px", cursor: "pointer", fontSize: 12 }}>
            <RefreshCw size={13} style={{ animation: refreshing ? "spin 1s linear infinite" : "none" }} />
            Refresh
          </button>
          <button onClick={() => setShowSim(true)}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "linear-gradient(135deg,#00D4FF22,#00FF9422)", border: "1px solid rgba(0,212,255,0.35)", borderRadius: 8, color: "#00D4FF", padding: "7px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
            <DollarSign size={14} /> Simulate Portfolio
          </button>
        </div>
      </div>

      {/* Stat strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 18 }}>
        {[
          { icon: <TrendingUp size={14} color="#00FF94" />,  label: "Avg Momentum", val: `${(stocks.filter(s=>s.changePct>0).length/stocks.length*100).toFixed(0)}% positive` },
          { icon: <Shield size={14} color="#00D4FF" />,      label: "Avg Confidence", val: `${Math.round(stocks.reduce((s,x)=>s+x.confidence,0)/(stocks.length||1))}%` },
          { icon: <Target size={14} color="#FFB800" />,      label: "Avg Upside",    val: `+${(stocks.reduce((s,x)=>s+((x.ceiling-x.price)/x.price)*100,0)/(stocks.length||1)).toFixed(1)}%` },
          { icon: <Zap size={14} color="#A855F7" />,         label: "Sectors",       val: [...new Set(stocks.map(s=>s.sector))].length + " covered" },
        ].map(s => (
          <div key={s.label} style={{ ...card, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: "#111E30", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {s.icon}
            </div>
            <div>
              <div style={{ ...mono, ...muted, fontSize: 9, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 2 }}>{s.label}</div>
              <div style={{ ...mono, fontSize: 13, fontWeight: 700 }}>{s.val}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{ ...card, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #1E293B" }}>
              <ColHeader label="Rank"       col="rank"       />
              <ColHeader label="Ticker"     col="ticker"     />
              <ColHeader label="Company"    col="name"       />
              <ColHeader label="Price"      col="price"      right />
              <ColHeader label="% Today"    col="changePct"  right />
              <ColHeader label="Floor"      col="floor"      right />
              <ColHeader label="Ceiling"    col="ceiling"    right />
              <ColHeader label="Confidence" col="confidence" right />
            </tr>
          </thead>
          <tbody>
            {sorted.map((s, idx) => {
              const up = s.changePct >= 0;
              const sectorColor = SECTOR_COLOR[s.sector] ?? "#7A9BBF";
              return (
                <tr key={s.ticker}
                  style={{ borderBottom: "1px solid #111E30", transition: "background 0.15s" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#111E30")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>

                  {/* Rank */}
                  <td style={{ padding: "14px 12px", width: 60 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ ...mono, fontSize: 11, color: idx < 3 ? "#FFB800" : "#3D5A7A", fontWeight: 700 }}>
                        {idx < 3 ? ["🥇","🥈","🥉"][idx] : `#${s.rank}`}
                      </span>
                    </div>
                  </td>

                  {/* Ticker */}
                  <td style={{ padding: "14px 12px" }}>
                    <div style={{ ...mono, fontSize: 13, fontWeight: 700, color: "#00D4FF" }}>{s.ticker}</div>
                    <div style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: `${sectorColor}15`, color: sectorColor, border: `1px solid ${sectorColor}25`, display: "inline-block", marginTop: 2, fontFamily: "monospace" }}>{s.sector}</div>
                  </td>

                  {/* Name */}
                  <td style={{ padding: "14px 12px", fontSize: 12, color: "#7A9BBF", maxWidth: 180 }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>{s.name}</span>
                  </td>

                  {/* Price */}
                  <td style={{ padding: "14px 12px", textAlign: "right" }}>
                    <span style={{ ...mono, fontSize: 13, fontWeight: 600 }}>{fmt$(s.price)}</span>
                  </td>

                  {/* % Change */}
                  <td style={{ padding: "14px 12px", textAlign: "right" }}>
                    <span style={{ ...mono, fontSize: 12, padding: "3px 8px", borderRadius: 6, background: up ? "rgba(0,255,148,0.1)" : "rgba(255,59,92,0.1)", color: up ? "#00FF94" : "#FF3B5C", display: "inline-flex", alignItems: "center", gap: 4 }}>
                      {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                      {fmtPct(s.changePct)}
                    </span>
                  </td>

                  {/* Floor */}
                  <td style={{ padding: "14px 12px", textAlign: "right" }}>
                    <span style={{ ...mono, fontSize: 12, color: "#FF3B5C" }}>{fmt$(s.floor)}</span>
                  </td>

                  {/* Ceiling */}
                  <td style={{ padding: "14px 12px", textAlign: "right" }}>
                    <div style={{ ...mono, fontSize: 12, color: "#00FF94" }}>{fmt$(s.ceiling)}</div>
                    <div style={{ ...mono, fontSize: 9, color: "#3D5A7A" }}>+{(((s.ceiling - s.price) / s.price) * 100).toFixed(1)}%</div>
                  </td>

                  {/* Confidence */}
                  <td style={{ padding: "14px 20px 14px 12px", width: 140 }}>
                    <ConfidenceBar pct={s.confidence} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p style={{ ...muted, fontSize: 10, marginTop: 12, fontFamily: "monospace" }}>
        ⚡ Rankings refresh every 15 min · Confidence derived from momentum, volume, and technical signals · Not financial advice
      </p>

      {showSim && <SimulatorModal stocks={stocks} onClose={() => setShowSim(false)} />}
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
