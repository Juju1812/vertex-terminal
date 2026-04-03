"use client";

import { useState, useEffect, useCallback } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  Search, TrendingUp, TrendingDown, Brain,
  Star, StarOff, Zap, RefreshCw, AlertTriangle,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StockQuote {
  ticker: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  high: number;
  low: number;
  open: number;
  volume: number;
}

interface Bar {
  date: string;
  close: number;
  open: number;
  high: number;
  low: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const API_KEY = "1xwzcvUOF9pft6PRNylO2Xc6X2QeQCGr";
const BASE    = "https://api.polygon.io";

const POPULAR = ["AAPL","MSFT","NVDA","GOOGL","META","TSLA","AMZN","AMD"];

const MOCK_QUOTES: Record<string, StockQuote> = {
  AAPL:  { ticker:"AAPL",  name:"Apple Inc.",           price:228.52, change: 3.21, changePct: 1.42, high:229.88, low:225.12, open:225.80, volume:58_234_100 },
  MSFT:  { ticker:"MSFT",  name:"Microsoft Corp.",       price:415.32, change:-2.18, changePct:-0.52, high:418.55, low:413.22, open:417.50, volume:21_456_200 },
  NVDA:  { ticker:"NVDA",  name:"NVIDIA Corp.",          price:875.42, change:24.63, changePct: 2.90, high:881.20, low:851.30, open:853.10, volume:42_118_700 },
  GOOGL: { ticker:"GOOGL", name:"Alphabet Inc.",         price:178.94, change: 1.43, changePct: 0.81, high:180.12, low:177.34, open:177.51, volume:18_932_400 },
  META:  { ticker:"META",  name:"Meta Platforms",        price:554.78, change: 8.92, changePct: 1.63, high:557.33, low:545.21, open:546.10, volume:14_209_300 },
  TSLA:  { ticker:"TSLA",  name:"Tesla Inc.",            price:248.50, change:-9.23, changePct:-3.58, high:260.42, low:247.11, open:258.10, volume:89_234_100 },
  AMZN:  { ticker:"AMZN",  name:"Amazon.com Inc.",       price:201.17, change:-0.88, changePct:-0.44, high:203.21, low:200.54, open:202.05, volume:29_847_100 },
  AMD:   { ticker:"AMD",   name:"Advanced Micro Devices",price:162.34, change: 5.82, changePct: 3.72, high:163.80, low:156.42, open:157.10, volume:45_123_200 },
};

const AI_WINNERS = [
  { ticker:"NVDA", name:"NVIDIA Corp.",        confidence:91, target:950, current:875.42, upside: 8.5, reason:"AI infrastructure capex surging. Blackwell GPU demand exceeds supply by 3×. Data center revenue +120% YoY.",    tags:["Blackwell Launch","Azure Deal","Q4 Beat"] },
  { ticker:"META", name:"Meta Platforms",       confidence:84, target:620, current:554.78, upside:11.8, reason:"Llama monetisation accelerating. Reels ad revenue +40% QoQ. Cost discipline driving margin expansion.",          tags:["Llama 4","Ad Beat","Cost Cuts"] },
  { ticker:"AMD",  name:"Advanced Micro Dev.",  confidence:78, target:195, current:162.34, upside:20.1, reason:"MI300X gaining enterprise traction vs H100. Data center segment +80% YoY. TSMC capacity secured through 2025.", tags:["MI400 Reveal","Design Wins","CPU Share"] },
];
const AI_LOSERS = [
  { ticker:"TSLA", name:"Tesla Inc.",     confidence:76, target:195, current:248.50, downside:-21.6, reason:"EV demand soft globally. Brutal price war in China. Cybertruck ramp costlier than expected. CEO distraction risk.", tags:["China Share Loss","Margin Squeeze","Competition"] },
  { ticker:"AMZN", name:"Amazon.com Inc.",confidence:61, target:180, current:201.17, downside:-10.5, reason:"AWS growth decelerating vs Azure/GCP. Retail margins structurally thin. Advertising CPM pressure building.",        tags:["AWS Slowdown","Ad CPMs","FTC Risk"] },
];

// ─── Seed deterministic mock chart bars ───────────────────────────────────────

function seedBars(basePrice: number, days = 90): Bar[] {
  const bars: Bar[] = [];
  let p = basePrice * 0.82;
  const now = new Date();
  // Simple LCG so bars are always the same per ticker
  let seed = Math.round(basePrice * 100);
  const rand = () => { seed = (seed * 1664525 + 1013904223) & 0xffffffff; return (seed >>> 0) / 0xffffffff; };

  for (let i = days; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    const chg = (rand() - 0.47) * 0.022 * p;
    const o = p, c = p + chg;
    bars.push({
      date:  d.toISOString().split("T")[0],
      open:  +o.toFixed(2),
      high:  +(Math.max(o, c) * (1 + rand() * 0.008)).toFixed(2),
      low:   +(Math.min(o, c) * (1 - rand() * 0.008)).toFixed(2),
      close: +c.toFixed(2),
    });
    p = c;
  }
  return bars;
}

// ─── Polygon helpers ──────────────────────────────────────────────────────────

async function polyFetch<T>(path: string): Promise<T | null> {
  try {
    const sep = path.includes("?") ? "&" : "?";
    const res = await fetch(`${BASE}${path}${sep}apiKey=${API_KEY}`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function getQuote(ticker: string): Promise<StockQuote> {
  const mock = MOCK_QUOTES[ticker] ?? {
    ticker, name: ticker, price: 100, change: 0,
    changePct: 0, high: 101, low: 99, open: 100, volume: 1_000_000,
  };

  const data = await polyFetch<{
    ticker: { day: { o:number;h:number;l:number;c:number;v:number }; prevDay: { c:number } };
  }>(`/v2/snapshot/locale/us/markets/stocks/tickers/${ticker}`);

  if (!data?.ticker?.day?.c) return mock;
  const { day, prevDay } = data.ticker;
  const change = day.c - prevDay.c;
  return {
    ticker,
    name:      mock.name,
    price:     day.c,
    change:    +change.toFixed(2),
    changePct: +((change / prevDay.c) * 100).toFixed(2),
    high:      day.h,
    low:       day.l,
    open:      day.o,
    volume:    day.v,
  };
}

async function getBars(ticker: string): Promise<Bar[]> {
  const to   = new Date().toISOString().split("T")[0];
  const from = new Date(Date.now() - 90 * 86_400_000).toISOString().split("T")[0];
  const data = await polyFetch<{
    results?: { o:number;h:number;l:number;c:number;t:number }[];
  }>(`/v2/aggs/ticker/${ticker}/range/1/day/${from}/${to}?adjusted=true&sort=asc&limit=120`);

  if (!data?.results?.length) return seedBars(MOCK_QUOTES[ticker]?.price ?? 100);
  return data.results.map(b => ({
    date:  new Date(b.t).toISOString().split("T")[0],
    open:  b.o, high: b.h, low: b.l, close: b.c,
  }));
}

async function searchTickers(q: string): Promise<string[]> {
  const data = await polyFetch<{
    results?: { ticker: string; name: string }[];
  }>(`/v3/reference/tickers?search=${encodeURIComponent(q)}&active=true&limit=6&market=stocks`);

  if (!data?.results?.length) {
    return POPULAR.filter(t =>
      t.includes(q.toUpperCase()) ||
      (MOCK_QUOTES[t]?.name.toLowerCase().includes(q.toLowerCase()))
    );
  }
  return data.results.map(r => r.ticker);
}

// ─── Formatters ───────────────────────────────────────────────────────────────

const fmt$ = (n: number) =>
  new Intl.NumberFormat("en-US", { style:"currency", currency:"USD", minimumFractionDigits:2 }).format(n);

const fmtPct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;

const fmtVol = (n: number) => {
  if (n >= 1e9) return `${(n/1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n/1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n/1e3).toFixed(2)}K`;
  return String(n);
};

// ─── Tiny chart tooltip ────────────────────────────────────────────────────────

function ChartTip({ active, payload, label }: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:"#0D1321", border:"1px solid #1E293B", borderRadius:8, padding:"8px 12px" }}>
      <p style={{ fontFamily:"monospace", fontSize:10, color:"#7A9BBF", marginBottom:2 }}>{label}</p>
      <p style={{ fontFamily:"monospace", fontSize:13, color:"#E2EAF4", fontWeight:600 }}>{fmt$(payload[0].value)}</p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function VertexTerminal() {
  const [ticker,    setTicker]    = useState("AAPL");
  const [quote,     setQuote]     = useState<StockQuote>(MOCK_QUOTES["AAPL"]);
  const [bars,      setBars]      = useState<Bar[]>(seedBars(228.52));
  const [watchlist, setWatchlist] = useState<string[]>(["AAPL","NVDA","MSFT","META"]);
  const [search,    setSearch]    = useState("");
  const [results,   setResults]   = useState<string[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [tab,       setTab]       = useState<"chart"|"ai">("chart");
  const [searching, setSearching] = useState(false);

  // ── Load quote + bars when ticker changes ────────────────────────────────
  const load = useCallback(async (t: string) => {
    setLoading(true);
    const [q, b] = await Promise.all([getQuote(t), getBars(t)]);
    setQuote(q);
    setBars(b);
    setLoading(false);
  }, []);

  useEffect(() => { load(ticker); }, [ticker, load]);

  // ── Search ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!search.trim()) { setResults([]); return; }
    const id = setTimeout(async () => {
      setSearching(true);
      const res = await searchTickers(search);
      setResults(res.slice(0, 6));
      setSearching(false);
    }, 350);
    return () => clearTimeout(id);
  }, [search]);

  const selectTicker = (t: string) => {
    setTicker(t);
    setSearch("");
    setResults([]);
    setTab("chart");
  };

  const toggleWatch = (t: string) =>
    setWatchlist(w => w.includes(t) ? w.filter(x => x !== t) : [...w, t]);

  // ── Derived ──────────────────────────────────────────────────────────────
  const up       = quote.changePct >= 0;
  const lineColor = up ? "#00FF94" : "#FF3B5C";
  const watched  = watchlist.includes(ticker);

  // ─── Styles (inline to stay truly self-contained) ─────────────────────────
  const S = {
    page:        { minHeight:"100vh", background:"#060B14", color:"#E2EAF4", fontFamily:"system-ui,sans-serif" } as React.CSSProperties,
    mono:        { fontFamily:"'Courier New',Courier,monospace" } as React.CSSProperties,
    card:        { background:"#0D1321", border:"1px solid #1E293B", borderRadius:12 } as React.CSSProperties,
    cardSm:      { background:"#0D1321", border:"1px solid #1E293B", borderRadius:8 } as React.CSSProperties,
    green:       { color:"#00FF94" } as React.CSSProperties,
    red:         { color:"#FF3B5C" } as React.CSSProperties,
    muted:       { color:"#7A9BBF" } as React.CSSProperties,
    cyan:        { color:"#00D4FF" } as React.CSSProperties,
    badge: (pos: boolean) => ({
      display:"inline-flex", alignItems:"center", gap:4,
      background: pos ? "rgba(0,255,148,0.1)" : "rgba(255,59,92,0.1)",
      color:       pos ? "#00FF94" : "#FF3B5C",
      border:     `1px solid ${pos ? "rgba(0,255,148,0.2)" : "rgba(255,59,92,0.2)"}`,
      borderRadius:6, padding:"2px 8px",
      fontFamily:"'Courier New',Courier,monospace", fontSize:12,
    } as React.CSSProperties),
    btn: (active: boolean) => ({
      background: active ? "rgba(0,212,255,0.12)" : "transparent",
      color:      active ? "#00D4FF" : "#7A9BBF",
      border:     "none", borderRadius:6,
      padding:"4px 12px", cursor:"pointer",
      fontFamily:"'Courier New',Courier,monospace", fontSize:12,
      transition:"all 0.15s",
    } as React.CSSProperties),
    input: {
      background:"#060B14", border:"1px solid #1E293B", borderRadius:8,
      color:"#E2EAF4", padding:"8px 12px 8px 36px",
      fontFamily:"'Courier New',Courier,monospace", fontSize:13,
      outline:"none", width:"100%",
    } as React.CSSProperties,
    tag: (color: string) => ({
      fontSize:10, padding:"2px 8px", borderRadius:99,
      background:`${color}10`, color, border:`1px solid ${color}30`,
      fontFamily:"'Courier New',Courier,monospace",
    } as React.CSSProperties),
  };

  return (
    <div style={S.page}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header style={{ borderBottom:"1px solid #1E293B", background:"#0D1321", padding:"0 24px", height:52, display:"flex", alignItems:"center", gap:16 }}>
        {/* Logo */}
        <div style={{ display:"flex", alignItems:"center", gap:8, marginRight:8 }}>
          <div style={{ width:28, height:28, borderRadius:8, background:"linear-gradient(135deg,#00D4FF,#00FF94)", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <Zap size={15} color="#060B14" strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ ...S.mono, fontSize:11, fontWeight:700, letterSpacing:"0.15em", lineHeight:1 }}>VERTEX</div>
            <div style={{ ...S.mono, ...S.muted, fontSize:8, letterSpacing:"0.2em" }}>TERMINAL</div>
          </div>
        </div>

        {/* Search */}
        <div style={{ position:"relative", flex:1, maxWidth:320 }}>
          <Search size={14} color="#7A9BBF" style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)" }} />
          <input
            style={S.input}
            placeholder="Search ticker or company…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {searching && (
            <RefreshCw size={12} color="#7A9BBF" style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", animation:"spin 1s linear infinite" }} />
          )}
          {results.length > 0 && (
            <div style={{ position:"absolute", top:"calc(100% + 6px)", left:0, right:0, background:"#0D1321", border:"1px solid #1E293B", borderRadius:8, zIndex:99, overflow:"hidden" }}>
              {results.map(t => (
                <button key={t} onClick={() => selectTicker(t)}
                  style={{ display:"flex", justifyContent:"space-between", width:"100%", padding:"8px 12px", background:"none", border:"none", color:"#E2EAF4", cursor:"pointer", textAlign:"left" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#111E30")}
                  onMouseLeave={e => (e.currentTarget.style.background = "none")}>
                  <span style={{ ...S.mono, fontSize:13, fontWeight:600 }}>{t}</span>
                  <span style={{ ...S.muted, fontSize:12 }}>{MOCK_QUOTES[t]?.name ?? ""}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Popular chips */}
        <div style={{ display:"flex", gap:6, flexWrap:"nowrap", overflow:"hidden" }}>
          {POPULAR.map(t => (
            <button key={t} onClick={() => selectTicker(t)}
              style={{ ...S.mono, fontSize:11, padding:"3px 10px", borderRadius:6, cursor:"pointer", border:"1px solid", transition:"all 0.15s",
                background: t === ticker ? "rgba(0,212,255,0.12)" : "transparent",
                color:      t === ticker ? "#00D4FF" : "#7A9BBF",
                borderColor:t === ticker ? "rgba(0,212,255,0.3)" : "#1E293B" }}>
              {t}
            </button>
          ))}
        </div>

        {/* Live dot */}
        <div style={{ display:"flex", alignItems:"center", gap:6, marginLeft:"auto" }}>
          <div style={{ width:7, height:7, borderRadius:"50%", background:"#00FF94", animation:"pulse 2s infinite" }} />
          <span style={{ ...S.mono, ...S.muted, fontSize:9 }}>LIVE</span>
        </div>
      </header>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 280px", gap:20, padding:20, maxWidth:1400, margin:"0 auto" }}>

        {/* ── Left column ──────────────────────────────────────────────────── */}
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

          {/* Quote header */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <h1 style={{ fontSize:28, fontWeight:700, margin:0 }}>{ticker}</h1>
                <span style={S.badge(up)}>
                  {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {fmtPct(quote.changePct)}
                </span>
                <button onClick={() => toggleWatch(ticker)} title="Toggle watchlist"
                  style={{ background:"none", border:"none", cursor:"pointer", padding:4 }}>
                  {watched
                    ? <Star size={18} color="#FFB800" fill="#FFB800" />
                    : <StarOff size={18} color="#3D5A7A" />}
                </button>
              </div>
              <p style={{ ...S.muted, margin:"2px 0 0", fontSize:13 }}>{quote.name}</p>
            </div>
            <div style={{ textAlign:"right" }}>
              {loading
                ? <div style={{ width:140, height:36, background:"#111E30", borderRadius:6, animation:"pulse 1.5s infinite" }} />
                : <>
                    <div style={{ ...S.mono, fontSize:32, fontWeight:700 }}>{fmt$(quote.price)}</div>
                    <div style={{ ...S.mono, fontSize:13, ...(up ? S.green : S.red) }}>
                      {quote.change >= 0 ? "+" : ""}{fmt$(quote.change)} today
                    </div>
                  </>}
            </div>
          </div>

          {/* Tab switcher */}
          <div style={{ display:"flex", gap:4, background:"#0D1321", border:"1px solid #1E293B", borderRadius:8, padding:4, width:"fit-content" }}>
            <button style={S.btn(tab === "chart")} onClick={() => setTab("chart")}>📈 Chart</button>
            <button style={S.btn(tab === "ai")}    onClick={() => setTab("ai")}>🤖 AI Predictions</button>
          </div>

          {/* ── Chart panel ──────────────────────────────────────────────── */}
          {tab === "chart" && (
            <div style={{ ...S.card, padding:0, overflow:"hidden" }}>
              {/* Stat row */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", borderBottom:"1px solid #1E293B" }}>
                {[
                  { label:"Open",    val: fmt$(quote.open)    },
                  { label:"High",    val: fmt$(quote.high)    },
                  { label:"Low",     val: fmt$(quote.low)     },
                  { label:"Volume",  val: fmtVol(quote.volume)},
                ].map(s => (
                  <div key={s.label} style={{ padding:"12px 16px", borderRight:"1px solid #1E293B" }}>
                    <div style={{ ...S.mono, ...S.muted, fontSize:10, marginBottom:3, textTransform:"uppercase", letterSpacing:"0.08em" }}>{s.label}</div>
                    <div style={{ ...S.mono, fontSize:14, fontWeight:600 }}>{s.val}</div>
                  </div>
                ))}
              </div>

              {/* Chart */}
              <div style={{ padding:"16px 8px 12px" }}>
                {loading ? (
                  <div style={{ height:240, background:"#111E30", borderRadius:8, animation:"pulse 1.5s infinite" }} />
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={bars} margin={{ top:4, right:8, left:0, bottom:0 }}>
                      <defs>
                        <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={lineColor} stopOpacity={0.2} />
                          <stop offset="95%" stopColor={lineColor} stopOpacity={0}   />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                      <XAxis dataKey="date"
                        tick={{ fill:"#3D5A7A", fontSize:9, fontFamily:"Courier New" }}
                        tickLine={false} axisLine={false} interval="preserveStartEnd" />
                      <YAxis
                        tick={{ fill:"#3D5A7A", fontSize:9, fontFamily:"Courier New" }}
                        tickLine={false} axisLine={false}
                        tickFormatter={(v:number) => `$${v.toFixed(0)}`}
                        width={54} domain={["auto","auto"]} />
                      <Tooltip content={<ChartTip />} />
                      <Area type="monotone" dataKey="close"
                        stroke={lineColor} strokeWidth={1.5}
                        fill="url(#cg)" dot={false}
                        activeDot={{ r:4, fill:lineColor, strokeWidth:0 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div style={{ ...S.mono, ...S.muted, fontSize:10, textAlign:"center", paddingBottom:10 }}>
                90-day closing price · Powered by Polygon.io
              </div>
            </div>
          )}

          {/* ── AI Predictions panel ─────────────────────────────────────── */}
          {tab === "ai" && (
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              {/* Header */}
              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                <div style={{ width:40, height:40, borderRadius:10, background:"rgba(168,85,247,0.12)", border:"1px solid rgba(168,85,247,0.25)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <Brain size={20} color="#A855F7" />
                </div>
                <div>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ fontSize:16, fontWeight:600 }}>AI Predictions</span>
                    <span style={{ ...S.mono, fontSize:9, background:"rgba(168,85,247,0.12)", color:"#A855F7", border:"1px solid rgba(168,85,247,0.2)", borderRadius:99, padding:"2px 8px" }}>BETA</span>
                  </div>
                  <p style={{ ...S.muted, fontSize:12, margin:0 }}>ML signals: momentum · volume · sentiment · technicals</p>
                </div>
              </div>

              {/* Stat chips */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10 }}>
                {[
                  { label:"Model Accuracy", val:"73.4%", color:"#00D4FF" },
                  { label:"Avg Confidence", val:"78.5%", color:"#00FF94" },
                  { label:"Backtested α",   val:"+5.9%", color:"#00FF94" },
                ].map(s => (
                  <div key={s.label} style={{ ...S.cardSm, padding:"12px 14px" }}>
                    <div style={{ ...S.mono, ...S.muted, fontSize:10, marginBottom:4 }}>{s.label}</div>
                    <div style={{ ...S.mono, fontSize:20, fontWeight:700, color:s.color }}>{s.val}</div>
                  </div>
                ))}
              </div>

              {/* Winners */}
              <div>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                  <TrendingUp size={15} color="#00FF94" />
                  <span style={{ fontSize:13, fontWeight:600 }}>Predicted Outperformers</span>
                  <span style={{ ...S.mono, fontSize:10, background:"rgba(0,255,148,0.1)", color:"#00FF94", borderRadius:4, padding:"2px 7px" }}>BUY</span>
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  {AI_WINNERS.map((s, i) => (
                    <div key={s.ticker} style={{ ...S.card, padding:16, cursor:"pointer", transition:"border-color 0.2s" }}
                      onClick={() => selectTicker(s.ticker)}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(0,255,148,0.35)")}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = "#1E293B")}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                          <span style={{ ...S.mono, ...S.muted, fontSize:11 }}>#{i+1}</span>
                          <div>
                            <div style={{ ...S.mono, fontSize:14, fontWeight:700, ...S.cyan }}>{s.ticker}</div>
                            <div style={{ ...S.muted, fontSize:11 }}>{s.name}</div>
                          </div>
                        </div>
                        <div style={{ textAlign:"right" }}>
                          <div style={{ ...S.muted, fontSize:10 }}>Target</div>
                          <div style={{ ...S.mono, ...S.green, fontSize:14, fontWeight:700 }}>{fmt$(s.target)}</div>
                          <div style={{ ...S.mono, ...S.green, fontSize:11 }}>+{s.upside.toFixed(1)}% upside</div>
                        </div>
                      </div>
                      {/* Confidence bar */}
                      <div style={{ marginBottom:10 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                          <span style={{ ...S.mono, ...S.muted, fontSize:9, textTransform:"uppercase", letterSpacing:"0.08em" }}>Confidence</span>
                          <span style={{ ...S.mono, ...S.green, fontSize:9 }}>{s.confidence}%</span>
                        </div>
                        <div style={{ height:3, background:"#111E30", borderRadius:99, overflow:"hidden" }}>
                          <div style={{ height:"100%", width:`${s.confidence}%`, background:"linear-gradient(90deg,rgba(0,255,148,0.5),#00FF94)", borderRadius:99 }} />
                        </div>
                      </div>
                      <p style={{ ...S.muted, fontSize:12, lineHeight:1.5, marginBottom:10 }}>{s.reason}</p>
                      <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                        {s.tags.map(t => <span key={t} style={S.tag("#00FF94")}>{t}</span>)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Losers */}
              <div>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                  <TrendingDown size={15} color="#FF3B5C" />
                  <span style={{ fontSize:13, fontWeight:600 }}>Predicted Underperformers</span>
                  <span style={{ ...S.mono, fontSize:10, background:"rgba(255,59,92,0.1)", color:"#FF3B5C", borderRadius:4, padding:"2px 7px" }}>AVOID</span>
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  {AI_LOSERS.map((s, i) => (
                    <div key={s.ticker} style={{ ...S.card, padding:16, cursor:"pointer", transition:"border-color 0.2s" }}
                      onClick={() => selectTicker(s.ticker)}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(255,59,92,0.35)")}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = "#1E293B")}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                          <span style={{ ...S.mono, ...S.muted, fontSize:11 }}>#{i+1}</span>
                          <div>
                            <div style={{ ...S.mono, fontSize:14, fontWeight:700, ...S.cyan }}>{s.ticker}</div>
                            <div style={{ ...S.muted, fontSize:11 }}>{s.name}</div>
                          </div>
                        </div>
                        <div style={{ textAlign:"right" }}>
                          <div style={{ ...S.muted, fontSize:10 }}>Target</div>
                          <div style={{ ...S.mono, color:"#FF3B5C", fontSize:14, fontWeight:700 }}>{fmt$(s.target)}</div>
                          <div style={{ ...S.mono, color:"#FF3B5C", fontSize:11 }}>{s.downside.toFixed(1)}% downside</div>
                        </div>
                      </div>
                      <div style={{ marginBottom:10 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                          <span style={{ ...S.mono, ...S.muted, fontSize:9, textTransform:"uppercase", letterSpacing:"0.08em" }}>Confidence</span>
                          <span style={{ ...S.mono, color:"#FF3B5C", fontSize:9 }}>{s.confidence}%</span>
                        </div>
                        <div style={{ height:3, background:"#111E30", borderRadius:99, overflow:"hidden" }}>
                          <div style={{ height:"100%", width:`${s.confidence}%`, background:"linear-gradient(90deg,rgba(255,59,92,0.5),#FF3B5C)", borderRadius:99 }} />
                        </div>
                      </div>
                      <p style={{ ...S.muted, fontSize:12, lineHeight:1.5, marginBottom:10 }}>{s.reason}</p>
                      <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                        {s.tags.map(t => (
                          <span key={t} style={S.tag("#FF3B5C")}>
                            <AlertTriangle size={8} style={{ display:"inline", marginRight:3 }} />{t}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Disclaimer */}
              <div style={{ background:"rgba(255,184,0,0.05)", border:"1px solid rgba(255,184,0,0.2)", borderRadius:10, padding:"12px 14px", display:"flex", gap:10 }}>
                <AlertTriangle size={15} color="#FFB800" style={{ marginTop:1, shrink:0 }} />
                <p style={{ ...S.muted, fontSize:11, lineHeight:1.6, margin:0 }}>
                  AI predictions are for informational purposes only and do not constitute financial advice.
                  Always conduct your own research before making investment decisions.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── Right column — Watchlist ──────────────────────────────────── */}
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <div style={{ ...S.card, overflow:"hidden" }}>
            <div style={{ padding:"12px 16px", borderBottom:"1px solid #1E293B", display:"flex", alignItems:"center", gap:8 }}>
              <Star size={14} color="#FFB800" fill="#FFB800" />
              <span style={{ fontSize:13, fontWeight:600 }}>Watchlist</span>
              <span style={{ ...S.mono, ...S.muted, fontSize:11, marginLeft:"auto" }}>{watchlist.length}</span>
            </div>
            {watchlist.length === 0 && (
              <p style={{ ...S.muted, fontSize:12, textAlign:"center", padding:20 }}>Star a stock to add it here</p>
            )}
            {watchlist.map(t => {
              const q = MOCK_QUOTES[t];
              const pos = (q?.changePct ?? 0) >= 0;
              return (
                <button key={t} onClick={() => selectTicker(t)}
                  style={{ display:"flex", justifyContent:"space-between", alignItems:"center", width:"100%", padding:"10px 16px", background: t === ticker ? "rgba(0,212,255,0.05)" : "none", border:"none", borderBottom:"1px solid #1E293B", cursor:"pointer", borderLeft: t === ticker ? "2px solid #00D4FF" : "2px solid transparent" }}
                  onMouseEnter={e => { if (t !== ticker) e.currentTarget.style.background = "#111E30"; }}
                  onMouseLeave={e => { if (t !== ticker) e.currentTarget.style.background = "none"; }}>
                  <div style={{ textAlign:"left" }}>
                    <div style={{ ...S.mono, fontSize:12, fontWeight:700, color: t === ticker ? "#00D4FF" : "#E2EAF4" }}>{t}</div>
                    <div style={{ ...S.muted, fontSize:10, maxWidth:100, overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis" }}>{q?.name ?? ""}</div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ ...S.mono, fontSize:12, fontWeight:600 }}>{q ? fmt$(q.price) : "—"}</div>
                    <div style={{ ...S.mono, fontSize:10, color: pos ? "#00FF94" : "#FF3B5C" }}>{q ? fmtPct(q.changePct) : ""}</div>
                  </div>
                </button>
              );
            })}
            {/* Add popular stocks not yet on watchlist */}
            <div style={{ padding:"10px 14px", borderTop:"1px solid #1E293B" }}>
              <p style={{ ...S.muted, fontSize:10, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>Add stocks</p>
              <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                {POPULAR.filter(t => !watchlist.includes(t)).map(t => (
                  <button key={t} onClick={() => toggleWatch(t)}
                    style={{ ...S.mono, fontSize:10, padding:"2px 8px", borderRadius:5, background:"transparent", border:"1px solid #1E293B", color:"#7A9BBF", cursor:"pointer" }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = "#00D4FF55"; e.currentTarget.style.color = "#00D4FF"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "#1E293B";   e.currentTarget.style.color = "#7A9BBF";  }}>
                    + {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Market snapshot */}
          <div style={{ ...S.card, overflow:"hidden" }}>
            <div style={{ padding:"12px 16px", borderBottom:"1px solid #1E293B" }}>
              <span style={{ fontSize:13, fontWeight:600 }}>Market Snapshot</span>
            </div>
            {[
              { name:"S&P 500", val:"5,842", chg:"+0.74%" },
              { name:"NASDAQ",  val:"18,843",chg:"+1.12%" },
              { name:"DOW",     val:"43,189",chg:"+0.42%" },
              { name:"VIX",     val:"14.32", chg:"-2.18%" },
              { name:"10Y",     val:"4.28%", chg:"+0.03%" },
            ].map(m => {
              const pos = m.chg.startsWith("+");
              return (
                <div key={m.name} style={{ display:"flex", justifyContent:"space-between", padding:"9px 16px", borderBottom:"1px solid #1E293B" }}>
                  <span style={{ ...S.muted, fontSize:12 }}>{m.name}</span>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ ...S.mono, fontSize:12, fontWeight:600 }}>{m.val}</div>
                    <div style={{ ...S.mono, fontSize:10, color: pos ? "#00FF94" : "#FF3B5C" }}>{m.chg}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* CSS animations */}
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes spin  { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width:4px }
        ::-webkit-scrollbar-track { background:#0D1321 }
        ::-webkit-scrollbar-thumb { background:#1E293B; border-radius:2px }
      `}</style>
    </div>
  );
}