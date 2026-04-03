"use client";

import {
  useState, useEffect, useCallback, useRef,
  memo, useMemo, type SetStateAction, type Dispatch,
} from "react";
import dynamic from "next/dynamic";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  Search, TrendingUp, TrendingDown, Brain, Star, StarOff,
  Zap, AlertTriangle, Trophy, BookOpen, X,
  LayoutDashboard, ChevronRight, ExternalLink,
} from "lucide-react";
import { CountdownBar } from "@/components/CountdownBar";

const Top15    = dynamic(() => import("@/components/Top15"),    { ssr: false, loading: () => <PanelSkeleton /> });
const MyStocks = dynamic(() => import("@/components/MyStocks"), { ssr: false, loading: () => <PanelSkeleton /> });

function PanelSkeleton() {
  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
      {[180, 60, 60, 60, 60].map((h, i) => (
        <div key={i} className="skel" style={{ height: h, borderRadius: 12 }} />
      ))}
    </div>
  );
}

interface Quote {
  ticker: string; name: string; price: number; change: number;
  changePct: number; high: number; low: number; open: number; volume: number;
}
interface Bar { date: string; close: number; }
type Tab = "markets" | "ai" | "top15" | "portfolio";

const API_KEY = "1xwzcvUOF9pft6PRNylO2Xc6X2QeQCGr";
const BASE    = "https://api.polygon.io";
const TICKERS = ["AAPL", "MSFT", "NVDA", "GOOGL", "META", "TSLA", "AMZN", "AMD"];

const MOCK: Record<string, Quote> = {
  AAPL:  { ticker:"AAPL",  name:"Apple Inc.",            price:228.52, change: 3.21, changePct: 1.42, high:229.88, low:225.12, open:225.80, volume:58_234_100 },
  MSFT:  { ticker:"MSFT",  name:"Microsoft Corp.",        price:415.32, change:-2.18, changePct:-0.52, high:418.55, low:413.22, open:417.50, volume:21_456_200 },
  NVDA:  { ticker:"NVDA",  name:"NVIDIA Corp.",           price:875.42, change:24.63, changePct: 2.90, high:881.20, low:851.30, open:853.10, volume:42_118_700 },
  GOOGL: { ticker:"GOOGL", name:"Alphabet Inc.",          price:178.94, change: 1.43, changePct: 0.81, high:180.12, low:177.34, open:177.51, volume:18_932_400 },
  META:  { ticker:"META",  name:"Meta Platforms",         price:554.78, change: 8.92, changePct: 1.63, high:557.33, low:545.21, open:546.10, volume:14_209_300 },
  TSLA:  { ticker:"TSLA",  name:"Tesla Inc.",             price:248.50, change:-9.23, changePct:-3.58, high:260.42, low:247.11, open:258.10, volume:89_234_100 },
  AMZN:  { ticker:"AMZN",  name:"Amazon.com Inc.",        price:201.17, change:-0.88, changePct:-0.44, high:203.21, low:200.54, open:202.05, volume:29_847_100 },
  AMD:   { ticker:"AMD",   name:"Advanced Micro Devices", price:162.34, change: 5.82, changePct: 3.72, high:163.80, low:156.42, open:157.10, volume:45_123_200 },
};

const AI_LONG = [
  { ticker:"NVDA", name:"NVIDIA Corp.",   conf:91, target:950, up: 8.5, thesis:"AI infrastructure capex surging. Blackwell GPU demand exceeds supply 3x. Data center revenue +120% YoY.", tags:["Blackwell","Azure Win","Q4 Beat"] },
  { ticker:"META", name:"Meta Platforms", conf:84, target:620, up:11.8, thesis:"Llama monetisation accelerating. Reels ad revenue +40% QoQ. Sustained cost discipline expanding margins.", tags:["Llama 4","Ad Beat","Cost Cuts"] },
  { ticker:"AMD",  name:"AMD",            conf:78, target:195, up:20.1, thesis:"MI300X gaining enterprise GPU traction. Data center +80% YoY. TSMC capacity locked through 2025.", tags:["MI400","Design Wins","CPU Share"] },
];
const AI_SHORT = [
  { ticker:"TSLA", name:"Tesla Inc.",  conf:76, target:195, down:-21.6, thesis:"EV demand soft. Brutal price war in China. Cybertruck ramp costlier than expected.", tags:["China","Margins","Competition"] },
  { ticker:"AMZN", name:"Amazon.com", conf:61, target:180, down:-10.5, thesis:"AWS growth decelerating vs peers. Retail margins thin. Advertising CPM pressure rising.", tags:["AWS Slowdown","Ad CPMs","FTC"] },
];

const INDICES = [
  { n:"S&P 500", v:"5,842.47", d:"+0.74%", up:true  },
  { n:"NASDAQ",  v:"18,843",   d:"+1.12%", up:true  },
  { n:"DJIA",    v:"43,189",   d:"+0.42%", up:true  },
  { n:"VIX",     v:"14.32",    d:"-2.18%", up:false },
  { n:"10Y",     v:"4.28%",    d:"+0.03%", up:true  },
  { n:"BTC",     v:"94,120",   d:"+2.31%", up:true  },
];

const TABS: { id: Tab; label: string; short: string }[] = [
  { id:"markets",   label:"Markets",    short:"Markets"   },
  { id:"top15",     label:"Top 15",     short:"Top 15"    },
  { id:"portfolio", label:"Portfolio",  short:"Portfolio" },
  { id:"ai",        label:"AI Signals", short:"AI"        },
];

interface SnapTicker {
  ticker:  string;
  day:     { c: number; o: number; h: number; l: number; v: number };
  prevDay: { c: number };
}
interface AggBar { c: number; o: number; h: number; l: number; v: number; t: number; }

async function polyFetch<T>(path: string): Promise<T | null> {
  try {
    const sep = path.includes("?") ? "&" : "?";
    const r = await fetch(`${BASE}${path}${sep}apiKey=${API_KEY}`);
    return r.ok ? (r.json() as Promise<T>) : null;
  } catch {
    return null;
  }
}

async function loadBars(ticker: string): Promise<Bar[]> {
  const to   = new Date().toISOString().split("T")[0];
  const from = new Date(Date.now() - 92 * 86_400_000).toISOString().split("T")[0];
  const d = await polyFetch<{ results?: AggBar[] }>(
    `/v2/aggs/ticker/${ticker}/range/1/day/${from}/${to}?adjusted=true&sort=asc&limit=120`
  );
  if (!d?.results?.length) return [];
  return d.results.map(b => ({ date: new Date(b.t).toISOString().split("T")[0], close: b.c }));
}

function seedBars(base: number, days = 90): Bar[] {
  const out: Bar[] = [];
  let p = base * 0.81;
  let seed = Math.round(base * 137);
  const rng = () => {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    return (seed >>> 0) / 0xffffffff;
  };
  const now = new Date();
  for (let i = days; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    p += (rng() - 0.47) * 0.022 * p;
    out.push({ date: d.toISOString().split("T")[0], close: +p.toFixed(2) });
  }
  return out;
}

async function loadQuote(ticker: string, bars?: Bar[]): Promise<Quote> {
  const name = MOCK[ticker]?.name ?? ticker;

  const snap = await polyFetch<{ ticker?: SnapTicker }>(
    `/v2/snapshot/locale/us/markets/stocks/tickers/${ticker}`
  );
  const sd = snap?.ticker;

  if (sd && sd.day?.c > 0 && sd.prevDay?.c > 0) {
    const price = sd.day.c;
    const prev  = sd.prevDay.c;
    const chg   = price - prev;
    return {
      ticker, name, price,
      change:    +chg.toFixed(2),
      changePct: +((chg / prev) * 100).toFixed(2),
      high:   sd.day.h || price,
      low:    sd.day.l || price,
      open:   sd.day.o || price,
      volume: sd.day.v || 0,
    };
  }

  const b = bars?.length ? bars : await loadBars(ticker);
  if (b.length >= 2) {
    const last = b[b.length - 1];
    const prev = b[b.length - 2];
    const chg  = last.close - prev.close;
    return {
      ticker, name,
      price:     last.close,
      change:    +chg.toFixed(2),
      changePct: +((chg / prev.close) * 100).toFixed(2),
      high:   sd?.day?.h && sd.day.h > 0 ? sd.day.h : +(last.close * 1.005).toFixed(2),
      low:    sd?.day?.l && sd.day.l > 0 ? sd.day.l : +(last.close * 0.995).toFixed(2),
      open:   sd?.day?.o && sd.day.o > 0 ? sd.day.o : prev.close,
      volume: sd?.day?.v && sd.day.v > 0 ? sd.day.v : (MOCK[ticker]?.volume ?? 0),
    };
  }

  return MOCK[ticker] ?? { ticker, name, price:0, change:0, changePct:0, high:0, low:0, open:0, volume:0 };
}

async function bulkPrices(
  tickers: string[]
): Promise<Record<string, { price: number; changePct: number }>> {
  const unique = [...new Set(tickers)];
  const result: Record<string, { price: number; changePct: number }> = {};

  const snap = await polyFetch<{ tickers?: SnapTicker[] }>(
    `/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${unique.join(",")}`
  );

  const snapMap: Record<string, SnapTicker> = {};
  if (snap?.tickers) {
    for (const s of snap.tickers) snapMap[s.ticker] = s;
  }

  const needBars: string[] = [];
  for (const t of unique) {
    const s = snapMap[t];
    if (s && s.day?.c > 0 && s.prevDay?.c > 0) {
      result[t] = {
        price:     s.day.c,
        changePct: +((s.day.c - s.prevDay.c) / s.prevDay.c * 100).toFixed(2),
      };
    } else {
      needBars.push(t);
    }
  }

  if (needBars.length) {
    const barData = await Promise.all(
      needBars.map(t => loadBars(t).then(bars => ({ t, bars })))
    );
    for (const { t, bars } of barData) {
      if (bars.length >= 2) {
        const last = bars[bars.length - 1];
        const prev = bars[bars.length - 2];
        result[t] = {
          price:     last.close,
          changePct: +((last.close - prev.close) / prev.close * 100).toFixed(2),
        };
      }
    }
  }
  return result;
}

async function searchTickers(q: string): Promise<string[]> {
  try {
    const r = await fetch(
      `${BASE}/v3/reference/tickers?search=${encodeURIComponent(q)}&active=true&limit=7&market=stocks&apiKey=${API_KEY}`
    );
    if (r.ok) {
      const d = await r.json() as { results?: { ticker: string }[] };
      if (d?.results?.length) return d.results.map(x => x.ticker);
    }
  } catch { /* ignore */ }
  return TICKERS.filter(t =>
    t.includes(q.toUpperCase()) || MOCK[t]?.name.toLowerCase().includes(q.toLowerCase())
  );
}

const f$ = (n: number) =>
  new Intl.NumberFormat("en-US", { style:"currency", currency:"USD", minimumFractionDigits:2 }).format(n);
const fp = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
const fv = (n: number) =>
  n >= 1e9 ? `${(n/1e9).toFixed(2)}B` :
  n >= 1e6 ? `${(n/1e6).toFixed(2)}M` :
  n >= 1e3 ? `${(n/1e3).toFixed(1)}K` : String(n);

const V = {
  void:"#050810", d0:"#050810", d1:"#080D18", d2:"#0C1220", d3:"#101828", d4:"#151F30", dh:"#1E2D40",
  w1:"rgba(130,180,255,0.055)", w2:"rgba(130,180,255,0.10)", w3:"rgba(130,180,255,0.16)",
  ink0:"#F2F6FF", ink1:"#C8D5E8", ink2:"#7A9CBF", ink3:"#3D5A7A", ink4:"#1F3550",
  gain:"#00C896",  gainDim:"rgba(0,200,150,0.08)",  gainWire:"rgba(0,200,150,0.20)",  gainGlow:"rgba(0,200,150,0.12)",
  loss:"#E8445A",  lossDim:"rgba(232,68,90,0.08)",   lossWire:"rgba(232,68,90,0.20)",  lossGlow:"rgba(232,68,90,0.10)",
  arc:"#4F8EF7",   arcDim:"rgba(79,142,247,0.10)",   arcWire:"rgba(79,142,247,0.22)",
  gold:"#E8A030",  goldDim:"rgba(232,160,48,0.10)",
  ame:"#9B72F5",   ameDim:"rgba(155,114,245,0.10)",  ameWire:"rgba(155,114,245,0.22)",
};
const mono: React.CSSProperties = { fontFamily: "'Geist Mono','Courier New',monospace" };

const glassCard = (extra?: React.CSSProperties): React.CSSProperties => ({
  background: "linear-gradient(145deg,rgba(255,255,255,0.030) 0%,rgba(255,255,255,0.012) 100%)",
  backdropFilter: "blur(24px) saturate(1.5)",
  WebkitBackdropFilter: "blur(24px) saturate(1.5)",
  border: `1px solid ${V.w2}`,
  borderRadius: 16,
  boxShadow: "0 4px 16px rgba(0,0,0,0.55), 0 1px 3px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)",
  position: "relative" as const,
  overflow: "hidden",
  ...extra,
});

function ChartTip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:V.d3, border:`1px solid ${V.w3}`, borderRadius:10, padding:"8px 12px", boxShadow:"0 8px 32px rgba(0,0,0,0.65)" }}>
      <p style={{ ...mono, fontSize:9, color:V.ink3, marginBottom:3, letterSpacing:"0.06em", textTransform:"uppercase" }}>{label}</p>
      <p style={{ ...mono, fontSize:14, color:V.ink0, fontWeight:500, letterSpacing:"-0.02em" }}>{f$(payload[0].value)}</p>
    </div>
  );
}

function ConfBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
      <div style={{ flex:1, height:2, background:"rgba(255,255,255,0.05)", borderRadius:99, overflow:"hidden" }}>
        <div style={{ width:`${pct}%`, height:"100%", background:color, borderRadius:99, transition:"width 1s cubic-bezier(0.16,1,0.3,1)" }} />
      </div>
      <span style={{ ...mono, fontSize:10, color, minWidth:30, textAlign:"right" }}>{pct}%</span>
    </div>
  );
}

function TabIcon({ id, size = 20, active }: { id: Tab; size?: number; active: boolean }) {
  const sw = active ? 2 : 1.5;
  if (id === "markets")   return <LayoutDashboard size={size} strokeWidth={sw} />;
  if (id === "top15")     return <Trophy          size={size} strokeWidth={sw} />;
  if (id === "portfolio") return <BookOpen        size={size} strokeWidth={sw} />;
  if (id === "ai")        return <Brain           size={size} strokeWidth={sw} />;
  return null;
}

function YahooBtn({ ticker, compact = false }: { ticker: string; compact?: boolean }) {
  return (
    <a
      href={`https://finance.yahoo.com/quote/${ticker}`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={e => e.stopPropagation()}
      style={{
        display:"inline-flex", alignItems:"center", gap: compact ? 3 : 4,
        padding: compact ? "2px 7px" : "4px 9px",
        borderRadius: 6,
        background: "rgba(79,142,247,0.08)",
        border: "1px solid rgba(79,142,247,0.18)",
        color: "#7EB6FF",
        textDecoration: "none",
        fontSize: compact ? 9 : 10,
        fontFamily: "'Geist Mono','Courier New',monospace",
        whiteSpace: "nowrap",
        transition: "background 0.15s",
        flexShrink: 0,
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(79,142,247,0.16)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(79,142,247,0.08)"; }}
    >
      <ExternalLink size={compact ? 8 : 10} />
      {!compact && "Yahoo Finance"}
    </a>
  );
}

function MiniChart({ ticker, isGain }: { ticker: string; isGain: boolean }) {
  const [bars,  setBars]  = useState<Bar[]>(() => seedBars(MOCK[ticker]?.price ?? 100, 30));
  const [ready, setReady] = useState(false);
  const color  = isGain ? V.gain : V.loss;
  const gradId = `mc-${ticker}-${isGain ? "g" : "l"}`;

  useEffect(() => {
    let cancelled = false;
    setBars(seedBars(MOCK[ticker]?.price ?? 100, 30));
    setReady(false);
    loadBars(ticker).then(data => {
      if (!cancelled) { setBars(data.slice(-30)); setReady(true); }
    });
    return () => { cancelled = true; };
  }, [ticker]);

  return (
    <div style={{ height:72, marginTop:14, marginBottom:4, opacity: ready ? 1 : 0.65, transition:"opacity 0.4s" }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={bars} margin={{ top:2, right:1, left:0, bottom:0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={color} stopOpacity={0.22} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="1 6" stroke="rgba(130,180,255,0.04)" vertical={false} />
          <Tooltip content={<ChartTip />} cursor={{ stroke: `${color}50`, strokeWidth:1 }} />
          <Area type="monotone" dataKey="close" stroke={color} strokeWidth={1.5}
            fill={`url(#${gradId})`} dot={false} isAnimationActive={false}
            activeDot={{ r:3, fill:color, stroke:V.void, strokeWidth:1.5 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function SignalCard({
  ticker, name, conf, target, upside, downside, thesis, tags, isGain, rank, go,
}: {
  ticker: string; name: string; conf: number; target: number;
  upside?: number; downside?: number;
  thesis: string; tags: string[]; isGain: boolean; rank: number;
  go: (t: string) => void;
}) {
  const color = isGain ? V.gain : V.loss;
  const dim   = isGain ? V.gainDim : V.lossDim;
  const wire  = isGain ? V.gainWire : V.lossWire;
  const priceLine = upside != null
    ? `+${upside.toFixed(1)}% upside`
    : `${downside!.toFixed(1)}% downside`;

  return (
    <div
      style={{ ...glassCard({ padding:18 }), cursor:"pointer", transition:"border-color 0.25s, transform 0.2s" }}
      onClick={() => go(ticker)}
      onMouseEnter={e => { e.currentTarget.style.borderColor = wire; (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = V.w2;  (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
    >
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:8 }}>
        <div style={{ display:"flex", alignItems:"flex-start", gap:8 }}>
          <span style={{ ...mono, fontSize:10, color:V.ink4, marginTop:3 }}>#{rank}</span>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:7, flexWrap:"wrap" }}>
              <p style={{ ...mono, fontSize:15, fontWeight:500, color:"#7EB6FF", letterSpacing:"-0.02em" }}>{ticker}</p>
              <YahooBtn ticker={ticker} compact />
            </div>
            <p style={{ color:V.ink2, fontSize:11, marginTop:1 }}>{name}</p>
          </div>
        </div>
        <div style={{ textAlign:"right", flexShrink:0 }}>
          <p style={{ ...mono, fontSize:9, color:V.ink3, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:2 }}>Target</p>
          <p style={{ ...mono, fontSize:16, fontWeight:500, color, letterSpacing:"-0.02em" }}>{f$(target)}</p>
          <p style={{ ...mono, fontSize:10, color }}>{priceLine}</p>
        </div>
      </div>
      <MiniChart ticker={ticker} isGain={isGain} />
      <ConfBar pct={conf} color={color} />
      <p style={{ color:V.ink2, fontSize:12, lineHeight:1.65, margin:"12px 0 10px" }}>{thesis}</p>
      <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
        {tags.map(t => (
          <span key={t} style={{ ...mono, fontSize:9, padding:"3px 9px", borderRadius:99, background:dim, color, border:`1px solid ${wire}`, display:"inline-flex", alignItems:"center", gap:3 }}>
            {!isGain && <AlertTriangle size={8} style={{ display:"inline", verticalAlign:"middle", marginRight:2 }} />}{t}
          </span>
        ))}
      </div>
    </div>
  );
}

interface MarketsPanelProps {
  ticker: string; quote: Quote; bars: Bar[]; loading: boolean;
  up: boolean; lineColor: string; watched: boolean; watchlist: string[];
  livePrices: Record<string, { price: number; changePct: number }>;
  go: (t: string) => void;
  toggleWatch: (t: string) => void;
  refreshMarkets: () => Promise<void>;
}

const MarketsPanel = memo(function MarketsPanel({
  ticker, quote, bars, loading, up, lineColor, watched, watchlist,
  livePrices, go, toggleWatch, refreshMarkets,
}: MarketsPanelProps) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>

      <div style={{ ...glassCard(), padding:0 }}>
        <div style={{ position:"absolute", top:-60, right:-60, width:240, height:240, borderRadius:"50%", background: up ? V.gainGlow : V.lossGlow, filter:"blur(60px)", pointerEvents:"none", zIndex:0 }} />
        <div style={{ position:"relative", zIndex:1, padding:"20px 20px 0" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12 }}>
            <div style={{ minWidth:0, flex:1 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4, flexWrap:"wrap" }}>
                <h1 style={{ ...mono, fontSize:"clamp(24px,5vw,42px)", fontWeight:500, letterSpacing:"-0.04em", lineHeight:1, color:V.ink0, flexShrink:0 }}>{ticker}</h1>
                <span style={{ ...mono, fontSize:11, padding:"3px 8px", borderRadius:6, background: up ? V.gainDim : V.lossDim, color: up ? V.gain : V.loss, border:`1px solid ${up ? V.gainWire : V.lossWire}`, display:"inline-flex", alignItems:"center", gap:3, flexShrink:0 }}>
                  {up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                  {fp(quote.changePct)}
                </span>
                <YahooBtn ticker={ticker} />
                <button onClick={() => toggleWatch(ticker)}
                  style={{ background:"none", border:"none", cursor:"pointer", padding:4, display:"flex", alignItems:"center", minWidth:36, minHeight:36, justifyContent:"center", borderRadius:8, flexShrink:0 }}>
                  {watched ? <Star size={17} color={V.gold} fill={V.gold} /> : <StarOff size={17} color={V.ink3} />}
                </button>
              </div>
              <p style={{ color:V.ink2, fontSize:13 }}>{quote.name}</p>
            </div>
            <div style={{ textAlign:"right", flexShrink:0 }}>
              {loading
                ? <div className="skel" style={{ width:150, height:44, borderRadius:8 }} />
                : (
                  <>
                    <div style={{ ...mono, fontSize:"clamp(26px,4.5vw,40px)", fontWeight:500, letterSpacing:"-0.04em", lineHeight:1, color:V.ink0 }}>{f$(quote.price)}</div>
                    <div style={{ ...mono, fontSize:12, color: up ? V.gain : V.loss, marginTop:4 }}>{quote.change >= 0 ? "+" : ""}{f$(quote.change)} today</div>
                  </>
                )}
            </div>
          </div>

          <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch", marginLeft:-20, marginRight:-20, paddingLeft:20, paddingRight:20, marginTop:16 }}>
            <div style={{ display:"flex", gap:6, minWidth:"max-content", paddingBottom:16 }}>
              {[
                { l:"Open",   v:f$(quote.open) },
                { l:"High",   v:f$(quote.high) },
                { l:"Low",    v:f$(quote.low) },
                { l:"Volume", v:fv(quote.volume) },
                { l:"Prev",   v:f$(quote.price - quote.change) },
              ].map(s => (
                <div key={s.l} style={{ background:"rgba(255,255,255,0.035)", border:`1px solid ${V.w1}`, borderRadius:9, padding:"8px 12px", flexShrink:0 }}>
                  <p style={{ ...mono, fontSize:8, color:V.ink4, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:3 }}>{s.l}</p>
                  <p style={{ ...mono, fontSize:12, fontWeight:500, color:V.ink0 }}>{s.v}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ position:"relative", zIndex:1 }}>
          <div style={{ display:"flex", alignItems:"center", padding:"0 20px 10px", gap:6 }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background:lineColor, animation:"live-pulse 2.5s ease-in-out infinite" }} />
            <span style={{ ...mono, fontSize:9, color:V.ink3, textTransform:"uppercase", letterSpacing:"0.1em" }}>90-day  x  Polygon.io</span>
          </div>
          {loading
            ? <div className="skel" style={{ height:200, margin:"0 16px 16px", borderRadius:10 }} />
            : (
              <div className="vx-chart-main" style={{ height:200, padding:"0 4px 16px" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={bars} margin={{ top:4, right:8, left:0, bottom:0 }}>
                    <defs>
                      <linearGradient id="vxGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor={lineColor} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="2 8" stroke="rgba(130,180,255,0.04)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill:V.ink4, fontSize:8, fontFamily:"Geist Mono" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fill:V.ink4, fontSize:8, fontFamily:"Geist Mono" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `$${v.toFixed(0)}`} width={44} domain={["auto","auto"]} />
                    <Tooltip content={<ChartTip />} cursor={{ stroke:V.w3, strokeWidth:1 }} />
                    <Area type="monotone" dataKey="close" stroke={lineColor} strokeWidth={1.5} fill="url(#vxGrad)" dot={false} activeDot={{ r:5, fill:lineColor, stroke:V.void, strokeWidth:2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
        </div>
      </div>

      <CountdownBar onRefresh={refreshMarkets} label="Next market update" />

      <div>
        <p style={{ ...mono, fontSize:9, color:V.ink3, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:10 }}>Quick Select</p>
        <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch", marginLeft:-16, marginRight:-16, paddingLeft:16, paddingRight:16 }}>
          <div style={{ display:"flex", gap:6, minWidth:"max-content", paddingBottom:2 }}>
            {TICKERS.map(t => {
              const live       = livePrices[t];
              const changePct  = live?.changePct ?? MOCK[t]?.changePct ?? 0;
              const pos        = changePct >= 0;
              const active     = t === ticker;
              return (
                <button key={t} onClick={() => go(t)}
                  style={{ flexShrink:0, display:"flex", flexDirection:"column", alignItems:"flex-start", padding:"9px 12px", borderRadius:10, border:"1px solid", cursor:"pointer", minWidth:64, minHeight:48, transition:"all 0.2s",
                    background:  active ? "linear-gradient(145deg,rgba(79,142,247,0.12),rgba(79,142,247,0.06))" : "rgba(255,255,255,0.025)",
                    borderColor: active ? V.arcWire : V.w1 }}>
                  <span style={{ ...mono, fontSize:12, fontWeight:500, color: active ? "#7EB6FF" : V.ink0 }}>{t}</span>
                  <span style={{ ...mono, fontSize:9, color: pos ? V.gain : V.loss, marginTop:2 }}>{fp(changePct)}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
          <div style={{ display:"flex", alignItems:"center", gap:7 }}>
            <Star size={13} color={V.gold} fill={V.gold} />
            <span style={{ fontSize:13, fontWeight:600, color:V.ink0 }}>Watchlist</span>
          </div>
          <span style={{ ...mono, fontSize:10, color:V.ink3 }}>{watchlist.length} tracked</span>
        </div>
        <div style={{ ...glassCard({ overflow:"hidden" }) }}>
          {watchlist.length === 0 && (
            <p style={{ color:V.ink3, fontSize:13, textAlign:"center", padding:"24px 20px" }}>Star a ticker to add it here</p>
          )}
          {watchlist.map((t, i) => {
            const live      = livePrices[t];
            const price     = live?.price     ?? MOCK[t]?.price     ?? 0;
            const changePct = live?.changePct ?? MOCK[t]?.changePct ?? 0;
            const pos = changePct >= 0;
            return (
              <button key={t} onClick={() => go(t)}
                style={{ display:"flex", justifyContent:"space-between", alignItems:"center", width:"100%", padding:"12px 16px", background: t === ticker ? "linear-gradient(90deg,rgba(79,142,247,0.08),transparent)" : "none", border:"none", cursor:"pointer", minHeight:54, textAlign:"left", transition:"background 0.2s", borderLeft: t === ticker ? `2px solid ${V.arc}` : "2px solid transparent", borderBottom: i < watchlist.length - 1 ? `1px solid ${V.w1}` : "none" }}
                className="row-hover">
                <div>
                  <p style={{ ...mono, fontSize:13, fontWeight:500, color: t === ticker ? "#7EB6FF" : V.ink0 }}>{t}</p>
                  <p style={{ color:V.ink3, fontSize:11, marginTop:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:"min(180px,40vw)" }}>{MOCK[t]?.name ?? t}</p>
                </div>
                <div style={{ textAlign:"right", marginLeft:8 }}>
                  <p style={{ ...mono, fontSize:13, fontWeight:500, color:V.ink0 }}>{price > 0 ? f$(price) : "---"}</p>
                  <p style={{ ...mono, fontSize:11, color: pos ? V.gain : V.loss, marginTop:1 }}>{fp(changePct)}</p>
                </div>
              </button>
            );
          })}
          <div style={{ padding:"10px 14px", borderTop:`1px solid ${V.w1}`, display:"flex", flexWrap:"wrap", gap:5 }}>
            {TICKERS.filter(t => !watchlist.includes(t)).map(t => (
              <button key={t} onClick={() => toggleWatch(t)}
                style={{ ...mono, fontSize:10, padding:"5px 10px", borderRadius:6, background:"transparent", border:`1px solid ${V.w1}`, color:V.ink3, cursor:"pointer", minHeight:32, transition:"all 0.2s" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = V.arcWire; e.currentTarget.style.color = "#7EB6FF"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = V.w1;     e.currentTarget.style.color = V.ink3; }}>
                +{t}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <p style={{ fontSize:13, fontWeight:600, color:V.ink0, marginBottom:10 }}>Global Markets</p>
        <div style={{ ...glassCard({ overflow:"hidden" }) }}>
          {INDICES.map((m, i) => (
            <div key={m.n} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"11px 16px", borderBottom: i < INDICES.length - 1 ? `1px solid ${V.w1}` : "none" }}>
              <span style={{ color:V.ink2, fontSize:13, fontWeight:500 }}>{m.n}</span>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <span style={{ ...mono, fontSize:13, fontWeight:500, color:V.ink0 }}>{m.v}</span>
                <span style={{ ...mono, fontSize:11, color: m.up ? V.gain : V.loss, minWidth:52, textAlign:"right" }}>{m.d}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

interface AIPanelProps {
  go: (t: string) => void;
  refreshMarkets: () => Promise<void>;
}

const AIPanel = memo(function AIPanel({ go, refreshMarkets }: AIPanelProps) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      <div style={{ ...glassCard({ padding:20 }) }}>
        <div style={{ position:"absolute", top:-40, right:-40, width:200, height:200, borderRadius:"50%", background:"rgba(155,114,245,0.06)", filter:"blur(50px)", pointerEvents:"none" }} />
        <div style={{ position:"relative", display:"flex", alignItems:"flex-start", gap:12 }}>
          <div style={{ width:42, height:42, borderRadius:11, background:"rgba(155,114,245,0.12)", border:`1px solid ${V.ameWire}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <Brain size={20} color={V.ame} />
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4, flexWrap:"wrap" }}>
              <h2 style={{ fontSize:16, fontWeight:600, color:V.ink0 }}>AI Signals</h2>
              <span style={{ ...mono, fontSize:9, background:V.ameDim, color:V.ame, border:`1px solid ${V.ameWire}`, borderRadius:99, padding:"2px 9px", textTransform:"uppercase", letterSpacing:"0.1em", whiteSpace:"nowrap" }}>Beta</span>
            </div>
            <p style={{ color:V.ink2, fontSize:12, lineHeight:1.55 }}>ML signals from price momentum, volume anomalies, earnings revisions, and NLP sentiment.</p>
          </div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginTop:16 }}>
          {[{ l:"Accuracy", v:"73.4%", c:"#7EB6FF" }, { l:"Confidence", v:"78.5%", c:V.gain }, { l:"Alpha", v:"+5.9%", c:V.gain }].map(s => (
            <div key={s.l} style={{ background:"rgba(255,255,255,0.04)", border:`1px solid ${V.w1}`, borderRadius:9, padding:"10px 12px", textAlign:"center" }}>
              <p style={{ ...mono, fontSize:8, color:V.ink4, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:4 }}>{s.l}</p>
              <p style={{ ...mono, fontSize:17, fontWeight:500, color:s.c, letterSpacing:"-0.02em" }}>{s.v}</p>
            </div>
          ))}
        </div>
      </div>

      <CountdownBar onRefresh={refreshMarkets} label="Next signal update" />

      <div>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12, flexWrap:"wrap" }}>
          <div style={{ width:24, height:24, borderRadius:6, background:V.gainDim, border:`1px solid ${V.gainWire}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <TrendingUp size={13} color={V.gain} />
          </div>
          <span style={{ fontSize:14, fontWeight:600, color:V.ink0 }}>Outperformer Signals</span>
          <span style={{ ...mono, fontSize:9, background:V.gainDim, color:V.gain, border:`1px solid ${V.gainWire}`, borderRadius:5, padding:"2px 8px", textTransform:"uppercase", letterSpacing:"0.08em" }}>Long</span>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {AI_LONG.map((s, i) => (
            <SignalCard key={s.ticker} {...s} upside={s.up} isGain rank={i + 1} go={go} />
          ))}
        </div>
      </div>

      <div>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12, flexWrap:"wrap" }}>
          <div style={{ width:24, height:24, borderRadius:6, background:V.lossDim, border:`1px solid ${V.lossWire}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <TrendingDown size={13} color={V.loss} />
          </div>
          <span style={{ fontSize:14, fontWeight:600, color:V.ink0 }}>Underperformer Signals</span>
          <span style={{ ...mono, fontSize:9, background:V.lossDim, color:V.loss, border:`1px solid ${V.lossWire}`, borderRadius:5, padding:"2px 8px", textTransform:"uppercase", letterSpacing:"0.08em" }}>Avoid</span>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {AI_SHORT.map((s, i) => (
            <SignalCard key={s.ticker} {...s} downside={s.down} isGain={false} rank={i + 1} go={go} />
          ))}
        </div>
      </div>

      <div style={{ display:"flex", gap:10, padding:"12px 16px", borderRadius:12, background:V.goldDim, border:"1px solid rgba(232,160,48,0.18)" }}>
        <AlertTriangle size={13} color={V.gold} style={{ marginTop:1, flexShrink:0 }} />
        <p style={{ color:V.ink2, fontSize:11, lineHeight:1.65 }}>For informational purposes only. Not investment advice. Past performance does not guarantee future results.</p>
      </div>
    </div>
  );
});

interface SidebarProps {
  ticker: string;
  watchlist: string[];
  livePrices: Record<string, { price: number; changePct: number }>;
  go: (t: string) => void;
  toggleWatch: (t: string) => void;
  setTab: Dispatch<SetStateAction<Tab>>;
}

const Sidebar = memo(function Sidebar({ ticker, watchlist, livePrices, go, toggleWatch, setTab }: SidebarProps) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <div style={{ ...glassCard({ overflow:"hidden", padding:0 }) }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, padding:"12px 16px", borderBottom:`1px solid ${V.w1}` }}>
          <Star size={13} color={V.gold} fill={V.gold} />
          <span style={{ fontSize:13, fontWeight:600, color:V.ink0 }}>Watchlist</span>
          <span style={{ ...mono, fontSize:10, color:V.ink3, marginLeft:"auto" }}>{watchlist.length}</span>
        </div>
        {watchlist.map((t, i) => {
          const live      = livePrices[t];
          const price     = live?.price     ?? MOCK[t]?.price     ?? 0;
          const changePct = live?.changePct ?? MOCK[t]?.changePct ?? 0;
          const pos = changePct >= 0;
          return (
            <button key={t} onClick={() => go(t)}
              style={{ display:"flex", justifyContent:"space-between", alignItems:"center", width:"100%", padding:"10px 16px", background: t === ticker ? "linear-gradient(90deg,rgba(79,142,247,0.07),transparent)" : "none", border:"none", cursor:"pointer", borderBottom: i < watchlist.length - 1 ? `1px solid ${V.w1}` : "none", borderLeft: t === ticker ? `2px solid ${V.arc}` : "2px solid transparent", minHeight:48, textAlign:"left", transition:"background 0.18s" }}
              className="row-hover">
              <div>
                <p style={{ ...mono, fontSize:12, fontWeight:500, color: t === ticker ? "#7EB6FF" : V.ink0 }}>{t}</p>
                <p style={{ color:V.ink3, fontSize:10, marginTop:1, maxWidth:100, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{MOCK[t]?.name ?? t}</p>
              </div>
              <div style={{ textAlign:"right" }}>
                <p style={{ ...mono, fontSize:12, fontWeight:500, color:V.ink0 }}>{price > 0 ? f$(price) : "---"}</p>
                <p style={{ ...mono, fontSize:10, color: pos ? V.gain : V.loss, marginTop:1 }}>{fp(changePct)}</p>
              </div>
            </button>
          );
        })}
        <div style={{ padding:"8px 12px", borderTop:`1px solid ${V.w1}`, display:"flex", flexWrap:"wrap", gap:4 }}>
          {TICKERS.filter(t => !watchlist.includes(t)).map(t => (
            <button key={t} onClick={() => toggleWatch(t)}
              style={{ ...mono, fontSize:9, padding:"3px 8px", borderRadius:5, background:"transparent", border:`1px solid ${V.w1}`, color:V.ink3, cursor:"pointer", transition:"all 0.18s" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = V.arcWire; e.currentTarget.style.color = "#7EB6FF"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = V.w1;     e.currentTarget.style.color = V.ink3; }}>
              +{t}
            </button>
          ))}
        </div>
      </div>

      <div style={{ ...glassCard({ overflow:"hidden", padding:0 }) }}>
        <div style={{ padding:"12px 16px", borderBottom:`1px solid ${V.w1}` }}>
          <span style={{ fontSize:13, fontWeight:600, color:V.ink0 }}>Global Markets</span>
        </div>
        {INDICES.map((m, i) => (
          <div key={m.n} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"9px 16px", borderBottom: i < INDICES.length - 1 ? `1px solid ${V.w1}` : "none" }}>
            <span style={{ color:V.ink2, fontSize:12, fontWeight:500 }}>{m.n}</span>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ ...mono, fontSize:12, fontWeight:500, color:V.ink0 }}>{m.v}</span>
              <span style={{ ...mono, fontSize:10, color: m.up ? V.gain : V.loss, minWidth:44, textAlign:"right" }}>{m.d}</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ ...glassCard({ padding:14 }) }}>
        <p style={{ ...mono, fontSize:9, color:V.ink4, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:10 }}>Explore</p>
        <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
          {([
            { id:"top15"     as Tab, label:"Top 15 Stocks", color:V.gold,    dimBg:V.goldDim, dimWire:"rgba(232,160,48,0.2)" },
            { id:"portfolio" as Tab, label:"My Portfolio",  color:V.ame,     dimBg:V.ameDim,  dimWire:V.ameWire },
            { id:"ai"        as Tab, label:"AI Signals",    color:"#7EB6FF", dimBg:V.arcDim,  dimWire:V.arcWire },
          ] as const).map(item => (
            <button key={item.id} onClick={() => setTab(item.id)}
              style={{ display:"flex", alignItems:"center", justifyContent:"space-between", background:item.dimBg, border:`1px solid ${item.dimWire}`, borderRadius:9, color:item.color, padding:"9px 12px", cursor:"pointer", fontSize:12, fontWeight:500, minHeight:40, transition:"opacity 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.opacity = "0.8"}
              onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
              <span>{item.label}</span>
              <ChevronRight size={13} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
});

export default function VertexTerminal() {
  const [ticker,     setTicker]     = useState("AAPL");
  const [quote,      setQuote]      = useState<Quote>(MOCK["AAPL"]);
  const [bars,       setBars]       = useState<Bar[]>(() => seedBars(228.52));
  const [watchlist,  setWatchlist]  = useState<string[]>(["AAPL","NVDA","MSFT","META"]);
  const [search,     setSearch]     = useState("");
  const [results,    setResults]    = useState<string[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [tab,        setTab]        = useState<Tab>("markets");
  const [searching,  setSearching]  = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [livePrices, setLivePrices] = useState<Record<string, { price: number; changePct: number }>>({});
  const searchRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (t: string) => {
    setLoading(true);
    const b = await loadBars(t);
    const realBars = b.length ? b : seedBars(MOCK[t]?.price ?? 100);
    const q = await loadQuote(t, realBars);
    setQuote(q);
    setBars(realBars);
    setLoading(false);
  }, []);
  useEffect(() => { load(ticker); }, [ticker, load]);

  const tickerRef = useRef(ticker);
  useEffect(() => { tickerRef.current = ticker; }, [ticker]);

  const refreshMarkets = useCallback(async () => {
    const t = tickerRef.current;
    const b = await loadBars(t);
    const realBars = b.length ? b : seedBars(MOCK[t]?.price ?? 100);
    const q = await loadQuote(t, realBars);
    setQuote(q);
    setBars(realBars);
  }, []);

  const fetchLivePrices = useCallback(async () => {
    const all = [...new Set([...TICKERS, ...watchlist])];
    const prices = await bulkPrices(all);
    if (Object.keys(prices).length > 0) setLivePrices(prices);
  }, [watchlist]);
  useEffect(() => { fetchLivePrices(); }, [fetchLivePrices]);

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
    const h = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setResults([]); setShowSearch(false);
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const go = useCallback((t: string) => {
    setTicker(t); setSearch(""); setResults([]); setShowSearch(false); setTab("markets");
  }, []);

  const toggleWatch = useCallback((t: string) => {
    setWatchlist(w => w.includes(t) ? w.filter(x => x !== t) : [...w, t]);
  }, []);

  const marketProps = useMemo<MarketsPanelProps>(() => ({
    ticker, quote, bars, loading,
    up:        quote.changePct >= 0,
    lineColor: quote.changePct >= 0 ? V.gain : V.loss,
    watched:   watchlist.includes(ticker),
    watchlist, livePrices, go, toggleWatch, refreshMarkets,
  }), [ticker, quote, bars, loading, watchlist, livePrices, go, toggleWatch, refreshMarkets]);

  const aiProps   = useMemo<AIPanelProps>(() => ({ go, refreshMarkets }), [go, refreshMarkets]);
  const sideProps = useMemo<SidebarProps>(() => ({ ticker, watchlist, livePrices, go, toggleWatch, setTab }), [ticker, watchlist, livePrices, go, toggleWatch]);

  return (
    <div style={{ minHeight:"100vh", background:V.d0, color:V.ink1, fontFamily:"'Bricolage Grotesque',system-ui,sans-serif" }}>

      <header style={{ position:"sticky", top:0, zIndex:100, background:"rgba(5,8,16,0.94)", backdropFilter:"blur(40px) saturate(2.5)", WebkitBackdropFilter:"blur(40px) saturate(2.5)", borderBottom:`1px solid ${V.w2}` }}>
        <div style={{ display:"flex", alignItems:"center", padding:"0 16px", height:32, borderBottom:`1px solid ${V.w1}`, overflow:"hidden" }}>
          <div className="vx-strip" style={{ flex:1, display:"flex", alignItems:"center", gap:14, overflowX:"auto" }}>
            {INDICES.map(m => (
              <div key={m.n} style={{ display:"flex", alignItems:"center", gap:4, flexShrink:0 }}>
                <span style={{ ...mono, fontSize:8, color:V.ink4, textTransform:"uppercase", letterSpacing:"0.06em" }}>{m.n}</span>
                <span style={{ ...mono, fontSize:9, fontWeight:500, color:V.ink1 }}>{m.v}</span>
                <span style={{ ...mono, fontSize:8, color: m.up ? V.gain : V.loss }}>{m.d}</span>
              </div>
            ))}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:4, flexShrink:0, marginLeft:10, paddingLeft:10, borderLeft:`1px solid ${V.w1}` }}>
            <div style={{ width:5, height:5, borderRadius:"50%", background:V.gain, animation:"live-pulse 2.5s ease-in-out infinite" }} />
            <span style={{ ...mono, fontSize:8, color:V.ink4, textTransform:"uppercase", letterSpacing:"0.1em" }}>Live</span>
          </div>
        </div>

        <div style={{ display:"flex", alignItems:"center", gap:10, padding:"0 16px", height:50 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
            <div style={{ width:28, height:28, borderRadius:8, background:"linear-gradient(135deg,#4F8EF7,#00C896)", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 2px 10px rgba(79,142,247,0.35)" }}>
              <Zap size={13} color="#fff" strokeWidth={2.5} />
            </div>
            <div style={{ lineHeight:1 }}>
              <div style={{ ...mono, fontSize:11, fontWeight:500, letterSpacing:"0.14em", color:V.ink0 }}>VERTEX</div>
              <div style={{ ...mono, fontSize:7, color:V.ink4, letterSpacing:"0.18em", marginTop:1 }}>TERMINAL</div>
            </div>
          </div>

          <div style={{ display:"flex", alignItems:"center", gap:0, marginLeft:6, flex:1, overflow:"hidden" }}>
            {TABS.map(t => {
              const active = tab === t.id;
              return (
                <button key={t.id} onClick={() => setTab(t.id)}
                  style={{ display:"flex", alignItems:"center", gap:5, padding:"0 12px", height:50, background:"none", border:"none", borderBottom: active ? `2px solid ${V.arc}` : "2px solid transparent", color: active ? V.ink0 : V.ink3, cursor:"pointer", fontSize:12, fontWeight: active ? 600 : 400, transition:"all 0.2s", whiteSpace:"nowrap" }}>
                  <TabIcon id={t.id} size={14} active={active} />
                  <span style={{ display:"none" }} className="tab-label">{t.label}</span>
                </button>
              );
            })}
          </div>

          <div ref={searchRef} style={{ position:"relative", flexShrink:0 }}>
            <button onClick={() => setShowSearch(s => !s)}
              style={{ background: showSearch ? "rgba(79,142,247,0.10)" : "none", border:`1px solid ${showSearch ? V.arcWire : "transparent"}`, borderRadius:8, cursor:"pointer", color: showSearch ? "#7EB6FF" : V.ink3, padding:"6px 10px", display:"flex", alignItems:"center", gap:5, minHeight:36, minWidth:36, justifyContent:"center", transition:"all 0.2s" }}>
              <Search size={16} />
            </button>
            {showSearch && (
              <div style={{ position:"fixed", right:16, top:90, width:"min(340px,calc(100vw - 32px))", background:"rgba(8,13,24,0.97)", backdropFilter:"blur(40px)", WebkitBackdropFilter:"blur(40px)", border:`1px solid ${V.w3}`, borderRadius:14, overflow:"hidden", zIndex:200, boxShadow:"0 20px 60px rgba(0,0,0,0.75)" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, padding:"11px 14px", borderBottom:`1px solid ${V.w1}` }}>
                  <Search size={13} color={V.ink3} />
                  <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="Search ticker or company..."
                    style={{ background:"transparent", border:"none", padding:0, borderRadius:0, fontSize:16, flex:1, color:V.ink0, outline:"none", fontFamily:"'Geist Mono',monospace" }} />
                  {search && (
                    <button onClick={() => setSearch("")} style={{ background:"none", border:"none", cursor:"pointer", color:V.ink3, padding:2, display:"flex", minWidth:28, minHeight:28, alignItems:"center", justifyContent:"center" }}>
                      <X size={13} />
                    </button>
                  )}
                </div>
                {results.map(t => (
                  <button key={t} onClick={() => go(t)}
                    style={{ display:"flex", alignItems:"center", justifyContent:"space-between", width:"100%", padding:"11px 14px", background:"none", border:"none", cursor:"pointer", minHeight:48, textAlign:"left", transition:"background 0.15s" }}
                    className="row-hover">
                    <span style={{ ...mono, fontSize:13, fontWeight:500, color:V.ink0 }}>{t}</span>
                    <span style={{ fontSize:12, color:V.ink3, maxWidth:160, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{MOCK[t]?.name ?? ""}</span>
                  </button>
                ))}
                {results.length === 0 && search.length > 0 && !searching && (
                  <p style={{ ...mono, fontSize:11, color:V.ink4, textAlign:"center", padding:"14px" }}>No results for "{search}"</p>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="vx-main" style={{ position:"relative", zIndex:1 }}>
        {tab === "top15"     && <Top15 onSelectTicker={go} />}
        {tab === "portfolio" && <MyStocks />}
        {(tab === "markets" || tab === "ai") && (
          <div style={{ maxWidth:1200, margin:"0 auto", padding:"20px 16px" }}>
            <div className="vx-two-col" style={{ display:"flex", flexDirection:"column", gap:20 }}>
              <div style={{ minWidth:0 }}>
                {tab === "markets" && <MarketsPanel {...marketProps} />}
                {tab === "ai"      && <AIPanel      {...aiProps} />}
              </div>
              <div id="vx-sidebar" style={{ display:"none" }}>
                <Sidebar {...sideProps} />
              </div>
            </div>
          </div>
        )}
      </main>

      <nav className="vx-bottom-nav">
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)" }}>
          {TABS.map(t => {
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"8px 4px 6px", gap:3, background:"none", border:"none", cursor:"pointer", minHeight:54, color: active ? "#7EB6FF" : V.ink4, transition:"color 0.2s", touchAction:"manipulation" }}>
                <div style={{ padding:"3px 10px", borderRadius:16, background: active ? "rgba(79,142,247,0.12)" : "transparent", transition:"background 0.25s", display:"flex", alignItems:"center", justifyContent:"center", minWidth:40 }}>
                  <TabIcon id={t.id} size={21} active={active} />
                </div>
                <span style={{ fontSize:10, fontWeight: active ? 600 : 400, letterSpacing:"0.01em", whiteSpace:"nowrap" }}>{t.short}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <style>{`
        @keyframes vx-rise    { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes live-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.7)} }
        @keyframes shimmer    { 0%{background-position:-400% 0} 100%{background-position:400% 0} }
        *, *::before, *::after { box-sizing:border-box; }
        input, select, textarea { font-size:16px; }
        button,[role="button"] { touch-action:manipulation; }
        ::-webkit-scrollbar       { width:2px; height:2px; }
        ::-webkit-scrollbar-thumb { background:rgba(130,180,255,0.12); border-radius:99px; }
        .vx-strip { scrollbar-width:none; }
        .vx-strip::-webkit-scrollbar { display:none; }
        .row-hover:hover { background:rgba(30,45,64,0.7) !important; }
        .tab-label { display:none; }
        @media(min-width:480px){ .tab-label { display:inline; } }
        @media(min-width:1024px){
          .vx-two-col { display:grid !important; grid-template-columns:1fr 284px !important; gap:20px; align-items:start; }
          #vx-sidebar  { display:block !important; }
        }
        @media(max-width:767px){
          .vx-main { padding-bottom:calc(64px + env(safe-area-inset-bottom,0px)) !important; }
          .vx-chart-main { height:160px !important; }
        }
        @media(min-width:768px){
          .vx-bottom-nav { display:none !important; }
          .vx-main { padding-bottom:40px !important; }
        }
      `}</style>
    </div>
  );
}
