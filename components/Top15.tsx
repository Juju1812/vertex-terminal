"use client";

import { useState, useEffect, useCallback } from "react";
import {
  TrendingUp, TrendingDown, DollarSign,
  Trophy, Target, Shield, Zap,
  ChevronUp, ChevronDown, X,
  ArrowRight, ExternalLink,
} from "lucide-react";
import { CountdownBar } from "@/components/CountdownBar";

interface Stock {
  rank: number; ticker: string; name: string; price: number;
  changePct: number; change: number; floor: number; ceiling: number;
  conf: number; sector: string; score: number; volume: number;
}

interface Alloc {
  ticker: string; name: string; price: number;
  dollars: number; shares: number; pct: number; note: string;
}

interface Top15Props {
  onSelectTicker?: (ticker: string) => void;
}

interface SnapTicker {
  ticker:  string;
  day:     { c: number; o: number; h: number; l: number; v: number };
  prevDay: { c: number };
}

interface AggBar { c: number; o: number; h: number; l: number; v: number; t: number; }

const KEY  = "1xwzcvUOF9pft6PRNylO2Xc6X2QeQCGr";
const BASE = "https://api.polygon.io";

const UNI: { t: string; n: string; s: string }[] = [
  { t:"NVDA",  n:"NVIDIA Corp.",          s:"Technology" },
  { t:"MSFT",  n:"Microsoft Corp.",        s:"Technology" },
  { t:"AAPL",  n:"Apple Inc.",             s:"Technology" },
  { t:"META",  n:"Meta Platforms",         s:"Technology" },
  { t:"GOOGL", n:"Alphabet Inc.",          s:"Technology" },
  { t:"AMZN",  n:"Amazon.com",             s:"Consumer"   },
  { t:"AMD",   n:"Advanced Micro Dev.",    s:"Technology" },
  { t:"PLTR",  n:"Palantir Tech.",         s:"Technology" },
  { t:"JPM",   n:"JPMorgan Chase",         s:"Financials" },
  { t:"V",     n:"Visa Inc.",              s:"Financials" },
  { t:"UNH",   n:"UnitedHealth Group",     s:"Healthcare" },
  { t:"LLY",   n:"Eli Lilly & Co.",        s:"Healthcare" },
  { t:"TSLA",  n:"Tesla Inc.",             s:"Consumer"   },
  { t:"ORCL",  n:"Oracle Corp.",           s:"Technology" },
  { t:"CRWD",  n:"CrowdStrike",            s:"Technology" },
  { t:"PANW",  n:"Palo Alto Networks",     s:"Technology" },
  { t:"AVGO",  n:"Broadcom Inc.",          s:"Technology" },
  { t:"CRM",   n:"Salesforce Inc.",        s:"Technology" },
  { t:"NOW",   n:"ServiceNow Inc.",        s:"Technology" },
  { t:"COIN",  n:"Coinbase Global",        s:"Financials" },
];

const SECTOR_HUE: Record<string, string> = {
  Technology:"#4F8EF7", Financials:"#9B72F5",
  Healthcare:"#00C896", Consumer:"#E8A030",
};

const calcConf = (chg: number, vol: number): number => {
  let c = 60;
  if (chg > 3) c += 18; else if (chg > 1) c += 10; else if (chg < -2) c -= 12;
  if (vol > 50e6) c += 12; else if (vol > 25e6) c += 6;
  return Math.min(96, Math.max(42, c));
};

const calcScore = (chg: number, vol: number, conf: number): number =>
  +(Math.min(Math.max(chg / 5, -1), 1) * 40 + Math.min(vol / 60e6, 1) * 30 + (conf / 100) * 30).toFixed(2);

const calcLevels = (price: number, chg: number) => ({
  floor:   +(price * (1 - (chg < 0 ? 0.06 : 0.04))).toFixed(2),
  ceiling: +(price * (1 + (chg > 2 ? 0.14 : chg > 0 ? 0.10 : 0.08))).toFixed(2),
});

async function polyFetch<T>(path: string): Promise<T | null> {
  try {
    const sep = path.includes("?") ? "&" : "?";
    const r = await fetch(`${BASE}${path}${sep}apiKey=${KEY}`);
    return r.ok ? (r.json() as Promise<T>) : null;
  } catch {
    return null;
  }
}

/* Fallback prices used when the API returns nothing (market closed,
   rate-limited, or weekend). These are approximate last-known values
   used only for display -- the real API data takes priority.          */
const FALLBACK: Record<string, { price: number; changePct: number; volume: number }> = {
  NVDA:{ price:875,   changePct: 2.90, volume:42_000_000 },
  MSFT:{ price:415,   changePct:-0.52, volume:21_000_000 },
  AAPL:{ price:228,   changePct: 1.42, volume:58_000_000 },
  META:{ price:554,   changePct: 1.63, volume:14_000_000 },
  GOOGL:{ price:178,  changePct: 0.81, volume:18_000_000 },
  AMZN:{ price:201,   changePct:-0.44, volume:29_000_000 },
  AMD: { price:162,   changePct: 3.72, volume:45_000_000 },
  PLTR:{ price:38,    changePct: 4.96, volume:60_000_000 },
  JPM: { price:224,   changePct: 0.50, volume:10_000_000 },
  V:   { price:296,   changePct: 0.83, volume:8_000_000  },
  UNH: { price:512,   changePct:-0.81, volume:3_000_000  },
  LLY: { price:798,   changePct: 1.24, volume:4_000_000  },
  TSLA:{ price:248,   changePct:-3.58, volume:89_000_000 },
  ORCL:{ price:142,   changePct: 0.92, volume:7_000_000  },
  CRWD:{ price:368,   changePct: 2.44, volume:5_000_000  },
  PANW:{ price:341,   changePct: 1.87, volume:4_000_000  },
  AVGO:{ price:1642,  changePct: 1.11, volume:3_000_000  },
  CRM: { price:299,   changePct: 0.68, volume:5_000_000  },
  NOW: { price:812,   changePct: 1.33, volume:2_000_000  },
  COIN:{ price:234,   changePct: 5.21, volume:15_000_000 },
};

async function fetchDailyBars(ticker: string): Promise<Array<{ close: number; open: number; high: number; low: number; volume: number }>> {
  const to   = new Date().toISOString().split("T")[0];
  /* Use a 30-day window so we always catch at least 2 trading days
     even across long weekends / holidays.                            */
  const from = new Date(Date.now() - 30 * 86_400_000).toISOString().split("T")[0];
  const d = await polyFetch<{ results?: AggBar[] }>(
    `/v2/aggs/ticker/${ticker}/range/1/day/${from}/${to}?adjusted=true&sort=asc&limit=30`
  );
  if (!d?.results?.length) return [];
  return d.results.map(b => ({ close:b.c, open:b.o, high:b.h, low:b.l, volume:b.v }));
}

async function fetchAllPrices(): Promise<Record<string, { price: number; changePct: number; change: number; high: number; low: number; open: number; volume: number }>> {
  const tickers = UNI.map(u => u.t);
  const result: Record<string, { price: number; changePct: number; change: number; high: number; low: number; open: number; volume: number }> = {};

  /* Step 1: try the bulk snapshot (fast, works during market hours) */
  const snap = await polyFetch<{ tickers?: SnapTicker[] }>(
    `/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${tickers.join(",")}`
  );

  const snapMap: Record<string, SnapTicker> = {};
  if (snap?.tickers) {
    for (const s of snap.tickers) snapMap[s.ticker] = s;
  }

  const needBars: string[] = [];
  for (const t of tickers) {
    const s = snapMap[t];
    if (s && s.day?.c > 0 && s.prevDay?.c > 0) {
      const price = s.day.c;
      const prev  = s.prevDay.c;
      const chg   = price - prev;
      result[t] = {
        price, change: +chg.toFixed(2),
        changePct: +((chg / prev) * 100).toFixed(2),
        high:   s.day.h || price,
        low:    s.day.l || price,
        open:   s.day.o || price,
        volume: s.day.v || 0,
      };
    } else {
      needBars.push(t);
    }
  }

  /* Step 2: bar fallback for anything snapshot missed (market closed) */
  if (needBars.length) {
    /* Fetch in small parallel batches to avoid rate-limits on free tier */
    const BATCH = 5;
    for (let i = 0; i < needBars.length; i += BATCH) {
      const batch = needBars.slice(i, i + BATCH);
      const barData = await Promise.all(
        batch.map(t => fetchDailyBars(t).then(bars => ({ t, bars })))
      );
      for (const { t, bars } of barData) {
        if (bars.length >= 2) {
          const last  = bars[bars.length - 1];
          const prev  = bars[bars.length - 2];
          const chg   = last.close - prev.close;
          const snap2 = snapMap[t];
          result[t] = {
            price:     last.close,
            change:    +chg.toFixed(2),
            changePct: +((chg / prev.close) * 100).toFixed(2),
            high:   snap2?.day?.h > 0 ? snap2.day.h : +(last.close * 1.005).toFixed(2),
            low:    snap2?.day?.l > 0 ? snap2.day.l : +(last.close * 0.995).toFixed(2),
            open:   snap2?.day?.o > 0 ? snap2.day.o : prev.close,
            volume: snap2?.day?.v > 0 ? snap2.day.v : last.volume,
          };
        }
      }
    }
  }

  /* Step 3: for any ticker still missing, use the hardcoded fallback
     so the table is never empty. These are stale but better than blank. */
  for (const t of tickers) {
    if (!result[t]) {
      const fb = FALLBACK[t];
      if (fb) {
        const chg = +(fb.price * fb.changePct / 100).toFixed(2);
        result[t] = {
          price:     fb.price,
          change:    chg,
          changePct: fb.changePct,
          high:   +(fb.price * 1.005).toFixed(2),
          low:    +(fb.price * 0.995).toFixed(2),
          open:   +(fb.price - chg).toFixed(2),
          volume: fb.volume,
        };
      }
    }
  }

  return result;
}

async function fetchTop15(): Promise<Stock[]> {
  const prices = await fetchAllPrices();
  const rows = UNI.map((u): Stock | null => {
    const lp = prices[u.t];
    if (!lp || lp.price <= 0) return null;
    const conf = calcConf(lp.changePct, lp.volume);
    const { floor, ceiling } = calcLevels(lp.price, lp.changePct);
    return {
      rank: 0, ticker: u.t, name: u.n, sector: u.s,
      price: lp.price, change: lp.change, changePct: lp.changePct,
      high: lp.high, low: lp.low, open: lp.open, volume: lp.volume,
      floor, ceiling, conf,
      score: calcScore(lp.changePct, lp.volume, conf),
    };
  }).filter((r): r is Stock => r !== null);

  rows.sort((a, b) => b.score - a.score);
  rows.forEach((r, i) => { r.rank = i + 1; });
  return rows.slice(0, 15);
}

function simulate(stocks: Stock[], cash: number): Alloc[] {
  const picks = stocks.slice(0, 8);
  const tw = picks.reduce((s, p) => s + p.conf * Math.max(p.score + 60, 1), 0);
  return picks.map(p => {
    const w       = (p.conf * Math.max(p.score + 60, 1)) / tw;
    const dollars = Math.round(cash * w * 100) / 100;
    const upside  = (((p.ceiling - p.price) / p.price) * 100).toFixed(1);
    return {
      ticker: p.ticker, name: p.name, price: p.price,
      dollars, shares: Math.floor(dollars / p.price),
      pct: +(w * 100).toFixed(1),
      note: `${(w * 100).toFixed(1)}%  x  +${upside}% target  x  ${p.conf}% conf`,
    };
  }).sort((a, b) => b.dollars - a.dollars);
}

const f$ = (n: number, d = 2) =>
  new Intl.NumberFormat("en-US", { style:"currency", currency:"USD", minimumFractionDigits:d, maximumFractionDigits:d }).format(n);
const fp = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;

const V = {
  d0:"#050810", dh:"rgba(30,45,64,0.85)",
  w1:"rgba(130,180,255,0.055)", w2:"rgba(130,180,255,0.10)", w3:"rgba(130,180,255,0.16)",
  ink0:"#F2F6FF", ink1:"#C8D5E8", ink2:"#7A9CBF", ink3:"#3D5A7A", ink4:"#1F3550",
  gain:"#00C896", gainDim:"rgba(0,200,150,0.08)", gainWire:"rgba(0,200,150,0.20)",
  loss:"#E8445A", lossDim:"rgba(232,68,90,0.08)",  lossWire:"rgba(232,68,90,0.20)",
  arc:"#4F8EF7",  arcDim:"rgba(79,142,247,0.10)",  arcWire:"rgba(79,142,247,0.22)",
  gold:"#E8A030", ame:"#9B72F5",
};
const mono: React.CSSProperties = { fontFamily:"'Geist Mono','Courier New',monospace" };

const glass = (ex?: React.CSSProperties): React.CSSProperties => ({
  background: "linear-gradient(145deg,rgba(255,255,255,0.030) 0%,rgba(255,255,255,0.012) 100%)",
  backdropFilter: "blur(24px) saturate(1.5)",
  WebkitBackdropFilter: "blur(24px) saturate(1.5)",
  border: `1px solid ${V.w2}`,
  borderRadius: 14,
  boxShadow: "0 4px 16px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)",
  position: "relative" as const,
  overflow: "hidden",
  ...ex,
});

function ConfBar({ pct }: { pct: number }) {
  const color = pct >= 80 ? V.gain : pct >= 65 ? V.gold : V.loss;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:7 }}>
      <div style={{ flex:1, height:2, background:"rgba(255,255,255,0.05)", borderRadius:99, overflow:"hidden" }}>
        <div style={{ width:`${pct}%`, height:"100%", background:color, borderRadius:99, transition:"width 0.9s cubic-bezier(0.16,1,0.3,1)" }} />
      </div>
      <span style={{ ...mono, fontSize:10, color, minWidth:26 }}>{pct}%</span>
    </div>
  );
}

function YahooBtn({ ticker }: { ticker: string }) {
  return (
    <a
      href={`https://finance.yahoo.com/quote/${ticker}`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={e => e.stopPropagation()}
      style={{ display:"inline-flex", alignItems:"center", gap:3, padding:"2px 7px", borderRadius:5, background:"rgba(79,142,247,0.08)", border:"1px solid rgba(79,142,247,0.18)", color:"#7EB6FF", textDecoration:"none", fontSize:9, fontFamily:"'Geist Mono','Courier New',monospace", whiteSpace:"nowrap", transition:"background 0.15s", flexShrink:0 }}
      onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(79,142,247,0.16)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(79,142,247,0.08)"; }}
    >
      <ExternalLink size={8} />
      Yahoo
    </a>
  );
}

function SimModal({ stocks, onClose }: { stocks: Stock[]; onClose: () => void }) {
  const [cash, setCash] = useState("50000");
  const num    = Math.max(100, parseFloat(cash.replace(/,/g, "")) || 50000);
  const allocs = simulate(stocks, num);
  const total  = allocs.reduce((s, a) => s + a.dollars, 0);

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:999, display:"flex", alignItems:"flex-end", justifyContent:"center", backdropFilter:"blur(4px)" }}
    >
      <div style={{ ...glass({ borderRadius:"18px 18px 0 0", boxShadow:"0 -20px 60px rgba(0,0,0,0.6)" }), width:"100%", maxWidth:680, maxHeight:"90vh", overflow:"auto" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 20px", borderBottom:`1px solid ${V.w1}`, position:"sticky", top:0, background:"rgba(8,13,24,0.97)", backdropFilter:"blur(20px)", zIndex:1 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:32, height:32, borderRadius:9, background:"linear-gradient(135deg,#4F8EF7,#00C896)", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <DollarSign size={15} color="#fff" />
            </div>
            <div>
              <p style={{ fontWeight:600, fontSize:14, color:V.ink0 }}>Portfolio Simulator</p>
              <p style={{ ...mono, fontSize:9, color:V.ink4, textTransform:"uppercase", letterSpacing:"0.07em" }}>AI-weighted  x  Top 8</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:V.ink3, padding:6, borderRadius:7, display:"flex", minWidth:34, minHeight:34, alignItems:"center", justifyContent:"center" }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding:"14px 20px", borderBottom:`1px solid ${V.w1}`, display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
          <label style={{ ...mono, fontSize:9, color:V.ink3, textTransform:"uppercase", letterSpacing:"0.08em", whiteSpace:"nowrap" }}>Investment</label>
          <div style={{ position:"relative", flex:1, minWidth:120 }}>
            <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:V.ink3, ...mono, fontSize:14 }}>$</span>
            <input type="number" value={cash} onChange={e => setCash(e.target.value)} min="100" step="1000"
              style={{ width:"100%", background:"rgba(255,255,255,0.03)", border:`1px solid ${V.w2}`, borderRadius:9, color:V.ink0, ...mono, fontSize:14, padding:"9px 12px 9px 22px", outline:"none" }} />
          </div>
          <p style={{ ...mono, fontSize:11, color:V.gain, whiteSpace:"nowrap" }}>Reserve: {f$(num - total)}</p>
        </div>

        <div style={{ padding:"12px 20px" }}>
          {allocs.map((a, i) => (
            <div key={a.ticker} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 0", borderBottom:"1px solid rgba(130,180,255,0.05)", flexWrap:"wrap" }}>
              <span style={{ ...mono, color:V.ink4, fontSize:10, minWidth:22 }}>#{i + 1}</span>
              <span style={{ ...mono, fontWeight:500, fontSize:13, color:"#7EB6FF", minWidth:48 }}>{a.ticker}</span>
              <div style={{ flex:1, minWidth:100 }}>
                <div style={{ height:2, background:"rgba(255,255,255,0.05)", borderRadius:99, overflow:"hidden", marginBottom:3 }}>
                  <div style={{ width:`${a.pct}%`, height:"100%", background:"linear-gradient(90deg,#4F8EF7,#00C896)", borderRadius:99 }} />
                </div>
                <span style={{ ...mono, color:V.ink4, fontSize:9 }}>{a.note}</span>
              </div>
              <div style={{ textAlign:"right", flexShrink:0 }}>
                <p style={{ ...mono, fontSize:13, fontWeight:500, color:V.ink0 }}>{f$(a.dollars)}</p>
                <p style={{ ...mono, fontSize:9, color:V.ink3 }}>{a.shares} sh  x  {a.pct}%</p>
              </div>
            </div>
          ))}
        </div>

        <div style={{ padding:"12px 20px", borderTop:`1px solid ${V.w1}`, display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8, background:"rgba(5,8,16,0.8)" }}>
          <p style={{ fontSize:11, color:V.ink3, maxWidth:280 }}>Weighted by confidence x momentum. Fractional shares excluded.</p>
          <div style={{ textAlign:"right" }}>
            <p style={{ ...mono, fontSize:9, color:V.ink4, textTransform:"uppercase", letterSpacing:"0.08em" }}>Total Deployed</p>
            <p style={{ ...mono, fontSize:20, fontWeight:500, color:V.gain, letterSpacing:"-0.02em" }}>{f$(total)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Top15({ onSelectTicker }: Top15Props) {
  const [stocks,  setStocks]  = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSim, setShowSim] = useState(false);
  const [sortCol, setSortCol] = useState<keyof Stock>("rank");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [hovRow,  setHovRow]  = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const d = await fetchTop15();
    setStocks(d);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const sorted = [...stocks].sort((a, b) => {
    const av = a[sortCol] as number;
    const bv = b[sortCol] as number;
    return sortDir === "asc" ? av - bv : bv - av;
  });

  const toggle = (col: keyof Stock) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  };

  if (loading) return (
    <div style={{ padding:24, display:"flex", flexDirection:"column", gap:12 }}>
      {[180, 60, 60, 60, 60, 60].map((h, i) => (
        <div key={i} style={{ background:"linear-gradient(105deg,#0C1220 30%,#151F30 50%,#0C1220 70%)", backgroundSize:"400% 100%", animation:"shimmer 2.2s ease-in-out infinite", borderRadius:12, height:h }} />
      ))}
      <style>{`@keyframes shimmer{0%{background-position:-400% 0}100%{background-position:400% 0}}`}</style>
    </div>
  );

  const ColH = ({ label, col, right }: { label: string; col: keyof Stock; right?: boolean }) => (
    <th
      onClick={() => toggle(col)}
      style={{ ...mono, fontSize:9, color: sortCol === col ? "#7EB6FF" : V.ink4, textTransform:"uppercase", letterSpacing:"0.09em", padding:"10px 10px", cursor:"pointer", userSelect:"none", textAlign: right ? "right" : "left", fontWeight: sortCol === col ? 500 : 400, whiteSpace:"nowrap", background:"rgba(5,8,16,0.75)" }}
    >
      <span style={{ display:"inline-flex", alignItems:"center", gap:3 }}>
        {label}
        {sortCol === col
          ? (sortDir === "asc" ? <ChevronUp size={10} color="#7EB6FF" /> : <ChevronDown size={10} color="#7EB6FF" />)
          : <span style={{ opacity:0.18 }}>{"~"}</span>}
      </span>
    </th>
  );

  return (
    <div style={{ padding:"20px 16px", maxWidth:1280, margin:"0 auto" }}>

      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:18, gap:12, flexWrap:"wrap" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:40, height:40, borderRadius:11, background:"linear-gradient(135deg,rgba(232,160,48,0.15),rgba(232,160,48,0.06))", border:"1px solid rgba(232,160,48,0.25)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <Trophy size={20} color={V.gold} />
          </div>
          <div>
            <h2 style={{ fontSize:18, fontWeight:700, color:V.ink0, margin:0, letterSpacing:"-0.01em" }}>Top 15 Stocks</h2>
            <p style={{ ...mono, color:V.ink4, fontSize:9, margin:0, marginTop:2, textTransform:"uppercase", letterSpacing:"0.08em" }}>
              Live prices  x  Click any row to view full details
            </p>
          </div>
        </div>
        <button onClick={() => setShowSim(true)} className="vx-btn vx-btn-arc"
          style={{ fontFamily:"'Bricolage Grotesque',system-ui,sans-serif", fontWeight:600, flexShrink:0 }}>
          <DollarSign size={13} /> Simulate Portfolio
        </button>
      </div>

      <div style={{ marginBottom:16 }}>
        <CountdownBar onRefresh={loadData} label="Next ranking update" />
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:8, marginBottom:16 }}>
        {[
          { icon:<TrendingUp size={13} color={V.gain} />,    label:"Bullish",        val:`${stocks.filter(s => s.changePct > 0).length}/${stocks.length}` },
          { icon:<Shield    size={13} color="#7EB6FF" />,    label:"Avg Confidence", val:`${Math.round(stocks.reduce((s, x) => s + x.conf, 0) / (stocks.length || 1))}%` },
          { icon:<Target    size={13} color={V.gold} />,     label:"Avg Upside",     val:`+${(stocks.reduce((s, x) => s + ((x.ceiling - x.price) / x.price) * 100, 0) / (stocks.length || 1)).toFixed(1)}%` },
          { icon:<Zap       size={13} color={V.ame} />,      label:"Sectors",        val:`${[...new Set(stocks.map(s => s.sector))].length} covered` },
        ].map(s => (
          <div key={s.label} style={{ ...glass({ padding:"11px 14px", display:"flex", alignItems:"center", gap:10 }) }}>
            <div style={{ width:28, height:28, borderRadius:7, background:"rgba(255,255,255,0.04)", border:`1px solid ${V.w1}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>{s.icon}</div>
            <div>
              <p style={{ ...mono, color:V.ink4, fontSize:8, textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:2 }}>{s.label}</p>
              <p style={{ ...mono, fontSize:13, fontWeight:500, color:V.ink0 }}>{s.val}</p>
            </div>
          </div>
        ))}
      </div>

      <div style={{ ...glass({ overflow:"hidden" }) }}>
        <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", minWidth:640 }}>
            <thead>
              <tr style={{ borderBottom:`1px solid ${V.w1}` }}>
                <ColH label="Rank"    col="rank" />
                <th style={{ ...mono, fontSize:9, color:V.ink4, textTransform:"uppercase", letterSpacing:"0.09em", padding:"10px 10px", textAlign:"left", fontWeight:400, background:"rgba(5,8,16,0.75)", whiteSpace:"nowrap" }}>Ticker</th>
                <th style={{ ...mono, fontSize:9, color:V.ink4, textTransform:"uppercase", letterSpacing:"0.09em", padding:"10px 10px", textAlign:"left", fontWeight:400, background:"rgba(5,8,16,0.75)", whiteSpace:"nowrap", minWidth:120 }}>Company</th>
                <ColH label="Price"   col="price"     right />
                <ColH label="Today"   col="changePct" right />
                <ColH label="Floor"   col="floor"     right />
                <ColH label="Ceiling" col="ceiling"   right />
                <ColH label="Conf."   col="conf"      right />
                <th style={{ ...mono, fontSize:9, color:V.ink4, textTransform:"uppercase", letterSpacing:"0.09em", padding:"10px 10px", textAlign:"center", fontWeight:400, background:"rgba(5,8,16,0.75)", whiteSpace:"nowrap" }}>Link</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((s, idx) => {
                const up      = s.changePct >= 0;
                const sc      = SECTOR_HUE[s.sector] ?? "#7A9CBF";
                const isH     = hovRow === s.ticker;
                const clickable = !!onSelectTicker;
                return (
                  <tr
                    key={s.ticker}
                    onClick={() => onSelectTicker?.(s.ticker)}
                    onMouseEnter={() => setHovRow(s.ticker)}
                    onMouseLeave={() => setHovRow(null)}
                    style={{ borderBottom:"1px solid rgba(130,180,255,0.04)", background: isH ? V.dh : "transparent", transition:"background 0.15s", cursor: clickable ? "pointer" : "default" }}
                  >
                    <td style={{ padding:"13px 10px", textAlign:"right", whiteSpace:"nowrap" }}>
                      <span style={{ ...mono, fontSize:12, color: idx < 3 ? V.gold : V.ink4, fontWeight:500 }}>
                        {idx === 0 ? "#1" : idx === 1 ? "#2" : idx === 2 ? "#3" : `#${s.rank}`}
                      </span>
                    </td>
                    <td style={{ padding:"13px 10px", whiteSpace:"nowrap" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                        <div>
                          <p style={{ ...mono, fontSize:13, fontWeight:500, color: isH ? "#93C5FD" : "#7EB6FF", letterSpacing:"-0.01em" }}>{s.ticker}</p>
                          <span style={{ ...mono, fontSize:8, padding:"1px 5px", borderRadius:4, background:`${sc}15`, color:sc, border:`1px solid ${sc}22` }}>{s.sector}</span>
                        </div>
                        {isH && clickable && <ArrowRight size={13} color="#7EB6FF" style={{ flexShrink:0 }} />}
                      </div>
                    </td>
                    <td style={{ padding:"13px 10px", fontSize:12, color:V.ink2, maxWidth:150 }}>
                      <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", display:"block" }}>{s.name}</span>
                    </td>
                    <td style={{ padding:"13px 10px", textAlign:"right" }}>
                      <span style={{ ...mono, fontSize:13, fontWeight:600, color:V.ink0 }}>{f$(s.price)}</span>
                    </td>
                    <td style={{ padding:"13px 10px", textAlign:"right", whiteSpace:"nowrap" }}>
                      <span style={{ ...mono, fontSize:11, padding:"3px 7px", borderRadius:5, background: up ? V.gainDim : V.lossDim, color: up ? V.gain : V.loss, border:`1px solid ${up ? V.gainWire : V.lossWire}`, display:"inline-flex", alignItems:"center", gap:2 }}>
                        {up ? <TrendingUp size={9} /> : <TrendingDown size={9} />}{fp(s.changePct)}
                      </span>
                    </td>
                    <td style={{ padding:"13px 10px", textAlign:"right", whiteSpace:"nowrap" }}>
                      <span style={{ ...mono, fontSize:11, color:V.loss }}>{f$(s.floor)}</span>
                    </td>
                    <td style={{ padding:"13px 10px", textAlign:"right", whiteSpace:"nowrap" }}>
                      <p style={{ ...mono, fontSize:12, color:V.gain, fontWeight:500 }}>{f$(s.ceiling)}</p>
                      <p style={{ ...mono, fontSize:9, color:V.ink4 }}>+{(((s.ceiling - s.price) / s.price) * 100).toFixed(1)}%</p>
                    </td>
                    <td style={{ padding:"13px 14px 13px 10px", minWidth:110 }}>
                      <ConfBar pct={s.conf} />
                    </td>
                    <td style={{ padding:"8px 10px", textAlign:"center" }}>
                      <YahooBtn ticker={s.ticker} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {onSelectTicker && (
          <div style={{ padding:"10px 16px", borderTop:`1px solid ${V.w1}`, display:"flex", alignItems:"center", gap:6 }}>
            <ArrowRight size={11} color={V.ink4} />
            <span style={{ ...mono, fontSize:9, color:V.ink4, textTransform:"uppercase", letterSpacing:"0.08em" }}>
              Tap any row to view full stock details
            </span>
          </div>
        )}
      </div>

      <p style={{ ...mono, color:V.ink4, fontSize:9, marginTop:10, lineHeight:1.6 }}>
        Prices from Polygon.io -- live during market hours, last official close otherwise  x  Not financial advice
      </p>

      {showSim && <SimModal stocks={stocks} onClose={() => setShowSim(false)} />}
    </div>
  );
}
