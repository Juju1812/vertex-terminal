"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  Search, TrendingUp, TrendingDown, Brain, Star, StarOff,
  Zap, RefreshCw, AlertTriangle, Trophy, BookOpen, X,
  LayoutDashboard, ChevronRight, Activity,
} from "lucide-react";

/* ── Lazy panels ──────────────────────────────────────────────── */
const Top15    = dynamic(() => import("@/components/Top15"),    { ssr: false, loading: () => <PanelSkeleton/> });
const MyStocks = dynamic(() => import("@/components/MyStocks"), { ssr: false, loading: () => <PanelSkeleton/> });

function PanelSkeleton() {
  return (
    <div style={{ padding: 28, display: "flex", flexDirection: "column", gap: 14 }}>
      {[220, 72, 72, 72, 72].map((h, i) => (
        <div key={i} className="skel" style={{ height: h, borderRadius: 14 }} />
      ))}
    </div>
  );
}

/* ── Types ─────────────────────────────────────────────────────── */
interface Quote { ticker:string; name:string; price:number; change:number; changePct:number; high:number; low:number; open:number; volume:number; }
interface Bar   { date:string; close:number; }
type Tab = "markets" | "ai" | "top15" | "portfolio";

/* ── Data ──────────────────────────────────────────────────────── */
const API_KEY = "1xwzcvUOF9pft6PRNylO2Xc6X2QeQCGr";
const BASE    = "https://api.polygon.io";
const TICKERS = ["AAPL","MSFT","NVDA","GOOGL","META","TSLA","AMZN","AMD"];

const MOCK: Record<string, Quote> = {
  AAPL:  { ticker:"AAPL", name:"Apple Inc.",            price:228.52, change: 3.21, changePct: 1.42, high:229.88, low:225.12, open:225.80, volume:58_234_100 },
  MSFT:  { ticker:"MSFT", name:"Microsoft Corp.",        price:415.32, change:-2.18, changePct:-0.52, high:418.55, low:413.22, open:417.50, volume:21_456_200 },
  NVDA:  { ticker:"NVDA", name:"NVIDIA Corp.",           price:875.42, change:24.63, changePct: 2.90, high:881.20, low:851.30, open:853.10, volume:42_118_700 },
  GOOGL: { ticker:"GOOGL",name:"Alphabet Inc.",          price:178.94, change: 1.43, changePct: 0.81, high:180.12, low:177.34, open:177.51, volume:18_932_400 },
  META:  { ticker:"META", name:"Meta Platforms",         price:554.78, change: 8.92, changePct: 1.63, high:557.33, low:545.21, open:546.10, volume:14_209_300 },
  TSLA:  { ticker:"TSLA", name:"Tesla Inc.",             price:248.50, change:-9.23, changePct:-3.58, high:260.42, low:247.11, open:258.10, volume:89_234_100 },
  AMZN:  { ticker:"AMZN", name:"Amazon.com Inc.",        price:201.17, change:-0.88, changePct:-0.44, high:203.21, low:200.54, open:202.05, volume:29_847_100 },
  AMD:   { ticker:"AMD",  name:"Advanced Micro Devices", price:162.34, change: 5.82, changePct: 3.72, high:163.80, low:156.42, open:157.10, volume:45_123_200 },
};

const AI_LONG = [
  { ticker:"NVDA", name:"NVIDIA Corp.",       conf:91, target:950, up: 8.5, thesis:"AI infrastructure capex surging. Blackwell GPU demand exceeds supply 3×. Data center revenue +120% YoY.", tags:["Blackwell","Azure Win","Q4 Beat"] },
  { ticker:"META", name:"Meta Platforms",      conf:84, target:620, up:11.8, thesis:"Llama monetisation accelerating. Reels ad revenue +40% QoQ. Sustained cost discipline expanding margins.", tags:["Llama 4","Ad Beat","Cost Cuts"] },
  { ticker:"AMD",  name:"AMD",                 conf:78, target:195, up:20.1, thesis:"MI300X gaining enterprise GPU traction. Data center +80% YoY. TSMC capacity locked through 2025.", tags:["MI400","Design Wins","CPU Share"] },
];
const AI_SHORT = [
  { ticker:"TSLA", name:"Tesla Inc.",      conf:76, target:195, down:-21.6, thesis:"EV demand soft. Brutal price war in China. Cybertruck ramp costlier than expected. Brand erosion risk.", tags:["China","Margins","Competition"] },
  { ticker:"AMZN", name:"Amazon.com",      conf:61, target:180, down:-10.5, thesis:"AWS growth decelerating vs peers. Retail margins thin. Advertising CPM pressure accelerating.", tags:["AWS Slowdown","Ad CPMs","FTC"] },
];

const INDICES = [
  { n:"S&P 500",  v:"5,842.47", d:"+0.74%", up:true  },
  { n:"NASDAQ",   v:"18,843",   d:"+1.12%", up:true  },
  { n:"DJIA",     v:"43,189",   d:"+0.42%", up:true  },
  { n:"VIX",      v:"14.32",    d:"−2.18%", up:false },
  { n:"10Y",      v:"4.28%",    d:"+0.03%", up:true  },
  { n:"BTC",      v:"94,120",   d:"+2.31%", up:true  },
];

const TABS: { id:Tab; label:string; short:string }[] = [
  { id:"markets",   label:"Markets",    short:"Markets"   },
  { id:"top15",     label:"Top 15",     short:"Top 15"    },
  { id:"portfolio", label:"Portfolio",  short:"Portfolio" },
  { id:"ai",        label:"AI Signals", short:"AI"        },
];

/* ── Helpers ───────────────────────────────────────────────────── */
function seedBars(base: number, days = 90): Bar[] {
  const out: Bar[] = [];
  let p = base * 0.81, seed = Math.round(base * 137);
  const r = () => { seed = (seed * 1664525 + 1013904223) & 0xffffffff; return (seed >>> 0) / 0xffffffff; };
  const now = new Date();
  for (let i = days; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    p += (r() - 0.47) * 0.022 * p;
    out.push({ date: d.toISOString().split("T")[0], close: +p.toFixed(2) });
  }
  return out;
}

async function apiFetch<T>(path: string): Promise<T | null> {
  try {
    const sep = path.includes("?") ? "&" : "?";
    const r = await fetch(`${BASE}${path}${sep}apiKey=${API_KEY}`);
    return r.ok ? r.json() : null;
  } catch { return null; }
}

async function loadQuote(ticker: string): Promise<Quote> {
  const m = MOCK[ticker] ?? { ticker, name:ticker, price:100, change:0, changePct:0, high:101, low:99, open:100, volume:1e6 };
  const d = await apiFetch<{ ticker: { day:{c:number;h:number;l:number;o:number;v:number}; prevDay:{c:number} } }>(`/v2/snapshot/locale/us/markets/stocks/tickers/${ticker}`);
  if (!d?.ticker?.day?.c) return m;
  const { day, prevDay } = d.ticker, chg = day.c - prevDay.c;
  return { ticker, name:m.name, price:day.c, change:+chg.toFixed(2), changePct:+((chg/prevDay.c)*100).toFixed(2), high:day.h, low:day.l, open:day.o, volume:day.v };
}

async function loadBars(ticker: string): Promise<Bar[]> {
  const to   = new Date().toISOString().split("T")[0];
  const from = new Date(Date.now() - 90*86_400_000).toISOString().split("T")[0];
  const d = await apiFetch<{ results?:{c:number;t:number}[] }>(`/v2/aggs/ticker/${ticker}/range/1/day/${from}/${to}?adjusted=true&sort=asc&limit=120`);
  if (!d?.results?.length) return seedBars(MOCK[ticker]?.price ?? 100);
  return d.results.map(b => ({ date: new Date(b.t).toISOString().split("T")[0], close: b.c }));
}

async function searchTickers(q: string): Promise<string[]> {
  const d = await apiFetch<{ results?:{ticker:string}[] }>(`/v3/reference/tickers?search=${encodeURIComponent(q)}&active=true&limit=7&market=stocks`);
  if (!d?.results?.length) return TICKERS.filter(t => t.includes(q.toUpperCase()) || MOCK[t]?.name.toLowerCase().includes(q.toLowerCase()));
  return d.results.map(r => r.ticker);
}

/* ── Format utils ──────────────────────────────────────────────── */
const f$ = (n:number) => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",minimumFractionDigits:2}).format(n);
const fp = (n:number) => `${n>=0?"+":""}${n.toFixed(2)}%`;
const fv = (n:number) => n>=1e9?`${(n/1e9).toFixed(2)}B`:n>=1e6?`${(n/1e6).toFixed(2)}M`:n>=1e3?`${(n/1e3).toFixed(1)}K`:String(n);

/* ── Design tokens (JS) ─────────────────────────────────────────── */
const V = {
  void:  "#050810",
  d0:    "#050810", d1: "#080D18", d2: "#0C1220", d3: "#101828", d4:"#151F30", d5:"#1A2638", dh:"#1E2D40",
  w1:  "rgba(130,180,255,0.055)", w2:"rgba(130,180,255,0.10)", w3:"rgba(130,180,255,0.16)", w4:"rgba(130,180,255,0.26)",
  ink0:"#F2F6FF", ink1:"#C8D5E8", ink2:"#7A9CBF", ink3:"#3D5A7A", ink4:"#1F3550",
  gain:"#00C896",  gainDim:"rgba(0,200,150,0.08)",  gainWire:"rgba(0,200,150,0.20)",  gainGlow:"rgba(0,200,150,0.12)",
  loss:"#E8445A",  lossDim:"rgba(232,68,90,0.08)",  lossWire:"rgba(232,68,90,0.20)",  lossGlow:"rgba(232,68,90,0.10)",
  arc: "#4F8EF7",  arcDim: "rgba(79,142,247,0.10)", arcWire: "rgba(79,142,247,0.22)",
  gold:"#E8A030",  goldDim:"rgba(232,160,48,0.10)",
  ame: "#9B72F5",  ameDim: "rgba(155,114,245,0.10)", ameWire:"rgba(155,114,245,0.22)",
};

const mono: React.CSSProperties = { fontFamily: "'Geist Mono', 'Courier New', monospace" };
const body: React.CSSProperties = { fontFamily: "'Bricolage Grotesque', system-ui, sans-serif" };

/* ── Shared card style ──────────────────────────────────────────── */
const glassCard = (extra?: React.CSSProperties): React.CSSProperties => ({
  background: "linear-gradient(145deg, rgba(255,255,255,0.030) 0%, rgba(255,255,255,0.012) 100%)",
  backdropFilter: "blur(24px) saturate(1.5)",
  WebkitBackdropFilter: "blur(24px) saturate(1.5)",
  border: `1px solid ${V.w2}`,
  borderRadius: 16,
  boxShadow: `0 4px 16px rgba(0,0,0,0.55), 0 1px 3px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)`,
  position: "relative" as const,
  overflow: "hidden",
  ...extra,
});

/* ── Custom chart tooltip ─────────────────────────────────────── */
function ChartTip({ active, payload, label }: { active?:boolean; payload?:{value:number}[]; label?:string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:V.d3, border:`1px solid ${V.w3}`, borderRadius:12, padding:"10px 16px", boxShadow:`0 12px 40px rgba(0,0,0,0.65)` }}>
      <p style={{ ...mono, fontSize:10, color:V.ink3, marginBottom:4, letterSpacing:"0.06em", textTransform:"uppercase" }}>{label}</p>
      <p style={{ ...mono, fontSize:17, color:V.ink0, fontWeight:500, letterSpacing:"-0.02em" }}>{f$(payload[0].value)}</p>
    </div>
  );
}

/* ── Micro confidence bar ──────────────────────────────────────── */
function ConfBar({ pct, color }: { pct:number; color:string }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
      <div style={{ flex:1, height:2, background:"rgba(255,255,255,0.05)", borderRadius:99, overflow:"hidden" }}>
        <div style={{ width:`${pct}%`, height:"100%", background:color, borderRadius:99, transition:"width 1s cubic-bezier(0.16,1,0.3,1)" }} />
      </div>
      <span style={{ ...mono, fontSize:10, color, minWidth:30, textAlign:"right" }}>{pct}%</span>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════════════ */
export default function VertexTerminal() {
  const [ticker,    setTicker]    = useState("AAPL");
  const [quote,     setQuote]     = useState<Quote>(MOCK["AAPL"]);
  const [bars,      setBars]      = useState<Bar[]>(seedBars(228.52));
  const [watchlist, setWatchlist] = useState<string[]>(["AAPL","NVDA","MSFT","META"]);
  const [search,    setSearch]    = useState("");
  const [results,   setResults]   = useState<string[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [tab,       setTab]       = useState<Tab>("markets");
  const [searching, setSearching] = useState(false);
  const [showSearch,setShowSearch]= useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (t: string) => {
    setLoading(true);
    const [q, b] = await Promise.all([loadQuote(t), loadBars(t)]);
    setQuote(q); setBars(b); setLoading(false);
  }, []);
  useEffect(() => { load(ticker); }, [ticker, load]);

  useEffect(() => {
    if (!search.trim()) { setResults([]); return; }
    const id = setTimeout(async () => {
      setSearching(true);
      setResults((await searchTickers(search)).slice(0, 7));
      setSearching(false);
    }, 300);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => {
    const h = (e:MouseEvent) => { if (searchRef.current && !searchRef.current.contains(e.target as Node)) { setResults([]); setShowSearch(false); } };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const go = (t: string) => { setTicker(t); setSearch(""); setResults([]); setShowSearch(false); setTab("markets"); };
  const toggleWatch = (t: string) => setWatchlist(w => w.includes(t) ? w.filter(x=>x!==t) : [...w,t]);

  const up        = quote.changePct >= 0;
  const lineColor = up ? V.gain : V.loss;
  const watched   = watchlist.includes(ticker);
  const fullWide  = tab === "top15" || tab === "portfolio";

  /* ── Markets panel ─────────────────────────────────────── */
  const MarketsPanel = () => (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }} className="vx-rise">

      {/* ── Hero quote card ── */}
      <div style={{ ...glassCard(), padding:0, overflow:"hidden" }}>
        {/* Ambient glow matching direction */}
        <div style={{ position:"absolute", top:-60, right:-60, width:240, height:240, borderRadius:"50%", background:up?V.gainGlow:V.lossGlow, filter:"blur(60px)", pointerEvents:"none", zIndex:0 }} />

        <div style={{ position:"relative", zIndex:1, padding:"24px 24px 0" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12, flexWrap:"wrap" }}>
            {/* Left: ticker name */}
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4, flexWrap:"wrap" }}>
                <h1 style={{ ...mono, fontSize:"clamp(28px,6vw,44px)", fontWeight:500, letterSpacing:"-0.04em", lineHeight:1, color:V.ink0 }}>{ticker}</h1>
                <span className={`badge ${up?"badge-gain":"badge-loss"}`}>
                  {up ? <TrendingUp size={10}/> : <TrendingDown size={10}/>}
                  {fp(quote.changePct)}
                </span>
                <button onClick={() => toggleWatch(ticker)}
                  style={{ background:"none", border:"none", cursor:"pointer", padding:4, display:"flex", alignItems:"center", minWidth:32, minHeight:32, justifyContent:"center", borderRadius:8, transition:"background 0.15s" }}>
                  {watched
                    ? <Star size={17} color={V.gold} fill={V.gold}/>
                    : <StarOff size={17} color={V.ink3}/>}
                </button>
              </div>
              <p style={{ color:V.ink2, fontSize:13, fontWeight:400 }}>{quote.name}</p>
            </div>
            {/* Right: price */}
            <div style={{ textAlign:"right" }}>
              {loading
                ? <div className="skel" style={{ width:180, height:48, borderRadius:8 }}/>
                : <>
                    <div style={{ ...mono, fontSize:"clamp(30px,5vw,46px)", fontWeight:500, letterSpacing:"-0.04em", lineHeight:1, color:V.ink0, animation:"vx-rise 0.3s ease-out both" }}>{f$(quote.price)}</div>
                    <div style={{ ...mono, fontSize:12, color:up?V.gain:V.loss, marginTop:5 }}>{quote.change>=0?"+":""}{f$(quote.change)} today</div>
                  </>}
            </div>
          </div>

          {/* Stat chips — horizontal scroll on mobile */}
          <div className="scroll-x" style={{ marginTop:20, marginLeft:-24, marginRight:-24, paddingLeft:24, paddingRight:24 }}>
            <div style={{ display:"flex", gap:8, minWidth:"max-content", paddingBottom:20 }}>
              {[
                { l:"Open",   v:f$(quote.open) },
                { l:"High",   v:f$(quote.high) },
                { l:"Low",    v:f$(quote.low)  },
                { l:"Volume", v:fv(quote.volume) },
                { l:"Prev",   v:f$(quote.price - quote.change) },
              ].map(s => (
                <div key={s.l} style={{ background:"rgba(255,255,255,0.035)", border:`1px solid ${V.w1}`, borderRadius:10, padding:"9px 14px", flexShrink:0, backdropFilter:"blur(8px)" }}>
                  <p className="label" style={{ marginBottom:3 }}>{s.l}</p>
                  <p style={{ ...mono, fontSize:12, fontWeight:500, color:V.ink0 }}>{s.v}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Chart — seamless into card */}
        <div style={{ position:"relative", zIndex:1 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 24px 12px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ width:6, height:6, borderRadius:"50%", background:lineColor, animation:"live-pulse 2.5s ease-in-out infinite", boxShadow:`0 0 8px ${lineColor}` }} />
              <span style={{ ...mono, fontSize:9, color:V.ink3, textTransform:"uppercase", letterSpacing:"0.1em" }}>90-day · Polygon.io</span>
            </div>
          </div>
          {loading
            ? <div className="skel" style={{ height:200, margin:"0 16px 16px", borderRadius:10 }}/>
            : <div style={{ height:200, padding:"0 4px 16px" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={bars} margin={{ top:4, right:8, left:0, bottom:0 }}>
                    <defs>
                      <linearGradient id="vxGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor={lineColor} stopOpacity={0.3}/>
                        <stop offset="100%" stopColor={lineColor} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="2 8" stroke="rgba(130,180,255,0.04)" vertical={false}/>
                    <XAxis dataKey="date" tick={{ fill:V.ink4, fontSize:8, fontFamily:"Geist Mono" }} tickLine={false} axisLine={false} interval="preserveStartEnd"/>
                    <YAxis tick={{ fill:V.ink4, fontSize:8, fontFamily:"Geist Mono" }} tickLine={false} axisLine={false} tickFormatter={(v:number)=>`$${v.toFixed(0)}`} width={46} domain={["auto","auto"]}/>
                    <Tooltip content={<ChartTip/>} cursor={{ stroke:V.w3, strokeWidth:1 }}/>
                    <Area type="monotone" dataKey="close" stroke={lineColor} strokeWidth={1.5} fill="url(#vxGrad)" dot={false} activeDot={{ r:5, fill:lineColor, stroke:V.void, strokeWidth:2 }}/>
                  </AreaChart>
                </ResponsiveContainer>
              </div>}
        </div>
      </div>

      {/* ── Ticker quick-select ── */}
      <div>
        <p className="label" style={{ marginBottom:10 }}>Quick Select</p>
        <div className="scroll-x" style={{ marginLeft:-16, marginRight:-16, paddingLeft:16, paddingRight:16 }}>
          <div style={{ display:"flex", gap:6, minWidth:"max-content" }}>
            {TICKERS.map(t => {
              const q = MOCK[t], pos = (q?.changePct??0) >= 0, active = t === ticker;
              return (
                <button key={t} onClick={() => go(t)}
                  style={{ flexShrink:0, display:"flex", flexDirection:"column", alignItems:"flex-start", padding:"9px 13px", borderRadius:11, border:`1px solid`, cursor:"pointer", minWidth:68, transition:"all 0.2s cubic-bezier(0.16,1,0.3,1)",
                    background: active ? `linear-gradient(145deg, rgba(79,142,247,0.12), rgba(79,142,247,0.06))` : "rgba(255,255,255,0.025)",
                    borderColor: active ? V.arcWire : V.w1,
                    boxShadow: active ? `0 0 20px ${V.arcDim}, inset 0 1px 0 rgba(255,255,255,0.08)` : "none",
                  }}>
                  <span style={{ ...mono, fontSize:12, fontWeight:500, color:active?"#7EB6FF":V.ink0 }}>{t}</span>
                  <span style={{ ...mono, fontSize:9, color:pos?V.gain:V.loss, marginTop:2 }}>{q ? fp(q.changePct) : ""}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Watchlist ── */}
      <div>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
          <div style={{ display:"flex", alignItems:"center", gap:7 }}>
            <Star size={13} color={V.gold} fill={V.gold}/>
            <span style={{ fontSize:13, fontWeight:600, color:V.ink0 }}>Watchlist</span>
          </div>
          <span style={{ ...mono, fontSize:10, color:V.ink3 }}>{watchlist.length} tracked</span>
        </div>
        <div style={{ ...glassCard({ overflow:"hidden" }) }}>
          {watchlist.length === 0 && (
            <p style={{ color:V.ink3, fontSize:13, textAlign:"center", padding:"28px 20px" }}>Star a ticker to add it here</p>
          )}
          {watchlist.map((t, i) => {
            const q = MOCK[t], pos = (q?.changePct??0) >= 0;
            return (
              <button key={t} onClick={() => go(t)}
                style={{ display:"flex", justifyContent:"space-between", alignItems:"center", width:"100%", padding:"13px 18px", background:t===ticker?`linear-gradient(90deg,rgba(79,142,247,0.08),transparent)`:"none", border:"none", cursor:"pointer", minHeight:58, textAlign:"left", transition:"background 0.2s", borderLeft:t===ticker?`2px solid ${V.arc}`:"2px solid transparent", borderBottom:i<watchlist.length-1?`1px solid ${V.w1}`:"none" }}
                className="row-hover">
                <div>
                  <p style={{ ...mono, fontSize:13, fontWeight:500, color:t===ticker?"#7EB6FF":V.ink0 }}>{t}</p>
                  <p style={{ color:V.ink3, fontSize:11, marginTop:2, maxWidth:160, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{q?.name}</p>
                </div>
                <div style={{ textAlign:"right" }}>
                  <p style={{ ...mono, fontSize:14, fontWeight:500, color:V.ink0 }}>{q ? f$(q.price) : "—"}</p>
                  <p style={{ ...mono, fontSize:11, color:pos?V.gain:V.loss, marginTop:2 }}>{q ? fp(q.changePct) : ""}</p>
                </div>
              </button>
            );
          })}
          <div style={{ padding:"10px 16px", borderTop:`1px solid ${V.w1}`, display:"flex", flexWrap:"wrap", gap:5 }}>
            {TICKERS.filter(t=>!watchlist.includes(t)).map(t => (
              <button key={t} onClick={() => toggleWatch(t)}
                style={{ ...mono, fontSize:10, padding:"4px 10px", borderRadius:6, background:"transparent", border:`1px solid ${V.w1}`, color:V.ink3, cursor:"pointer", transition:"all 0.2s" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = V.arcWire; e.currentTarget.style.color = "#7EB6FF"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = V.w1; e.currentTarget.style.color = V.ink3; }}>
                +{t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Market indices ── */}
      <div>
        <p style={{ fontSize:13, fontWeight:600, color:V.ink0, marginBottom:12 }}>Global Markets</p>
        <div style={{ ...glassCard({ overflow:"hidden" }) }}>
          {INDICES.map((m, i) => (
            <div key={m.n} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 18px", borderBottom:i<INDICES.length-1?`1px solid ${V.w1}`:"none" }}>
              <span style={{ color:V.ink2, fontSize:13, fontWeight:500 }}>{m.n}</span>
              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                <span style={{ ...mono, fontSize:13, fontWeight:500, color:V.ink0 }}>{m.v}</span>
                <span style={{ ...mono, fontSize:11, color:m.up?V.gain:V.loss, minWidth:52, textAlign:"right" }}>{m.d}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  /* ── AI Signals panel ───────────────────────────────────── */
  const AIPanel = () => (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }} className="vx-rise">
      {/* Header card */}
      <div style={{ ...glassCard({ padding:24 }) }}>
        <div style={{ position:"absolute", top:-40, right:-40, width:200, height:200, borderRadius:"50%", background:"rgba(155,114,245,0.06)", filter:"blur(50px)", pointerEvents:"none" }}/>
        <div style={{ position:"relative", display:"flex", alignItems:"flex-start", gap:14 }}>
          <div style={{ width:44, height:44, borderRadius:12, background:"rgba(155,114,245,0.12)", border:`1px solid ${V.ameWire}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, boxShadow:`0 4px 16px rgba(155,114,245,0.15)` }}>
            <Brain size={21} color={V.ame}/>
          </div>
          <div style={{ flex:1 }}>
            <div style={{ display:"flex", alignItems:"center", gap:9, marginBottom:5, flexWrap:"wrap" }}>
              <h2 style={{ fontSize:17, fontWeight:600, color:V.ink0 }}>AI Signals</h2>
              <span style={{ ...mono, fontSize:9, background:V.ameDim, color:V.ame, border:`1px solid ${V.ameWire}`, borderRadius:99, padding:"2px 9px", textTransform:"uppercase", letterSpacing:"0.1em" }}>Beta</span>
            </div>
            <p style={{ color:V.ink2, fontSize:13, lineHeight:1.6 }}>ML signals across price momentum, volume anomalies, earnings revisions, and NLP sentiment from 10,000+ sources.</p>
          </div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginTop:18 }}>
          {[{l:"Model Accuracy",v:"73.4%",c:"#7EB6FF"},{l:"Avg Confidence",v:"78.5%",c:V.gain},{l:"Alpha vs S&P",v:"+5.9%",c:V.gain}].map(s => (
            <div key={s.l} style={{ background:"rgba(255,255,255,0.04)", border:`1px solid ${V.w1}`, borderRadius:10, padding:"11px 14px", textAlign:"center" }}>
              <p className="label" style={{ marginBottom:5 }}>{s.l}</p>
              <p style={{ ...mono, fontSize:19, fontWeight:500, color:s.c, letterSpacing:"-0.02em" }}>{s.v}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Long signals */}
      <div>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12, flexWrap:"wrap" }}>
          <div style={{ width:26, height:26, borderRadius:7, background:V.gainDim, border:`1px solid ${V.gainWire}`, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <TrendingUp size={13} color={V.gain}/>
          </div>
          <span style={{ fontSize:14, fontWeight:600, color:V.ink0 }}>Outperformer Signals</span>
          <span style={{ ...mono, fontSize:9, background:V.gainDim, color:V.gain, border:`1px solid ${V.gainWire}`, borderRadius:5, padding:"2px 8px", textTransform:"uppercase", letterSpacing:"0.08em" }}>Long</span>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {AI_LONG.map((s, i) => (
            <div key={s.ticker} style={{ ...glassCard({ padding:20 }), cursor:"pointer", transition:"border-color 0.25s, transform 0.2s cubic-bezier(0.16,1,0.3,1)" }} className="vx-card-lift"
              onClick={() => go(s.ticker)}
              onMouseEnter={e => { e.currentTarget.style.borderColor = V.gainWire; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = V.w2; }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14, gap:8 }}>
                <div style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
                  <span style={{ ...mono, fontSize:10, color:V.ink4, marginTop:3 }}>#{i+1}</span>
                  <div>
                    <p style={{ ...mono, fontSize:15, fontWeight:500, color:"#7EB6FF", letterSpacing:"-0.02em" }}>{s.ticker}</p>
                    <p style={{ color:V.ink2, fontSize:11, marginTop:2 }}>{s.name}</p>
                  </div>
                </div>
                <div style={{ textAlign:"right", flexShrink:0 }}>
                  <p className="label" style={{ marginBottom:3 }}>Price Target</p>
                  <p style={{ ...mono, fontSize:17, fontWeight:500, color:V.gain, letterSpacing:"-0.02em" }}>{f$(s.target)}</p>
                  <p style={{ ...mono, fontSize:10, color:V.gain }}>+{s.up.toFixed(1)}% upside</p>
                </div>
              </div>
              <ConfBar pct={s.conf} color={V.gain}/>
              <p style={{ color:V.ink2, fontSize:12, lineHeight:1.65, margin:"12px 0" }}>{s.thesis}</p>
              <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                {s.tags.map(t => <span key={t} style={{ ...mono, fontSize:9, padding:"3px 9px", borderRadius:99, background:V.gainDim, color:V.gain, border:`1px solid ${V.gainWire}` }}>{t}</span>)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Short signals */}
      <div>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12, flexWrap:"wrap" }}>
          <div style={{ width:26, height:26, borderRadius:7, background:V.lossDim, border:`1px solid ${V.lossWire}`, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <TrendingDown size={13} color={V.loss}/>
          </div>
          <span style={{ fontSize:14, fontWeight:600, color:V.ink0 }}>Underperformer Signals</span>
          <span style={{ ...mono, fontSize:9, background:V.lossDim, color:V.loss, border:`1px solid ${V.lossWire}`, borderRadius:5, padding:"2px 8px", textTransform:"uppercase", letterSpacing:"0.08em" }}>Avoid</span>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {AI_SHORT.map((s, i) => (
            <div key={s.ticker} style={{ ...glassCard({ padding:20 }), cursor:"pointer", transition:"border-color 0.25s, transform 0.2s cubic-bezier(0.16,1,0.3,1)" }} className="vx-card-lift"
              onClick={() => go(s.ticker)}
              onMouseEnter={e => { e.currentTarget.style.borderColor = V.lossWire; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = V.w2; }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14, gap:8 }}>
                <div style={{ display:"flex", alignItems:"flex-start", gap:10 }}>
                  <span style={{ ...mono, fontSize:10, color:V.ink4, marginTop:3 }}>#{i+1}</span>
                  <div>
                    <p style={{ ...mono, fontSize:15, fontWeight:500, color:"#7EB6FF", letterSpacing:"-0.02em" }}>{s.ticker}</p>
                    <p style={{ color:V.ink2, fontSize:11, marginTop:2 }}>{s.name}</p>
                  </div>
                </div>
                <div style={{ textAlign:"right", flexShrink:0 }}>
                  <p className="label" style={{ marginBottom:3 }}>Price Target</p>
                  <p style={{ ...mono, fontSize:17, fontWeight:500, color:V.loss, letterSpacing:"-0.02em" }}>{f$(s.target)}</p>
                  <p style={{ ...mono, fontSize:10, color:V.loss }}>{s.down.toFixed(1)}% downside</p>
                </div>
              </div>
              <ConfBar pct={s.conf} color={V.loss}/>
              <p style={{ color:V.ink2, fontSize:12, lineHeight:1.65, margin:"12px 0" }}>{s.thesis}</p>
              <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                {s.tags.map(t => (
                  <span key={t} style={{ ...mono, fontSize:9, padding:"3px 9px", borderRadius:99, background:V.lossDim, color:V.loss, border:`1px solid ${V.lossWire}`, display:"inline-flex", alignItems:"center", gap:3 }}>
                    <AlertTriangle size={8}/>{t}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display:"flex", gap:10, padding:"12px 16px", borderRadius:12, background:V.goldDim, border:`1px solid rgba(232,160,48,0.18)` }}>
        <AlertTriangle size={13} color={V.gold} style={{ marginTop:1, flexShrink:0 }}/>
        <p style={{ color:V.ink2, fontSize:11, lineHeight:1.65 }}>For informational purposes only. Not investment advice. Past performance does not guarantee future results.</p>
      </div>
    </div>
  );

  /* ── Desktop sidebar ───────────────────────────────────── */
  const Sidebar = () => (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {/* Watchlist */}
      <div style={{ ...glassCard({ overflow:"hidden", padding:0 }) }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, padding:"13px 18px", borderBottom:`1px solid ${V.w1}` }}>
          <Star size={13} color={V.gold} fill={V.gold}/>
          <span style={{ fontSize:13, fontWeight:600, color:V.ink0 }}>Watchlist</span>
          <span style={{ ...mono, fontSize:10, color:V.ink3, marginLeft:"auto" }}>{watchlist.length}</span>
        </div>
        {watchlist.map((t, i) => {
          const q = MOCK[t], pos = (q?.changePct??0) >= 0;
          return (
            <button key={t} onClick={() => go(t)}
              style={{ display:"flex", justifyContent:"space-between", alignItems:"center", width:"100%", padding:"11px 18px", background:t===ticker?`linear-gradient(90deg,rgba(79,142,247,0.07),transparent)`:"none", border:"none", cursor:"pointer", borderBottom:i<watchlist.length-1?`1px solid ${V.w1}`:"none", borderLeft:t===ticker?`2px solid ${V.arc}`:"2px solid transparent", minHeight:50, textAlign:"left", transition:"background 0.18s" }}
              className="row-hover">
              <div>
                <p style={{ ...mono, fontSize:12, fontWeight:500, color:t===ticker?"#7EB6FF":V.ink0 }}>{t}</p>
                <p style={{ color:V.ink3, fontSize:10, marginTop:1, maxWidth:100, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{q?.name}</p>
              </div>
              <div style={{ textAlign:"right" }}>
                <p style={{ ...mono, fontSize:13, fontWeight:500, color:V.ink0 }}>{q ? f$(q.price) : "—"}</p>
                <p style={{ ...mono, fontSize:10, color:pos?V.gain:V.loss, marginTop:1 }}>{q ? fp(q.changePct) : ""}</p>
              </div>
            </button>
          );
        })}
        <div style={{ padding:"9px 14px", borderTop:`1px solid ${V.w1}`, display:"flex", flexWrap:"wrap", gap:4 }}>
          {TICKERS.filter(t=>!watchlist.includes(t)).map(t => (
            <button key={t} onClick={() => toggleWatch(t)}
              style={{ ...mono, fontSize:9, padding:"3px 8px", borderRadius:5, background:"transparent", border:`1px solid ${V.w1}`, color:V.ink3, cursor:"pointer", transition:"all 0.18s" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor=V.arcWire; e.currentTarget.style.color="#7EB6FF"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor=V.w1; e.currentTarget.style.color=V.ink3; }}>
              +{t}
            </button>
          ))}
        </div>
      </div>

      {/* Global Markets */}
      <div style={{ ...glassCard({ overflow:"hidden", padding:0 }) }}>
        <div style={{ padding:"13px 18px", borderBottom:`1px solid ${V.w1}` }}>
          <span style={{ fontSize:13, fontWeight:600, color:V.ink0 }}>Global Markets</span>
        </div>
        {INDICES.map((m, i) => (
          <div key={m.n} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 18px", borderBottom:i<INDICES.length-1?`1px solid ${V.w1}`:"none" }}>
            <span style={{ color:V.ink2, fontSize:12, fontWeight:500 }}>{m.n}</span>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <span style={{ ...mono, fontSize:12, fontWeight:500, color:V.ink0 }}>{m.v}</span>
              <span style={{ ...mono, fontSize:10, color:m.up?V.gain:V.loss, minWidth:44, textAlign:"right" }}>{m.d}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Explore nav */}
      <div style={{ ...glassCard({ padding:16 }) }}>
        <p className="label" style={{ marginBottom:12 }}>Explore</p>
        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
          {[
            { id:"top15"     as Tab, label:"Top 15 Stocks",  color:V.gold, dimBg:V.goldDim,                  dimWire:"rgba(232,160,48,0.2)" },
            { id:"portfolio" as Tab, label:"My Portfolio",   color:V.ame,  dimBg:V.ameDim,                   dimWire:V.ameWire },
            { id:"ai"        as Tab, label:"AI Signals",     color:"#7EB6FF", dimBg:V.arcDim,                dimWire:V.arcWire },
          ].map(item => (
            <button key={item.id} onClick={() => setTab(item.id)}
              style={{ display:"flex", alignItems:"center", justifyContent:"space-between", background:item.dimBg, border:`1px solid ${item.dimWire}`, borderRadius:10, color:item.color, padding:"9px 13px", cursor:"pointer", fontSize:12, fontWeight:500, transition:"all 0.18s" }}
              onMouseEnter={e => e.currentTarget.style.opacity = "0.8"}
              onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
              <span>{item.label}</span>
              <ChevronRight size={13}/>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  /* ── Tab icon ───────────────────────────────────────────── */
  const TabIcon = ({ id, size = 20, active }: { id:Tab; size?:number; active:boolean }) => {
    const sw = active ? 2 : 1.5;
    if (id === "markets")   return <LayoutDashboard size={size} strokeWidth={sw}/>;
    if (id === "top15")     return <Trophy          size={size} strokeWidth={sw}/>;
    if (id === "portfolio") return <BookOpen        size={size} strokeWidth={sw}/>;
    if (id === "ai")        return <Brain           size={size} strokeWidth={sw}/>;
    return null;
  };

  return (
    <div style={{ minHeight:"100vh", background:V.d0, color:V.ink1, fontFamily:"'Bricolage Grotesque',system-ui,sans-serif" }}>

      {/* ══════════════════════════════════════════
          HEADER
          ══════════════════════════════════════════ */}
      <header style={{ position:"sticky", top:0, zIndex:100, background:"rgba(5,8,16,0.92)", backdropFilter:"blur(40px) saturate(2.5)", WebkitBackdropFilter:"blur(40px) saturate(2.5)", borderBottom:`1px solid ${V.w2}` }}>
        {/* Index ticker strip */}
        <div style={{ display:"flex", alignItems:"center", gap:16, padding:"0 20px", height:36, borderBottom:`1px solid ${V.w1}`, overflow:"hidden" }}>
          <div className="scroll-x" style={{ flex:1, display:"flex", alignItems:"center", gap:20 }}>
            {INDICES.map(m => (
              <div key={m.n} style={{ display:"flex", alignItems:"center", gap:5, flexShrink:0 }}>
                <span style={{ ...mono, fontSize:9, color:V.ink4, textTransform:"uppercase", letterSpacing:"0.08em" }}>{m.n}</span>
                <span style={{ ...mono, fontSize:10, fontWeight:500, color:V.ink1 }}>{m.v}</span>
                <span style={{ ...mono, fontSize:9, color:m.up?V.gain:V.loss }}>{m.d}</span>
              </div>
            ))}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:5, flexShrink:0 }}>
            <div style={{ width:5, height:5, borderRadius:"50%", background:V.gain, animation:"live-pulse 2.5s ease-in-out infinite" }} />
            <span style={{ ...mono, fontSize:8, color:V.ink4, textTransform:"uppercase", letterSpacing:"0.12em" }}>Live</span>
          </div>
        </div>

        {/* Main header row */}
        <div style={{ display:"flex", alignItems:"center", gap:14, padding:"0 20px", height:52 }}>
          {/* Logo */}
          <div style={{ display:"flex", alignItems:"center", gap:9, flexShrink:0 }}>
            <div style={{ width:30, height:30, borderRadius:9, background:"linear-gradient(135deg,#4F8EF7,#00C896)", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 2px 12px rgba(79,142,247,0.35), 0 0 0 1px rgba(79,142,247,0.2)" }}>
              <Zap size={14} color="#fff" strokeWidth={2.5}/>
            </div>
            <div style={{ lineHeight:1 }}>
              <div style={{ ...mono, fontSize:12, fontWeight:500, letterSpacing:"0.14em", color:V.ink0 }}>VERTEX</div>
              <div style={{ ...mono, fontSize:8, color:V.ink4, letterSpacing:"0.20em", marginTop:1 }}>TERMINAL</div>
            </div>
          </div>

          {/* Desktop tab bar */}
          <div style={{ display:"flex", alignItems:"center", gap:0, marginLeft:8 }}>
            {TABS.map(t => {
              const active = tab === t.id;
              return (
                <button key={t.id} onClick={() => setTab(t.id)}
                  style={{ display:"flex", alignItems:"center", gap:6, padding:"0 14px", height:52, background:"none", border:"none", borderBottom:active?`2px solid ${V.arc}`:"2px solid transparent", color:active?V.ink0:V.ink3, cursor:"pointer", fontSize:13, fontWeight:active?600:400, transition:"all 0.2s", whiteSpace:"nowrap", letterSpacing:"0.01em" }}>
                  <TabIcon id={t.id} size={15} active={active}/>{t.label}
                </button>
              );
            })}
          </div>

          <div style={{ flex:1 }}/>

          {/* Search */}
          <div ref={searchRef} style={{ position:"relative" }}>
            <button onClick={() => setShowSearch(s=>!s)}
              style={{ background:showSearch?"rgba(79,142,247,0.10)":"none", border:`1px solid ${showSearch?V.arcWire:"transparent"}`, borderRadius:9, cursor:"pointer", color:showSearch?"#7EB6FF":V.ink3, padding:"6px 10px", display:"flex", alignItems:"center", gap:6, fontSize:12, minHeight:36, transition:"all 0.2s" }}>
              <Search size={16}/><span style={{ display:"none" }} className="sm-show">Search</span>
            </button>

            {showSearch && (
              <div style={{ position:"absolute", right:0, top:46, width:"min(360px,93vw)", background:"rgba(8,13,24,0.97)", backdropFilter:"blur(40px)", WebkitBackdropFilter:"blur(40px)", border:`1px solid ${V.w3}`, borderRadius:16, overflow:"hidden", zIndex:200, boxShadow:"0 24px 64px rgba(0,0,0,0.75)", animation:"vx-rise 0.2s var(--ease-expo) both" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, padding:"12px 16px", borderBottom:`1px solid ${V.w1}` }}>
                  <Search size={14} color={V.ink3}/>
                  <input autoFocus value={search} onChange={e=>setSearch(e.target.value)} className="vx-input" placeholder="Search ticker or company…"
                    style={{ background:"transparent", border:"none", boxShadow:"none", padding:"0", borderRadius:0, fontSize:14 }}/>
                  {searching && <RefreshCw size={12} color={V.ink3} className="vx-spin"/>}
                  {search && <button onClick={()=>setSearch("")} style={{ background:"none", border:"none", cursor:"pointer", color:V.ink3, padding:2, borderRadius:4, display:"flex" }}><X size={13}/></button>}
                </div>
                {results.map(t => (
                  <button key={t} onClick={() => go(t)}
                    style={{ display:"flex", alignItems:"center", justifyContent:"space-between", width:"100%", padding:"12px 16px", background:"none", border:"none", cursor:"pointer", minHeight:50, textAlign:"left", transition:"background 0.15s" }}
                    className="row-hover">
                    <span style={{ ...mono, fontSize:14, fontWeight:500, color:V.ink0 }}>{t}</span>
                    <span style={{ fontSize:12, color:V.ink3, maxWidth:180, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{MOCK[t]?.name ?? ""}</span>
                  </button>
                ))}
                {results.length === 0 && search.length > 0 && !searching && (
                  <p style={{ ...mono, fontSize:11, color:V.ink4, textAlign:"center", padding:"16px 14px" }}>No results for "{search}"</p>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ══════════════════════════════════════════
          MAIN CONTENT
          ══════════════════════════════════════════ */}
      <main style={{ paddingBottom:80, position:"relative", zIndex:1 }}>
        {/* Full-width panels */}
        {tab === "top15"     && <Top15/>}
        {tab === "portfolio" && <MyStocks/>}

        {/* Two-col panels */}
        {(tab === "markets" || tab === "ai") && (
          <div style={{ maxWidth:1280, margin:"0 auto", padding:"24px 16px" }}>
            <div className="vx-two-col" style={{ display:"flex", flexDirection:"column", gap:20 }}>
              <div style={{ minWidth:0 }}>
                {tab === "markets" && <MarketsPanel/>}
                {tab === "ai"      && <AIPanel/>}
              </div>
              <div id="vx-sidebar" style={{ display:"none" }}>
                <Sidebar/>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ══════════════════════════════════════════
          MOBILE BOTTOM NAV
          ══════════════════════════════════════════ */}
      <nav className="vx-bottom-nav">
        <div style={{ display:"flex", alignItems:"stretch" }}>
          {TABS.map(t => {
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"9px 4px 7px", gap:3, background:"none", border:"none", cursor:"pointer", minHeight:58, color:active?"#7EB6FF":V.ink4, transition:"color 0.2s" }}>
                <div style={{ padding:"3px 12px", borderRadius:18, background:active?"rgba(79,142,247,0.12)":"transparent", transition:"background 0.25s", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <TabIcon id={t.id} size={22} active={active}/>
                </div>
                <span style={{ fontSize:10, fontWeight:active?600:400, letterSpacing:"0.01em" }}>{t.short}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <style>{`
        @keyframes vx-rise  { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes live-pulse{ 0%,100%{opacity:1;transform:scale(1);box-shadow:0 0 0 0 rgba(0,200,150,.5)} 50%{opacity:.5;transform:scale(.75);box-shadow:0 0 0 4px rgba(0,200,150,0)} }
        @keyframes spin     { to{transform:rotate(360deg)} }
        @keyframes shimmer  { 0%{background-position:-400% 0}100%{background-position:400% 0} }
        *, *::before, *::after { box-sizing:border-box; }
        input { font-size:16px; }
        button,[role="button"]{ touch-action:manipulation; }
        ::-webkit-scrollbar{width:2px;height:2px}
        ::-webkit-scrollbar-thumb{background:rgba(130,180,255,0.12);border-radius:99px}
        .row-hover:hover { background: var(--depth-hover, #1E2D40) !important; }
        @media(min-width:1024px){
          .vx-two-col { display:grid!important; grid-template-columns:1fr 296px!important; gap:22px; align-items:start; }
          #vx-sidebar { display:block!important; }
        }
      `}</style>
    </div>
  );
}
