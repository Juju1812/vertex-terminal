"use client";

import { useState, useEffect, useCallback } from "react";
import { SlidersHorizontal, TrendingUp, TrendingDown, RefreshCw, ArrowUpDown, ChevronUp, ChevronDown, ExternalLink, X, Search, Zap } from "lucide-react";

/* ---- Types -------------------------------------------------- */
interface ScreenerStock {
  ticker: string;
  name: string;
  sector: string;
  price: number;
  changePct: number;
  volume: number;
  rsi: number;
  sma20: number;
  sma50: number;
  momentum5d: number;
  momentum20d: number;
  volumeRatio: number;
  aboveSma20: boolean;
  aboveSma50: boolean;
}

interface Props { onSelectTicker?: (t: string) => void; }

/* ---- Full Universe ----------------------------------------- */
const UNI = [
  { t:"NVDA",  n:"NVIDIA Corp.",           s:"Technology"  },
  { t:"MSFT",  n:"Microsoft Corp.",         s:"Technology"  },
  { t:"AAPL",  n:"Apple Inc.",              s:"Technology"  },
  { t:"META",  n:"Meta Platforms",          s:"Technology"  },
  { t:"GOOGL", n:"Alphabet Inc.",           s:"Technology"  },
  { t:"AMD",   n:"Advanced Micro Dev.",     s:"Technology"  },
  { t:"AVGO",  n:"Broadcom Inc.",           s:"Technology"  },
  { t:"ORCL",  n:"Oracle Corp.",            s:"Technology"  },
  { t:"CRM",   n:"Salesforce Inc.",         s:"Technology"  },
  { t:"NOW",   n:"ServiceNow Inc.",         s:"Technology"  },
  { t:"ADBE",  n:"Adobe Inc.",              s:"Technology"  },
  { t:"INTC",  n:"Intel Corp.",             s:"Technology"  },
  { t:"QCOM",  n:"Qualcomm Inc.",           s:"Technology"  },
  { t:"JPM",   n:"JPMorgan Chase",          s:"Financials"  },
  { t:"V",     n:"Visa Inc.",               s:"Financials"  },
  { t:"MA",    n:"Mastercard Inc.",         s:"Financials"  },
  { t:"BAC",   n:"Bank of America",         s:"Financials"  },
  { t:"GS",    n:"Goldman Sachs",           s:"Financials"  },
  { t:"COIN",  n:"Coinbase Global",         s:"Financials"  },
  { t:"AMZN",  n:"Amazon.com",              s:"Consumer"    },
  { t:"TSLA",  n:"Tesla Inc.",              s:"Consumer"    },
  { t:"NKE",   n:"Nike Inc.",               s:"Consumer"    },
  { t:"SBUX",  n:"Starbucks Corp.",         s:"Consumer"    },
  { t:"RIVN",  n:"Rivian Automotive",       s:"Consumer"    },
  { t:"LCID",  n:"Lucid Group",             s:"Consumer"    },
  { t:"UNH",   n:"UnitedHealth Group",      s:"Healthcare"  },
  { t:"LLY",   n:"Eli Lilly & Co.",         s:"Healthcare"  },
  { t:"PFE",   n:"Pfizer Inc.",             s:"Healthcare"  },
  { t:"MRNA",  n:"Moderna Inc.",            s:"Healthcare"  },
  { t:"ABBV",  n:"AbbVie Inc.",             s:"Healthcare"  },
  { t:"NVO",   n:"Novo Nordisk (ADR)",      s:"Healthcare"  },
  { t:"PLTR",  n:"Palantir Tech.",          s:"Technology"  },
  { t:"CRWD",  n:"CrowdStrike",             s:"Technology"  },
  { t:"PANW",  n:"Palo Alto Networks",      s:"Technology"  },
  { t:"S",     n:"SentinelOne",             s:"Technology"  },
  { t:"NET",   n:"Cloudflare Inc.",         s:"Technology"  },
  { t:"SNOW",  n:"Snowflake Inc.",          s:"Technology"  },
  { t:"XOM",   n:"ExxonMobil Corp.",        s:"Energy"      },
  { t:"CVX",   n:"Chevron Corp.",           s:"Energy"      },
  { t:"OXY",   n:"Occidental Petroleum",    s:"Energy"      },
  { t:"TCEHY", n:"Tencent Holdings (ADR)",  s:"Technology"  },
  { t:"BABA",  n:"Alibaba Group (ADR)",     s:"Consumer"    },
  { t:"BIDU",  n:"Baidu Inc. (ADR)",        s:"Technology"  },
  { t:"TSM",   n:"Taiwan Semi (ADR)",       s:"Technology"  },
  { t:"ASML",  n:"ASML Holding (ADR)",      s:"Technology"  },
  { t:"SAP",   n:"SAP SE (ADR)",            s:"Technology"  },
  { t:"SONY",  n:"Sony Group (ADR)",        s:"Consumer"    },
  { t:"TM",    n:"Toyota Motor (ADR)",      s:"Consumer"    },
  { t:"NSRGY", n:"Nestle SA (ADR)",         s:"Consumer"    },
  { t:"RHHBY", n:"Roche Holding (ADR)",     s:"Healthcare"  },
  { t:"ACMIF", n:"Allied Critical Metals",  s:"Materials"   },
  { t:"BTQQF", n:"BTQ Technologies",        s:"Technology"  },
  { t:"GBTC",  n:"Grayscale Bitcoin Trust", s:"Financials"  },
  { t:"MSTR",  n:"MicroStrategy Inc.",      s:"Technology"  },
  { t:"SIRI",  n:"Sirius XM Holdings",      s:"Consumer"    },
  { t:"NKLA",  n:"Nikola Corp.",            s:"Consumer"    },
];

const POLYGON_KEY = "1xwzcvUOF9pft6PRNylO2Xc6X2QeQCGr";
const SECTORS = ["All", ...Array.from(new Set(UNI.map(s => s.s))).sort()];

/* ---- Design tokens ----------------------------------------- */
const V = {
  w1:"rgba(130,180,255,0.055)", w2:"rgba(130,180,255,0.10)",
  ink0:"#F2F6FF", ink1:"#C8D5E8", ink2:"#7A9CBF", ink3:"#3D5A7A", ink4:"#1F3550",
  gain:"#00C896", gainDim:"rgba(0,200,150,0.08)", gainWire:"rgba(0,200,150,0.20)",
  loss:"#E8445A", lossDim:"rgba(232,68,90,0.08)",  lossWire:"rgba(232,68,90,0.20)",
  arc:"#4F8EF7",  arcDim:"rgba(79,142,247,0.08)",  arcWire:"rgba(79,142,247,0.22)",
  gold:"#E8A030", goldDim:"rgba(232,160,48,0.08)", goldWire:"rgba(232,160,48,0.20)",
  ame:"#9B72F5",  ameDim:"rgba(155,114,245,0.08)", ameWire:"rgba(155,114,245,0.22)",
};
const mono: React.CSSProperties = { fontFamily:"'Geist Mono','Courier New',monospace" };
const glass = (ex?: React.CSSProperties): React.CSSProperties => ({
  background:"linear-gradient(145deg,rgba(255,255,255,0.028) 0%,rgba(255,255,255,0.010) 100%)",
  border:`1px solid ${V.w2}`, borderRadius:14,
  boxShadow:"0 4px 16px rgba(0,0,0,0.45)",
  position:"relative" as const, ...ex,
});

const SECTOR_COLOR: Record<string, string> = {
  Technology:"#4F8EF7", Financials:"#9B72F5", Healthcare:"#00C896",
  Consumer:"#E8A030", Energy:"#F97316", Materials:"#84CC16",
};

/* ---- Technical calcs --------------------------------------- */
function calcRSI(closes: number[]): number {
  if (closes.length < 15) return 50;
  let gains = 0, losses = 0;
  for (let i = closes.length - 14; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) gains += d; else losses -= d;
  }
  const rs = (gains / 14) / (losses / 14 || 0.001);
  return Math.round(100 - 100 / (1 + rs));
}

function calcSMA(closes: number[], period: number): number {
  const slice = closes.slice(-period);
  return slice.length ? +(slice.reduce((a, b) => a + b, 0) / slice.length).toFixed(2) : 0;
}

function calcMomentum(closes: number[], days: number): number {
  if (closes.length < days + 1) return 0;
  const past = closes[closes.length - days - 1];
  return past > 0 ? +((closes[closes.length - 1] - past) / past * 100).toFixed(2) : 0;
}

/* ---- Fetch data -------------------------------------------- */
async function fetchStockData(ticker: string, name: string, sector: string): Promise<ScreenerStock | null> {
  try {
    const to   = new Date().toISOString().split("T")[0];
    const from = new Date(Date.now() - 90 * 86400000).toISOString().split("T")[0];
    const r = await fetch(
      `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/1/day/${from}/${to}?adjusted=true&sort=asc&limit=90&apiKey=${POLYGON_KEY}`
    );
    if (!r.ok) return null;
    const d = await r.json() as { results?: Array<{ c: number; v: number }> };
    const bars = d.results ?? [];
    if (bars.length < 2) return null;

    const closes  = bars.map(b => b.c);
    const volumes = bars.map(b => b.v);
    const last    = bars[bars.length - 1];
    const prev    = bars[bars.length - 2];
    const price   = last.c;
    const changePct = +((price - prev.c) / prev.c * 100).toFixed(2);
    const volume  = last.v;
    const rsi     = calcRSI(closes);
    const sma20   = calcSMA(closes, 20);
    const sma50   = calcSMA(closes, 50);
    const momentum5d  = calcMomentum(closes, 5);
    const momentum20d = calcMomentum(closes, 20);
    const volAvg = volumes.slice(-20).reduce((a, b) => a + b, 0) / Math.min(20, volumes.length);
    const volumeRatio = volAvg > 0 ? +(volume / volAvg).toFixed(2) : 1;

    return {
      ticker, name, sector, price, changePct, volume,
      rsi, sma20, sma50, momentum5d, momentum20d, volumeRatio,
      aboveSma20: price > sma20,
      aboveSma50: price > sma50,
    };
  } catch { return null; }
}

/* ---- Preset screens ---------------------------------------- */
const PRESETS = [
  { id:"oversold",     label:"RSI Oversold",      icon:"📉", desc:"RSI < 35 — potentially undervalued", filter: (s: ScreenerStock) => s.rsi < 35 },
  { id:"overbought",   label:"RSI Overbought",     icon:"📈", desc:"RSI > 65 — potentially overextended", filter: (s: ScreenerStock) => s.rsi > 65 },
  { id:"momentum",     label:"Strong Momentum",    icon:"🚀", desc:"5d momentum > +3%", filter: (s: ScreenerStock) => s.momentum5d > 3 },
  { id:"trending",     label:"Above Both SMAs",    icon:"📊", desc:"Price above SMA20 & SMA50", filter: (s: ScreenerStock) => s.aboveSma20 && s.aboveSma50 },
  { id:"highvol",      label:"High Volume",        icon:"⚡", desc:"Volume 1.5x above average", filter: (s: ScreenerStock) => s.volumeRatio >= 1.5 },
  { id:"breakdown",    label:"Trend Breakdown",    icon:"⚠️", desc:"Below both SMAs", filter: (s: ScreenerStock) => !s.aboveSma20 && !s.aboveSma50 },
];

/* ---- RSI bar ----------------------------------------------- */
function RSIBar({ val }: { val: number }) {
  const color = val < 30 ? V.gain : val > 70 ? V.loss : val < 45 ? "#7EB6FF" : V.ink2;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
      <div style={{ flex:1, height:3, background:"rgba(255,255,255,0.06)", borderRadius:99, overflow:"hidden" }}>
        <div style={{ width:`${val}%`, height:"100%", background:color, borderRadius:99 }} />
      </div>
      <span style={{ ...mono, fontSize:10, color, minWidth:26 }}>{val}</span>
    </div>
  );
}

/* ---- Main Component ---------------------------------------- */
export default function StockScreener({ onSelectTicker }: Props) {
  const [stocks,    setStocks]    = useState<ScreenerStock[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [progress,  setProgress]  = useState(0);
  const [sortCol,   setSortCol]   = useState<keyof ScreenerStock>("momentum5d");
  const [sortDir,   setSortDir]   = useState<"asc" | "desc">("desc");
  const [sector,    setSector]    = useState("All");
  const [preset,    setPreset]    = useState<string | null>(null);
  const [search,    setSearch]    = useState("");
  const [minRsi,    setMinRsi]    = useState(0);
  const [maxRsi,    setMaxRsi]    = useState(100);
  const [minMom,    setMinMom]    = useState(-100);
  const [showFilters, setShowFilters] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setProgress(0);
    const results: ScreenerStock[] = [];
    const BATCH = 6;
    for (let i = 0; i < UNI.length; i += BATCH) {
      const batch = UNI.slice(i, i + BATCH);
      const batchResults = await Promise.all(
        batch.map(s => fetchStockData(s.t, s.n, s.s))
      );
      results.push(...batchResults.filter((s): s is ScreenerStock => s !== null));
      setProgress(Math.round(((i + BATCH) / UNI.length) * 100));
      if (i + BATCH < UNI.length) await new Promise(r => setTimeout(r, 150));
    }
    setStocks(results);
    setLoading(false);
    setProgress(100);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = (col: keyof ScreenerStock) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("desc"); }
  };

  const filtered = stocks
    .filter(s => {
      if (sector !== "All" && s.sector !== sector) return false;
      if (search && !s.ticker.toLowerCase().includes(search.toLowerCase()) && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (s.rsi < minRsi || s.rsi > maxRsi) return false;
      if (s.momentum5d < minMom) return false;
      if (preset) {
        const p = PRESETS.find(p => p.id === preset);
        if (p && !p.filter(s)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const av = a[sortCol] as number, bv = b[sortCol] as number;
      return sortDir === "asc" ? av - bv : bv - av;
    });

  const f$ = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits:2, maximumFractionDigits:2 })}`;
  const fp = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;

  const ColH = ({ label, col, right }: { label: string; col: keyof ScreenerStock; right?: boolean }) => (
    <th onClick={() => toggle(col)}
      style={{ ...mono, fontSize:9, color: sortCol === col ? "#7EB6FF" : V.ink4, textTransform:"uppercase", letterSpacing:"0.08em", padding:"10px 12px", cursor:"pointer", userSelect:"none", textAlign: right ? "right" : "left", background:"rgba(5,8,16,0.8)", whiteSpace:"nowrap", fontWeight: sortCol === col ? 600 : 400 }}>
      <span style={{ display:"inline-flex", alignItems:"center", gap:3 }}>
        {label}
        {sortCol === col
          ? (sortDir === "asc" ? <ChevronUp size={10} color="#7EB6FF" /> : <ChevronDown size={10} color="#7EB6FF" />)
          : <ArrowUpDown size={9} style={{ opacity:0.25 }} />}
      </span>
    </th>
  );

  return (
    <div style={{ padding:"20px 16px", maxWidth:1280, margin:"0 auto" }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20, gap:12, flexWrap:"wrap" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:42, height:42, borderRadius:12, background:V.ameDim, border:`1px solid ${V.ameWire}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <SlidersHorizontal size={21} color={V.ame} />
          </div>
          <div>
            <h2 style={{ fontSize:19, fontWeight:700, color:V.ink0, margin:0 }}>Stock Screener</h2>
            <p style={{ ...mono, color:V.ink4, fontSize:9, margin:0, marginTop:3, textTransform:"uppercase", letterSpacing:"0.08em" }}>
              Filter {UNI.length} stocks by technical indicators
            </p>
          </div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={() => setShowFilters(f => !f)}
            style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 14px", borderRadius:9, background: showFilters ? V.ameDim : "rgba(255,255,255,0.03)", border:`1px solid ${showFilters ? V.ameWire : V.w1}`, color: showFilters ? V.ame : V.ink2, cursor:"pointer", fontSize:12, fontFamily:"'Bricolage Grotesque',system-ui,sans-serif" }}>
            <SlidersHorizontal size={12} /> Filters
          </button>
          <button onClick={load} disabled={loading}
            style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 14px", borderRadius:9, background:"rgba(255,255,255,0.03)", border:`1px solid ${V.w1}`, color:V.ink2, cursor: loading ? "not-allowed" : "pointer", fontSize:12, fontFamily:"'Bricolage Grotesque',system-ui,sans-serif", opacity: loading ? 0.5 : 1 }}>
            <RefreshCw size={12} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} /> Refresh
          </button>
        </div>
      </div>

      {/* Loading progress */}
      {loading && (
        <div style={{ marginBottom:16 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
            <span style={{ ...mono, fontSize:11, color:V.ink3 }}>Fetching data for {UNI.length} stocks... {progress}%</span>
          </div>
          <div style={{ height:3, background:"rgba(255,255,255,0.05)", borderRadius:99, overflow:"hidden" }}>
            <div style={{ width:`${progress}%`, height:"100%", background:`linear-gradient(90deg,${V.ame},${V.arc})`, borderRadius:99, transition:"width 0.3s ease" }} />
          </div>
        </div>
      )}

      {/* Preset screens */}
      <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap" }}>
        {PRESETS.map(p => (
          <button key={p.id} onClick={() => setPreset(prev => prev === p.id ? null : p.id)}
            title={p.desc}
            style={{ display:"flex", alignItems:"center", gap:5, padding:"6px 12px", borderRadius:99, border:`1px solid ${preset === p.id ? V.arcWire : V.w1}`, background: preset === p.id ? V.arcDim : "rgba(255,255,255,0.02)", color: preset === p.id ? "#7EB6FF" : V.ink3, cursor:"pointer", fontSize:11, fontFamily:"'Bricolage Grotesque',system-ui,sans-serif", whiteSpace:"nowrap" }}>
            <span>{p.icon}</span>{p.label}
          </button>
        ))}
        {preset && (
          <button onClick={() => setPreset(null)}
            style={{ display:"flex", alignItems:"center", gap:4, padding:"6px 10px", borderRadius:99, border:`1px solid ${V.lossWire}`, background:V.lossDim, color:V.loss, cursor:"pointer", fontSize:11 }}>
            <X size={10} /> Clear
          </button>
        )}
      </div>

      {/* Search + sector filter */}
      <div style={{ display:"flex", gap:8, marginBottom: showFilters ? 12 : 16, flexWrap:"wrap" }}>
        <div style={{ position:"relative", flex:1, minWidth:160 }}>
          <Search size={12} color={V.ink4} style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search ticker or name..."
            style={{ width:"100%", background:"rgba(255,255,255,0.03)", border:`1px solid ${V.w1}`, borderRadius:9, color:V.ink0, ...mono, fontSize:12, padding:"8px 12px 8px 28px", outline:"none", boxSizing:"border-box" as const }} />
        </div>
        {SECTORS.map(s => (
          <button key={s} onClick={() => setSector(s)}
            style={{ ...mono, fontSize:10, padding:"6px 12px", borderRadius:99, border:`1px solid ${sector === s ? `${SECTOR_COLOR[s] ?? V.arc}44` : V.w1}`, background: sector === s ? `${SECTOR_COLOR[s] ?? V.arc}12` : "rgba(255,255,255,0.02)", color: sector === s ? (SECTOR_COLOR[s] ?? "#7EB6FF") : V.ink3, cursor:"pointer" }}>
            {s}
          </button>
        ))}
      </div>

      {/* Advanced filters panel */}
      {showFilters && (
        <div style={{ ...glass({ padding:"16px 20px", marginBottom:16 }) }}>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:16 }}>
            {/* RSI range */}
            <div>
              <p style={{ ...mono, fontSize:9, color:V.ink4, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:8 }}>RSI Range: {minRsi} – {maxRsi}</p>
              <div style={{ display:"flex", gap:8 }}>
                <input type="range" min={0} max={100} value={minRsi} onChange={e => setMinRsi(+e.target.value)} style={{ flex:1, accentColor:V.ame }} />
                <input type="range" min={0} max={100} value={maxRsi} onChange={e => setMaxRsi(+e.target.value)} style={{ flex:1, accentColor:V.ame }} />
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", marginTop:4 }}>
                <button onClick={() => { setMinRsi(0); setMaxRsi(30); }} style={{ ...mono, fontSize:9, color:V.gain, background:"none", border:"none", cursor:"pointer" }}>Oversold</button>
                <button onClick={() => { setMinRsi(70); setMaxRsi(100); }} style={{ ...mono, fontSize:9, color:V.loss, background:"none", border:"none", cursor:"pointer" }}>Overbought</button>
              </div>
            </div>

            {/* Min 5d momentum */}
            <div>
              <p style={{ ...mono, fontSize:9, color:V.ink4, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:8 }}>Min 5d Momentum: {minMom >= 0 ? "+" : ""}{minMom}%</p>
              <input type="range" min={-20} max={20} step={0.5} value={minMom} onChange={e => setMinMom(+e.target.value)} style={{ width:"100%", accentColor:V.arc }} />
              <div style={{ display:"flex", justifyContent:"space-between", marginTop:4 }}>
                <button onClick={() => setMinMom(-20)} style={{ ...mono, fontSize:9, color:V.ink4, background:"none", border:"none", cursor:"pointer" }}>Any</button>
                <button onClick={() => setMinMom(3)} style={{ ...mono, fontSize:9, color:V.gain, background:"none", border:"none", cursor:"pointer" }}>+3% Strong</button>
              </div>
            </div>

            {/* Reset */}
            <div style={{ display:"flex", alignItems:"flex-end" }}>
              <button onClick={() => { setMinRsi(0); setMaxRsi(100); setMinMom(-100); setPreset(null); setSector("All"); setSearch(""); }}
                style={{ ...mono, fontSize:10, padding:"8px 16px", borderRadius:9, background:V.lossDim, border:`1px solid ${V.lossWire}`, color:V.loss, cursor:"pointer" }}>
                Reset All Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Results count */}
      {!loading && (
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
          <Zap size={12} color={V.ame} />
          <span style={{ ...mono, fontSize:10, color:V.ink3 }}>
            {filtered.length} of {stocks.length} stocks match
            {preset ? ` · ${PRESETS.find(p => p.id === preset)?.label}` : ""}
            {sector !== "All" ? ` · ${sector}` : ""}
          </span>
        </div>
      )}

      {/* Table */}
      {!loading && filtered.length === 0 && (
        <div style={{ ...glass({ padding:"32px 24px", textAlign:"center" }) }}>
          <p style={{ color:V.ink3, fontSize:14 }}>No stocks match your filters.</p>
          <button onClick={() => { setPreset(null); setSector("All"); setSearch(""); setMinRsi(0); setMaxRsi(100); setMinMom(-100); }}
            style={{ ...mono, fontSize:11, color:"#7EB6FF", background:"none", border:`1px solid ${V.arcWire}`, borderRadius:8, padding:"6px 14px", cursor:"pointer", marginTop:12 }}>
            Clear all filters
          </button>
        </div>
      )}

      {filtered.length > 0 && (
        <div style={{ ...glass({ overflow:"hidden" }) }}>
          <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", minWidth:720 }}>
              <thead>
                <tr style={{ borderBottom:`1px solid ${V.w1}` }}>
                  <ColH label="Ticker"    col="ticker"      />
                  <th style={{ ...mono, fontSize:9, color:V.ink4, textTransform:"uppercase", padding:"10px 12px", textAlign:"left", background:"rgba(5,8,16,0.8)", whiteSpace:"nowrap", letterSpacing:"0.08em", fontWeight:400 }}>Name</th>
                  <ColH label="Price"     col="price"       right />
                  <ColH label="Today"     col="changePct"   right />
                  <ColH label="RSI"       col="rsi"         right />
                  <ColH label="5d Mom."   col="momentum5d"  right />
                  <ColH label="20d Mom."  col="momentum20d" right />
                  <ColH label="Vol Ratio" col="volumeRatio" right />
                  <th style={{ ...mono, fontSize:9, color:V.ink4, textTransform:"uppercase", padding:"10px 12px", textAlign:"center", background:"rgba(5,8,16,0.8)", whiteSpace:"nowrap", letterSpacing:"0.08em", fontWeight:400 }}>Trend</th>
                  <th style={{ ...mono, fontSize:9, color:V.ink4, textTransform:"uppercase", padding:"10px 12px", textAlign:"center", background:"rgba(5,8,16,0.8)", whiteSpace:"nowrap", letterSpacing:"0.08em", fontWeight:400 }}>Chart</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => {
                  const up = s.changePct >= 0;
                  const sc = SECTOR_COLOR[s.sector] ?? V.arc;
                  return (
                    <tr key={s.ticker}
                      onClick={() => onSelectTicker?.(s.ticker)}
                      style={{ borderBottom:`1px solid rgba(130,180,255,0.04)`, cursor:"pointer", transition:"background 0.15s" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(30,45,64,0.7)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>

                      {/* Ticker */}
                      <td style={{ padding:"12px 12px" }}>
                        <p style={{ ...mono, fontSize:13, fontWeight:600, color:"#7EB6FF", margin:0 }}>{s.ticker}</p>
                        <span style={{ ...mono, fontSize:8, padding:"1px 5px", borderRadius:4, background:`${sc}15`, color:sc, border:`1px solid ${sc}22` }}>{s.sector}</span>
                      </td>

                      {/* Name */}
                      <td style={{ padding:"12px 12px", fontSize:11, color:V.ink3, maxWidth:130 }}>
                        <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", display:"block" }}>{s.name}</span>
                      </td>

                      {/* Price */}
                      <td style={{ padding:"12px 12px", textAlign:"right" }}>
                        <span style={{ ...mono, fontSize:13, fontWeight:600, color:V.ink0 }}>{f$(s.price)}</span>
                      </td>

                      {/* Today */}
                      <td style={{ padding:"12px 12px", textAlign:"right" }}>
                        <span style={{ ...mono, fontSize:11, color: up ? V.gain : V.loss, display:"flex", alignItems:"center", gap:3, justifyContent:"flex-end" }}>
                          {up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                          {fp(s.changePct)}
                        </span>
                      </td>

                      {/* RSI */}
                      <td style={{ padding:"12px 12px", minWidth:90 }}>
                        <RSIBar val={s.rsi} />
                      </td>

                      {/* 5d mom */}
                      <td style={{ padding:"12px 12px", textAlign:"right" }}>
                        <span style={{ ...mono, fontSize:11, fontWeight:500, color: s.momentum5d >= 0 ? V.gain : V.loss }}>{fp(s.momentum5d)}</span>
                      </td>

                      {/* 20d mom */}
                      <td style={{ padding:"12px 12px", textAlign:"right" }}>
                        <span style={{ ...mono, fontSize:11, color: s.momentum20d >= 0 ? V.gain : V.loss }}>{fp(s.momentum20d)}</span>
                      </td>

                      {/* Volume ratio */}
                      <td style={{ padding:"12px 12px", textAlign:"right" }}>
                        <span style={{ ...mono, fontSize:11, color: s.volumeRatio >= 1.5 ? "#7EB6FF" : V.ink2 }}>{s.volumeRatio}x</span>
                      </td>

                      {/* Trend pills */}
                      <td style={{ padding:"8px 12px", textAlign:"center" }}>
                        <div style={{ display:"flex", gap:4, justifyContent:"center", flexWrap:"wrap" }}>
                          <span style={{ ...mono, fontSize:8, padding:"2px 6px", borderRadius:4, background: s.aboveSma20 ? V.gainDim : V.lossDim, color: s.aboveSma20 ? V.gain : V.loss, border:`1px solid ${s.aboveSma20 ? V.gainWire : V.lossWire}` }}>
                            SMA20
                          </span>
                          <span style={{ ...mono, fontSize:8, padding:"2px 6px", borderRadius:4, background: s.aboveSma50 ? V.gainDim : V.lossDim, color: s.aboveSma50 ? V.gain : V.loss, border:`1px solid ${s.aboveSma50 ? V.gainWire : V.lossWire}` }}>
                            SMA50
                          </span>
                        </div>
                      </td>

                      {/* Yahoo link */}
                      <td style={{ padding:"8px 12px", textAlign:"center" }}>
                        <a href={`https://finance.yahoo.com/quote/${s.ticker}`} target="_blank" rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          style={{ ...mono, fontSize:9, display:"inline-flex", alignItems:"center", gap:3, padding:"3px 8px", borderRadius:5, background:V.arcDim, border:`1px solid ${V.arcWire}`, color:"#7EB6FF", textDecoration:"none" }}>
                          <ExternalLink size={8} /> Yahoo
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ padding:"10px 16px", borderTop:`1px solid ${V.w1}`, display:"flex", alignItems:"center", gap:6 }}>
            <span style={{ ...mono, fontSize:9, color:V.ink4 }}>Click any row to view chart · Data from Polygon.io</span>
          </div>
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
