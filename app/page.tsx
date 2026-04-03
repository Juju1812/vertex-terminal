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
  LayoutDashboard, ChevronRight,
} from "lucide-react";

const Top15    = dynamic(() => import("@/components/Top15"),    { ssr: false, loading: () => <PanelSkeleton/> });
const MyStocks = dynamic(() => import("@/components/MyStocks"), { ssr: false, loading: () => <PanelSkeleton/> });

function PanelSkeleton() {
  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
      {[180, 80, 80, 80, 80].map((h, i) => (
        <div key={i} className="skeleton" style={{ height: h, borderRadius: 12 }} />
      ))}
    </div>
  );
}

/* ── Types ──────────────────────────────────────────────────── */
interface Quote { ticker:string; name:string; price:number; change:number; changePct:number; high:number; low:number; open:number; volume:number; }
interface Bar   { date:string; close:number; open:number; high:number; low:number; }
type TabId = "dashboard" | "ai" | "top15" | "mystocks";

/* ── Constants ───────────────────────────────────────────────── */
const API_KEY = "1xwzcvUOF9pft6PRNylO2Xc6X2QeQCGr";
const BASE    = "https://api.polygon.io";
const POPULAR = ["AAPL","MSFT","NVDA","GOOGL","META","TSLA","AMZN","AMD"];

const MOCK: Record<string, Quote> = {
  AAPL:  {ticker:"AAPL", name:"Apple Inc.",            price:228.52,change: 3.21,changePct: 1.42,high:229.88,low:225.12,open:225.80,volume:58_234_100},
  MSFT:  {ticker:"MSFT", name:"Microsoft Corp.",        price:415.32,change:-2.18,changePct:-0.52,high:418.55,low:413.22,open:417.50,volume:21_456_200},
  NVDA:  {ticker:"NVDA", name:"NVIDIA Corp.",           price:875.42,change:24.63,changePct: 2.90,high:881.20,low:851.30,open:853.10,volume:42_118_700},
  GOOGL: {ticker:"GOOGL",name:"Alphabet Inc.",          price:178.94,change: 1.43,changePct: 0.81,high:180.12,low:177.34,open:177.51,volume:18_932_400},
  META:  {ticker:"META", name:"Meta Platforms",         price:554.78,change: 8.92,changePct: 1.63,high:557.33,low:545.21,open:546.10,volume:14_209_300},
  TSLA:  {ticker:"TSLA", name:"Tesla Inc.",             price:248.50,change:-9.23,changePct:-3.58,high:260.42,low:247.11,open:258.10,volume:89_234_100},
  AMZN:  {ticker:"AMZN", name:"Amazon.com Inc.",        price:201.17,change:-0.88,changePct:-0.44,high:203.21,low:200.54,open:202.05,volume:29_847_100},
  AMD:   {ticker:"AMD",  name:"Advanced Micro Devices", price:162.34,change: 5.82,changePct: 3.72,high:163.80,low:156.42,open:157.10,volume:45_123_200},
};

const AI_WINNERS = [
  {ticker:"NVDA",name:"NVIDIA Corp.",       conf:91,target:950, up: 8.5, thesis:"AI infrastructure capex surging. Blackwell GPU demand exceeds supply 3×. Data center revenue +120% YoY.", catalysts:["Blackwell Launch","Azure Win","Q4 Beat"]},
  {ticker:"META",name:"Meta Platforms",      conf:84,target:620, up:11.8, thesis:"Llama monetisation accelerating. Reels ads +40% QoQ. Cost discipline driving margin expansion.",            catalysts:["Llama 4","Ad Revenue Beat","Cost Cuts"]},
  {ticker:"AMD", name:"Advanced Micro Dev.", conf:78,target:195, up:20.1, thesis:"MI300X gaining enterprise traction. Data center +80% YoY. TSMC capacity locked through 2025.",              catalysts:["MI400 Reveal","Design Wins","CPU Share"]},
];
const AI_LOSERS = [
  {ticker:"TSLA",name:"Tesla Inc.",      conf:76,target:195,down:-21.6, thesis:"EV demand soft globally. Brutal price war in China. Cybertruck ramp costlier than expected.",  risks:["China Market","Margin Squeeze","Competition"]},
  {ticker:"AMZN",name:"Amazon.com Inc.", conf:61,target:180,down:-10.5, thesis:"AWS growth decelerating vs Azure/GCP. Retail margins structurally thin. CPM pressure rising.", risks:["AWS Slowdown","Ad CPMs","FTC Scrutiny"]},
];

const INDICES = [
  {name:"S&P 500",val:"5,842",chg:"+0.74%",up:true},
  {name:"NDX",    val:"18,843",chg:"+1.12%",up:true},
  {name:"DJIA",   val:"43,189",chg:"+0.42%",up:true},
  {name:"VIX",    val:"14.32", chg:"−2.18%",up:false},
  {name:"10Y",    val:"4.28%", chg:"+0.03%",up:true},
  {name:"DXY",    val:"104.2", chg:"−0.11%",up:false},
];

const TABS = [
  {id:"dashboard" as TabId, label:"Markets",   icon:<LayoutDashboard size={18}/>},
  {id:"top15"     as TabId, label:"Top 15",    icon:<Trophy size={18}/>},
  {id:"mystocks"  as TabId, label:"Portfolio", icon:<BookOpen size={18}/>},
  {id:"ai"        as TabId, label:"AI Signals",icon:<Brain size={18}/>},
];

/* ── Helpers ─────────────────────────────────────────────────── */
function seedBars(base: number, days = 90): Bar[] {
  const bars: Bar[] = [];
  let p = base * 0.82, seed = Math.round(base * 100);
  const rand = () => { seed = (seed * 1664525 + 1013904223) & 0xffffffff; return (seed >>> 0) / 0xffffffff; };
  const now = new Date();
  for (let i = days; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    const chg = (rand() - 0.47) * 0.022 * p, o = p, c = p + chg;
    bars.push({ date: d.toISOString().split("T")[0], open: +o.toFixed(2), high: +(Math.max(o,c)*(1+rand()*.008)).toFixed(2), low: +(Math.min(o,c)*(1-rand()*.008)).toFixed(2), close: +c.toFixed(2) });
    p = c;
  }
  return bars;
}

async function poly<T>(path: string): Promise<T|null> {
  try { const r = await fetch(`${BASE}${path}${path.includes("?")?"&":"?"}apiKey=${API_KEY}`); return r.ok ? r.json() : null; }
  catch { return null; }
}

async function getQuote(ticker: string): Promise<Quote> {
  const m = MOCK[ticker] ?? {ticker,name:ticker,price:100,change:0,changePct:0,high:101,low:99,open:100,volume:1_000_000};
  const d = await poly<{ticker:{day:{o:number;h:number;l:number;c:number;v:number};prevDay:{c:number}}}>(`/v2/snapshot/locale/us/markets/stocks/tickers/${ticker}`);
  if (!d?.ticker?.day?.c) return m;
  const {day,prevDay} = d.ticker, chg = day.c - prevDay.c;
  return {ticker,name:m.name,price:day.c,change:+chg.toFixed(2),changePct:+((chg/prevDay.c)*100).toFixed(2),high:day.h,low:day.l,open:day.o,volume:day.v};
}

async function getBars(ticker: string): Promise<Bar[]> {
  const to = new Date().toISOString().split("T")[0];
  const from = new Date(Date.now()-90*86_400_000).toISOString().split("T")[0];
  const d = await poly<{results?:{o:number;h:number;l:number;c:number;t:number}[]}>(`/v2/aggs/ticker/${ticker}/range/1/day/${from}/${to}?adjusted=true&sort=asc&limit=120`);
  if (!d?.results?.length) return seedBars(MOCK[ticker]?.price ?? 100);
  return d.results.map(b => ({date:new Date(b.t).toISOString().split("T")[0],open:b.o,high:b.h,low:b.l,close:b.c}));
}

async function searchTickers(q: string): Promise<string[]> {
  const d = await poly<{results?:{ticker:string}[]}>(`/v3/reference/tickers?search=${encodeURIComponent(q)}&active=true&limit=7&market=stocks`);
  if (!d?.results?.length) return POPULAR.filter(t => t.includes(q.toUpperCase()) || MOCK[t]?.name.toLowerCase().includes(q.toLowerCase()));
  return d.results.map(r => r.ticker);
}

const fmt$   = (n:number) => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",minimumFractionDigits:2}).format(n);
const fmtPct = (n:number) => `${n>=0?"+":""}${n.toFixed(2)}%`;
const fmtVol = (n:number) => n>=1e9?`${(n/1e9).toFixed(2)}B`:n>=1e6?`${(n/1e6).toFixed(2)}M`:n>=1e3?`${(n/1e3).toFixed(2)}K`:String(n);

/* ── Design tokens (JS mirror) ───────────────────────────────── */
const C = {
  bgBase:    "#060B14", bgRaised: "#0A1220", bgElevated: "#0F1A2B",
  bgOverlay: "#142035", bgHover:  "#18273D",
  borderSoft:"rgba(100,160,220,0.11)", borderMid:"rgba(100,160,220,0.18)",
  textPrimary:"#EEF3FA", textSecondary:"#7A9DBF", textMuted:"#3D5A7A",
  emerald:"#10B981", emeraldBright:"#34D399", emeraldDim:"rgba(16,185,129,0.10)", emeraldBorder:"rgba(16,185,129,0.20)",
  crimson:"#F43F5E", crimsonBright:"#FB7185", crimsonDim:"rgba(244,63,94,0.10)",   crimsonBorder:"rgba(244,63,94,0.20)",
  sapphire:"#3B82F6", sapphireDim:"rgba(59,130,246,0.10)", sapphireBorder:"rgba(59,130,246,0.22)",
  gold:"#F59E0B", amethyst:"#8B5CF6",
};

const card = (extra?: React.CSSProperties): React.CSSProperties => ({
  background: C.bgRaised, border: `1px solid ${C.borderSoft}`,
  borderRadius: 14, boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
  ...extra,
});

/* ── Custom chart tooltip ────────────────────────────────────── */
function ChartTip({active,payload,label}:{active?:boolean;payload?:{value:number}[];label?:string}) {
  if (!active||!payload?.length) return null;
  return (
    <div style={{background:C.bgElevated,border:`1px solid ${C.borderMid}`,borderRadius:10,padding:"10px 14px",boxShadow:"0 8px 24px rgba(0,0,0,0.5)"}}>
      <p style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:C.textMuted,marginBottom:3,letterSpacing:"0.04em"}}>{label}</p>
      <p style={{fontFamily:"'JetBrains Mono',monospace",fontSize:15,color:C.textPrimary,fontWeight:600}}>{fmt$(payload[0].value)}</p>
    </div>
  );
}

/* ── Confidence bar ──────────────────────────────────────────── */
function ConfBar({pct,color}:{pct:number;color:string}) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:8}}>
      <div style={{flex:1,height:3,background:"rgba(255,255,255,0.06)",borderRadius:99,overflow:"hidden"}}>
        <div style={{width:`${pct}%`,height:"100%",background:color,borderRadius:99,transition:"width 0.8s cubic-bezier(0,0,0.2,1)"}}/>
      </div>
      <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color,minWidth:28,textAlign:"right"}}>{pct}%</span>
    </div>
  );
}

/* ── Stat tile ───────────────────────────────────────────────── */
function StatTile({label,value}:{label:string;value:string}) {
  return (
    <div style={{...card(),padding:"10px 14px",textAlign:"center",flexShrink:0}}>
      <p style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:C.textMuted,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:4}}>{label}</p>
      <p style={{fontFamily:"'JetBrains Mono',monospace",fontSize:13,fontWeight:500,color:C.textPrimary}}>{value}</p>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════ */
export default function VertexTerminal() {
  const [ticker,     setTicker]    = useState("AAPL");
  const [quote,      setQuote]     = useState<Quote>(MOCK["AAPL"]);
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
    if (!search.trim()){ setResults([]); return; }
    const id = setTimeout(async()=>{ setSearching(true); setResults((await searchTickers(search)).slice(0,7)); setSearching(false); },320);
    return ()=>clearTimeout(id);
  },[search]);

  useEffect(()=>{
    const h=(e:MouseEvent)=>{ if(searchRef.current&&!searchRef.current.contains(e.target as Node)){setResults([]);setShowSearch(false);} };
    document.addEventListener("mousedown",h); return ()=>document.removeEventListener("mousedown",h);
  },[]);

  const go = (t:string)=>{ setTicker(t); setSearch(""); setResults([]); setShowSearch(false); setTab("dashboard"); };
  const toggleWatch = (t:string)=>setWatchlist(w=>w.includes(t)?w.filter(x=>x!==t):[...w,t]);

  const up        = quote.changePct >= 0;
  const lineColor = up ? C.emerald : C.crimson;
  const lineColorBright = up ? C.emeraldBright : C.crimsonBright;
  const watched   = watchlist.includes(ticker);
  const fullWidth = tab==="top15"||tab==="mystocks";

  /* ── Dashboard ─────────────────────────────────────────────── */
  const DashPanel = () => (
    <div style={{display:"flex",flexDirection:"column",gap:18,animation:"fadeUp 0.3s ease-out both"}}>
      {/* Hero quote block */}
      <div style={{...card(),padding:20,background:`linear-gradient(135deg, ${C.bgRaised} 0%, ${C.bgElevated} 100%)`,position:"relative",overflow:"hidden"}}>
        {/* Background accent streak */}
        <div style={{position:"absolute",top:-40,right:-40,width:200,height:200,borderRadius:"50%",background:up?C.emeraldDim:C.crimsonDim,filter:"blur(60px)",pointerEvents:"none"}}/>
        <div style={{position:"relative",display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
          <div style={{minWidth:0}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap"}}>
              <h1 style={{fontFamily:"'JetBrains Mono',monospace",fontSize:"clamp(28px,6vw,42px)",fontWeight:600,letterSpacing:"-0.02em",lineHeight:1}}>{ticker}</h1>
              {up
                ? <span style={{display:"inline-flex",alignItems:"center",gap:3,background:C.emeraldDim,color:C.emeraldBright,border:`1px solid ${C.emeraldBorder}`,borderRadius:7,padding:"3px 9px",fontFamily:"'JetBrains Mono',monospace",fontSize:12,fontWeight:500}}><TrendingUp size={11}/>{fmtPct(quote.changePct)}</span>
                : <span style={{display:"inline-flex",alignItems:"center",gap:3,background:C.crimsonDim,color:C.crimsonBright,border:`1px solid ${C.crimsonBorder}`,borderRadius:7,padding:"3px 9px",fontFamily:"'JetBrains Mono',monospace",fontSize:12,fontWeight:500}}><TrendingDown size={11}/>{fmtPct(quote.changePct)}</span>
              }
              <button onClick={()=>toggleWatch(ticker)} style={{background:"none",border:"none",cursor:"pointer",padding:4,display:"flex",alignItems:"center",minWidth:36,minHeight:36,justifyContent:"center"}}>
                {watched ? <Star size={18} color={C.gold} fill={C.gold}/> : <StarOff size={18} color={C.textMuted}/>}
              </button>
            </div>
            <p style={{color:C.textSecondary,fontSize:13,marginBottom:0}}>{quote.name}</p>
          </div>
          <div style={{textAlign:"right",flexShrink:0}}>
            {loading
              ? <div className="skeleton" style={{width:160,height:44,borderRadius:8}}/>
              : <>
                  <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:"clamp(28px,5vw,40px)",fontWeight:600,letterSpacing:"-0.025em",lineHeight:1,animation:"fadeUp 0.25s ease-out"}}>{fmt$(quote.price)}</div>
                  <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12,color:up?C.emeraldBright:C.crimsonBright,marginTop:4}}>
                    {quote.change>=0?"+":""}{fmt$(quote.change)} today
                  </div>
                </>}
          </div>
        </div>
        {/* Stat row */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8,marginTop:16}}>
          {[{l:"Open",v:fmt$(quote.open)},{l:"High",v:fmt$(quote.high)},{l:"Low",v:fmt$(quote.low)},{l:"Volume",v:fmtVol(quote.volume)},{l:"Prev",v:fmt$(quote.price-quote.change)}].map(s=>(
            <div key={s.l} style={{background:"rgba(255,255,255,0.04)",borderRadius:8,padding:"8px 10px",textAlign:"center"}}>
              <p style={{fontFamily:"'JetBrains Mono',monospace",fontSize:8,color:C.textMuted,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:3}}>{s.l}</p>
              <p style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,fontWeight:500,color:C.textPrimary,whiteSpace:"nowrap"}}>{s.v}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div style={card({overflow:"hidden"})}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 18px",borderBottom:`1px solid ${C.borderSoft}`}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:lineColorBright,animation:"pulseDot 2.5s ease-in-out infinite",boxShadow:`0 0 8px ${lineColorBright}`}}/>
            <span style={{fontSize:12,fontWeight:500,color:C.textSecondary,letterSpacing:"0.02em"}}>90-Day Price History</span>
          </div>
          <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:C.textMuted,textTransform:"uppercase",letterSpacing:"0.08em"}}>Polygon.io · Live</span>
        </div>
        {loading
          ? <div className="skeleton" style={{height:220,margin:14,borderRadius:10}}/>
          : <div style={{height:220,padding:"12px 4px 8px"}}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={bars} margin={{top:4,right:4,left:0,bottom:0}}>
                  <defs>
                    <linearGradient id="lg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor={lineColor} stopOpacity={0.25}/>
                      <stop offset="100%" stopColor={lineColor} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="1 4" stroke="rgba(100,160,220,0.06)" vertical={false}/>
                  <XAxis dataKey="date" tick={{fill:C.textMuted,fontSize:9,fontFamily:"JetBrains Mono"}} tickLine={false} axisLine={false} interval="preserveStartEnd"/>
                  <YAxis tick={{fill:C.textMuted,fontSize:9,fontFamily:"JetBrains Mono"}} tickLine={false} axisLine={false} tickFormatter={(v:number)=>`$${v.toFixed(0)}`} width={46} domain={["auto","auto"]}/>
                  <Tooltip content={<ChartTip/>} cursor={{stroke:C.borderMid,strokeWidth:1}}/>
                  <Area type="monotone" dataKey="close" stroke={lineColorBright} strokeWidth={1.5} fill="url(#lg)" dot={false} activeDot={{r:5,fill:lineColorBright,stroke:C.bgBase,strokeWidth:2}}/>
                </AreaChart>
              </ResponsiveContainer>
            </div>}
      </div>

      {/* Quick-select chips */}
      <div>
        <p style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:C.textMuted,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:10}}>Quick Access</p>
        <div className="scroll-x" style={{marginLeft:-16,marginRight:-16,paddingLeft:16,paddingRight:16}}>
          <div style={{display:"flex",gap:6,minWidth:"max-content"}}>
            {POPULAR.map(t=>{
              const q=MOCK[t]; const pos=(q?.changePct??0)>=0; const active=t===ticker;
              return(
                <button key={t} onClick={()=>go(t)}
                  style={{flexShrink:0,display:"flex",flexDirection:"column",alignItems:"flex-start",padding:"9px 12px",borderRadius:10,border:`1px solid`,cursor:"pointer",minWidth:64,transition:"all 0.2s",
                    background:active?`linear-gradient(135deg,${C.bgElevated},${C.bgOverlay})`:"transparent",
                    borderColor:active?"rgba(59,130,246,0.35)":C.borderSoft}}>
                  <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12,fontWeight:active?600:400,color:active?"#60A5FA":C.textPrimary}}>{t}</span>
                  <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:pos?C.emeraldBright:C.crimsonBright,marginTop:2}}>{q?fmtPct(q.changePct):""}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Watchlist */}
      <div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <Star size={13} color={C.gold} fill={C.gold}/>
            <span style={{fontSize:13,fontWeight:600,color:C.textPrimary}}>Watchlist</span>
          </div>
          <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:C.textMuted}}>{watchlist.length} positions</span>
        </div>
        <div style={card({overflow:"hidden"})}>
          {watchlist.length===0&&(
            <div style={{padding:"24px",textAlign:"center",color:C.textMuted,fontSize:13}}>
              Star stocks to build your watchlist
            </div>
          )}
          {watchlist.map((t,i)=>{
            const q=MOCK[t]; const pos=(q?.changePct??0)>=0;
            return(
              <button key={t} onClick={()=>go(t)}
                style={{display:"flex",justifyContent:"space-between",alignItems:"center",width:"100%",padding:"12px 16px",background:t===ticker?C.bgOverlay:"none",border:"none",cursor:"pointer",minHeight:56,textAlign:"left",borderBottom:i<watchlist.length-1?`1px solid ${C.borderSoft}`:"none",borderLeft:t===ticker?`2px solid ${C.sapphire}`:"2px solid transparent",transition:"background 0.15s"}}
                onMouseEnter={e=>{if(t!==ticker)e.currentTarget.style.background=C.bgHover}}
                onMouseLeave={e=>{if(t!==ticker)e.currentTarget.style.background="none"}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div>
                    <p style={{fontFamily:"'JetBrains Mono',monospace",fontSize:13,fontWeight:600,color:t===ticker?"#60A5FA":C.textPrimary}}>{t}</p>
                    <p style={{color:C.textMuted,fontSize:10,marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:160}}>{q?.name}</p>
                  </div>
                </div>
                <div style={{textAlign:"right"}}>
                  <p style={{fontFamily:"'JetBrains Mono',monospace",fontSize:14,fontWeight:600}}>{q?fmt$(q.price):"—"}</p>
                  <p style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:pos?C.emeraldBright:C.crimsonBright,marginTop:1}}>{q?fmtPct(q.changePct):""}</p>
                </div>
              </button>
            );
          })}
          <div style={{padding:"10px 14px",borderTop:`1px solid ${C.borderSoft}`,display:"flex",flexWrap:"wrap",gap:5}}>
            {POPULAR.filter(t=>!watchlist.includes(t)).map(t=>(
              <button key={t} onClick={()=>toggleWatch(t)}
                style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,padding:"4px 10px",borderRadius:6,background:"transparent",border:`1px solid ${C.borderSoft}`,color:C.textMuted,cursor:"pointer",transition:"all 0.15s",minHeight:30}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(59,130,246,0.35)";e.currentTarget.style.color="#60A5FA"}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor=C.borderSoft;e.currentTarget.style.color=C.textMuted}}>
                + {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Market indices */}
      <div>
        <p style={{fontSize:13,fontWeight:600,marginBottom:10,color:C.textPrimary}}>Global Markets</p>
        <div style={card({overflow:"hidden"})}>
          {INDICES.map((m,i)=>(
            <div key={m.name} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 16px",borderBottom:i<INDICES.length-1?`1px solid ${C.borderSoft}`:"none"}}>
              <span style={{fontSize:12,color:C.textSecondary,fontWeight:500}}>{m.name}</span>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:13,fontWeight:500}}>{m.val}</span>
                <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:m.up?C.emeraldBright:C.crimsonBright,minWidth:54,textAlign:"right"}}>{m.chg}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  /* ── AI Signals panel ───────────────────────────────────────── */
  const AIPanel = () => (
    <div style={{display:"flex",flexDirection:"column",gap:18,animation:"fadeUp 0.3s ease-out both"}}>
      {/* Header */}
      <div style={{...card({background:`linear-gradient(135deg,${C.bgRaised},${C.bgElevated})`}),padding:20,position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-30,right:-30,width:160,height:160,borderRadius:"50%",background:"rgba(139,92,246,0.08)",filter:"blur(40px)",pointerEvents:"none"}}/>
        <div style={{position:"relative",display:"flex",alignItems:"flex-start",gap:12}}>
          <div style={{width:44,height:44,borderRadius:12,background:"rgba(139,92,246,0.12)",border:"1px solid rgba(139,92,246,0.22)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <Brain size={22} color={C.amethyst}/>
          </div>
          <div>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
              <h2 style={{fontSize:17,fontWeight:600,color:C.textPrimary}}>AI Signals</h2>
              <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,background:"rgba(139,92,246,0.12)",color:C.amethyst,border:"1px solid rgba(139,92,246,0.22)",borderRadius:99,padding:"2px 8px",textTransform:"uppercase",letterSpacing:"0.08em"}}>BETA</span>
            </div>
            <p style={{color:C.textSecondary,fontSize:12,lineHeight:1.5}}>Machine learning signals derived from price momentum, volume anomalies, earnings revisions, and NLP sentiment across 10,000+ sources.</p>
          </div>
        </div>
        {/* Metrics strip */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginTop:16}}>
          {[{l:"Model Accuracy",v:"73.4%",c:"#60A5FA"},{l:"Avg Confidence",v:"78.5%",c:C.emeraldBright},{l:"Alpha vs S&P",v:"+5.9%",c:C.emeraldBright}].map(s=>(
            <div key={s.l} style={{background:"rgba(255,255,255,0.04)",borderRadius:8,padding:"10px 12px",textAlign:"center"}}>
              <p style={{fontFamily:"'JetBrains Mono',monospace",fontSize:8,color:C.textMuted,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:4}}>{s.l}</p>
              <p style={{fontFamily:"'JetBrains Mono',monospace",fontSize:18,fontWeight:600,color:s.c}}>{s.v}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Outperformers */}
      <div>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
          <div style={{width:28,height:28,borderRadius:8,background:C.emeraldDim,border:`1px solid ${C.emeraldBorder}`,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <TrendingUp size={14} color={C.emeraldBright}/>
          </div>
          <span style={{fontSize:14,fontWeight:600}}>Predicted Outperformers</span>
          <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,background:C.emeraldDim,color:C.emeraldBright,border:`1px solid ${C.emeraldBorder}`,borderRadius:4,padding:"2px 8px",textTransform:"uppercase",letterSpacing:"0.08em"}}>Long</span>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {AI_WINNERS.map((s,i)=>(
            <div key={s.ticker} style={{...card({background:`linear-gradient(135deg,${C.bgRaised},${C.bgElevated})`}),padding:18,cursor:"pointer",transition:"border-color 0.2s,transform 0.15s"}}
              onClick={()=>go(s.ticker)}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=C.emeraldBorder;e.currentTarget.style.transform="translateY(-1px)"}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=C.borderSoft;e.currentTarget.style.transform="translateY(0)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12,gap:8}}>
                <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
                  <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:C.textMuted,marginTop:2}}>#{i+1}</span>
                  <div>
                    <p style={{fontFamily:"'JetBrains Mono',monospace",fontSize:15,fontWeight:600,color:"#60A5FA"}}>{s.ticker}</p>
                    <p style={{color:C.textSecondary,fontSize:11,marginTop:1}}>{s.name}</p>
                  </div>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <p style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:C.textMuted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:2}}>Price Target</p>
                  <p style={{fontFamily:"'JetBrains Mono',monospace",fontSize:16,fontWeight:600,color:C.emeraldBright}}>{fmt$(s.target)}</p>
                  <p style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:C.emeraldBright}}>+{s.up.toFixed(1)}% upside</p>
                </div>
              </div>
              <ConfBar pct={s.conf} color={C.emeraldBright}/>
              <p style={{color:C.textSecondary,fontSize:12,lineHeight:1.6,margin:"12px 0"}}>{s.thesis}</p>
              <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                {s.catalysts.map(c=>(
                  <span key={c} style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,padding:"3px 8px",borderRadius:99,background:C.emeraldDim,color:C.emeraldBright,border:`1px solid ${C.emeraldBorder}`}}>{c}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Underperformers */}
      <div>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
          <div style={{width:28,height:28,borderRadius:8,background:C.crimsonDim,border:`1px solid ${C.crimsonBorder}`,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <TrendingDown size={14} color={C.crimsonBright}/>
          </div>
          <span style={{fontSize:14,fontWeight:600}}>Predicted Underperformers</span>
          <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,background:C.crimsonDim,color:C.crimsonBright,border:`1px solid ${C.crimsonBorder}`,borderRadius:4,padding:"2px 8px",textTransform:"uppercase",letterSpacing:"0.08em"}}>Avoid</span>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {AI_LOSERS.map((s,i)=>(
            <div key={s.ticker} style={{...card({background:`linear-gradient(135deg,${C.bgRaised},${C.bgElevated})`}),padding:18,cursor:"pointer",transition:"border-color 0.2s,transform 0.15s"}}
              onClick={()=>go(s.ticker)}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=C.crimsonBorder;e.currentTarget.style.transform="translateY(-1px)"}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=C.borderSoft;e.currentTarget.style.transform="translateY(0)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12,gap:8}}>
                <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
                  <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:C.textMuted,marginTop:2}}>#{i+1}</span>
                  <div>
                    <p style={{fontFamily:"'JetBrains Mono',monospace",fontSize:15,fontWeight:600,color:"#60A5FA"}}>{s.ticker}</p>
                    <p style={{color:C.textSecondary,fontSize:11,marginTop:1}}>{s.name}</p>
                  </div>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <p style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:C.textMuted,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:2}}>Price Target</p>
                  <p style={{fontFamily:"'JetBrains Mono',monospace",fontSize:16,fontWeight:600,color:C.crimsonBright}}>{fmt$(s.target)}</p>
                  <p style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:C.crimsonBright}}>{s.down.toFixed(1)}% downside</p>
                </div>
              </div>
              <ConfBar pct={s.conf} color={C.crimsonBright}/>
              <p style={{color:C.textSecondary,fontSize:12,lineHeight:1.6,margin:"12px 0"}}>{s.thesis}</p>
              <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                {s.risks.map(r=>(
                  <span key={r} style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,padding:"3px 8px",borderRadius:99,background:C.crimsonDim,color:C.crimsonBright,border:`1px solid ${C.crimsonBorder}`,display:"inline-flex",alignItems:"center",gap:4}}>
                    <AlertTriangle size={8}/>{r}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Disclaimer */}
      <div style={{display:"flex",gap:10,padding:"12px 16px",borderRadius:10,background:"rgba(245,158,11,0.05)",border:"1px solid rgba(245,158,11,0.15)"}}>
        <AlertTriangle size={14} color={C.gold} style={{marginTop:1,flexShrink:0}}/>
        <p style={{color:C.textSecondary,fontSize:11,lineHeight:1.6}}>These signals are for informational purposes only and do not constitute investment advice. Past performance does not guarantee future results.</p>
      </div>
    </div>
  );

  /* ── Sidebar ─────────────────────────────────────────────────── */
  const Sidebar = () => (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      {/* Watchlist */}
      <div style={card({overflow:"hidden"})}>
        <div style={{display:"flex",alignItems:"center",gap:8,padding:"12px 16px",borderBottom:`1px solid ${C.borderSoft}`}}>
          <Star size={13} color={C.gold} fill={C.gold}/>
          <span style={{fontSize:13,fontWeight:600}}>Watchlist</span>
          <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:C.textMuted,marginLeft:"auto"}}>{watchlist.length}</span>
        </div>
        {watchlist.map((t,i)=>{
          const q=MOCK[t]; const pos=(q?.changePct??0)>=0;
          return(
            <button key={t} onClick={()=>go(t)}
              style={{display:"flex",justifyContent:"space-between",alignItems:"center",width:"100%",padding:"10px 16px",background:t===ticker?C.bgOverlay:"none",border:"none",cursor:"pointer",borderBottom:i<watchlist.length-1?`1px solid ${C.borderSoft}`:"none",borderLeft:t===ticker?`2px solid ${C.sapphire}`:"2px solid transparent",minHeight:48,textAlign:"left",transition:"background 0.15s"}}
              onMouseEnter={e=>{if(t!==ticker)e.currentTarget.style.background=C.bgHover}}
              onMouseLeave={e=>{if(t!==ticker)e.currentTarget.style.background="none"}}>
              <div>
                <p style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12,fontWeight:600,color:t===ticker?"#60A5FA":C.textPrimary}}>{t}</p>
                <p style={{color:C.textMuted,fontSize:10,marginTop:1,maxWidth:110,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{q?.name}</p>
              </div>
              <div style={{textAlign:"right"}}>
                <p style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12,fontWeight:600}}>{q?fmt$(q.price):"—"}</p>
                <p style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:pos?C.emeraldBright:C.crimsonBright,marginTop:1}}>{q?fmtPct(q.changePct):""}</p>
              </div>
            </button>
          );
        })}
        <div style={{padding:"8px 12px",borderTop:`1px solid ${C.borderSoft}`,display:"flex",flexWrap:"wrap",gap:4}}>
          {POPULAR.filter(t=>!watchlist.includes(t)).map(t=>(
            <button key={t} onClick={()=>toggleWatch(t)}
              style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,padding:"3px 8px",borderRadius:5,background:"transparent",border:`1px solid ${C.borderSoft}`,color:C.textMuted,cursor:"pointer",transition:"all 0.15s"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(59,130,246,0.35)";e.currentTarget.style.color="#60A5FA"}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=C.borderSoft;e.currentTarget.style.color=C.textMuted}}>
              +{t}
            </button>
          ))}
        </div>
      </div>

      {/* Global markets */}
      <div style={card({overflow:"hidden"})}>
        <div style={{padding:"12px 16px",borderBottom:`1px solid ${C.borderSoft}`}}>
          <span style={{fontSize:13,fontWeight:600}}>Global Markets</span>
        </div>
        {INDICES.map((m,i)=>(
          <div key={m.name} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 16px",borderBottom:i<INDICES.length-1?`1px solid ${C.borderSoft}`:"none"}}>
            <span style={{fontSize:12,color:C.textSecondary,fontWeight:500}}>{m.name}</span>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12,fontWeight:500}}>{m.val}</span>
              <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:m.up?C.emeraldBright:C.crimsonBright,minWidth:44,textAlign:"right"}}>{m.chg}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Quick nav */}
      <div style={card({padding:14})}>
        <p style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:C.textMuted,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:10}}>Explore</p>
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {[
            {id:"top15"   as TabId,label:"Top 15 Stocks",   color:C.gold,    bg:"rgba(245,158,11,0.08)",  border:"rgba(245,158,11,0.18)",  icon:<Trophy size={13}/>},
            {id:"mystocks"as TabId,label:"My Portfolio",     color:C.amethyst,bg:"rgba(139,92,246,0.08)", border:"rgba(139,92,246,0.18)",  icon:<BookOpen size={13}/>},
            {id:"ai"      as TabId,label:"AI Signals",       color:"#60A5FA", bg:C.sapphireDim,           border:C.sapphireBorder,         icon:<Brain size={13}/>},
          ].map(item=>(
            <button key={item.id} onClick={()=>setTab(item.id)}
              style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:item.bg,border:`1px solid ${item.border}`,borderRadius:9,color:item.color,padding:"9px 12px",cursor:"pointer",fontSize:12,fontWeight:500,transition:"all 0.15s"}}
              onMouseEnter={e=>e.currentTarget.style.opacity="0.8"}
              onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
              <span style={{display:"flex",alignItems:"center",gap:7}}>{item.icon}{item.label}</span>
              <ChevronRight size={13}/>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:C.bgBase,color:C.textPrimary,fontFamily:"'DM Sans',system-ui,sans-serif"}}>

      {/* ── HEADER ──────────────────────────────────────────────── */}
      <header style={{position:"sticky",top:0,zIndex:50,background:"rgba(6,11,20,0.97)",backdropFilter:"blur(28px) saturate(2)",WebkitBackdropFilter:"blur(28px) saturate(2)",borderBottom:`1px solid ${C.borderSoft}`}}>
        {/* Top strip: logo + index ticker + actions */}
        <div style={{display:"flex",alignItems:"center",gap:14,padding:"0 16px",height:52,borderBottom:`1px solid ${C.borderSoft}`}}>
          {/* Logo */}
          <div style={{display:"flex",alignItems:"center",gap:9,flexShrink:0}}>
            <div style={{width:30,height:30,borderRadius:9,background:"linear-gradient(135deg,#3B82F6 0%,#10B981 100%)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 2px 12px rgba(59,130,246,0.3)"}}>
              <Zap size={15} color="#fff" strokeWidth={2.5}/>
            </div>
            <div style={{display:"flex",flexDirection:"column",lineHeight:1}}>
              <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12,fontWeight:600,letterSpacing:"0.12em",color:C.textPrimary}}>VERTEX</span>
              <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:8,color:C.textMuted,letterSpacing:"0.18em",marginTop:1}}>TERMINAL</span>
            </div>
          </div>

          {/* Index ticker — scrollable */}
          <div className="scroll-x" style={{flex:1,display:"flex",alignItems:"center",gap:18,overflow:"hidden"}}>
            {INDICES.map(m=>(
              <div key={m.name} style={{display:"flex",alignItems:"center",gap:5,flexShrink:0}}>
                <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:C.textMuted,textTransform:"uppercase",letterSpacing:"0.06em"}}>{m.name}</span>
                <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,fontWeight:500,color:C.textPrimary}}>{m.val}</span>
                <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:m.up?C.emeraldBright:C.crimsonBright}}>{m.chg}</span>
              </div>
            ))}
          </div>

          {/* Search */}
          <div ref={searchRef} style={{position:"relative",flexShrink:0}}>
            <button onClick={()=>setShowSearch(s=>!s)}
              style={{background:"none",border:"none",cursor:"pointer",color:showSearch?"#60A5FA":C.textSecondary,padding:8,minWidth:40,minHeight:40,display:"flex",alignItems:"center",justifyContent:"center",transition:"color 0.15s"}}>
              <Search size={18}/>
            </button>
            {showSearch&&(
              <div style={{position:"absolute",right:0,top:46,width:"min(340px,92vw)",background:C.bgElevated,border:`1px solid ${C.borderMid}`,borderRadius:14,overflow:"hidden",zIndex:99,boxShadow:"0 16px 48px rgba(0,0,0,0.6)",animation:"fadeUp 0.2s ease-out both"}}>
                <div style={{display:"flex",alignItems:"center",gap:8,padding:"11px 14px",borderBottom:`1px solid ${C.borderSoft}`}}>
                  <Search size={14} color={C.textMuted}/>
                  <input autoFocus value={search} onChange={e=>setSearch(e.target.value)}
                    style={{background:"transparent",fontFamily:"'JetBrains Mono',monospace",fontSize:13,color:C.textPrimary,border:"none",outline:"none",flex:1}}
                    placeholder="Search ticker or company…"/>
                  {searching&&<RefreshCw size={12} color={C.textMuted} style={{animation:"spin 1s linear infinite"}}/>}
                  {search&&<button onClick={()=>setSearch("")} style={{background:"none",border:"none",cursor:"pointer",color:C.textMuted,padding:2}}><X size={13}/></button>}
                </div>
                {results.map(t=>(
                  <button key={t} onClick={()=>go(t)}
                    style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",padding:"11px 14px",background:"none",border:"none",cursor:"pointer",minHeight:48,textAlign:"left",transition:"background 0.12s"}}
                    onMouseEnter={e=>e.currentTarget.style.background=C.bgHover}
                    onMouseLeave={e=>e.currentTarget.style.background="none"}>
                    <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:13,fontWeight:600,color:C.textPrimary}}>{t}</span>
                    <span style={{fontSize:11,color:C.textSecondary,maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{MOCK[t]?.name??""}</span>
                  </button>
                ))}
                {results.length===0&&search.length>0&&!searching&&(
                  <p style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:C.textMuted,textAlign:"center",padding:"16px 14px"}}>No results for "{search}"</p>
                )}
              </div>
            )}
          </div>

          {/* Live badge */}
          <div style={{display:"flex",alignItems:"center",gap:5,flexShrink:0}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:C.emeraldBright,animation:"pulseDot 2.5s ease-in-out infinite",boxShadow:`0 0 6px ${C.emeraldBright}`}}/>
            <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:C.textMuted,textTransform:"uppercase",letterSpacing:"0.1em"}}>Live</span>
          </div>
        </div>

        {/* Tab bar — desktop */}
        <div style={{display:"flex",alignItems:"center",gap:0,padding:"0 16px",height:40,overflow:"auto"}}>
          {TABS.map(t=>{
            const active=tab===t.id;
            return(
              <button key={t.id} onClick={()=>setTab(t.id)}
                style={{display:"flex",alignItems:"center",gap:6,padding:"0 14px",height:"100%",background:"none",border:"none",borderBottom:active?`2px solid #3B82F6`:"2px solid transparent",color:active?C.textPrimary:C.textSecondary,cursor:"pointer",fontSize:12,fontWeight:active?600:400,transition:"all 0.2s",whiteSpace:"nowrap",letterSpacing:"0.01em"}}>
                {t.icon} {t.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* ── MAIN ────────────────────────────────────────────────── */}
      <main style={{paddingBottom:80}}>
        {fullWidth&&(
          <div style={{maxWidth:1200,margin:"0 auto"}}>
            {tab==="top15"    && <Top15/>}
            {tab==="mystocks" && <MyStocks/>}
          </div>
        )}
        {!fullWidth&&(
          <div style={{maxWidth:1200,margin:"0 auto",padding:"20px 16px"}}>
            <div style={{display:"flex",flexDirection:"column",gap:20}}>
              <div style={{minWidth:0}}>
                {tab==="dashboard"&&<DashPanel/>}
                {tab==="ai"       &&<AIPanel/>}
              </div>
              {/* Desktop sidebar — CSS-driven */}
              <div id="vx-sidebar" style={{display:"none"}}>
                <Sidebar/>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── MOBILE BOTTOM NAV ───────────────────────────────────── */}
      <nav className="bottom-nav">
        <div style={{display:"flex",alignItems:"stretch"}}>
          {TABS.map(t=>{
            const active=tab===t.id;
            return(
              <button key={t.id} onClick={()=>setTab(t.id)}
                style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"8px 4px 6px",gap:3,background:"none",border:"none",cursor:"pointer",minHeight:56,transition:"color 0.15s",color:active?"#60A5FA":C.textMuted}}>
                <div style={{padding:"3px 10px",borderRadius:16,background:active?"rgba(59,130,246,0.12)":"transparent",transition:"background 0.2s",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  {t.id==="dashboard"&&<LayoutDashboard size={21} strokeWidth={active?2:1.5}/>}
                  {t.id==="top15"    &&<Trophy          size={21} strokeWidth={active?2:1.5}/>}
                  {t.id==="mystocks" &&<BookOpen         size={21} strokeWidth={active?2:1.5}/>}
                  {t.id==="ai"       &&<Brain            size={21} strokeWidth={active?2:1.5}/>}
                </div>
                <span style={{fontSize:9,fontWeight:active?600:400,letterSpacing:"0.02em"}}>{t.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <style>{`
        @keyframes fadeUp  { from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn  { from{opacity:0}to{opacity:1} }
        @keyframes pulseDot{ 0%,100%{opacity:1;transform:scale(1)}50%{opacity:.3;transform:scale(.65)} }
        @keyframes spin    { to{transform:rotate(360deg)} }
        @keyframes shimmer { 0%{background-position:-200% 0}100%{background-position:200% 0} }
        *  { box-sizing:border-box; }
        input { font-size:16px; }
        button,[role="button"] { touch-action:manipulation; }
        ::-webkit-scrollbar{width:3px;height:3px}
        ::-webkit-scrollbar-thumb{background:rgba(100,160,220,0.18);border-radius:99px}

        /* Two-column layout on large screens */
        @media (min-width:1024px) {
          main > div > div { display:grid !important; grid-template-columns:1fr 290px !important; }
          #vx-sidebar { display:block !important; }
        }
      `}</style>
    </div>
  );
}
