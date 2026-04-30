"use client";

import {
  useState, useEffect, useCallback,
  memo, useMemo, useRef,
  type SetStateAction, type Dispatch,
} from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  Search, TrendingUp, TrendingDown, Star, StarOff,
  Trophy, BookOpen, X, Calendar, Newspaper,
  SlidersHorizontal, BarChart2, LayoutDashboard,
  ChevronRight, ExternalLink, Eye, EyeOff, Bell,
  AlertTriangle, GitCompare, Sun, Moon, Zap,
} from "lucide-react";
import { CountdownBar } from "@/components/CountdownBar";
import {
  AnimatedHeadline, ParallaxLayer, TiltCard, SpringButton,
  ScrollReveal, AnimatedGradient,
} from "@/components/landing/LandingFX";
import { AnimatedTab } from "@/components/motion/AnimatedTab";
import AnimatedPrice from "@/components/motion/AnimatedPrice";
import { motion } from "framer-motion";

/* ── Dynamic imports ──────────────────────────────────────── */
const Scene3D         = dynamic(() => import("@/components/landing/Scene3D"),         { ssr:false, loading:() => null });
const ParticleField   = dynamic(() => import("@/components/landing/ParticleField"),   { ssr:false, loading:() => null });
const CursorSpotlight = dynamic(() => import("@/components/landing/CursorSpotlight"), { ssr:false, loading:() => null });
const Top15    = dynamic(() => import("@/components/Top15"),   { ssr:false, loading:() => <PanelSkeleton /> });
const MyStocks = dynamic(() => import("@/components/MyStocks"),{ ssr:false, loading:() => <PanelSkeleton /> });
const EarningsCal    = dynamic<{ onSelectTicker?:(t:string)=>void }>(() => import("@/components/EarningsCalendar"),  { ssr:false, loading:() => <PanelSkeleton /> });
const NewsFeed       = dynamic<{ onSelectTicker?:(t:string)=>void }>(() => import("@/components/NewsFeed"),          { ssr:false, loading:() => <PanelSkeleton /> });
const StockScreener  = dynamic<{ onSelectTicker?:(t:string)=>void }>(() => import("@/components/StockScreener"),     { ssr:false, loading:() => <PanelSkeleton /> });
const PortfolioAnalytics = dynamic<{ onSelectTicker?:(t:string)=>void; onGoPortfolio?:()=>void }>(() => import("@/components/PortfolioAnalytics"), { ssr:false, loading:() => <PanelSkeleton /> });
const WatchlistAlerts = dynamic<{ watchlist:string[]; onToggleWatch:(t:string)=>void; onSelectTicker?:(t:string)=>void }>(() => import("@/components/WatchlistAlerts"), { ssr:false, loading:() => <PanelSkeleton /> });
const StockComparison = dynamic<{ initialTicker:string; onClose:()=>void }>(() => import("@/components/StockComparison"), { ssr:false });
const ProUpgradeModal = dynamic(() => import("@/components/ProUpgradeModal"), { ssr:false });

function PanelSkeleton() {
  return (
    <div style={{ maxWidth:1200, margin:"0 auto", padding:"24px 16px", display:"flex", flexDirection:"column", gap:20 }}>
      {/* Header row: title + toolbar shape */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:16 }}>
        <div className="skel" style={{ height:32, width:"min(280px, 60%)", borderRadius:8 }} />
        <div className="skel" style={{ height:32, width:120, borderRadius:8 }} />
      </div>
      {/* Stat row */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(140px, 1fr))", gap:12 }}>
        {[0,1,2,3].map(i => (
          <div key={i} className="skel" style={{ height:64, borderRadius:12 }} />
        ))}
      </div>
      {/* Chart-shaped block */}
      <div className="skel" style={{ height:280, borderRadius:14, position:"relative" }}>
        {/* Faint ascending bars to hint at chart shape */}
        <svg viewBox="0 0 400 100" preserveAspectRatio="none" style={{ position:"absolute", inset:0, width:"100%", height:"100%", opacity:0.18, pointerEvents:"none" }}>
          <path d="M0,80 Q60,60 120,55 T240,35 T360,45 L400,30" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </div>
      {/* Table rows */}
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {[0,1,2,3,4].map(i => (
          <div key={i} className="skel" style={{ height:48, borderRadius:10, animationDelay: `${i*0.08}s` }} />
        ))}
      </div>
    </div>
  );
}

/* ── Types ────────────────────────────────────────────────── */
interface Quote {
  ticker:string; name:string; price:number; change:number;
  changePct:number; high:number; low:number; open:number; volume:number;
}
interface Bar { date:string; close:number; }
interface IndexData { n:string; v:string; d:string; up:boolean; }
type Tab = "markets"|"top15"|"portfolio"|"earnings"|"news"|"screener"|"analytics"|"watchlist";

/* ── Constants ────────────────────────────────────────────── */
const API_KEY = "1xwzcvUOF9pft6PRNylO2Xc6X2QeQCGr";
const BASE    = "https://api.polygon.io";
const TICKERS = ["AAPL","MSFT","NVDA","GOOGL","META","TSLA","AMZN","AMD"];

const NAMES: Record<string,string> = {
  AAPL:"Apple Inc.",MSFT:"Microsoft Corp.",NVDA:"NVIDIA Corp.",
  GOOGL:"Alphabet Inc.",META:"Meta Platforms",TSLA:"Tesla Inc.",
  AMZN:"Amazon.com Inc.",AMD:"Advanced Micro Devices",
};

const FALLBACK: Record<string,{price:number;changePct:number;volume:number}> = {
  AAPL:{price:203,changePct:-2.3,volume:55_000_000},
  MSFT:{price:363,changePct:-1.7,volume:22_000_000},
  NVDA:{price:177,changePct:-1.1,volume:150_000_000},
  GOOGL:{price:155,changePct:-2.0,volume:30_000_000},
  META:{price:510,changePct:-2.8,volume:18_000_000},
  TSLA:{price:252,changePct:-4.9,volume:120_000_000},
  AMZN:{price:185,changePct:-3.4,volume:50_000_000},
  AMD:{price:95,changePct:-3.2,volume:55_000_000},
};

const MOCK: Record<string,Quote> = Object.fromEntries(
  Object.entries(FALLBACK).map(([t,fb]) => [t,{
    ticker:t, name:NAMES[t]??t,
    price:fb.price, change:+(fb.price*fb.changePct/100).toFixed(2),
    changePct:fb.changePct,
    high:+(fb.price*1.01).toFixed(2), low:+(fb.price*0.99).toFixed(2),
    open:+(fb.price*(1-fb.changePct/200)).toFixed(2), volume:fb.volume,
  }])
);

const INDICES_FALLBACK: IndexData[] = [
  {n:"S&P 500",v:"--",d:"--",up:false},
  {n:"NASDAQ", v:"--",d:"--",up:false},
  {n:"DJIA",   v:"--",d:"--",up:false},
  {n:"VIX",    v:"--",d:"--",up:false},
  {n:"10Y",    v:"--",d:"--",up:false},
  {n:"BTC",    v:"--",d:"--",up:false},
];

const TABS: {id:Tab;label:string;short:string}[] = [
  {id:"markets",   label:"Markets",   short:"Markets"  },
  {id:"top15",     label:"Top 15",    short:"Top 15"   },
  {id:"earnings",  label:"Earnings",  short:"Earnings" },
  {id:"news",      label:"News",      short:"News"     },
  {id:"screener",  label:"Screener",  short:"Screen"   },
  {id:"analytics", label:"Analytics", short:"Analytics"},
  {id:"watchlist", label:"Watchlist", short:"Watch"    },
  {id:"portfolio", label:"Portfolio", short:"Portfolio"},
];

/* ── Design tokens ────────────────────────────────────────── */
const DARK_V = {
  void:"#050407", abyss:"#080610", deep:"#0d0b16",
  surface:"#120f1e", raised:"#1a1628",
  border:"rgba(60,48,100,0.5)", borderHi:"rgba(90,72,150,0.6)",
  gold:"#f0a500", goldBright:"#ffbe1a",
  goldDim:"rgba(240,165,0,0.10)", goldWire:"rgba(240,165,0,0.25)",
  ember:"#ff6b35", emberDim:"rgba(255,107,53,0.10)",
  ink0:"#f4f0ff", ink1:"#cdc7e0", ink2:"#8a82a8", ink3:"#4a4468", ink4:"#2d2848",
  gain:"#00e5a0", gainDim:"rgba(0,229,160,0.08)", gainWire:"rgba(0,229,160,0.22)",
  loss:"#ff4560", lossDim:"rgba(255,69,96,0.08)", lossWire:"rgba(255,69,96,0.22)",
};

const LIGHT_V = {
  void:"#e8dcb8", abyss:"#ddd0a8", deep:"#d4c69c",
  surface:"#ffffff", raised:"#fffaed",
  border:"rgba(120,75,0,0.45)", borderHi:"rgba(120,75,0,0.70)",
  gold:"#8a5200", goldBright:"#a06200",
  goldDim:"rgba(138,82,0,0.14)", goldWire:"rgba(138,82,0,0.45)",
  ember:"#9a2a04", emberDim:"rgba(154,42,4,0.12)",
  ink0:"#0a0500", ink1:"#1f1505", ink2:"#3a2a0a", ink3:"#5c4218", ink4:"#7a5a2a",
  gain:"#004a2c", gainDim:"rgba(0,74,44,0.12)", gainWire:"rgba(0,74,44,0.38)",
  loss:"#8a0a1c", lossDim:"rgba(138,10,28,0.12)", lossWire:"rgba(138,10,28,0.38)",
};

// V is set at runtime based on theme — default dark
let V = DARK_V;
const mono: React.CSSProperties = { fontFamily:"'DM Mono','Courier New',monospace" };
const display: React.CSSProperties = { fontFamily:"'Cabinet Grotesk','Syne',system-ui,sans-serif" };

function getCard(theme: "dark"|"light", ex?: React.CSSProperties): React.CSSProperties {
  const v = theme === "light" ? LIGHT_V : DARK_V;
  return {
    background: theme === "light"
      ? "#ffffff"
      : "linear-gradient(145deg,rgba(255,255,255,0.032) 0%,rgba(255,255,255,0.010) 100%)",
    backdropFilter:"blur(20px) saturate(1.4)",
    WebkitBackdropFilter:"blur(20px) saturate(1.4)",
    border:`1px solid ${v.border}`,
    borderRadius:18,
    boxShadow: theme === "light"
      ? "0 1px 0 rgba(140,90,0,0.10),0 2px 6px rgba(100,60,0,0.10),0 12px 28px rgba(100,60,0,0.18),0 24px 64px rgba(100,60,0,0.10),inset 0 1px 0 rgba(255,255,255,1)"
      : "0 4px 32px rgba(0,0,0,0.6),inset 0 1px 0 rgba(255,255,255,0.045)",
    position:"relative" as const,
    overflow:"hidden",
    transition:"border-color 0.3s,transform 0.3s,box-shadow 0.3s",
    ...ex,
  };
}

const card = (ex?: React.CSSProperties): React.CSSProperties => getCard("dark", ex);

/* ── Polygon helpers ──────────────────────────────────────── */
interface SnapTicker {
  ticker:string;
  day:{c:number;o:number;h:number;l:number;v:number};
  prevDay:{c:number};
}
interface AggBar {c:number;o:number;h:number;l:number;v:number;t:number;}

async function polyFetch<T>(path:string): Promise<T|null> {
  try {
    const sep = path.includes("?")?"&":"?";
    const r = await fetch(`${BASE}${path}${sep}apiKey=${API_KEY}`);
    return r.ok ? (r.json() as Promise<T>) : null;
  } catch { return null; }
}

async function loadBars(ticker:string): Promise<Bar[]> {
  const to   = new Date().toISOString().split("T")[0];
  const from = new Date(Date.now()-92*86_400_000).toISOString().split("T")[0];
  const d = await polyFetch<{results?:AggBar[]}>(
    `/v2/aggs/ticker/${ticker}/range/1/day/${from}/${to}?adjusted=true&sort=asc&limit=120`
  );
  if (!d?.results?.length) return [];
  return d.results.map(b => ({date:new Date(b.t).toISOString().split("T")[0],close:b.c}));
}

async function loadQuote(ticker:string, existingBars?:Bar[]): Promise<Quote> {
  const name = NAMES[ticker]??ticker;
  const bars = existingBars?.length ? existingBars : await loadBars(ticker);
  let price=0,change=0,changePct=0,high=0,low=0,open=0,volume=0;
  if (bars.length>=2) {
    const last=bars[bars.length-1], prev=bars[bars.length-2];
    price=last.close; change=+(last.close-prev.close).toFixed(2);
    changePct=+((change/prev.close)*100).toFixed(2);
    high=+(last.close*1.005).toFixed(2); low=+(last.close*0.995).toFixed(2);
    open=prev.close; volume=FALLBACK[ticker]?.volume??0;
  }
  const snap = await polyFetch<{ticker?:SnapTicker}>(`/v2/snapshot/locale/us/markets/stocks/tickers/${ticker}`);
  const sd = snap?.ticker;
  if (sd&&sd.day?.c>0&&sd.prevDay?.c>0) {
    const sp=sd.day.c,prev=sd.prevDay.c,chg=sp-prev;
    return {ticker,name,price:sp,change:+chg.toFixed(2),changePct:+((chg/prev)*100).toFixed(2),high:sd.day.h||sp,low:sd.day.l||sp,open:sd.day.o||sp,volume:sd.day.v||volume};
  }
  if (price>0) return {ticker,name,price,change,changePct,high,low,open,volume};
  const fb=FALLBACK[ticker];
  if (fb) {
    const chg=+(fb.price*fb.changePct/100).toFixed(2);
    return {ticker,name,price:fb.price,change:chg,changePct:fb.changePct,high:+(fb.price*1.005).toFixed(2),low:+(fb.price*0.995).toFixed(2),open:+(fb.price-chg).toFixed(2),volume:fb.volume};
  }
  return {ticker,name,price:0,change:0,changePct:0,high:0,low:0,open:0,volume:0};
}

function seedBars(base:number,days=90): Bar[] {
  const out:Bar[]=[]; let p=base*0.85, seed=Math.round(base*137);
  const rng=()=>{seed=(seed*1664525+1013904223)&0xffffffff;return (seed>>>0)/0xffffffff;};
  const now=new Date();
  for (let i=days;i>=0;i--) {
    const d=new Date(now);d.setDate(d.getDate()-i);
    if (d.getDay()===0||d.getDay()===6) continue;
    p+=(rng()-0.48)*0.022*p;
    out.push({date:d.toISOString().split("T")[0],close:+p.toFixed(2)});
  }
  return out;
}

async function bulkPrices(tickers:string[]): Promise<Record<string,{price:number;changePct:number}>> {
  const unique=[...new Set(tickers)];
  const result: Record<string,{price:number;changePct:number}> = {};
  const snap = await polyFetch<{tickers?:SnapTicker[]}>(`/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${unique.join(",")}`);
  const snapMap: Record<string,SnapTicker> = {};
  if (snap?.tickers) { for (const s of snap.tickers) snapMap[s.ticker]=s; }
  const needBars:string[] = [];
  for (const t of unique) {
    const s=snapMap[t];
    if (s&&s.day?.c>0&&s.prevDay?.c>0) result[t]={price:s.day.c,changePct:+((s.day.c-s.prevDay.c)/s.prevDay.c*100).toFixed(2)};
    else needBars.push(t);
  }
  const BATCH=4;
  for (let i=0;i<needBars.length;i+=BATCH) {
    const batch=needBars.slice(i,i+BATCH);
    const barData=await Promise.all(batch.map(t=>loadBars(t).then(bars=>({t,bars}))));
    for (const {t,bars} of barData) {
      if (bars.length>=2) {
        const last=bars[bars.length-1],prev=bars[bars.length-2];
        result[t]={price:last.close,changePct:+((last.close-prev.close)/prev.close*100).toFixed(2)};
      }
    }
    if (i+BATCH<needBars.length) await new Promise(r=>setTimeout(r,250));
  }
  for (const t of unique) { if (!result[t]&&FALLBACK[t]) result[t]={price:FALLBACK[t].price,changePct:FALLBACK[t].changePct}; }
  return result;
}

async function fetchIndices(): Promise<IndexData[]> {
  try {
    const [spySnap,qqqSnap,diaSnap,vixSnap,btcSnap] = await Promise.all([
      fetch(`${BASE}/v2/snapshot/locale/us/markets/stocks/tickers/SPY?apiKey=${API_KEY}`).then(r=>r.ok?r.json():null),
      fetch(`${BASE}/v2/snapshot/locale/us/markets/stocks/tickers/QQQ?apiKey=${API_KEY}`).then(r=>r.ok?r.json():null),
      fetch(`${BASE}/v2/snapshot/locale/us/markets/stocks/tickers/DIA?apiKey=${API_KEY}`).then(r=>r.ok?r.json():null),
      fetch(`${BASE}/v2/snapshot/locale/us/markets/stocks/tickers/UVXY?apiKey=${API_KEY}`).then(r=>r.ok?r.json():null),
      fetch(`${BASE}/v2/snapshot/locale/crypto/global/markets/ticker/X:BTCUSD?apiKey=${API_KEY}`).then(r=>r.ok?r.json():null),
    ]);
    const fmt=(n:number,d=2)=>n.toLocaleString("en-US",{minimumFractionDigits:d,maximumFractionDigits:d});
    const pct=(p:number,prev:number)=>{const d=((p-prev)/prev)*100;return{d:`${d>=0?"+":""}${d.toFixed(2)}%`,up:d>=0};};
    const result:IndexData[]=[...INDICES_FALLBACK];
    const spy=(spySnap as {ticker?:{day:{c:number};prevDay:{c:number}}})?.ticker;
    if (spy?.day?.c&&spy?.prevDay?.c){const {d,up}=pct(spy.day.c,spy.prevDay.c);result[0]={n:"S&P 500",v:fmt(spy.day.c*10,0),d,up};}
    const qqq=(qqqSnap as {ticker?:{day:{c:number};prevDay:{c:number}}})?.ticker;
    if (qqq?.day?.c&&qqq?.prevDay?.c){const {d,up}=pct(qqq.day.c,qqq.prevDay.c);result[1]={n:"NASDAQ",v:fmt(qqq.day.c*40,0),d,up};}
    const dia=(diaSnap as {ticker?:{day:{c:number};prevDay:{c:number}}})?.ticker;
    if (dia?.day?.c&&dia?.prevDay?.c){const {d,up}=pct(dia.day.c,dia.prevDay.c);result[2]={n:"DJIA",v:fmt(dia.day.c*100,0),d,up};}
    const vix=(vixSnap as {ticker?:{day:{c:number};prevDay:{c:number}}})?.ticker;
    if (vix?.day?.c&&vix?.prevDay?.c){const {d,up}=pct(vix.day.c,vix.prevDay.c);result[3]={n:"VIX",v:fmt(vix.day.c,2),d,up};}
    const btc=(btcSnap as {ticker?:{day:{c:number};prevDay:{c:number}}})?.ticker;
    if (btc?.day?.c&&btc?.prevDay?.c){const {d,up}=pct(btc.day.c,btc.prevDay.c);result[5]={n:"BTC",v:fmt(btc.day.c,0),d,up};}
    return result;
  } catch { return INDICES_FALLBACK; }
}

async function searchTickers(q:string): Promise<{ticker:string;name:string}[]> {
  const qUp=q.toUpperCase().trim();
  if (!qUp) return [];
  try {
    const [tickerRes,nameRes] = await Promise.all([
      fetch(`${BASE}/v3/reference/tickers?ticker=${encodeURIComponent(qUp)}&active=true&limit=3&market=stocks&apiKey=${API_KEY}`),
      fetch(`${BASE}/v3/reference/tickers?search=${encodeURIComponent(qUp)}&active=true&limit=8&market=stocks&apiKey=${API_KEY}`),
    ]);
    const tickerData=tickerRes.ok?await tickerRes.json() as {results?:{ticker:string;name:string}[]}:null;
    const nameData=nameRes.ok?await nameRes.json() as {results?:{ticker:string;name:string}[]}:null;
    const seen=new Set<string>(); const results:{ticker:string;name:string}[]=[];
    for (const r of tickerData?.results??[]) { if (!seen.has(r.ticker)){seen.add(r.ticker);results.push({ticker:r.ticker,name:r.name??r.ticker});} }
    for (const r of nameData?.results??[]) { if (!seen.has(r.ticker)&&r.ticker.startsWith(qUp)){seen.add(r.ticker);results.push({ticker:r.ticker,name:r.name??r.ticker});} }
    for (const r of nameData?.results??[]) { if (!seen.has(r.ticker)){seen.add(r.ticker);results.push({ticker:r.ticker,name:r.name??r.ticker});} }
    if (results.length) return results.slice(0,8);
  } catch { /**/ }
  return Object.entries(NAMES).map(([ticker,name])=>({ticker,name}))
    .filter(t=>t.ticker.startsWith(qUp)||t.name.toLowerCase().includes(q.toLowerCase()))
    .slice(0,8);
}

/* ── Format helpers ───────────────────────────────────────── */
const f$ = (n:number) => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",minimumFractionDigits:2}).format(n);
const fp = (n:number) => `${n>=0?"+":""}${n.toFixed(2)}%`;
const fv = (n:number) => n>=1e9?`${(n/1e9).toFixed(2)}B`:n>=1e6?`${(n/1e6).toFixed(2)}M`:n>=1e3?`${(n/1e3).toFixed(1)}K`:String(n);

/* ── Shared components ────────────────────────────────────── */
function ChartTip({active,payload,label}:{active?:boolean;payload?:{value:number}[];label?:string}) {
  if (!active||!payload?.length) return null;
  return (
    <div style={{background:V.raised,border:`1px solid ${V.borderHi}`,borderRadius:10,padding:"8px 12px",boxShadow:"0 8px 32px rgba(0,0,0,0.7)"}}>
      <p style={{...mono,fontSize:9,color:V.ink3,marginBottom:3,textTransform:"uppercase",letterSpacing:"0.06em"}}>{label}</p>
      <p style={{...mono,fontSize:14,color:V.ink0,fontWeight:500,letterSpacing:"-0.02em"}}>{f$(payload[0].value)}</p>
    </div>
  );
}

function TabIcon({id,size=20,active}:{id:Tab;size?:number;active:boolean}) {
  const sw=active?2:1.5;
  if (id==="markets")   return <LayoutDashboard size={size} strokeWidth={sw}/>;
  if (id==="top15")     return <Trophy          size={size} strokeWidth={sw}/>;
  if (id==="portfolio") return <BookOpen        size={size} strokeWidth={sw}/>;
  if (id==="earnings")  return <Calendar        size={size} strokeWidth={sw}/>;
  if (id==="news")      return <Newspaper       size={size} strokeWidth={sw}/>;
  if (id==="screener")  return <SlidersHorizontal size={size} strokeWidth={sw}/>;
  if (id==="analytics") return <BarChart2       size={size} strokeWidth={sw}/>;
  if (id==="watchlist") return <Bell            size={size} strokeWidth={sw}/>;
  return null;
}

function YahooBtn({ticker,compact=false}:{ticker:string;compact?:boolean}) {
  return (
    <a href={`https://finance.yahoo.com/quote/${ticker}`} target="_blank" rel="noopener noreferrer"
      onClick={e=>e.stopPropagation()}
      style={{display:"inline-flex",alignItems:"center",gap:compact?3:4,padding:compact?"2px 7px":"4px 9px",borderRadius:6,background:V.goldDim,border:`1px solid ${V.goldWire}`,color:V.gold,textDecoration:"none",fontSize:compact?9:10,...mono,whiteSpace:"nowrap",transition:"background 0.15s",flexShrink:0}}
      onMouseEnter={e=>{(e.currentTarget as HTMLAnchorElement).style.background="rgba(240,165,0,0.16)";}}
      onMouseLeave={e=>{(e.currentTarget as HTMLAnchorElement).style.background=V.goldDim;}}>
      <ExternalLink size={compact?8:10}/>
      {!compact&&"Yahoo"}
    </a>
  );
}

/* ── MarketsPanel ─────────────────────────────────────────── */
interface MarketsPanelProps {
  ticker:string;quote:Quote;bars:Bar[];loading:boolean;
  up:boolean;lineColor:string;watched:boolean;watchlist:string[];
  livePrices:Record<string,{price:number;changePct:number}>;
  indices:IndexData[];
  go:(t:string)=>void;toggleWatch:(t:string)=>void;refreshMarkets:()=>Promise<void>;
  onCompare:(t:string)=>void;
  theme:"dark"|"light";
}

const MarketsPanel = memo(function MarketsPanel({
  ticker,quote,bars,loading,up,lineColor,watched,watchlist,livePrices,indices,go,toggleWatch,refreshMarkets,onCompare,theme,
}:MarketsPanelProps) {
  const v = theme === "light" ? LIGHT_V : DARK_V;
  const c = (ex?: React.CSSProperties) => getCard(theme, ex);
  return (
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      {/* Main chart card */}
      <div className="vx-tilt vx-marquee-card" style={{...c({padding:0})}}>
        <div style={{position:"absolute",top:-40,right:-40,width:220,height:220,borderRadius:"50%",background:up?"rgba(0,229,160,0.06)":"rgba(255,69,96,0.06)",filter:"blur(60px)",pointerEvents:"none"}} />
        <div style={{position:"relative",padding:"24px 24px 0"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
            <div style={{minWidth:0,flex:1}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,flexWrap:"wrap"}}>
                <h1 style={{...mono,fontSize:"clamp(26px,5vw,44px)",fontWeight:500,letterSpacing:"-0.04em",color:v.ink0,flexShrink:0}}>{ticker}</h1>
                <span style={{...mono,fontSize:10,padding:"3px 10px",borderRadius:6,background:up?v.gainDim:v.lossDim,color:up?v.gain:v.loss,border:`1px solid ${up?v.gainWire:v.lossWire}`,display:"inline-flex",alignItems:"center",gap:3,flexShrink:0}}>
                  {up?<TrendingUp size={10}/>:<TrendingDown size={10}/>}{fp(quote.changePct)}
                </span>
                <YahooBtn ticker={ticker}/>
                <button onClick={()=>onCompare(ticker)}
                  style={{display:"inline-flex",alignItems:"center",gap:4,padding:"3px 9px",borderRadius:6,background:"rgba(240,165,0,0.08)",border:"1px solid rgba(240,165,0,0.22)",color:v.gold,fontSize:10,...mono,whiteSpace:"nowrap",cursor:"pointer",transition:"background 0.15s",flexShrink:0}}
                  onMouseEnter={e=>{e.currentTarget.style.background="rgba(240,165,0,0.16)";}}
                  onMouseLeave={e=>{e.currentTarget.style.background="rgba(240,165,0,0.08)";}}>
                  <GitCompare size={10}/> Compare
                </button>
                <button onClick={()=>toggleWatch(ticker)} style={{background:"none",border:"none",cursor:"pointer",padding:4,display:"flex",alignItems:"center",minWidth:36,minHeight:36,justifyContent:"center",borderRadius:8,flexShrink:0}}>
                  {watched?<Star size={17} color={v.gold} fill={v.gold}/>:<StarOff size={17} color={v.ink3}/>}
                </button>
              </div>
              <p style={{color:v.ink2,fontSize:13}}>{quote.name}</p>
            </div>
            <div style={{textAlign:"right",flexShrink:0}}>
              {loading
                ? <div className="skel" style={{width:150,height:44}}/>
                : <>
                    <AnimatedPrice
                      value={quote.price}
                      style={{...mono,fontSize:"clamp(28px,4.5vw,42px)",fontWeight:500,letterSpacing:"-0.04em",color:v.ink0}}
                    />
                    <div style={{...mono,fontSize:12,color:up?v.gain:v.loss,marginTop:4}}>{quote.change>=0?"+":""}{f$(quote.change)} today</div>
                  </>
              }
            </div>
          </div>
          <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch",marginLeft:-24,marginRight:-24,paddingLeft:24,paddingRight:24,marginTop:16}}>
            <div style={{display:"flex",gap:8,minWidth:"max-content",paddingBottom:16}}>
              {[
                {l:"Open",v:f$(quote.open)},
                {l:"High",v:f$(quote.high)},
                {l:"Low", v:f$(quote.low)},
                {l:"Volume",v:fv(quote.volume)},
                {l:"Prev",v:f$(quote.price-quote.change)},
              ].map(s=>(
                <div key={s.l} style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${v.border}`,borderRadius:10,padding:"8px 14px",flexShrink:0}}>
                  <p style={{...mono,fontSize:8,color:v.ink4,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:3}}>{s.l}</p>
                  <p style={{...mono,fontSize:12,fontWeight:500,color:v.ink0}}>{s.v}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{position:"relative"}}>
          <div style={{display:"flex",alignItems:"center",padding:"0 24px 10px",gap:6}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:lineColor,animation:"live-pulse 2.5s ease-in-out infinite"}}/>
            <span style={{...mono,fontSize:9,color:v.ink3,textTransform:"uppercase",letterSpacing:"0.1em"}}>90-day chart · Polygon.io</span>
          </div>
          {loading
            ? <div className="skel" style={{height:200,margin:"0 16px 16px"}}/>
            : <div className="vx-chart-main" style={{height:200,padding:"0 4px 16px"}}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={bars} margin={{top:4,right:8,left:0,bottom:0}}>
                    <defs>
                      <linearGradient id="vxGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={lineColor} stopOpacity={0.3}/>
                        <stop offset="100%" stopColor={lineColor} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="2 8" stroke="rgba(255,255,255,0.03)" vertical={false}/>
                    <XAxis dataKey="date" tick={{fill:v.ink4,fontSize:8,fontFamily:"DM Mono"}} tickLine={false} axisLine={false} interval="preserveStartEnd"/>
                    <YAxis tick={{fill:v.ink4,fontSize:8,fontFamily:"DM Mono"}} tickLine={false} axisLine={false} tickFormatter={(v:number)=>`$${v.toFixed(0)}`} width={44} domain={["auto","auto"]}/>
                    <Tooltip content={<ChartTip/>} cursor={{stroke:v.borderHi,strokeWidth:1}}/>
                    <Area
                      type="monotone"
                      dataKey="close"
                      stroke={lineColor}
                      strokeWidth={1.8}
                      fill="url(#vxGrad)"
                      dot={false}
                      activeDot={{r:5,fill:lineColor,stroke:v.void,strokeWidth:2}}
                      isAnimationActive={true}
                      animationBegin={120}
                      animationDuration={1800}
                      animationEasing="ease-out"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
          }
        </div>
      </div>

      <CountdownBar onRefresh={refreshMarkets} label="Next market update"/>

      {/* Quick select */}
      <div>
        <p style={{...mono,fontSize:9,color:v.ink3,textTransform:"uppercase",letterSpacing:"0.14em",marginBottom:10}}>Quick Select</p>
        <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch",marginLeft:-16,marginRight:-16,paddingLeft:16,paddingRight:16}}>
          <div style={{display:"flex",gap:8,minWidth:"max-content",paddingBottom:2}}>
            {TICKERS.map(t=>{
              const live=livePrices[t];
              const changePct=live?.changePct??FALLBACK[t]?.changePct??0;
              const pos=changePct>=0, active=t===ticker;
              return (
                <button key={t} onClick={()=>go(t)}
                  style={{flexShrink:0,display:"flex",flexDirection:"column",alignItems:"flex-start",padding:"10px 14px",borderRadius:12,border:"1px solid",cursor:"pointer",minWidth:68,minHeight:52,transition:"all 0.25s",
                    background:active?"linear-gradient(135deg,rgba(240,165,0,0.12),rgba(240,165,0,0.05))":"rgba(255,255,255,0.025)",
                    borderColor:active?v.goldWire:v.border}}>
                  <span style={{...mono,fontSize:12,fontWeight:500,color:active?v.gold:v.ink0}}>{t}</span>
                  <span style={{...mono,fontSize:9,color:pos?v.gain:v.loss,marginTop:2}}>{fp(changePct)}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Watchlist */}
      <div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
          <div style={{display:"flex",alignItems:"center",gap:7}}>
            <Star size={13} color={v.gold} fill={v.gold}/>
            <span style={{...display,fontSize:13,fontWeight:700,color:v.ink0}}>Watchlist</span>
          </div>
          <span style={{...mono,fontSize:10,color:v.ink3}}>{watchlist.length} tracked</span>
        </div>
        <div className="vx-tilt" style={{...c({overflow:"hidden"})}}>
          {watchlist.length===0&&(
            <div style={{padding:"32px 20px",textAlign:"center"}}>
              <div style={{fontSize:32,marginBottom:8,opacity:0.6}}>★</div>
              <p style={{color:v.ink2,fontSize:13,fontWeight:500,marginBottom:4}}>No tickers tracked yet</p>
              <p style={{color:v.ink3,fontSize:11}}>Star any ticker to follow it here</p>
            </div>
          )}
          {watchlist.map((t,i)=>{
            const live=livePrices[t];
            const price=live?.price??FALLBACK[t]?.price??0;
            const changePct=live?.changePct??FALLBACK[t]?.changePct??0;
            const pos=changePct>=0;
            return (
              <motion.button
                key={t}
                onClick={()=>go(t)}
                initial={{opacity:0,x:-12}}
                animate={{opacity:1,x:0}}
                transition={{delay:i*0.04,type:"spring",stiffness:280,damping:24}}
                style={{display:"flex",justifyContent:"space-between",alignItems:"center",width:"100%",padding:"13px 18px",background:t===ticker?"linear-gradient(90deg,rgba(240,165,0,0.07),transparent)":"none",border:"none",cursor:"pointer",minHeight:54,textAlign:"left",transition:"background 0.2s",borderLeft:t===ticker?`2px solid ${v.gold}`:"2px solid transparent",borderBottom:i<watchlist.length-1?`1px solid ${v.border}`:"none"}}
                className="row-hover">
                <div>
                  <p style={{...mono,fontSize:13,fontWeight:500,color:t===ticker?v.gold:v.ink0}}>{t}</p>
                  <p style={{color:v.ink3,fontSize:11,marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"min(180px,40vw)"}}>{NAMES[t]??t}</p>
                </div>
                <div style={{textAlign:"right",marginLeft:8}}>
                  <p style={{...mono,fontSize:13,fontWeight:500,color:v.ink0}}>{price>0?f$(price):"---"}</p>
                  <p style={{...mono,fontSize:11,color:pos?v.gain:v.loss,marginTop:1}}>{fp(changePct)}</p>
                </div>
              </motion.button>
            );
          })}
          <div style={{padding:"10px 14px",borderTop:`1px solid ${v.border}`,display:"flex",flexWrap:"wrap",gap:5}}>
            {TICKERS.filter(t=>!watchlist.includes(t)).map(t=>(
              <button key={t} onClick={()=>toggleWatch(t)}
                style={{...mono,fontSize:10,padding:"5px 10px",borderRadius:6,background:"transparent",border:`1px solid ${v.border}`,color:v.ink3,cursor:"pointer",minHeight:32,transition:"all 0.2s"}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=v.goldWire;e.currentTarget.style.color=v.gold;}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor=v.border;e.currentTarget.style.color=v.ink3;}}>
                +{t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Global Markets */}
      <div>
        <p style={{...display,fontSize:13,fontWeight:700,color:v.ink0,marginBottom:10}}>Global Markets</p>
        <div className="vx-tilt" style={{...c({overflow:"hidden"})}}>
          {indices.map((m,i)=>(
            <div key={m.n} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 18px",borderBottom:i<indices.length-1?`1px solid ${v.border}`:"none"}}>
              <span style={{color:v.ink2,fontSize:13,fontWeight:500}}>{m.n}</span>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <span style={{...mono,fontSize:13,fontWeight:500,color:v.ink0}}>{m.v}</span>
                <span style={{...mono,fontSize:11,color:m.up?v.gain:v.loss,minWidth:56,textAlign:"right"}}>{m.d}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

/* ── Sidebar ──────────────────────────────────────────────── */
interface SidebarProps {
  ticker:string;watchlist:string[];
  livePrices:Record<string,{price:number;changePct:number}>;
  indices:IndexData[];
  go:(t:string)=>void;toggleWatch:(t:string)=>void;
  setTab:Dispatch<SetStateAction<Tab>>;
  theme:"dark"|"light";
}

const Sidebar = memo(function Sidebar({ticker,watchlist,livePrices,indices,go,toggleWatch,setTab,theme}:SidebarProps) {
  const v = theme === "light" ? LIGHT_V : DARK_V;
  const c = (ex?: React.CSSProperties) => getCard(theme, ex);
  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div className="vx-tilt" style={{...c({overflow:"hidden",padding:0})}}>
        <div style={{display:"flex",alignItems:"center",gap:8,padding:"12px 16px",borderBottom:`1px solid ${v.border}`}}>
          <Star size={13} color={v.gold} fill={v.gold}/>
          <span style={{...display,fontSize:13,fontWeight:700,color:v.ink0}}>Watchlist</span>
          <span style={{...mono,fontSize:10,color:v.ink3,marginLeft:"auto"}}>{watchlist.length}</span>
        </div>
        {watchlist.map((t,i)=>{
          const live=livePrices[t];
          const price=live?.price??FALLBACK[t]?.price??0;
          const changePct=live?.changePct??FALLBACK[t]?.changePct??0;
          const pos=changePct>=0;
          return (
            <motion.button
              key={t}
              onClick={()=>go(t)}
              initial={{opacity:0,x:-10}}
              animate={{opacity:1,x:0}}
              transition={{delay:i*0.035,type:"spring",stiffness:300,damping:24}}
              style={{display:"flex",justifyContent:"space-between",alignItems:"center",width:"100%",padding:"11px 16px",background:t===ticker?"linear-gradient(90deg,rgba(240,165,0,0.06),transparent)":"none",border:"none",cursor:"pointer",borderBottom:i<watchlist.length-1?`1px solid ${v.border}`:"none",borderLeft:t===ticker?`2px solid ${v.gold}`:"2px solid transparent",minHeight:48,textAlign:"left",transition:"background 0.18s"}}
              className="row-hover">
              <div>
                <p style={{...mono,fontSize:12,fontWeight:500,color:t===ticker?v.gold:v.ink0}}>{t}</p>
                <p style={{color:v.ink3,fontSize:10,marginTop:1,maxWidth:100,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{NAMES[t]??t}</p>
              </div>
              <div style={{textAlign:"right"}}>
                <p style={{...mono,fontSize:12,fontWeight:500,color:v.ink0}}>{price>0?f$(price):"---"}</p>
                <p style={{...mono,fontSize:10,color:pos?v.gain:v.loss,marginTop:1}}>{fp(changePct)}</p>
              </div>
            </motion.button>
          );
        })}
        <div style={{padding:"8px 12px",borderTop:`1px solid ${v.border}`,display:"flex",flexWrap:"wrap",gap:4}}>
          {TICKERS.filter(t=>!watchlist.includes(t)).map(t=>(
            <button key={t} onClick={()=>toggleWatch(t)}
              style={{...mono,fontSize:9,padding:"3px 8px",borderRadius:5,background:"transparent",border:`1px solid ${v.border}`,color:v.ink3,cursor:"pointer",transition:"all 0.18s"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=v.goldWire;e.currentTarget.style.color=v.gold;}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=v.border;e.currentTarget.style.color=v.ink3;}}>
              +{t}
            </button>
          ))}
        </div>
      </div>

      <div className="vx-tilt" style={{...c({overflow:"hidden",padding:0})}}>
        <div style={{padding:"12px 16px",borderBottom:`1px solid ${v.border}`}}>
          <span style={{...display,fontSize:13,fontWeight:700,color:v.ink0}}>Global Markets</span>
        </div>
        {indices.map((m,i)=>(
          <div key={m.n} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 16px",borderBottom:i<indices.length-1?`1px solid ${v.border}`:"none"}}>
            <span style={{color:v.ink2,fontSize:12,fontWeight:500}}>{m.n}</span>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{...mono,fontSize:12,fontWeight:500,color:v.ink0}}>{m.v}</span>
              <span style={{...mono,fontSize:10,color:m.up?v.gain:v.loss,minWidth:48,textAlign:"right"}}>{m.d}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Explore nav */}
      <div className="vx-tilt" style={{...c({padding:14})}}>
        <p style={{...mono,fontSize:9,color:v.ink4,textTransform:"uppercase",letterSpacing:"0.14em",marginBottom:10}}>Explore</p>
        <div style={{display:"flex",flexDirection:"column",gap:5}}>
          {([
            {id:"top15"     as Tab, label:"Top 15 Stocks",      color:v.gold,  bg:v.goldDim,  wire:v.goldWire},
            {id:"earnings"  as Tab, label:"Earnings Cal.",        color:"#7eb6ff",bg:"rgba(79,142,247,0.08)", wire:"rgba(79,142,247,0.22)"},
            {id:"news"      as Tab, label:"News Feed",            color:v.gain,  bg:v.gainDim,  wire:v.gainWire},
            {id:"screener"  as Tab, label:"Stock Screener",       color:"#c084fc",bg:"rgba(192,132,252,0.08)",wire:"rgba(192,132,252,0.22)"},
            {id:"analytics" as Tab, label:"Portfolio Analytics",  color:v.gold,  bg:v.goldDim,  wire:v.goldWire},
            {id:"watchlist" as Tab, label:"Watchlist & Alerts",   color:v.ember, bg:v.emberDim, wire:v.goldWire},
            {id:"portfolio" as Tab, label:"My Portfolio",         color:"#c084fc",bg:"rgba(192,132,252,0.08)",wire:"rgba(192,132,252,0.22)"},
          ] as const).map(item=>(
            <button key={item.id} onClick={()=>setTab(item.id)}
              style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:item.bg,border:`1px solid ${item.wire}`,borderRadius:10,color:item.color,padding:"9px 12px",cursor:"pointer",fontSize:12,fontWeight:600,...display,minHeight:40,transition:"opacity 0.15s"}}
              onMouseEnter={e=>e.currentTarget.style.opacity="0.8"}
              onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
              <span>{item.label}</span>
              <ChevronRight size={13}/>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
});

/* ── GlobalAuthForm ───────────────────────────────────────── */
function GlobalAuthForm({onSuccess}:{onSuccess:()=>void}) {
  const [mode,setMode]       = useState<"login"|"signup">("login");
  const [email,setEmail]     = useState("");
  const [password,setPassword] = useState("");
  const [showPw,setShowPw]   = useState(false);
  const [loading,setLoading] = useState(false);
  const [error,setError]     = useState("");

  const submit = async () => {
    if (!email||!password){setError("Please fill in all fields.");return;}
    setLoading(true);setError("");
    try {
      const r=await fetch("/api/auth",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:mode,email,password})});
      const d=await r.json() as {success?:boolean;error?:string;user?:{email:string;token:string}};
      if (d.success&&d.user) {
        try{localStorage.setItem("arbibx-auth-user",JSON.stringify(d.user));window.dispatchEvent(new Event("arbibx-login"));}catch{/***/}
        onSuccess();
      } else {setError(d.error??"Something went wrong.");}
    } catch {setError("Network error — please try again.");}
    setLoading(false);
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div>
        <label style={{...mono,fontSize:9,color:V.ink3,textTransform:"uppercase",letterSpacing:"0.1em",display:"block",marginBottom:6}}>Email</label>
        <input type="email" value={email} onChange={e=>{setEmail(e.target.value);setError("");}} onKeyDown={e=>e.key==="Enter"&&submit()} placeholder="your@email.com"
          style={{width:"100%",background:"rgba(255,255,255,0.04)",border:`1px solid ${V.border}`,borderRadius:10,color:V.ink0,...mono,fontSize:14,padding:"11px 14px",outline:"none",boxSizing:"border-box" as const,transition:"border-color 0.2s"}}
          onFocus={e=>e.target.style.borderColor=V.goldWire}
          onBlur={e=>e.target.style.borderColor=V.border}/>
      </div>
      <div>
        <label style={{...mono,fontSize:9,color:V.ink3,textTransform:"uppercase",letterSpacing:"0.1em",display:"block",marginBottom:6}}>Password</label>
        <div style={{position:"relative"}}>
          <input type={showPw?"text":"password"} value={password} onChange={e=>{setPassword(e.target.value);setError("");}} onKeyDown={e=>e.key==="Enter"&&submit()} placeholder={mode==="signup"?"At least 6 characters":"Your password"}
            style={{width:"100%",background:"rgba(255,255,255,0.04)",border:`1px solid ${V.border}`,borderRadius:10,color:V.ink0,...mono,fontSize:14,padding:"11px 40px 11px 14px",outline:"none",boxSizing:"border-box" as const,transition:"border-color 0.2s"}}
            onFocus={e=>e.target.style.borderColor=V.goldWire}
            onBlur={e=>e.target.style.borderColor=V.border}/>
          <button onClick={()=>setShowPw(s=>!s)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:V.ink3,display:"flex",alignItems:"center"}}>
            {showPw?<EyeOff size={15}/>:<Eye size={15}/>}
          </button>
        </div>
      </div>
      {error&&(
        <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 12px",borderRadius:9,background:V.lossDim,border:`1px solid ${V.lossWire}`}}>
          <AlertTriangle size={13} color={V.loss}/>
          <span style={{fontSize:12,color:V.loss}}>{error}</span>
        </div>
      )}
      <button onClick={submit} disabled={loading}
        style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,padding:"13px 20px",borderRadius:11,background:loading?"rgba(240,165,0,0.3)":"linear-gradient(135deg,#f0a500,#ffbe1a)",border:"none",color:"#0a0800",cursor:loading?"not-allowed":"pointer",fontSize:14,fontWeight:800,...display,opacity:loading?0.7:1,boxShadow:loading?"none":"0 4px 24px rgba(240,165,0,0.35)",transition:"all 0.2s"}}>
        {loading?"Please wait...":mode==="login"?"Sign In":"Create Account"}
      </button>
      <p style={{textAlign:"center",fontSize:13,color:V.ink3,margin:0}}>
        {mode==="login"?"Don't have an account? ":"Already have an account? "}
        <button onClick={()=>{setMode(m=>m==="login"?"signup":"login");setError("");}} style={{background:"none",border:"none",color:V.gold,cursor:"pointer",fontSize:13,fontWeight:600,padding:0}}>
          {mode==="login"?"Sign up free":"Sign in"}
        </button>
      </p>
    </div>
  );
}

/* ── DesktopSideNav ───────────────────────────────────────────
   Fixed-position vertical nav on the left. Linear/Notion/Stripe
   style: icon + label per tab, springy active indicator that
   slides between tabs via layoutId, theme-aware styling.
   Only renders at >=1024px (controlled via CSS). */
function DesktopSideNav({tab,setTab}:{tab:Tab;setTab:(t:Tab)=>void}) {
  return (
    <aside className="vx-side-nav" aria-label="Primary navigation">
      <nav style={{display:"flex",flexDirection:"column",gap:4,padding:"24px 12px"}}>
        <p style={{...mono,fontSize:9,color:V.ink4,textTransform:"uppercase",letterSpacing:"0.16em",padding:"0 12px 12px",fontWeight:500}}>Terminal</p>
        {TABS.map(t => {
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={()=>setTab(t.id)}
              className={`vx-side-nav__item ${active ? "is-active" : ""}`}
              aria-current={active ? "page" : undefined}>
              {active && (
                <motion.span
                  layoutId="vx-side-nav-indicator"
                  aria-hidden
                  className="vx-side-nav__indicator"
                  transition={{type:"spring",stiffness:380,damping:30}}
                />
              )}
              <span className="vx-side-nav__icon">
                <TabIcon id={t.id} size={16} active={active}/>
              </span>
              <span className="vx-side-nav__label">{t.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

/* ── MobileNav ─────────────────────────────────────────────── */
function MobileNav({tab,setTab}:{tab:Tab;setTab:(t:Tab)=>void}) {
  return (
    <nav className="vx-bottom-nav">
      <div style={{display:"grid",gridTemplateColumns:"repeat(8,1fr)",position:"relative"}}>
        {TABS.map(t=>{
          const active=tab===t.id;
          return (
            <button key={t.id} onClick={()=>setTab(t.id)}
              style={{position:"relative",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"7px 2px 5px",gap:2,background:"none",border:"none",cursor:"pointer",minHeight:52,color:active?"#f0a500":"#2d2848",transition:"color 0.2s",touchAction:"manipulation",fontFamily:"'Syne',system-ui,sans-serif"}}>
              {active && (
                <motion.div
                  layoutId="vx-mobile-tab-indicator"
                  style={{position:"absolute",top:4,left:"50%",transform:"translateX(-50%)",width:32,height:28,borderRadius:10,background:"rgba(240,165,0,0.12)",border:"1px solid rgba(240,165,0,0.28)"}}
                  transition={{type:"spring",stiffness:400,damping:32}}
                />
              )}
              <div style={{padding:"2px 4px",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",position:"relative",zIndex:1}}>
                <TabIcon id={t.id} size={18} active={active}/>
              </div>
              <span style={{fontSize:8,fontWeight:active?700:400,whiteSpace:"nowrap",letterSpacing:"-0.01em",position:"relative",zIndex:1}}>{t.short}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/* ══════════════════════════════════════════════════════════════
   ROOT
   ══════════════════════════════════════════════════════════════ */
export default function ArbibX() {
  const [ticker,    setTicker]    = useState("AAPL");
  const [quote,     setQuote]     = useState<Quote>(MOCK["AAPL"]??{ticker:"AAPL",name:"Apple Inc.",price:203,change:-4.7,changePct:-2.3,high:205,low:200,open:207,volume:55_000_000});
  const [bars,      setBars]      = useState<Bar[]>(()=>seedBars(203));
  const [watchlist, setWatchlist] = useState<string[]>(()=>{
    try{const s=localStorage.getItem("arbibx-watchlist");return s?JSON.parse(s):["AAPL","NVDA","MSFT","META"];}
    catch{return ["AAPL","NVDA","MSFT","META"];}
  });
  const [search,    setSearch]    = useState("");
  const [results,   setResults]   = useState<{ticker:string;name:string}[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [tab,       setTab]       = useState<Tab>("markets");
  const [searching, setSearching] = useState(false);
  const [showSearch,setShowSearch]= useState(false);
  const [livePrices,setLivePrices]= useState<Record<string,{price:number;changePct:number}>>({});
  const [indices,   setIndices]   = useState<IndexData[]>(INDICES_FALLBACK);
  const [showAuthModal,setShowAuthModal]= useState(false);
  const [isLoggedIn,setIsLoggedIn]= useState(()=>{try{return !!localStorage.getItem("arbibx-auth-user");}catch{return false;}});
  const [showLanding,setShowLanding]= useState(()=>{try{return !localStorage.getItem("arbibx-visited");}catch{return true;}});
  const [showCompare,  setShowCompare]  = useState(false);
  const [showProModal, setShowProModal] = useState(false);
  const [proReason,    setProReason]    = useState("");
  const [isPro,        setIsPro]        = useState(false);
  const [theme, setTheme] = useState<"dark"|"light">(() => {
    try { return (localStorage.getItem("arbibx-theme") ?? "dark") as "dark"|"light"; } catch { return "dark"; }
  });

  // Check Pro status on mount and login
  useEffect(()=>{
    const checkPro = async () => {
      try {
        const stored = localStorage.getItem("arbibx-auth-user");
        if (!stored) return;
        const { email, token } = JSON.parse(stored) as { email:string; token:string };
        const r = await fetch(`/api/subscription?email=${encodeURIComponent(email)}&token=${token}`);
        const d = await r.json() as { isPro:boolean };
        setIsPro(d.isPro);
      } catch { /**/ }
    };
    checkPro();
    window.addEventListener("arbibx-login", checkPro);
    // Handle Stripe success redirect
    const params = new URLSearchParams(window.location.search);
    if (params.get("pro")==="success") {
      setIsPro(true); setTab("portfolio");
      window.history.replaceState({},""," /");
    }
    return ()=>window.removeEventListener("arbibx-login", checkPro);
  },[]);

  // Apply theme to document and update V tokens
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem("arbibx-theme", theme); } catch { /**/ }
    // Update the module-level V so all components re-render with correct colors
    V = theme === "light" ? LIGHT_V : DARK_V;
  }, [theme]);

  const themeBtnRef = useRef<HTMLButtonElement>(null);
  const toggleTheme = () => {
    const btn = themeBtnRef.current;
    const next = theme === "dark" ? "light" : "dark";
    // Circular reveal animation from the toggle button.
    // Falls back to instant swap when View Transitions API isn't supported,
    // user prefers reduced motion, OR the device is mobile / coarse-pointer
    // (the snapshot+blend cost of VT runs at ~3fps on mid-range mobile GPUs
    // and the animation is barely visible at touch-screen sizes anyway).
    const reduce = typeof window !== "undefined"
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isMobile = typeof window !== "undefined"
      && (window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 768);
    type DocWithVT = Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } };
    const doc = document as DocWithVT;
    if (!btn || !doc.startViewTransition || reduce || isMobile) {
      setTheme(next);
      return;
    }
    const r = btn.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const radius = Math.hypot(
      Math.max(cx, window.innerWidth - cx),
      Math.max(cy, window.innerHeight - cy),
    );
    document.documentElement.style.setProperty("--vt-x", `${cx}px`);
    document.documentElement.style.setProperty("--vt-y", `${cy}px`);
    document.documentElement.style.setProperty("--vt-r", `${radius}px`);
    const transition = doc.startViewTransition(() => setTheme(next));
    transition.ready.then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0 at ${cx}px ${cy}px)`,
            `circle(${radius}px at ${cx}px ${cy}px)`,
          ],
        },
        { duration: 600, easing: "cubic-bezier(0.4, 0, 0.2, 1)", pseudoElement: "::view-transition-new(root)" },
      );
    }).catch(() => { /* swallow — already transitioning */ });
  };

  // Recompute V synchronously for this render
  V = theme === "light" ? LIGHT_V : DARK_V;
  const searchRef = useRef<HTMLDivElement>(null);

  const enterApp = (asGuest=true) => {
    try{localStorage.setItem("arbibx-visited","1");}catch{/***/}
    setShowLanding(false);
    if (!asGuest){setShowAuthModal(true);setTab("portfolio");}
  };

  // Live indices
  useEffect(()=>{
    fetchIndices().then(setIndices);
    const id=setInterval(()=>fetchIndices().then(setIndices),5*60*1000);
    return()=>clearInterval(id);
  },[]);

  const load=useCallback(async(t:string)=>{
    setLoading(true);
    const b=await loadBars(t);
    const realBars=b.length?b:seedBars(FALLBACK[t]?.price??150);
    const q=await loadQuote(t,realBars);
    setQuote(q);setBars(realBars);setLoading(false);
  },[]);
  useEffect(()=>{load(ticker);},[ticker,load]);

  const tickerRef=useRef(ticker);
  useEffect(()=>{tickerRef.current=ticker;},[ticker]);

  const refreshMarkets=useCallback(async()=>{
    const t=tickerRef.current;
    const b=await loadBars(t);
    const realBars=b.length?b:seedBars(FALLBACK[t]?.price??150);
    const q=await loadQuote(t,realBars);
    setQuote(q);setBars(realBars);
    fetchIndices().then(setIndices);
  },[]);

  const fetchLivePrices=useCallback(async()=>{
    const all=[...new Set([...TICKERS,...watchlist])];
    const prices=await bulkPrices(all);
    if (Object.keys(prices).length>0) setLivePrices(prices);
  },[watchlist]);
  useEffect(()=>{fetchLivePrices();},[fetchLivePrices]);

  useEffect(()=>{
    if (!search.trim()){setResults([]);return;}
    const id=setTimeout(async()=>{setSearching(true);setResults(await searchTickers(search));setSearching(false);},300);
    return()=>clearTimeout(id);
  },[search]);

  useEffect(()=>{
    const h=(e:MouseEvent)=>{
      if (searchRef.current&&!searchRef.current.contains(e.target as Node)){setResults([]);setShowSearch(false);}
    };
    document.addEventListener("mousedown",h);
    return()=>document.removeEventListener("mousedown",h);
  },[]);

  // Keyboard shortcuts. K opens search, T toggles theme, 1-8 switch tabs,
  // Escape closes search/modals. Skipped while user types in any input/textarea.
  useEffect(()=>{
    const isTyping = (el: EventTarget | null): boolean => {
      const t = el as HTMLElement | null;
      if (!t) return false;
      const tag = t.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t.isContentEditable;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return; // don't fight browser shortcuts
      if (isTyping(e.target)) return;
      if (showLanding) return;
      const k = e.key.toLowerCase();
      if (k === "escape") {
        if (showSearch) { setShowSearch(false); setSearch(""); setResults([]); }
        if (showCompare) setShowCompare(false);
        if (showAuthModal) setShowAuthModal(false);
        if (showProModal) setShowProModal(false);
        return;
      }
      if (k === "k") { e.preventDefault(); setShowSearch(s => !s); return; }
      if (k === "t") { e.preventDefault(); toggleTheme(); return; }
      if (k === "/" ) { e.preventDefault(); setShowSearch(true); return; }
      // Number keys 1-8 → tabs
      const num = parseInt(k, 10);
      if (!Number.isNaN(num) && num >= 1 && num <= TABS.length) {
        e.preventDefault();
        setTab(TABS[num - 1].id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[showLanding, showSearch, showCompare, showAuthModal, showProModal]);

  const go=useCallback((t:string)=>{setTicker(t);setSearch("");setResults([]);setShowSearch(false);setTab("markets");},[]);
  const toggleWatch=useCallback((t:string)=>{
    setWatchlist(w=>{
      const next=w.includes(t)?w.filter(x=>x!==t):[...w,t];
      try{localStorage.setItem("arbibx-watchlist",JSON.stringify(next));}catch{/***/}
      return next;
    });
  },[]);

  const up=quote.changePct>=0;
  const lineColor=up?V.gain:V.loss;
  const watched=watchlist.includes(ticker);

  const marketProps=useMemo<MarketsPanelProps>(()=>({ticker,quote,bars,loading,up,lineColor,watched,watchlist,livePrices,indices,go,toggleWatch,refreshMarkets,onCompare:()=>setShowCompare(true),theme}),[ticker,quote,bars,loading,up,lineColor,watched,watchlist,livePrices,indices,go,toggleWatch,refreshMarkets,theme]);
  const sideProps=useMemo<SidebarProps>(()=>({ticker,watchlist,livePrices,indices,go,toggleWatch,setTab,theme}),[ticker,watchlist,livePrices,indices,go,toggleWatch,theme]);

  return (
    <div style={{minHeight:"100vh",background:V.void,color:V.ink1,fontFamily:"'Syne',system-ui,sans-serif"}}>

      {/* ════ LANDING PAGE ════════════════════════════════════ */}
      {showLanding&&(
        <div style={{position:"fixed",inset:0,zIndex:10000,background:V.void,display:"flex",flexDirection:"column",overflow:"auto",overscrollBehavior:"none",fontFamily:"'Cabinet Grotesk','Syne',system-ui,sans-serif"}}>
          <style>{`
            body{overflow:hidden!important;position:fixed;width:100%}
            @keyframes drift1{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(-30px,20px) scale(1.05)}66%{transform:translate(20px,-15px) scale(0.97)}}
            @keyframes drift2{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(25px,-30px) scale(1.03)}66%{transform:translate(-15px,20px) scale(0.98)}}
            @keyframes drift3{0%,100%{transform:translate(0,0)}50%{transform:translate(-20px,25px) scale(1.04)}}
            @keyframes fadeUp{from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:translateY(0)}}
            @keyframes live-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.3;transform:scale(.6)}}
            .land-cta-primary{display:inline-flex;align-items:center;gap:10px;padding:15px 36px;border-radius:13px;background:linear-gradient(135deg,#f0a500,#ffbe1a);border:none;color:#0a0800;font-family:'Cabinet Grotesk','Syne',system-ui,sans-serif;font-size:14px;font-weight:800;letter-spacing:0.04em;cursor:pointer;box-shadow:0 4px 32px rgba(240,165,0,0.40),0 1px 0 rgba(255,255,255,0.3) inset;transition:all 0.3s cubic-bezier(0.23,1,0.32,1)}
            .land-cta-primary:hover{transform:translateY(-3px);box-shadow:0 14px 48px rgba(240,165,0,0.55),0 1px 0 rgba(255,255,255,0.3) inset}
            .land-cta-ghost{display:inline-flex;align-items:center;gap:10px;padding:14px 32px;border-radius:13px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.12);color:#cdc7e0;font-family:'Cabinet Grotesk','Syne',system-ui,sans-serif;font-size:14px;font-weight:600;cursor:pointer;transition:all 0.25s}
            .land-cta-ghost:hover{background:rgba(255,255,255,0.08);border-color:rgba(240,165,0,0.35);color:#f4f0ff}
            .feat-card{background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.07);border-radius:16px;padding:20px;transition:all 0.3s cubic-bezier(0.23,1,0.32,1);text-align:left}
            .feat-card:hover{background:rgba(240,165,0,0.05);border-color:rgba(240,165,0,0.2);transform:translateY(-5px) scale(1.01);box-shadow:0 24px 60px rgba(0,0,0,0.5)}
          `}</style>

          {/* Cinematic background — 3D scene + particles + animated gradient */}
          <div style={{position:"absolute",inset:0,overflow:"hidden",pointerEvents:"none",zIndex:0}}>
            <AnimatedGradient />
            <div className="vx-scene-3d" style={{position:"absolute",inset:0}}>
              <Scene3D />
            </div>
            <ParticleField density={110} />
            <div style={{position:"absolute",inset:0,backgroundImage:"linear-gradient(rgba(255,255,255,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.02) 1px,transparent 1px)",backgroundSize:"80px 80px",maskImage:"radial-gradient(ellipse 80% 60% at 50% 0%,black 0%,transparent 100%)",zIndex:2}}/>
            <div style={{position:"absolute",top:0,left:"50%",width:"1px",height:"35%",background:"linear-gradient(180deg,rgba(240,165,0,0.45) 0%,transparent 100%)",zIndex:2}}/>
            <div style={{position:"absolute",top:0,left:"25%",width:"1px",height:"22%",background:"linear-gradient(180deg,rgba(255,255,255,0.08) 0%,transparent 100%)",zIndex:2}}/>
            <div style={{position:"absolute",top:0,left:"75%",width:"1px",height:"18%",background:"linear-gradient(180deg,rgba(255,255,255,0.06) 0%,transparent 100%)",zIndex:2}}/>
            <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse 90% 70% at 50% 60%, transparent 0%, rgba(5,4,7,0.55) 100%)",zIndex:3,pointerEvents:"none"}}/>
          </div>
          <CursorSpotlight />

          {/* Header */}
          <div style={{position:"relative",zIndex:10,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"clamp(16px,3vw,24px) clamp(20px,5vw,48px)",borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <div style={{width:38,height:38,borderRadius:10,overflow:"hidden",background:"linear-gradient(135deg,#f0a500,#ff6b35)",boxShadow:"0 0 24px rgba(240,165,0,0.4)"}}>
                <Image src="/logo.png" alt="ArbibX" width={38} height={38} style={{objectFit:"cover"}} unoptimized/>
              </div>
              <div>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:13,fontWeight:500,letterSpacing:"0.16em",color:V.ink0}}>ArbibX</div>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:7,color:V.ink4,letterSpacing:"0.28em"}}>TERMINAL</div>
              </div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{display:"flex",alignItems:"center",gap:6,padding:"4px 12px",borderRadius:99,background:"rgba(0,229,160,0.07)",border:"1px solid rgba(0,229,160,0.18)"}}>
                <div style={{width:5,height:5,borderRadius:"50%",background:V.gain,animation:"live-pulse 2s ease-in-out infinite"}}/>
                <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:V.gain,letterSpacing:"0.1em"}}>MARKETS LIVE</span>
              </div>
              <button className="land-cta-ghost" onClick={()=>enterApp(false)} style={{padding:"8px 18px",fontSize:12}}>Sign In</button>
            </div>
          </div>

          {/* Hero */}
          <ParallaxLayer
            strength={10}
            style={{position:"relative",zIndex:5,flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"clamp(16px,3vw,40px) clamp(20px,5vw,80px)",textAlign:"center",overflowY:"auto",overscrollBehavior:"contain"}}
          >
            {/* Eyebrow */}
            <ScrollReveal delay={0} y={18} style={{display:"inline-flex",alignItems:"center",gap:10,padding:"6px 16px",borderRadius:99,background:"rgba(240,165,0,0.08)",border:"1px solid rgba(240,165,0,0.22)",marginBottom:20,backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)"}}>
              <span style={{width:5,height:5,borderRadius:"50%",background:V.gold,display:"block",animation:"live-pulse 2s ease-in-out infinite"}}/>
              <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:V.gold,letterSpacing:"0.16em"}}>AI-POWERED STOCK INTELLIGENCE · 2026</span>
            </ScrollReveal>

            {/* Headline — letter-by-letter spring animation */}
            <div style={{marginBottom:16,perspective:"800px"}}>
              <AnimatedHeadline
                lines={[
                  { text: "TRADE" },
                  { text: "SMARTER.", gradient: true },
                ]}
                baseStyle={{fontFamily:"'Cabinet Grotesk','Syne',system-ui",fontSize:"clamp(36px,5.5vw,80px)",fontWeight:900,lineHeight:0.9,letterSpacing:"-0.04em",color:V.ink0}}
                gradientStyle={{fontFamily:"'Cabinet Grotesk','Syne',system-ui",fontSize:"clamp(36px,5.5vw,80px)",fontWeight:900,lineHeight:0.9,letterSpacing:"-0.04em",background:"linear-gradient(135deg,#ffbe1a 0%,#f0a500 45%,#ff6b35 100%)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text",filter:"drop-shadow(0 0 48px rgba(240,165,0,0.3))"}}
              />
            </div>

            {/* Subtitle */}
            <motion.p
              initial={{opacity:0,y:18}}
              animate={{opacity:1,y:0}}
              transition={{delay:0.55,type:"spring",stiffness:80,damping:18}}
              style={{fontSize:"clamp(14px,1.8vw,19px)",color:V.ink2,maxWidth:540,lineHeight:1.75,marginBottom:28}}
            >
              Real-time market data. Claude AI analysis across 57 stocks.<br/>
              Professional-grade tools — in one cinematic terminal.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{opacity:0,y:18}}
              animate={{opacity:1,y:0}}
              transition={{delay:0.7,type:"spring",stiffness:80,damping:18}}
              style={{display:"flex",gap:14,flexWrap:"wrap",justifyContent:"center",marginBottom:32}}
            >
              <SpringButton className="land-cta-primary" onClick={()=>enterApp(false)}>
                Sign In / Create Account <ChevronRight size={16}/>
              </SpringButton>
              <SpringButton className="land-cta-ghost" onClick={()=>enterApp(true)}>
                Continue as Guest
              </SpringButton>
            </motion.div>

            {/* Feature grid — 3D tilt cards */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,190px),1fr))",gap:12,width:"100%",maxWidth:920,perspective:"1200px"}}>
              {[
                {icon:"⚡",label:"Live Prices",       desc:"Real-time Polygon.io"},
                {icon:"🧠",label:"Claude AI Top 15",  desc:"Hourly AI analysis"},
                {icon:"📊",label:"57 Stocks",         desc:"NYSE, NASDAQ & OTC"},
                {icon:"💼",label:"Portfolio Tracker", desc:"P&L, grades & analytics"},
                {icon:"📰",label:"News Feed",         desc:"Sentiment-tagged"},
                {icon:"🎯",label:"Price Alerts",      desc:"Email when targets hit"},
              ].map((f,i)=>(
                <ScrollReveal key={f.label} delay={0.85 + i*0.06} y={28}>
                  <TiltCard
                    className="feat-card"
                    intensity={9}
                    float={i % 2 === 0}
                  >
                    <div style={{fontSize:26,marginBottom:10}}>{f.icon}</div>
                    <div style={{fontFamily:"'Cabinet Grotesk',system-ui",fontSize:13,fontWeight:700,color:V.ink0,marginBottom:3}}>{f.label}</div>
                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:V.ink4,letterSpacing:"0.04em"}}>{f.desc}</div>
                  </TiltCard>
                </ScrollReveal>
              ))}
            </div>

            <motion.p
              initial={{opacity:0}}
              animate={{opacity:1}}
              transition={{delay:1.4,duration:0.6}}
              style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:V.ink4,marginTop:44,letterSpacing:"0.1em"}}
            >
              NOT FINANCIAL ADVICE · FOR INFORMATIONAL PURPOSES ONLY
            </motion.p>
          </ParallaxLayer>

          {/* Bottom stats */}
          <div style={{position:"relative",zIndex:10,display:"flex",justifyContent:"center",gap:"clamp(24px,6vw,80px)",padding:"22px clamp(20px,5vw,48px)",borderTop:"1px solid rgba(255,255,255,0.05)",flexWrap:"wrap"}}>
            {[{val:"57",label:"Stocks Tracked"},{val:"Claude Opus",label:"AI Model"},{val:"Real-Time",label:"Market Data"},{val:"Free",label:"To Use"}].map(s=>(
              <div key={s.label} style={{textAlign:"center"}}>
                <div style={{fontFamily:"'Cabinet Grotesk',system-ui",fontSize:"clamp(15px,2vw,20px)",fontWeight:800,color:V.ink0,letterSpacing:"-0.02em"}}>{s.val}</div>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:8,color:V.ink4,letterSpacing:"0.16em",textTransform:"uppercase",marginTop:4}}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ════ GLOBAL AUTH MODAL ══════════════════════════════ */}
      {showAuthModal&&(
        <div onClick={e=>{if (e.target===e.currentTarget) setShowAuthModal(false);}}
          style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:"20px 16px"}}>
          <div style={{background:V.surface,border:`1px solid ${V.borderHi}`,borderRadius:20,width:"100%",maxWidth:420,overflow:"hidden",boxShadow:"0 32px 80px rgba(0,0,0,0.8)"}}>
            <div style={{height:2,background:"linear-gradient(90deg,#f0a500,#ff6b35,#f0a500)"}}/>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"20px 24px",borderBottom:`1px solid ${V.border}`}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:36,height:36,borderRadius:10,background:"linear-gradient(135deg,#f0a500,#ff6b35)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <Image src="/logo.png" alt="ArbibX" width={36} height={36} style={{objectFit:"cover",borderRadius:10}} unoptimized/>
                </div>
                <div>
                  <p style={{fontFamily:"'Cabinet Grotesk',system-ui",fontWeight:800,fontSize:14,color:V.ink0,margin:0}}>Sign in to ArbibX</p>
                  <p style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:V.ink4,margin:0,letterSpacing:"0.1em",textTransform:"uppercase"}}>Save portfolio across devices</p>
                </div>
              </div>
              <button onClick={()=>setShowAuthModal(false)} style={{background:"none",border:"none",cursor:"pointer",color:V.ink3,padding:6,borderRadius:7,display:"flex"}}><X size={16}/></button>
            </div>
            <div style={{padding:"24px"}}>
              <GlobalAuthForm onSuccess={()=>{setShowAuthModal(false);setIsLoggedIn(true);setTab("portfolio");}}/>
            </div>
          </div>
        </div>
      )}

      {/* ════ HEADER ═════════════════════════════════════════ */}
      <header style={{position:"sticky",top:0,zIndex:100,background:theme==="light"?"rgba(232,220,184,0.92)":"rgba(5,4,7,0.95)",backdropFilter:"blur(40px) saturate(2)",WebkitBackdropFilter:"blur(40px) saturate(2)",borderBottom:`1px solid ${V.border}`}}>
        {/* Subtle glow behind header */}
        <div aria-hidden style={{position:"absolute",inset:"-30% 0 auto 0",height:"160%",pointerEvents:"none",background:"radial-gradient(ellipse 60% 60% at 50% 0%, rgba(240,165,0,0.10) 0%, transparent 70%)",filter:"blur(20px)",zIndex:-1}}/>
        {/* Indices ticker */}
        <div style={{display:"flex",alignItems:"center",padding:"0 16px",height:30,borderBottom:`1px solid ${V.border}`,overflow:"hidden"}}>
          <div className="vx-strip" style={{flex:1,display:"flex",alignItems:"center",gap:16,overflowX:"auto"}}>
            {indices.map(m=>(
              <div key={m.n} style={{display:"flex",alignItems:"center",gap:5,flexShrink:0}}>
                <span style={{...mono,fontSize:8,color:V.ink4,textTransform:"uppercase",letterSpacing:"0.08em"}}>{m.n}</span>
                <span style={{...mono,fontSize:9,fontWeight:500,color:V.ink1}}>{m.v}</span>
                <span style={{...mono,fontSize:8,color:m.up?V.gain:V.loss}}>{m.d}</span>
              </div>
            ))}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:4,flexShrink:0,marginLeft:10,paddingLeft:10,borderLeft:`1px solid ${V.border}`}}>
            <div style={{width:5,height:5,borderRadius:"50%",background:V.gain,animation:"live-pulse 2.5s ease-in-out infinite"}}/>
            <span style={{...mono,fontSize:8,color:V.ink4,textTransform:"uppercase",letterSpacing:"0.12em"}}>Live</span>
          </div>
        </div>

        {/* Nav bar */}
        <div style={{display:"flex",alignItems:"center",gap:10,padding:"0 16px",height:50}}>
          {/* Logo */}
          <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0,position:"relative"}}>
            <motion.div
              whileHover={{ scale: 1.08, rotate: -3 }}
              transition={{ type: "spring", stiffness: 380, damping: 18 }}
              style={{position:"relative",width:30,height:30}}
            >
              {/* Breathing halo behind logo */}
              <motion.div
                aria-hidden
                animate={{ opacity: [0.45, 0.85, 0.45], scale: [1, 1.18, 1] }}
                transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
                style={{position:"absolute",inset:-4,borderRadius:12,background:"radial-gradient(circle, rgba(240,165,0,0.55) 0%, transparent 70%)",filter:"blur(6px)",pointerEvents:"none"}}
              />
              <div style={{width:30,height:30,borderRadius:8,overflow:"hidden",background:"linear-gradient(135deg,#f0a500,#ff6b35)",boxShadow:"0 2px 12px rgba(240,165,0,0.35)",position:"relative"}}>
                <Image src="/logo.png" alt="ArbibX" width={30} height={30} style={{objectFit:"cover",borderRadius:8}} priority unoptimized/>
              </div>
            </motion.div>
            <div style={{lineHeight:1}}>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:12,fontWeight:500,letterSpacing:"0.1em",color:V.ink0}}>ArbibX</div>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:7,color:V.ink4,letterSpacing:"0.2em",marginTop:1}}>TERMINAL</div>
            </div>
          </div>

          {/* Horizontal tabs — hidden at >=1024px in favor of left sidebar nav */}
          <div className="vx-header-tabs" style={{display:"flex",alignItems:"center",gap:0,marginLeft:6,flex:1,overflow:"hidden"}}>
            {TABS.map(t=>{
              const active=tab===t.id;
              return (
                <button key={t.id} onClick={()=>setTab(t.id)}
                  className="vx-nav-tab"
                  style={{display:"flex",alignItems:"center",gap:5,padding:"0 12px",height:50,background:"none",border:"none",color:active?V.ink0:V.ink3,cursor:"pointer",fontSize:12,fontWeight:active?700:400,fontFamily:"'Syne',system-ui,sans-serif",transition:"color 0.2s",whiteSpace:"nowrap",position:"relative"}}>
                  {/* Hover preview underline — shows where the indicator WOULD go on click */}
                  {!active && <span aria-hidden className="vx-nav-tab__hover-underline" />}
                  <TabIcon id={t.id} size={14} active={active}/>
                  <span style={{display:"none"}} className="tab-label">{t.label}</span>
                  {active && (
                    <motion.div
                      layoutId="vx-tab-indicator"
                      style={{position:"absolute",inset:"auto 0 0 0",height:2,background:V.gold,boxShadow:`0 0 12px ${V.gold}, 0 0 4px ${V.gold}`,borderRadius:2}}
                      transition={{type:"spring",stiffness:380,damping:32}}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Auth + search */}
          <div ref={searchRef} style={{position:"relative",flexShrink:0,display:"flex",alignItems:"center",gap:6}}>
            {isLoggedIn&&isPro&&(
              <div style={{display:"flex",alignItems:"center",gap:5,padding:"4px 10px",borderRadius:8,background:"rgba(240,165,0,0.10)",border:"1px solid rgba(240,165,0,0.28)"}}>
                <Zap size={10} color={V.gold} fill={V.gold}/>
                <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:V.gold,letterSpacing:"0.06em",fontWeight:600}}>PRO</span>
              </div>
            )}
            {!isPro&&(
              <button onClick={()=>{setProReason("Upgrade to remove ads and unlock all features");setShowProModal(true);}}
                style={{display:"flex",alignItems:"center",gap:5,padding:"5px 10px",borderRadius:8,background:"rgba(240,165,0,0.08)",border:"1px solid rgba(240,165,0,0.22)",color:V.gold,cursor:"pointer",fontSize:11,fontFamily:"'Cabinet Grotesk',system-ui",fontWeight:700,whiteSpace:"nowrap"}}>
                <Zap size={11} color={V.gold}/> Upgrade
              </button>
            )}
            {!isLoggedIn&&(
              <button onClick={()=>setShowAuthModal(true)}
                style={{display:"flex",alignItems:"center",gap:5,padding:"6px 12px",borderRadius:9,background:V.goldDim,border:`1px solid ${V.goldWire}`,color:V.gold,cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:"'Cabinet Grotesk',system-ui",whiteSpace:"nowrap",height:36,transition:"all 0.2s"}}
                onMouseEnter={e=>e.currentTarget.style.background="rgba(240,165,0,0.18)"}
                onMouseLeave={e=>e.currentTarget.style.background=V.goldDim}>
                Sign In
              </button>
            )}
            {isLoggedIn&&(
              <div style={{display:"flex",alignItems:"center",gap:5,padding:"4px 8px",borderRadius:8,background:"rgba(0,229,160,0.07)",border:`1px solid ${V.gainWire}`}}>
                <div style={{width:6,height:6,borderRadius:"50%",background:V.gain}}/>
                <span style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:V.gain,letterSpacing:"0.06em"}}>SIGNED IN</span>
              </div>
            )}
            <button ref={themeBtnRef} onClick={toggleTheme}
              style={{background:"none",border:`1px solid ${theme==="light"?"rgba(140,90,0,0.40)":"transparent"}`,borderRadius:8,cursor:"pointer",color:theme==="dark"?V.ink3:V.gold,padding:"6px 10px",display:"flex",alignItems:"center",minHeight:36,minWidth:36,justifyContent:"center",transition:"all 0.2s"}}
              title={theme==="dark"?"Switch to light mode":"Switch to dark mode"}>
              {theme==="dark" ? <Sun size={16}/> : <Moon size={16}/>}
            </button>
            <button onClick={()=>setShowSearch(s=>!s)}
              style={{background:showSearch?V.goldDim:"none",border:`1px solid ${showSearch?V.goldWire:"transparent"}`,borderRadius:8,cursor:"pointer",color:showSearch?V.gold:V.ink3,padding:"6px 10px",display:"flex",alignItems:"center",minHeight:36,minWidth:36,justifyContent:"center",transition:"all 0.2s"}}>
              <Search size={16}/>
            </button>
            {showSearch&&(
              <div style={{position:"fixed",right:16,top:88,width:"min(360px,calc(100vw - 32px))",background:V.surface,backdropFilter:"blur(40px)",WebkitBackdropFilter:"blur(40px)",border:`1px solid ${V.borderHi}`,borderRadius:14,overflow:"hidden",zIndex:200,boxShadow:"0 24px 64px rgba(0,0,0,0.8)"}}>
                <div style={{display:"flex",alignItems:"center",gap:8,padding:"12px 14px",borderBottom:`1px solid ${V.border}`}}>
                  <Search size={13} color={V.ink3}/>
                  <input autoFocus value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search ticker or company..."
                    style={{background:"transparent",border:"none",padding:0,fontSize:16,flex:1,color:V.ink0,outline:"none",fontFamily:"'DM Mono',monospace"}}/>
                  {search&&<button onClick={()=>setSearch("")} style={{background:"none",border:"none",cursor:"pointer",color:V.ink3,padding:2,display:"flex"}}><X size={13}/></button>}
                </div>
                {results.map(r=>(
                  <button key={r.ticker} onClick={()=>go(r.ticker)}
                    style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",padding:"11px 14px",background:"none",border:"none",cursor:"pointer",minHeight:48,textAlign:"left",transition:"background 0.15s"}}
                    className="row-hover">
                    <span style={{...mono,fontSize:13,fontWeight:500,color:V.gold}}>{r.ticker}</span>
                    <span style={{fontSize:12,color:V.ink3,maxWidth:180,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.name}</span>
                  </button>
                ))}
                {results.length===0&&search.length>0&&!searching&&(
                  <p style={{...mono,fontSize:11,color:V.ink4,textAlign:"center",padding:"14px"}}>No results for "{search}"</p>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ════ DESKTOP SIDE NAV (>=1024px only) ═══════════════ */}
      <DesktopSideNav tab={tab} setTab={setTab} />

      {/* ════ MAIN CONTENT ════════════════════════════════════ */}
      <main className="vx-main" style={{position:"relative",zIndex:1}}>
        <AnimatedTab tabKey={tab}>
          {tab==="top15"     && <Top15 onSelectTicker={go}/>}
          {tab==="earnings"  && <EarningsCal onSelectTicker={go}/>}
          {tab==="news"      && <NewsFeed onSelectTicker={go}/>}
          {tab==="screener"  && <StockScreener onSelectTicker={go}/>}
          {tab==="analytics" && <PortfolioAnalytics onSelectTicker={go} onGoPortfolio={()=>setTab("portfolio")}/>}
          {tab==="watchlist" && <WatchlistAlerts watchlist={watchlist} onToggleWatch={toggleWatch} onSelectTicker={go}/>}
          {tab==="portfolio" && <MyStocks onSignIn={()=>setShowAuthModal(true)}/>}
          {tab==="markets"&&(
            <div style={{maxWidth:1200,margin:"0 auto",padding:"24px 16px"}}>
              <div className="vx-two-col" style={{display:"flex",flexDirection:"column",gap:24}}>
                <div style={{minWidth:0}}><MarketsPanel {...marketProps}/></div>
                <div id="vx-sidebar" style={{display:"none"}}><Sidebar {...sideProps}/></div>
              </div>
            </div>
          )}
        </AnimatedTab>
      </main>

      {/* ════ PRO UPGRADE MODAL ══════════════════════════════ */}
      {showProModal&&(
        <ProUpgradeModal
          onClose={()=>setShowProModal(false)}
          userEmail={isLoggedIn ? (()=>{try{return JSON.parse(localStorage.getItem("arbibx-auth-user")??"{}").email??"";}catch{return "";}})() : undefined}
          reason={proReason}
        />
      )}

      {/* ════ BOTTOM NAV (mobile) ════════════════════════════ */}
      <MobileNav tab={tab} setTab={setTab} />

      {/* ════ STOCK COMPARISON MODAL ═════════════════════════ */}
      {showCompare && (
        <StockComparison initialTicker={ticker} onClose={()=>setShowCompare(false)}/>
      )}

      {/* ════ KEYBOARD SHORTCUT HINT (desktop only) ════════ */}
      {!showLanding && (
        <div className="vx-shortcut-hint" aria-hidden>
          <span style={{...mono,fontSize:9,color:V.ink3,letterSpacing:"0.08em"}}>
            <kbd>K</kbd> search · <kbd>T</kbd> theme · <kbd>1-8</kbd> tabs · <kbd>Esc</kbd> close
          </span>
        </div>
      )}

      {/* ════ GLOBAL STYLES ══════════════════════════════════ */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Mono:wght@300;400;500&family=Cabinet+Grotesk:wght@400;500;700;800;900&display=swap');
        @keyframes vx-rise    { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes live-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.3;transform:scale(.6)} }
        @keyframes shimmer    { 0%{background-position:-400% 0} 100%{background-position:400% 0} }
        @keyframes spin       { to{transform:rotate(360deg)} }
        *, *::before, *::after { box-sizing: border-box; }
        input, select, textarea { font-size: 16px; }
        button, [role="button"] { touch-action: manipulation; }
        ::-webkit-scrollbar       { width: 2px; height: 2px; }
        ::-webkit-scrollbar-thumb { background: rgba(90,72,150,0.4); border-radius: 99px; }
        .vx-strip { scrollbar-width: none; }
        .vx-strip::-webkit-scrollbar { display: none; }
        .row-hover:hover { background: rgba(240,165,0,0.04) !important; }
        .tab-label { display: none; }
        @media(min-width:520px){ .tab-label { display: inline; } }
        @media(min-width:1024px){
          .vx-two-col { display: grid !important; grid-template-columns: 1fr 284px !important; gap: 24px; align-items: start; }
          #vx-sidebar  { display: block !important; }
        }
        @media(max-width:767px){
          .vx-main { padding-bottom: calc(64px + env(safe-area-inset-bottom,0px)) !important; }
          .vx-chart-main { height: 160px !important; }
        }
        @media(min-width:768px){
          .vx-bottom-nav { display: none !important; }
          .vx-main { padding-bottom: 48px !important; }
        }
        .skel {
          background: linear-gradient(105deg,#0d0b16 30%,#1a1628 50%,#0d0b16 70%);
          background-size: 400% 100%;
          animation: shimmer 2s ease-in-out infinite;
          border-radius: 12px;
        }
        .vx-bottom-nav {
          position: fixed; bottom: 0; left: 0; right: 0; z-index: 99;
          background: rgba(5,4,7,0.97);
          backdrop-filter: blur(32px);
          border-top: 1px solid rgba(60,48,100,0.4);
          padding-bottom: env(safe-area-inset-bottom, 0px);
        }
        @media(max-width:768px){
          * { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }
        }
        @media(prefers-reduced-motion: reduce){
          *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
        }
      `}</style>
    </div>
  );
}
