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
  LayoutDashboard,
} from "lucide-react";

const Top15    = dynamic(() => import("@/components/Top15"),    { ssr: false, loading: () => <PanelLoader label="Loading Top 15…"    /> });
const MyStocks = dynamic(() => import("@/components/MyStocks"), { ssr: false, loading: () => <PanelLoader label="Loading My Stocks…" /> });

function PanelLoader({ label }: { label: string }) {
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:12, padding:48, color:"#7A9BBF", fontFamily:"monospace", fontSize:13 }}>
      <RefreshCw size={18} style={{ animation:"spin 1s linear infinite" }} />
      {label}
    </div>
  );
}

interface StockQuote {
  ticker: string; name: string; price: number; change: number;
  changePct: number; high: number; low: number; open: number; volume: number;
}
interface Bar { date: string; close: number; open: number; high: number; low: number; }

const API_KEY = "1xwzcvUOF9pft6PRNylO2Xc6X2QeQCGr";
const BASE    = "https://api.polygon.io";
const POPULAR = ["AAPL","MSFT","NVDA","GOOGL","META","TSLA","AMZN","AMD"];

const MOCK: Record<string, StockQuote> = {
  AAPL:  { ticker:"AAPL",  name:"Apple Inc.",            price:228.52, change: 3.21, changePct: 1.42, high:229.88, low:225.12, open:225.80, volume:58_234_100 },
  MSFT:  { ticker:"MSFT",  name:"Microsoft Corp.",        price:415.32, change:-2.18, changePct:-0.52, high:418.55, low:413.22, open:417.50, volume:21_456_200 },
  NVDA:  { ticker:"NVDA",  name:"NVIDIA Corp.",           price:875.42, change:24.63, changePct: 2.90, high:881.20, low:851.30, open:853.10, volume:42_118_700 },
  GOOGL: { ticker:"GOOGL", name:"Alphabet Inc.",          price:178.94, change: 1.43, changePct: 0.81, high:180.12, low:177.34, open:177.51, volume:18_932_400 },
  META:  { ticker:"META",  name:"Meta Platforms",         price:554.78, change: 8.92, changePct: 1.63, high:557.33, low:545.21, open:546.10, volume:14_209_300 },
  TSLA:  { ticker:"TSLA",  name:"Tesla Inc.",             price:248.50, change:-9.23, changePct:-3.58, high:260.42, low:247.11, open:258.10, volume:89_234_100 },
  AMZN:  { ticker:"AMZN",  name:"Amazon.com Inc.",        price:201.17, change:-0.88, changePct:-0.44, high:203.21, low:200.54, open:202.05, volume:29_847_100 },
  AMD:   { ticker:"AMD",   name:"Advanced Micro Devices", price:162.34, change: 5.82, changePct: 3.72, high:163.80, low:156.42, open:157.10, volume:45_123_200 },
};

const AI_WINNERS = [
  { ticker:"NVDA", name:"NVIDIA Corp.",       confidence:91, target:950, upside: 8.5, reason:"AI infrastructure capex surging. Blackwell GPU demand exceeds supply 3×. Data center revenue +120% YoY.", tags:["Blackwell Launch","Azure Deal","Q4 Beat"] },
  { ticker:"META", name:"Meta Platforms",      confidence:84, target:620, upside:11.8, reason:"Llama monetisation accelerating. Reels ad revenue +40% QoQ. Cost discipline driving margin expansion.",   tags:["Llama 4","Ad Beat","Cost Cuts"] },
  { ticker:"AMD",  name:"Advanced Micro Dev.", confidence:78, target:195, upside:20.1, reason:"MI300X gaining enterprise traction. Data center segment +80% YoY. TSMC capacity secured through 2025.",    tags:["MI400 Reveal","Design Wins","CPU Share"] },
];
const AI_LOSERS = [
  { ticker:"TSLA", name:"Tesla Inc.",      confidence:76, target:195, downside:-21.6, reason:"EV demand soft globally. Brutal price war in China. Cybertruck ramp costlier than expected.",   tags:["China Share Loss","Margin Squeeze","Competition"] },
  { ticker:"AMZN", name:"Amazon.com Inc.", confidence:61, target:180, downside:-10.5, reason:"AWS growth decelerating vs Azure/GCP. Retail margins thin. Ad CPM pressure building.",          tags:["AWS Slowdown","Ad CPMs","FTC Risk"] },
];

type TabId = "dashboard" | "ai" | "top15" | "mystocks";
const TABS = [
  { id:"dashboard" as TabId, label:"Market",   icon:<LayoutDashboard size={22}/> },
  { id:"top15"     as TabId, label:"Top 15",   icon:<Trophy size={22}/> },
  { id:"mystocks"  as TabId, label:"My Stocks",icon:<BookOpen size={22}/> },
  { id:"ai"        as TabId, label:"AI Picks", icon:<Brain size={22}/> },
];

function seedBars(base: number, days = 90): Bar[] {
  const bars: Bar[] = [];
  let p = base * 0.82, seed = Math.round(base * 100);
  const rand = () => { seed = (seed * 1664525 + 1013904223) & 0xffffffff; return (seed >>> 0) / 0xffffffff; };
  const now = new Date();
  for (let i = days; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    const chg = (rand() - 0.47) * 0.022 * p, o = p, c = p + chg;
    bars.push({ date:d.toISOString().split("T")[0], open:+o.toFixed(2), high:+(Math.max(o,c)*(1+rand()*.008)).toFixed(2), low:+(Math.min(o,c)*(1-rand()*.008)).toFixed(2), close:+c.toFixed(2) });
    p = c;
  }
  return bars;
}

async function polyFetch<T>(path: string): Promise<T|null> {
  try { const r = await fetch(`${BASE}${path}${path.includes("?")?"&":"?"}apiKey=${API_KEY}`); return r.ok ? r.json() : null; }
  catch { return null; }
}

async function getQuote(ticker: string): Promise<StockQuote> {
  const mock = MOCK[ticker] ?? { ticker, name:ticker, price:100, change:0, changePct:0, high:101, low:99, open:100, volume:1_000_000 };
  const data = await polyFetch<{ticker:{day:{o:number;h:number;l:number;c:number;v:number};prevDay:{c:number}}}>(`/v2/snapshot/locale/us/markets/stocks/tickers/${ticker}`);
  if (!data?.ticker?.day?.c) return mock;
  const {day,prevDay} = data.ticker, chg = day.c - prevDay.c;
  return { ticker, name:mock.name, price:day.c, change:+chg.toFixed(2), changePct:+((chg/prevDay.c)*100).toFixed(2), high:day.h, low:day.l, open:day.o, volume:day.v };
}

async function getBars(ticker: string): Promise<Bar[]> {
  const to=new Date().toISOString().split("T")[0], from=new Date(Date.now()-90*86_400_000).toISOString().split("T")[0];
  const data = await polyFetch<{results?:{o:number;h:number;l:number;c:number;t:number}[]}>(`/v2/aggs/ticker/${ticker}/range/1/day/${from}/${to}?adjusted=true&sort=asc&limit=120`);
  if (!data?.results?.length) return seedBars(MOCK[ticker]?.price ?? 100);
  return data.results.map(b=>({date:new Date(b.t).toISOString().split("T")[0],open:b.o,high:b.h,low:b.l,close:b.c}));
}

async function searchTickers(q: string): Promise<string[]> {
  const data = await polyFetch<{results?:{ticker:string}[]}>(`/v3/reference/tickers?search=${encodeURIComponent(q)}&active=true&limit=6&market=stocks`);
  if (!data?.results?.length) return POPULAR.filter(t=>t.includes(q.toUpperCase())||MOCK[t]?.name.toLowerCase().includes(q.toLowerCase()));
  return data.results.map(r=>r.ticker);
}

const fmt$   = (n:number) => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",minimumFractionDigits:2}).format(n);
const fmtPct = (n:number) => `${n>=0?"+":""}${n.toFixed(2)}%`;
const fmtVol = (n:number) => n>=1e9?`${(n/1e9).toFixed(1)}B`:n>=1e6?`${(n/1e6).toFixed(1)}M`:n>=1e3?`${(n/1e3).toFixed(1)}K`:String(n);

function ChartTip({active,payload,label}:{active?:boolean;payload?:{value:number}[];label?:string}) {
  if (!active||!payload?.length) return null;
  return (
    <div style={{background:"#0D1321",border:"1px solid #1E293B",borderRadius:8,padding:"8px 12px"}}>
      <p style={{fontFamily:"monospace",fontSize:10,color:"#7A9BBF",marginBottom:2}}>{label}</p>
      <p style={{fontFamily:"monospace",fontSize:13,color:"#E2EAF4",fontWeight:600}}>{fmt$(payload[0].value)}</p>
    </div>
  );
}

function ConfBar({pct,color="#00FF94"}:{pct:number;color?:string}) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:8}}>
      <div style={{flex:1,height:3,background:"#111E30",borderRadius:99,overflow:"hidden"}}>
        <div style={{width:`${pct}%`,height:"100%",background:color,borderRadius:99,transition:"width 0.6s ease"}}/>
      </div>
      <span style={{fontFamily:"monospace",fontSize:10,color,minWidth:28}}>{pct}%</span>
    </div>
  );
}

// ── Shared style tokens ───────────────────────────────────────────────────────
const T = {
  card:   {background:"#0D1321",border:"1px solid #1E293B",borderRadius:12} as React.CSSProperties,
  cardSm: {background:"#0D1321",border:"1px solid #1E293B",borderRadius:8}  as React.CSSProperties,
  mono:   {fontFamily:"'IBM Plex Mono','Courier New',monospace"} as React.CSSProperties,
  muted:  {color:"#7A9BBF"} as React.CSSProperties,
  green:  {color:"#00FF94"} as React.CSSProperties,
  red:    {color:"#FF3B5C"} as React.CSSProperties,
  cyan:   {color:"#00D4FF"} as React.CSSProperties,
  badge: (pos:boolean):React.CSSProperties => ({
    display:"inline-flex",alignItems:"center",gap:4,padding:"3px 8px",borderRadius:6,
    fontFamily:"monospace",fontSize:12,fontWeight:500,
    background:pos?"rgba(0,255,148,0.1)":"rgba(255,59,92,0.1)",
    color:pos?"#00FF94":"#FF3B5C",
    border:`1px solid ${pos?"rgba(0,255,148,0.25)":"rgba(255,59,92,0.25)"}`,
  }),
};

export default function VertexTerminal() {
  const [ticker,     setTicker]    = useState("AAPL");
  const [quote,      setQuote]     = useState<StockQuote>(MOCK["AAPL"]);
  const [bars,       setBars]      = useState<Bar[]>(seedBars(228.52));
  const [watchlist,  setWatchlist] = useState<string[]>(["AAPL","NVDA","MSFT","META"]);
  const [search,     setSearch]    = useState("");
  const [results,    setResults]   = useState<string[]>([]);
  const [loading,    setLoading]   = useState(false);
  const [tab,        setTab]       = useState<TabId>("dashboard");
  const [searching,  setSearching] = useState(false);
  const [showSearch, setShowSearch]= useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (t:string) => {
    setLoading(true);
    const [q,b] = await Promise.all([getQuote(t),getBars(t)]);
    setQuote(q); setBars(b); setLoading(false);
  },[]);
  useEffect(()=>{ load(ticker); },[ticker,load]);

  useEffect(()=>{
    if (!search.trim()) { setResults([]); return; }
    const id = setTimeout(async()=>{ setSearching(true); setResults((await searchTickers(search)).slice(0,6)); setSearching(false); },350);
    return ()=>clearTimeout(id);
  },[search]);

  useEffect(()=>{
    const h=(e:MouseEvent)=>{ if(searchRef.current&&!searchRef.current.contains(e.target as Node)){setResults([]);setShowSearch(false);} };
    document.addEventListener("mousedown",h); return ()=>document.removeEventListener("mousedown",h);
  },[]);

  const selectTicker=(t:string)=>{ setTicker(t); setSearch(""); setResults([]); setShowSearch(false); setTab("dashboard"); };
  const toggleWatch=(t:string)=>setWatchlist(w=>w.includes(t)?w.filter(x=>x!==t):[...w,t]);

  const up        = quote.changePct >= 0;
  const lineColor = up?"#00FF94":"#FF3B5C";
  const watched   = watchlist.includes(ticker);

  // ── Dashboard panel ───────────────────────────────────────────────────────
  const DashPanel = () => (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      {/* Quote header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
        <div style={{minWidth:0,flex:1}}>
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            <h1 style={{fontSize:"clamp(22px,5vw,32px)",fontWeight:700,margin:0}}>{ticker}</h1>
            <span style={T.badge(up)}>{up?<TrendingUp size={11}/>:<TrendingDown size={11}/>}{fmtPct(quote.changePct)}</span>
            <button onClick={()=>toggleWatch(ticker)} style={{background:"none",border:"none",cursor:"pointer",padding:6,minWidth:36,minHeight:36,display:"flex",alignItems:"center",justifyContent:"center"}}>
              {watched?<Star size={18} color="#FFB800" fill="#FFB800"/>:<StarOff size={18} color="#3D5A7A"/>}
            </button>
          </div>
          <p style={{...T.muted,fontSize:13,marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{quote.name}</p>
        </div>
        <div style={{textAlign:"right",flexShrink:0}}>
          {loading
            ? <div style={{width:120,height:32,background:"#111E30",borderRadius:8,animation:"shimmer 1.5s infinite"}}/>
            : <>
                <div style={{...T.mono,fontSize:"clamp(20px,4vw,28px)",fontWeight:700}}>{fmt$(quote.price)}</div>
                <div style={{...T.mono,fontSize:12,...(up?T.green:T.red)}}>{quote.change>=0?"+":""}{fmt$(quote.change)} today</div>
              </>}
        </div>
      </div>

      {/* Stats — horizontally scrollable */}
      <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch",marginLeft:-16,marginRight:-16,paddingLeft:16,paddingRight:16}}>
        <div style={{display:"flex",gap:8,minWidth:"max-content"}}>
          {[{l:"Open",v:fmt$(quote.open)},{l:"High",v:fmt$(quote.high)},{l:"Low",v:fmt$(quote.low)},{l:"Volume",v:fmtVol(quote.volume)},{l:"Prev Close",v:fmt$(quote.price-quote.change)}].map(s=>(
            <div key={s.l} style={{...T.cardSm,padding:"10px 12px",textAlign:"center",flexShrink:0}}>
              <div style={{...T.mono,fontSize:9,color:"#3D5A7A",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:3}}>{s.l}</div>
              <div style={{...T.mono,fontSize:12,fontWeight:600}}>{s.v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div style={{...T.card,overflow:"hidden"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",borderBottom:"1px solid #1E293B"}}>
          <span style={{fontSize:12,...T.muted,fontWeight:500}}>90-Day Price Chart</span>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:"#00FF94",animation:"pulseDot 2s infinite"}}/>
            <span style={{...T.mono,fontSize:9,...T.muted}}>Polygon.io</span>
          </div>
        </div>
        {loading
          ? <div style={{height:220,margin:12,borderRadius:8,animation:"shimmer 1.5s infinite",background:"#111E30"}}/>
          : <div style={{height:220,padding:"10px 4px 8px"}}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={bars} margin={{top:4,right:4,left:0,bottom:0}}>
                  <defs>
                    <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={lineColor} stopOpacity={0.2}/>
                      <stop offset="95%" stopColor={lineColor} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false}/>
                  <XAxis dataKey="date" tick={{fill:"#3D5A7A",fontSize:8,fontFamily:"IBM Plex Mono"}} tickLine={false} axisLine={false} interval="preserveStartEnd"/>
                  <YAxis tick={{fill:"#3D5A7A",fontSize:8,fontFamily:"IBM Plex Mono"}} tickLine={false} axisLine={false} tickFormatter={(v:number)=>`$${v.toFixed(0)}`} width={44} domain={["auto","auto"]}/>
                  <Tooltip content={<ChartTip/>}/>
                  <Area type="monotone" dataKey="close" stroke={lineColor} strokeWidth={1.5} fill="url(#cg)" dot={false} activeDot={{r:4,fill:lineColor,strokeWidth:0}}/>
                </AreaChart>
              </ResponsiveContainer>
            </div>}
      </div>

      {/* Quick picks — scroll */}
      <div>
        <p style={{...T.mono,fontSize:9,color:"#3D5A7A",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:8}}>Quick Select</p>
        <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch",marginLeft:-16,marginRight:-16,paddingLeft:16,paddingRight:16}}>
          <div style={{display:"flex",gap:8,minWidth:"max-content"}}>
            {POPULAR.map(t=>{
              const q=MOCK[t]; const pos=(q?.changePct??0)>=0;
              return (
                <button key={t} onClick={()=>selectTicker(t)}
                  style={{flexShrink:0,display:"flex",flexDirection:"column",alignItems:"flex-start",padding:"8px 12px",borderRadius:8,border:"1px solid",cursor:"pointer",minWidth:64,minHeight:48,background:t===ticker?"rgba(0,212,255,0.08)":"#0D1321",borderColor:t===ticker?"rgba(0,212,255,0.4)":"#1E293B",transition:"all 0.15s"}}>
                  <span style={{...T.mono,fontSize:12,fontWeight:700,color:t===ticker?"#00D4FF":"#E2EAF4"}}>{t}</span>
                  <span style={{...T.mono,fontSize:9,color:pos?"#00FF94":"#FF3B5C"}}>{q?fmtPct(q.changePct):""}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Watchlist (mobile view) */}
      <div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <Star size={13} color="#FFB800" fill="#FFB800"/>
            <span style={{fontSize:14,fontWeight:600}}>Watchlist</span>
          </div>
          <span style={{...T.mono,fontSize:10,color:"#3D5A7A"}}>{watchlist.length} stocks</span>
        </div>
        <div style={{...T.card,overflow:"hidden"}}>
          {watchlist.length===0&&<p style={{...T.muted,fontSize:13,textAlign:"center",padding:24}}>Star stocks to add them here</p>}
          {watchlist.map((t,i)=>{
            const q=MOCK[t]; const pos=(q?.changePct??0)>=0;
            return (
              <button key={t} onClick={()=>selectTicker(t)}
                style={{display:"flex",justifyContent:"space-between",alignItems:"center",width:"100%",padding:"12px 16px",background:t===ticker?"rgba(0,212,255,0.04)":"none",border:"none",borderBottom:i<watchlist.length-1?"1px solid #111E30":"none",cursor:"pointer",borderLeft:t===ticker?"2px solid #00D4FF":"2px solid transparent",minHeight:56,textAlign:"left"}}
                onMouseEnter={e=>{if(t!==ticker)e.currentTarget.style.background="#111E30"}}
                onMouseLeave={e=>{if(t!==ticker)e.currentTarget.style.background="none"}}>
                <div>
                  <p style={{...T.mono,fontSize:13,fontWeight:700,color:t===ticker?"#00D4FF":"#E2EAF4",marginBottom:1}}>{t}</p>
                  <p style={{...T.muted,fontSize:11,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:180}}>{q?.name}</p>
                </div>
                <div style={{textAlign:"right"}}>
                  <p style={{...T.mono,fontSize:13,fontWeight:600}}>{q?fmt$(q.price):"—"}</p>
                  <p style={{...T.mono,fontSize:11,color:pos?"#00FF94":"#FF3B5C"}}>{q?fmtPct(q.changePct):""}</p>
                </div>
              </button>
            );
          })}
          <div style={{padding:"10px 14px",borderTop:"1px solid #1E293B",display:"flex",flexWrap:"wrap",gap:6}}>
            {POPULAR.filter(t=>!watchlist.includes(t)).map(t=>(
              <button key={t} onClick={()=>toggleWatch(t)}
                style={{...T.mono,fontSize:10,padding:"5px 10px",borderRadius:6,background:"transparent",border:"1px solid #1E293B",color:"#7A9BBF",cursor:"pointer",minHeight:32}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor="#00D4FF44";e.currentTarget.style.color="#00D4FF"}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor="#1E293B";e.currentTarget.style.color="#7A9BBF"}}>
                + {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Market snapshot */}
      <div>
        <p style={{fontSize:14,fontWeight:600,marginBottom:8}}>Market Snapshot</p>
        <div style={{...T.card,overflow:"hidden"}}>
          {[{n:"S&P 500",v:"5,842",c:"+0.74%"},{n:"NASDAQ",v:"18,843",c:"+1.12%"},{n:"DOW",v:"43,189",c:"+0.42%"},{n:"VIX",v:"14.32",c:"-2.18%"},{n:"10Y Yield",v:"4.28%",c:"+0.03%"}].map((m,i,arr)=>{
            const pos=m.c.startsWith("+");
            return (
              <div key={m.n} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 16px",borderBottom:i<arr.length-1?"1px solid #111E30":undefined}}>
                <span style={{fontSize:13,...T.muted}}>{m.n}</span>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{...T.mono,fontSize:13,fontWeight:600}}>{m.v}</span>
                  <span style={{...T.mono,fontSize:11,color:pos?"#00FF94":"#FF3B5C"}}>{m.c}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  // ── AI panel ──────────────────────────────────────────────────────────────
  const AIPanel = () => (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{display:"flex",alignItems:"center",gap:12}}>
        <div style={{width:40,height:40,borderRadius:10,background:"rgba(168,85,247,0.12)",border:"1px solid rgba(168,85,247,0.25)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <Brain size={20} color="#A855F7"/>
        </div>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            <span style={{fontSize:16,fontWeight:600}}>AI Predictions</span>
            <span style={{...T.mono,fontSize:9,background:"rgba(168,85,247,0.12)",color:"#A855F7",border:"1px solid rgba(168,85,247,0.2)",borderRadius:99,padding:"2px 8px"}}>BETA</span>
          </div>
          <p style={{...T.muted,fontSize:12,margin:0}}>Momentum · volume · sentiment · technicals</p>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
        {[{l:"Accuracy",v:"73.4%",c:"#00D4FF"},{l:"Avg Conf",v:"78.5%",c:"#00FF94"},{l:"Alpha",v:"+5.9%",c:"#00FF94"}].map(s=>(
          <div key={s.l} style={{...T.cardSm,padding:"10px 12px"}}>
            <div style={{...T.mono,fontSize:9,color:"#3D5A7A",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:3}}>{s.l}</div>
            <div style={{...T.mono,fontSize:18,fontWeight:700,color:s.c}}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Winners */}
      <div>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10,flexWrap:"wrap"}}>
          <TrendingUp size={14} color="#00FF94"/>
          <span style={{fontSize:13,fontWeight:600}}>Predicted Outperformers</span>
          <span style={{...T.mono,fontSize:9,background:"rgba(0,255,148,0.1)",color:"#00FF94",borderRadius:4,padding:"2px 8px"}}>BUY</span>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {AI_WINNERS.map((s,i)=>(
            <div key={s.ticker} style={{...T.card,padding:16,cursor:"pointer",transition:"border-color 0.2s"}}
              onClick={()=>selectTicker(s.ticker)}
              onMouseEnter={e=>(e.currentTarget.style.borderColor="rgba(0,255,148,0.35)")}
              onMouseLeave={e=>(e.currentTarget.style.borderColor="#1E293B")}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12,gap:8}}>
                <div style={{display:"flex",alignItems:"flex-start",gap:8}}>
                  <span style={{...T.mono,fontSize:10,...T.muted,marginTop:2}}>#{i+1}</span>
                  <div>
                    <div style={{...T.mono,fontSize:14,fontWeight:700,...T.cyan}}>{s.ticker}</div>
                    <div style={{...T.muted,fontSize:11}}>{s.name}</div>
                  </div>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{...T.muted,fontSize:9,...T.mono}}>Target</div>
                  <div style={{...T.mono,...T.green,fontSize:14,fontWeight:700}}>{fmt$(s.target)}</div>
                  <div style={{...T.mono,...T.green,fontSize:10}}>+{s.upside.toFixed(1)}% upside</div>
                </div>
              </div>
              <ConfBar pct={s.confidence}/>
              <p style={{...T.muted,fontSize:12,lineHeight:1.6,margin:"10px 0"}}>{s.reason}</p>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {s.tags.map(t=><span key={t} style={{...T.mono,fontSize:9,padding:"2px 8px",borderRadius:99,background:"rgba(0,255,148,0.06)",color:"#00FF94",border:"1px solid rgba(0,255,148,0.15)"}}>{t}</span>)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Losers */}
      <div>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10,flexWrap:"wrap"}}>
          <TrendingDown size={14} color="#FF3B5C"/>
          <span style={{fontSize:13,fontWeight:600}}>Predicted Underperformers</span>
          <span style={{...T.mono,fontSize:9,background:"rgba(255,59,92,0.1)",color:"#FF3B5C",borderRadius:4,padding:"2px 8px"}}>AVOID</span>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {AI_LOSERS.map((s,i)=>(
            <div key={s.ticker} style={{...T.card,padding:16,cursor:"pointer",transition:"border-color 0.2s"}}
              onClick={()=>selectTicker(s.ticker)}
              onMouseEnter={e=>(e.currentTarget.style.borderColor="rgba(255,59,92,0.35)")}
              onMouseLeave={e=>(e.currentTarget.style.borderColor="#1E293B")}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12,gap:8}}>
                <div style={{display:"flex",alignItems:"flex-start",gap:8}}>
                  <span style={{...T.mono,fontSize:10,...T.muted,marginTop:2}}>#{i+1}</span>
                  <div>
                    <div style={{...T.mono,fontSize:14,fontWeight:700,...T.cyan}}>{s.ticker}</div>
                    <div style={{...T.muted,fontSize:11}}>{s.name}</div>
                  </div>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{...T.muted,fontSize:9,...T.mono}}>Target</div>
                  <div style={{...T.mono,color:"#FF3B5C",fontSize:14,fontWeight:700}}>{fmt$(s.target)}</div>
                  <div style={{...T.mono,color:"#FF3B5C",fontSize:10}}>{s.downside.toFixed(1)}%</div>
                </div>
              </div>
              <ConfBar pct={s.confidence} color="#FF3B5C"/>
              <p style={{...T.muted,fontSize:12,lineHeight:1.6,margin:"10px 0"}}>{s.reason}</p>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {s.tags.map(t=>(
                  <span key={t} style={{...T.mono,fontSize:9,padding:"2px 8px",borderRadius:99,background:"rgba(255,59,92,0.06)",color:"#FF3B5C",border:"1px solid rgba(255,59,92,0.15)",display:"inline-flex",alignItems:"center",gap:4}}>
                    <AlertTriangle size={8}/>{t}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{display:"flex",gap:10,padding:"12px 14px",borderRadius:10,background:"rgba(255,184,0,0.05)",border:"1px solid rgba(255,184,0,0.2)"}}>
        <AlertTriangle size={14} color="#FFB800" style={{marginTop:1,flexShrink:0}}/>
        <p style={{...T.muted,fontSize:11,lineHeight:1.6,margin:0}}>AI predictions are for informational purposes only and do not constitute financial advice. Always conduct your own research.</p>
      </div>
    </div>
  );

  const isFullWidth = tab==="top15"||tab==="mystocks";

  return (
    <div style={{minHeight:"100vh",background:"#060B14",color:"#E2EAF4",fontFamily:"system-ui,sans-serif"}}>

      {/* ── Sticky header ────────────────────────────────────────────────── */}
      <header style={{position:"sticky",top:0,zIndex:50,background:"rgba(6,11,20,0.97)",backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",borderBottom:"1px solid #1E293B"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,padding:"0 16px",height:52}}>
          {/* Logo */}
          <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
            <div style={{width:28,height:28,borderRadius:8,background:"linear-gradient(135deg,#00D4FF,#00FF94)",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <Zap size={14} color="#060B14" strokeWidth={2.5}/>
            </div>
            <div style={{display:"none"}} className="sm-logo">
              <div style={{...T.mono,fontSize:11,fontWeight:700,letterSpacing:"0.15em",lineHeight:1}}>VERTEX</div>
              <div style={{...T.mono,fontSize:8,...T.muted,letterSpacing:"0.2em"}}>TERMINAL</div>
            </div>
          </div>

          {/* Desktop tab bar */}
          <div style={{display:"flex",gap:2,background:"#0D1321",borderRadius:8,padding:3}}>
            {TABS.map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)}
                style={{display:"flex",alignItems:"center",gap:6,padding:"6px 12px",borderRadius:6,border:"none",cursor:"pointer",fontSize:12,fontWeight:500,transition:"all 0.15s",whiteSpace:"nowrap",background:tab===t.id?"#111E30":"transparent",color:tab===t.id?"#E2EAF4":"#7A9BBF",boxShadow:tab===t.id?"0 1px 4px rgba(0,0,0,0.4)":undefined}}>
                {/* Icon only on mobile, icon+label on desktop */}
                <span style={{display:"flex"}}>{t.icon}</span>
                <span style={{}}>{t.label}</span>
              </button>
            ))}
          </div>

          <div style={{flex:1}}/>

          {/* Search */}
          <div ref={searchRef} style={{position:"relative"}}>
            {/* Mobile search toggle */}
            <button onClick={()=>setShowSearch(s=>!s)}
              style={{background:"none",border:"none",cursor:"pointer",color:"#7A9BBF",padding:8,minWidth:40,minHeight:40,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <Search size={18}/>
            </button>

            {/* Search dropdown */}
            {showSearch&&(
              <div style={{position:"absolute",right:0,top:44,width:"min(320px,90vw)",background:"#0D1321",border:"1px solid #1E293B",borderRadius:12,overflow:"hidden",zIndex:99,boxShadow:"0 8px 32px rgba(0,0,0,0.5)"}}>
                <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",borderBottom:"1px solid #1E293B"}}>
                  <Search size={14} color="#7A9BBF"/>
                  <input autoFocus value={search} onChange={e=>setSearch(e.target.value)}
                    style={{background:"transparent",...T.mono,fontSize:14,color:"#E2EAF4",border:"none",outline:"none",flex:1}}
                    placeholder="Ticker or company…"/>
                  {searching&&<RefreshCw size={12} color="#7A9BBF" style={{animation:"spin 1s linear infinite"}}/>}
                  {search&&<button onClick={()=>setSearch("")} style={{background:"none",border:"none",cursor:"pointer",color:"#7A9BBF",padding:2}}><X size={13}/></button>}
                </div>
                {results.map(t=>(
                  <button key={t} onClick={()=>selectTicker(t)}
                    style={{display:"flex",justifyContent:"space-between",alignItems:"center",width:"100%",padding:"11px 14px",background:"none",border:"none",color:"#E2EAF4",cursor:"pointer",minHeight:48,textAlign:"left"}}
                    onMouseEnter={e=>(e.currentTarget.style.background="#111E30")}
                    onMouseLeave={e=>(e.currentTarget.style.background="none")}>
                    <span style={{...T.mono,fontSize:13,fontWeight:700}}>{t}</span>
                    <span style={{...T.muted,fontSize:12,maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{MOCK[t]?.name??""}</span>
                  </button>
                ))}
                {results.length===0&&search.length>0&&!searching&&(
                  <p style={{...T.muted,fontSize:12,...T.mono,textAlign:"center",padding:16}}>No results for "{search}"</p>
                )}
              </div>
            )}
          </div>

          {/* Live dot */}
          <div style={{display:"flex",alignItems:"center",gap:5,flexShrink:0}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:"#00FF94",animation:"pulseDot 2s infinite"}}/>
            <span style={{...T.mono,...T.muted,fontSize:9}}>LIVE</span>
          </div>
        </div>
      </header>

      {/* ── Content area ─────────────────────────────────────────────────── */}
      <main style={{paddingBottom:80 /* space for mobile bottom nav */}}>
        {/* Full-width tabs */}
        {tab==="top15"    && <Top15/>}
        {tab==="mystocks" && <MyStocks/>}

        {/* Two-col tabs */}
        {!isFullWidth&&(
          <div style={{maxWidth:1280,margin:"0 auto",padding:16,display:"grid",gridTemplateColumns:"1fr",gap:16}}>
            {/* On large screens: two columns */}
            <div style={{display:"contents"}}>
              <div id="main-col" style={{minWidth:0}}>
                {tab==="dashboard"&&<DashPanel/>}
                {tab==="ai"&&<AIPanel/>}
              </div>

              {/* Sidebar — only visible on large screens via CSS */}
              <div id="sidebar" style={{display:"none"}}>
                {/* Watchlist */}
                <div style={{...T.card,overflow:"hidden",marginBottom:12}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,padding:"12px 16px",borderBottom:"1px solid #1E293B"}}>
                    <Star size={13} color="#FFB800" fill="#FFB800"/>
                    <span style={{fontSize:13,fontWeight:600}}>Watchlist</span>
                    <span style={{...T.mono,...T.muted,fontSize:10,marginLeft:"auto"}}>{watchlist.length}</span>
                  </div>
                  {watchlist.map((t,i)=>{
                    const q=MOCK[t];const pos=(q?.changePct??0)>=0;
                    return (
                      <button key={t} onClick={()=>selectTicker(t)}
                        style={{display:"flex",justifyContent:"space-between",alignItems:"center",width:"100%",padding:"10px 16px",background:t===ticker?"rgba(0,212,255,0.04)":"none",border:"none",borderBottom:i<watchlist.length-1?"1px solid #111E30":"none",cursor:"pointer",borderLeft:t===ticker?"2px solid #00D4FF":"2px solid transparent",minHeight:48,textAlign:"left"}}
                        onMouseEnter={e=>{if(t!==ticker)e.currentTarget.style.background="#111E30"}}
                        onMouseLeave={e=>{if(t!==ticker)e.currentTarget.style.background="none"}}>
                        <div>
                          <p style={{...T.mono,fontSize:12,fontWeight:700,color:t===ticker?"#00D4FF":"#E2EAF4",marginBottom:1}}>{t}</p>
                          <p style={{...T.muted,fontSize:10,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:100}}>{q?.name}</p>
                        </div>
                        <div style={{textAlign:"right"}}>
                          <p style={{...T.mono,fontSize:12,fontWeight:600}}>{q?fmt$(q.price):"—"}</p>
                          <p style={{...T.mono,fontSize:10,color:pos?"#00FF94":"#FF3B5C"}}>{q?fmtPct(q.changePct):""}</p>
                        </div>
                      </button>
                    );
                  })}
                  <div style={{padding:"8px 12px",borderTop:"1px solid #1E293B",display:"flex",flexWrap:"wrap",gap:5}}>
                    {POPULAR.filter(t=>!watchlist.includes(t)).map(t=>(
                      <button key={t} onClick={()=>toggleWatch(t)}
                        style={{...T.mono,fontSize:10,padding:"3px 8px",borderRadius:5,background:"transparent",border:"1px solid #1E293B",color:"#7A9BBF",cursor:"pointer"}}
                        onMouseEnter={e=>{e.currentTarget.style.borderColor="#00D4FF44";e.currentTarget.style.color="#00D4FF"}}
                        onMouseLeave={e=>{e.currentTarget.style.borderColor="#1E293B";e.currentTarget.style.color="#7A9BBF"}}>
                        +{t}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Market snapshot */}
                <div style={{...T.card,overflow:"hidden",marginBottom:12}}>
                  <div style={{padding:"12px 16px",borderBottom:"1px solid #1E293B"}}>
                    <span style={{fontSize:13,fontWeight:600}}>Market Snapshot</span>
                  </div>
                  {[{n:"S&P 500",v:"5,842",c:"+0.74%"},{n:"NASDAQ",v:"18,843",c:"+1.12%"},{n:"DOW",v:"43,189",c:"+0.42%"},{n:"VIX",v:"14.32",c:"-2.18%"},{n:"10Y",v:"4.28%",c:"+0.03%"}].map((m,i,arr)=>{
                    const pos=m.c.startsWith("+");
                    return (
                      <div key={m.n} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 16px",borderBottom:i<arr.length-1?"1px solid #111E30":undefined}}>
                        <span style={{fontSize:12,...T.muted}}>{m.n}</span>
                        <div><span style={{...T.mono,fontSize:12,fontWeight:600}}>{m.v}</span><span style={{...T.mono,fontSize:10,marginLeft:8,color:pos?"#00FF94":"#FF3B5C"}}>{m.c}</span></div>
                      </div>
                    );
                  })}
                </div>
                {/* Quick nav */}
                <div style={{...T.card,padding:14,display:"flex",flexDirection:"column",gap:8}}>
                  <p style={{...T.mono,fontSize:9,color:"#3D5A7A",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:2}}>Quick Access</p>
                  <button onClick={()=>setTab("top15")} style={{display:"flex",alignItems:"center",gap:8,background:"rgba(255,184,0,0.06)",border:"1px solid rgba(255,184,0,0.2)",borderRadius:8,color:"#FFB800",padding:"8px 12px",cursor:"pointer",fontSize:12,fontWeight:500}}>
                    <Trophy size={13}/> Top 15 Stocks
                  </button>
                  <button onClick={()=>setTab("mystocks")} style={{display:"flex",alignItems:"center",gap:8,background:"rgba(168,85,247,0.06)",border:"1px solid rgba(168,85,247,0.2)",borderRadius:8,color:"#A855F7",padding:"8px 12px",cursor:"pointer",fontSize:12,fontWeight:500}}>
                    <BookOpen size={13}/> My Stocks
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── Mobile bottom navigation ─────────────────────────────────────── */}
      <nav style={{position:"fixed",bottom:0,left:0,right:0,zIndex:100,background:"rgba(6,11,20,0.97)",backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",borderTop:"1px solid #1E293B",paddingBottom:"env(safe-area-inset-bottom,0px)"}}>
        <div style={{display:"flex",alignItems:"stretch"}}>
          {TABS.map(t=>{
            const active=tab===t.id;
            return (
              <button key={t.id} onClick={()=>setTab(t.id)}
                style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"8px 4px 6px",gap:3,background:"none",border:"none",cursor:"pointer",minHeight:56,transition:"all 0.15s",color:active?"#00D4FF":"#3D5A7A"}}>
                <div style={{padding:"3px 12px",borderRadius:20,background:active?"rgba(0,212,255,0.12)":"transparent",transition:"all 0.2s",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  {t.id==="dashboard"&&<LayoutDashboard size={22} strokeWidth={active?2:1.5}/>}
                  {t.id==="top15"    &&<Trophy          size={22} strokeWidth={active?2:1.5}/>}
                  {t.id==="mystocks" &&<BookOpen         size={22} strokeWidth={active?2:1.5}/>}
                  {t.id==="ai"       &&<Brain            size={22} strokeWidth={active?2:1.5}/>}
                </div>
                <span style={{fontSize:10,fontWeight:active?600:400}}>{t.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <style>{`
        @keyframes spin      { to { transform:rotate(360deg); } }
        @keyframes pulseDot  { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(0.8)} }
        @keyframes shimmer   { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        * { box-sizing:border-box; }
        ::-webkit-scrollbar { width:3px; height:3px; }
        ::-webkit-scrollbar-track { background:#0D1321; }
        ::-webkit-scrollbar-thumb { background:#1E293B; border-radius:2px; }
        input { font-size:16px; } /* prevent iOS zoom */
        button, [role="button"] { touch-action:manipulation; }

        /* Desktop two-column layout */
        @media (min-width: 1024px) {
          #main-col { grid-column: 1; }
          #sidebar  { display:block !important; grid-column: 2; }
          main > div[style*="grid-template-columns"] {
            grid-template-columns: 1fr 280px !important;
          }
        }

        /* Hide desktop tab labels on small screens, show on medium+ */
        @media (max-width: 640px) {
          header .tab-label { display:none; }
        }

        /* Logo text only on sm+ */
        .sm-logo { display:none; }
        @media (min-width:480px) { .sm-logo { display:block; } }
      `}</style>
    </div>
  );
}
