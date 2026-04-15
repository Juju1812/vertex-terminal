"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  TrendingUp, TrendingDown, DollarSign,
  Trophy, Target, Shield, Zap, Brain,
  ChevronUp, ChevronDown, X,
  ArrowRight, ExternalLink, AlertTriangle,
  Clock, Activity,
} from "lucide-react";

/* ---- Types -------------------------------------------------- */
interface Stock {
  rank: number; ticker: string; name: string; sector: string;
  price: number; change: number; changePct: number;
  high: number; low: number; open: number; volume: number;
  rsi: number; sma20: number; sma50: number;
  volumeRatio: number; momentum5d: number; momentum20d: number;
  support: number; resistance: number;
  signal: "STRONG BUY" | "BUY" | "HOLD" | "SELL" | "STRONG SELL";
  confidence: number; targetPrice: number;
  thesis: string; risks: string; tags: string[];
  score: number; floor: number; ceiling: number;
}

interface Alloc {
  ticker: string; name: string; price: number;
  dollars: number; shares: number; pct: number; note: string;
}

interface Top15Props { onSelectTicker?: (ticker: string) => void; }

/* ---- Universe of 60 stocks --------------------------------- */
const UNI = [
  /* ---- Large Cap Tech ---- */
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
  /* ---- Financials ---- */
  { t:"JPM",   n:"JPMorgan Chase",          s:"Financials"  },
  { t:"V",     n:"Visa Inc.",               s:"Financials"  },
  { t:"MA",    n:"Mastercard Inc.",         s:"Financials"  },
  { t:"BAC",   n:"Bank of America",         s:"Financials"  },
  { t:"GS",    n:"Goldman Sachs",           s:"Financials"  },
  { t:"COIN",  n:"Coinbase Global",         s:"Financials"  },
  /* ---- Consumer / EV ---- */
  { t:"AMZN",  n:"Amazon.com",              s:"Consumer"    },
  { t:"TSLA",  n:"Tesla Inc.",              s:"Consumer"    },
  { t:"NKE",   n:"Nike Inc.",               s:"Consumer"    },
  { t:"SBUX",  n:"Starbucks Corp.",         s:"Consumer"    },
  { t:"RIVN",  n:"Rivian Automotive",       s:"Consumer"    },
  { t:"LCID",  n:"Lucid Group",             s:"Consumer"    },
  /* ---- Healthcare / Biotech ---- */
  { t:"UNH",   n:"UnitedHealth Group",      s:"Healthcare"  },
  { t:"LLY",   n:"Eli Lilly & Co.",         s:"Healthcare"  },
  { t:"PFE",   n:"Pfizer Inc.",             s:"Healthcare"  },
  { t:"MRNA",  n:"Moderna Inc.",            s:"Healthcare"  },
  { t:"ABBV",  n:"AbbVie Inc.",             s:"Healthcare"  },
  { t:"NVO",   n:"Novo Nordisk (ADR)",      s:"Healthcare"  },
  /* ---- Cybersecurity / AI ---- */
  { t:"PLTR",  n:"Palantir Tech.",          s:"Technology"  },
  { t:"CRWD",  n:"CrowdStrike",             s:"Technology"  },
  { t:"PANW",  n:"Palo Alto Networks",      s:"Technology"  },
  { t:"S",     n:"SentinelOne",             s:"Technology"  },
  { t:"NET",   n:"Cloudflare Inc.",         s:"Technology"  },
  { t:"SNOW",  n:"Snowflake Inc.",          s:"Technology"  },
  /* ---- Energy ---- */
  { t:"XOM",   n:"ExxonMobil Corp.",        s:"Energy"      },
  { t:"CVX",   n:"Chevron Corp.",           s:"Energy"      },
  { t:"OXY",   n:"Occidental Petroleum",    s:"Energy"      },
  /* ---- International ADRs (OTC) ---- */
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
  /* ---- OTC / Speculative ---- */
  { t:"ACMIF", n:"Allied Critical Metals",  s:"Materials"   },
  { t:"BTQQF", n:"BTQ Technologies",        s:"Technology"  },
  { t:"CRCUF", n:"Calibre Mining",          s:"Materials"   },
  { t:"GBTC",  n:"Grayscale Bitcoin Trust", s:"Financials"  },
  { t:"MSTR",  n:"MicroStrategy Inc.",      s:"Technology"  },
  { t:"SIRI",  n:"Sirius XM Holdings",      s:"Consumer"    },
  { t:"NKLA",  n:"Nikola Corp.",            s:"Consumer"    },
];

const SECTOR_HUE: Record<string, string> = {
  Technology:"#4F8EF7", Financials:"#9B72F5",
  Healthcare:"#00C896",  Consumer:"#E8A030",
};

const SIGNAL_CONFIG: Record<string, { color: string; bg: string; border: string; label: string }> = {
  "STRONG BUY":  { color:"#00C896", bg:"rgba(0,200,150,0.10)",   border:"rgba(0,200,150,0.30)",   label:"STRONG BUY"  },
  "BUY":         { color:"#00C896", bg:"rgba(0,200,150,0.07)",   border:"rgba(0,200,150,0.20)",   label:"BUY"         },
  "HOLD":        { color:"#E8A030", bg:"rgba(232,160,48,0.07)",  border:"rgba(232,160,48,0.20)",  label:"HOLD"        },
  "SELL":        { color:"#E8445A", bg:"rgba(232,68,90,0.07)",   border:"rgba(232,68,90,0.20)",   label:"SELL"        },
  "STRONG SELL": { color:"#E8445A", bg:"rgba(232,68,90,0.12)",   border:"rgba(232,68,90,0.30)",   label:"STRONG SELL" },
};

/* ---- Market hours check ------------------------------------ */
function isMarketHours(): boolean {
  const now = new Date();
  const et = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const day = et.getDay();
  const hour = et.getHours();
  const min  = et.getMinutes();
  const mins = hour * 60 + min;
  // Mon-Fri, 9:30am - 4:00pm ET
  return day >= 1 && day <= 5 && mins >= 570 && mins < 960;
}

function nextMarketOpen(): string {
  const now = new Date();
  const et  = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const day = et.getDay();
  if (day === 0) return "Monday 9:30 AM ET";
  if (day === 6) return "Monday 9:30 AM ET";
  const hour = et.getHours();
  const min  = et.getMinutes();
  if (hour < 9 || (hour === 9 && min < 30)) return "Today at 9:30 AM ET";
  return "Tomorrow at 9:30 AM ET";
}

/* ---- Portfolio simulator ----------------------------------- */
function simulate(stocks: Stock[], cash: number): Alloc[] {
  const buys = stocks.filter(s =>
    (s.signal === "STRONG BUY" || s.signal === "BUY") &&
    s.price > 0 && !isNaN(s.price)
  ).slice(0, 8);
  if (!buys.length) return [];
  const tw = buys.reduce((s, p) => s + p.confidence * Math.max(p.score, 1), 0);
  if (!tw || isNaN(tw)) return [];
  return buys.map(p => {
    const w = (p.confidence * Math.max(p.score, 1)) / tw;
    const dollars = Math.round(cash * w * 100) / 100;
    const shares = p.price > 0 ? Math.floor(dollars / p.price) : 0;
    return {
      ticker: p.ticker, name: p.name, price: p.price,
      dollars, shares,
      pct: +(w * 100).toFixed(1),
      note: `${(w * 100).toFixed(1)}% — ${p.targetPrice > 0 && !isNaN(p.targetPrice) ? "target $" + p.targetPrice.toFixed(0) : "no target"} — ${p.confidence}% conf`,
    };
  }).sort((a, b) => b.dollars - a.dollars);
}

/* ---- Formatters -------------------------------------------- */
const f$ = (n: number, d = 2) =>
  new Intl.NumberFormat("en-US", { style:"currency", currency:"USD", minimumFractionDigits:d, maximumFractionDigits:d }).format(n);
const fp = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;

/* ---- Design tokens ----------------------------------------- */
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
  backdropFilter: "blur(24px) saturate(1.5)", WebkitBackdropFilter: "blur(24px) saturate(1.5)",
  border: `1px solid ${V.w2}`, borderRadius: 14,
  boxShadow: "0 4px 16px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)",
  ...ex, position: "relative" as const,
});

/* ---- ConfBar ----------------------------------------------- */
function ConfBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:7 }}>
      <div style={{ flex:1, height:3, background:"rgba(255,255,255,0.05)", borderRadius:99, overflow:"hidden" }}>
        <div style={{ width:`${pct}%`, height:"100%", background:color, borderRadius:99, transition:"width 1s cubic-bezier(0.16,1,0.3,1)" }} />
      </div>
      <span style={{ ...mono, fontSize:10, color, minWidth:30 }}>{pct}%</span>
    </div>
  );
}

/* ---- Yahoo Finance link ------------------------------------ */
function YahooBtn({ ticker }: { ticker: string }) {
  return (
    <a href={`https://finance.yahoo.com/quote/${ticker}`} target="_blank" rel="noopener noreferrer"
      onClick={e => e.stopPropagation()}
      style={{ display:"inline-flex", alignItems:"center", gap:3, padding:"2px 7px", borderRadius:5, background:"rgba(79,142,247,0.08)", border:"1px solid rgba(79,142,247,0.18)", color:"#7EB6FF", textDecoration:"none", fontSize:9, fontFamily:"'Geist Mono',monospace", whiteSpace:"nowrap", flexShrink:0 }}
      onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(79,142,247,0.16)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(79,142,247,0.08)"; }}>
      <ExternalLink size={8} /> Yahoo
    </a>
  );
}

/* ---- Stock Detail Modal ------------------------------------ */
function StockModal({ stock, onClose }: { stock: Stock; onClose: () => void }) {
  const sig = SIGNAL_CONFIG[stock.signal] ?? SIGNAL_CONFIG["HOLD"];
  const up  = stock.changePct >= 0;

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:"20px 16px" }}>
      <div style={{ background:"rgba(8,13,24,0.97)", border:"1px solid rgba(130,180,255,0.10)", borderRadius:18, width:"100%", maxWidth:680, maxHeight:"85vh", overflow:"auto", display:"flex", flexDirection:"column", position:"relative", zIndex:9999 }}>

        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"20px 24px", borderBottom:`1px solid ${V.w1}`, position:"sticky", top:0, background:"rgba(8,13,24,0.97)", backdropFilter:"blur(20px)", zIndex:1 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:2 }}>
                <span style={{ ...mono, fontSize:20, fontWeight:700, color:"#7EB6FF" }}>{stock.ticker}</span>
                <span style={{ ...mono, fontSize:10, padding:"3px 8px", borderRadius:5, background:sig.bg, color:sig.color, border:`1px solid ${sig.border}`, fontWeight:600 }}>{sig.label}</span>
                <YahooBtn ticker={stock.ticker} />
              </div>
              <span style={{ fontSize:12, color:V.ink3 }}>{stock.name}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:V.ink3, padding:6, borderRadius:7, display:"flex", minWidth:34, minHeight:34, alignItems:"center", justifyContent:"center" }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding:"20px 24px", display:"flex", flexDirection:"column", gap:16 }}>

          {/* Price + target */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10 }}>
            {[
              { l:"Price",     v:f$(stock.price),       c:V.ink0  },
              { l:"Target",    v: stock.targetPrice > 0 && !isNaN(stock.targetPrice) ? f$(stock.targetPrice) : "--", c:sig.color },
              { l:"Upside",    v: stock.targetPrice > 0 && !isNaN(stock.targetPrice) ? fp(((stock.targetPrice - stock.price) / stock.price) * 100) : "--", c: stock.targetPrice > stock.price ? V.gain : V.loss },
            ].map(s => (
              <div key={s.l} style={{ background:"rgba(255,255,255,0.03)", border:`1px solid ${V.w1}`, borderRadius:10, padding:"12px 14px" }}>
                <p style={{ ...mono, fontSize:8, color:V.ink4, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:4 }}>{s.l}</p>
                <p style={{ ...mono, fontSize:18, fontWeight:600, color:s.c, letterSpacing:"-0.02em" }}>{s.v}</p>
              </div>
            ))}
          </div>

          {/* Confidence */}
          <div style={{ background:"rgba(255,255,255,0.02)", border:`1px solid ${V.w1}`, borderRadius:10, padding:"14px 16px" }}>
            <p style={{ ...mono, fontSize:9, color:V.ink4, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:8 }}>AI Confidence</p>
            <ConfBar pct={stock.confidence} color={sig.color} />
          </div>

          {/* Technical indicators */}
          <div style={{ background:"rgba(255,255,255,0.02)", border:`1px solid ${V.w1}`, borderRadius:10, padding:"14px 16px" }}>
            <p style={{ ...mono, fontSize:9, color:V.ink4, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:12 }}>Technical Indicators</p>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:10 }}>
              {[
                { l:"RSI(14)",        v:stock.rsi.toString(), c: stock.rsi < 30 ? V.gain : stock.rsi > 70 ? V.loss : V.ink0 },
                { l:"SMA 20",         v:f$(stock.sma20),       c: stock.price > stock.sma20 ? V.gain : V.loss },
                { l:"SMA 50",         v:f$(stock.sma50),       c: stock.price > stock.sma50 ? V.gain : V.loss },
                { l:"Volume Ratio",   v:`${stock.volumeRatio}x`, c: stock.volumeRatio > 1.5 ? "#7EB6FF" : V.ink2 },
                { l:"5d Momentum",    v:fp(stock.momentum5d),  c: stock.momentum5d >= 0 ? V.gain : V.loss },
                { l:"20d Momentum",   v:fp(stock.momentum20d), c: stock.momentum20d >= 0 ? V.gain : V.loss },
                { l:"Support",        v:f$(stock.support),     c:V.loss },
                { l:"Resistance",     v:f$(stock.resistance),  c:V.gain },
              ].map(s => (
                <div key={s.l} style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ ...mono, fontSize:10, color:V.ink4 }}>{s.l}</span>
                  <span style={{ ...mono, fontSize:11, fontWeight:500, color:s.c }}>{s.v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* AI Thesis */}
          <div style={{ background:"rgba(79,142,247,0.05)", border:`1px solid rgba(79,142,247,0.15)`, borderRadius:10, padding:"16px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:10 }}>
              <Brain size={14} color="#7EB6FF" />
              <span style={{ ...mono, fontSize:9, color:"#7EB6FF", textTransform:"uppercase", letterSpacing:"0.1em", fontWeight:600 }}>AI Analysis</span>
            </div>
            <p style={{ fontSize:13, color:V.ink1, lineHeight:1.7, margin:"0 0 12px" }}>{stock.thesis}</p>
            <div style={{ display:"flex", alignItems:"flex-start", gap:7, padding:"10px 12px", borderRadius:8, background:"rgba(232,68,90,0.06)", border:`1px solid rgba(232,68,90,0.15)` }}>
              <AlertTriangle size={12} color={V.loss} style={{ flexShrink:0, marginTop:1 }} />
              <p style={{ fontSize:12, color:V.ink3, margin:0, lineHeight:1.6 }}>{stock.risks}</p>
            </div>
          </div>

          {/* Tags */}
          {stock.tags.length > 0 && (
            <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
              {stock.tags.map(t => (
                <span key={t} style={{ ...mono, fontSize:9, padding:"4px 10px", borderRadius:99, background:sig.bg, color:sig.color, border:`1px solid ${sig.border}` }}>{t}</span>
              ))}
            </div>
          )}

          <p style={{ ...mono, fontSize:10, color:V.ink4, lineHeight:1.6, margin:0 }}>
            Analysis powered by Claude AI using real-time Polygon.io data. Not financial advice.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ---- Simulator Modal --------------------------------------- */
function SimModal({ stocks, onClose }: { stocks: Stock[]; onClose: () => void }) {
  const [cash, setCash] = useState("50000");
  const num = Math.max(100, parseFloat(cash.replace(/,/g, "")) || 50000);
  let allocs: Alloc[] = [];
  try { allocs = simulate(stocks, num); } catch { allocs = []; }
  const total = allocs.reduce((s, a) => s + (isNaN(a.dollars) ? 0 : a.dollars), 0);

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:"20px 16px" }}>
      <div style={{ background:"rgba(8,13,24,0.97)", border:"1px solid rgba(130,180,255,0.10)", borderRadius:18, width:"100%", maxWidth:680, maxHeight:"85vh", overflow:"auto", display:"flex", flexDirection:"column", position:"relative", zIndex:9999 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 20px", borderBottom:`1px solid ${V.w1}`, position:"sticky", top:0, background:"rgba(8,13,24,0.97)", backdropFilter:"blur(20px)", zIndex:1 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:32, height:32, borderRadius:9, background:"linear-gradient(135deg,#4F8EF7,#00C896)", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <DollarSign size={15} color="#fff" />
            </div>
            <div>
              <p style={{ fontWeight:600, fontSize:14, color:V.ink0, margin:0 }}>Portfolio Simulator</p>
              <p style={{ ...mono, fontSize:9, color:V.ink4, margin:0, textTransform:"uppercase" }}>AI Buy signals only</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:V.ink3, padding:6, borderRadius:7, display:"flex", minWidth:34, minHeight:34, alignItems:"center", justifyContent:"center" }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding:"14px 20px", borderBottom:`1px solid ${V.w1}`, display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
          <label style={{ ...mono, fontSize:9, color:V.ink3, textTransform:"uppercase", letterSpacing:"0.08em" }}>Investment</label>
          <div style={{ position:"relative", flex:1, minWidth:120 }}>
            <span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", color:V.ink3, ...mono, fontSize:14 }}>$</span>
            <input type="number" value={cash} onChange={e => setCash(e.target.value)} min="100" step="1000"
              style={{ width:"100%", background:"rgba(255,255,255,0.03)", border:`1px solid ${V.w2}`, borderRadius:9, color:V.ink0, ...mono, fontSize:14, padding:"9px 12px 9px 22px", outline:"none" }} />
          </div>
          <p style={{ ...mono, fontSize:11, color:V.gain }}>{f$(num - total)} reserve</p>
        </div>

        <div style={{ padding:"12px 20px" }}>
          {allocs.length === 0 ? (
            <p style={{ color:V.ink3, fontSize:13, textAlign:"center", padding:"20px 0" }}>No BUY signals in current analysis to simulate.</p>
          ) : allocs.map((a, i) => (
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
                <p style={{ ...mono, fontSize:9, color:V.ink3 }}>{a.shares} sh</p>
              </div>
            </div>
          ))}
        </div>

        <div style={{ padding:"12px 20px", borderTop:`1px solid ${V.w1}`, display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8, background:"rgba(5,8,16,0.8)" }}>
          <p style={{ fontSize:11, color:V.ink3, maxWidth:280 }}>Only allocates to BUY/STRONG BUY signals. Not financial advice.</p>
          <div style={{ textAlign:"right" }}>
            <p style={{ ...mono, fontSize:9, color:V.ink4, textTransform:"uppercase" }}>Deployed</p>
            <p style={{ ...mono, fontSize:20, fontWeight:500, color:V.gain }}>{f$(total)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   MAIN EXPORT
   ============================================================ */
const REFRESH_INTERVAL = 60 * 60 * 1000; // 60 minutes
const CACHE_KEY = "arbibx-top15-cache";
const CACHE_VERSION = "v7"; // bump this whenever fixing signal/analysis bugs

interface CachedData {
  stocks: Stock[];
  analyzedAt: string;
  version?: string;
}

function loadCache(): { stocks: Stock[]; lastUpdate: Date } | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { stocks, analyzedAt, version } = JSON.parse(raw) as CachedData;
    // Invalidate if wrong version or expired
    if (version !== CACHE_VERSION) return null;
    const age = Date.now() - new Date(analyzedAt).getTime();
    if (age > REFRESH_INTERVAL) return null;
    // Validate the data actually has real signals, not all HOLDs with 50% confidence
    const hasRealSignals = stocks.some(s => s.signal !== "HOLD" || s.confidence !== 50);
    if (!hasRealSignals) return null;
    // Also validate at least some stocks have real prices
    const hasPrices = stocks.filter(s => s.price > 0).length >= 5;
    if (!hasPrices) return null;
    return { stocks, lastUpdate: new Date(analyzedAt) };
  } catch { return null; }
}

function saveCache(stocks: Stock[], analyzedAt: string) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ stocks, analyzedAt, version: CACHE_VERSION }));
  } catch { /* ignore */ }
}

export default function Top15({ onSelectTicker }: Top15Props) {
  const cached = loadCache();
  const [stocks,     setStocks]     = useState<Stock[]>(cached?.stocks ?? []);
  const [loading,    setLoading]    = useState(!cached);
  const [analyzing,  setAnalyzing]  = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(cached?.lastUpdate ?? null);
  const [nextUpdate, setNextUpdate] = useState<Date | null>(cached ? new Date(cached.lastUpdate.getTime() + REFRESH_INTERVAL) : null);
  const [marketOpen, setMarketOpen] = useState(false);
  const [showSim,    setShowSim]    = useState(false);
  const [selected,   setSelected]   = useState<Stock | null>(null);
  const [sortCol,    setSortCol]    = useState<keyof Stock>("rank");
  const [sortDir,    setSortDir]    = useState<"asc" | "desc">("asc");
  const [hovRow,     setHovRow]     = useState<string | null>(null);
  const [timeLeft,   setTimeLeft]   = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const runAnalysis = useCallback(async () => {
    setAnalyzing(true);
    try {
      const r = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tickers: UNI }),
      });
      if (!r.ok) throw new Error("Analysis failed");
      const d = await r.json() as { stocks: Stock[]; analyzedAt: string };
      if (d.stocks?.length) {
        setStocks(d.stocks);
        saveCache(d.stocks, d.analyzedAt);
        const now = new Date();
        setLastUpdate(now);
        setNextUpdate(new Date(now.getTime() + REFRESH_INTERVAL));
      }
    } catch (err) {
      console.error("Analysis error:", err);
    }
    setLoading(false);
    setAnalyzing(false);
  }, []);

  // Initial load + auto-refresh during market hours
  useEffect(() => {
    const check = () => {
      const open = isMarketHours();
      setMarketOpen(open);
      return open;
    };

    // Only run analysis if no valid cache exists
    if (!loadCache()) {
      runAnalysis();
    }

    // Set up auto-refresh every hour during market hours
    timerRef.current = setInterval(() => {
      if (check()) {
        runAnalysis();
      }
    }, REFRESH_INTERVAL);

    // Update market open status every minute
    const statusTimer = setInterval(check, 60_000);
    check();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      clearInterval(statusTimer);
    };
  }, [runAnalysis]);

  // Countdown timer display
  useEffect(() => {
    if (!nextUpdate) return;
    const tick = () => {
      const diff = nextUpdate.getTime() - Date.now();
      if (diff <= 0) { setTimeLeft("Updating..."); return; }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${m}:${s.toString().padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [nextUpdate]);

  const sorted = [...stocks].sort((a, b) => {
    const av = a[sortCol] as number, bv = b[sortCol] as number;
    return sortDir === "asc" ? av - bv : bv - av;
  });

  const toggle = (col: keyof Stock) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("desc"); }
  };

  /* Loading skeleton */
  if (loading) return (
    <div style={{ padding:24, display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ ...glass({ padding:20, display:"flex", alignItems:"center", gap:14 }) }}>
        <Brain size={22} color="#9B72F5" />
        <div>
          <p style={{ color:"#F2F6FF", fontWeight:600, fontSize:14, margin:0 }}>AI is analyzing {UNI.length} stocks...</p>
          <p style={{ color:"#3D5A7A", fontSize:12, margin:0, marginTop:4 }}>Fetching price data, news, and running Claude analysis. This takes ~20-30 seconds.</p>
        </div>
      </div>
      {[200, 60, 60, 60, 60, 60].map((h, i) => (
        <div key={i} style={{ background:"linear-gradient(105deg,#0C1220 30%,#151F30 50%,#0C1220 70%)", backgroundSize:"400% 100%", animation:"shimmer 2.2s ease-in-out infinite", borderRadius:12, height:h }} />
      ))}
      <style>{`@keyframes shimmer{0%{background-position:-400% 0}100%{background-position:400% 0}}`}</style>
    </div>
  );

  const ColH = ({ label, col, right }: { label: string; col: keyof Stock; right?: boolean }) => (
    <th onClick={() => toggle(col)}
      style={{ ...mono, fontSize:9, color: sortCol === col ? "#7EB6FF" : V.ink4, textTransform:"uppercase", letterSpacing:"0.09em", padding:"10px 10px", cursor:"pointer", userSelect:"none", textAlign: right ? "right" : "left", fontWeight: sortCol === col ? 500 : 400, whiteSpace:"nowrap", background:"rgba(5,8,16,0.75)" }}>
      <span style={{ display:"inline-flex", alignItems:"center", gap:3 }}>
        {label}
        {sortCol === col ? (sortDir === "asc" ? <ChevronUp size={10} color="#7EB6FF" /> : <ChevronDown size={10} color="#7EB6FF" />) : <span style={{ opacity:0.18 }}>{"^v"}</span>}
      </span>
    </th>
  );

  const buyCount      = stocks.filter(s => s.signal === "STRONG BUY" || s.signal === "BUY").length;
  const avgConf       = Math.round(stocks.reduce((s, x) => s + x.confidence, 0) / (stocks.length || 1));
  const avgUpside = buyCount > 0 ? (() => {
    const buyStocks = stocks.filter(s => (s.signal === "BUY" || s.signal === "STRONG BUY") && s.price > 0 && s.targetPrice > 0);
    if (!buyStocks.length) return null;
    const avg = buyStocks.reduce((sum, x) => sum + ((x.targetPrice - x.price) / x.price) * 100, 0) / buyStocks.length;
    return isNaN(avg) ? null : avg.toFixed(1);
  })() : null;

  return (
    <div style={{ padding:"20px 16px", maxWidth:1280, margin:"0 auto" }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:18, gap:12, flexWrap:"wrap" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:40, height:40, borderRadius:11, background:"linear-gradient(135deg,rgba(232,160,48,0.15),rgba(232,160,48,0.06))", border:"1px solid rgba(232,160,48,0.25)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <Trophy size={20} color={V.gold} />
          </div>
          <div>
            <h2 style={{ fontSize:18, fontWeight:700, color:V.ink0, margin:0 }}>AI Top 15</h2>
            <p style={{ ...mono, color:V.ink4, fontSize:9, margin:0, marginTop:2, textTransform:"uppercase", letterSpacing:"0.08em" }}>
              Claude AI + Polygon.io -- Real data analysis
            </p>
          </div>
        </div>
        <button onClick={() => setShowSim(true)}
          style={{ display:"flex", alignItems:"center", gap:6, padding:"9px 16px", borderRadius:9, background:"linear-gradient(135deg,rgba(79,142,247,0.15),rgba(79,142,247,0.08))", border:`1px solid ${V.arcWire}`, color:"#7EB6FF", cursor:"pointer", fontSize:12, fontWeight:600, fontFamily:"'Bricolage Grotesque',system-ui,sans-serif", flexShrink:0 }}>
          <DollarSign size={13} /> Simulate Portfolio
        </button>
      </div>

      {/* Status bar */}
      <div style={{ ...glass({ padding:"12px 16px", marginBottom:16, display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }) }}>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <div style={{ width:7, height:7, borderRadius:"50%", background: marketOpen ? V.gain : V.gold, animation: marketOpen ? "live-pulse 2s ease-in-out infinite" : "none" }} />
          <span style={{ ...mono, fontSize:10, color: marketOpen ? V.gain : V.gold }}>
            {marketOpen ? "Market Open -- Auto-refreshing every hour" : `Market Closed -- Next open: ${nextMarketOpen()}`}
          </span>
        </div>
        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
          {analyzing && (
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <Activity size={11} color="#9B72F5" style={{ animation:"spin 1.5s linear infinite" }} />
              <span style={{ ...mono, fontSize:9, color:"#9B72F5" }}>Analyzing...</span>
            </div>
          )}
          {lastUpdate && (
            <span style={{ ...mono, fontSize:9, color:V.ink4 }}>
              Updated {lastUpdate.toLocaleTimeString()}
            </span>
          )}
          {nextUpdate && marketOpen && timeLeft && (
            <div style={{ display:"flex", alignItems:"center", gap:5 }}>
              <Clock size={10} color={V.ink4} />
              <span style={{ ...mono, fontSize:9, color:V.ink4 }}>Next: {timeLeft}</span>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="top15-stats" style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:8, marginBottom:16 }}>
        {[
          { icon:<TrendingUp size={13} color={V.gain} />,  label:"Buy Signals",    val:`${buyCount}/${stocks.length}` },
          { icon:<Shield    size={13} color="#7EB6FF" />,  label:"Avg Confidence", val:`${avgConf}%` },
          { icon:<Target    size={13} color={V.gold} />,   label:"Avg Buy Upside", val: avgUpside ? `+${avgUpside}%` : "N/A" },
          { icon:<Brain     size={13} color={V.ame} />,    label:"AI Model",       val:"Claude Opus" },
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

      {/* Table */}
      <div style={{ ...glass({ overflow:"hidden" }) }}>
        <div className="top15-table-wrap" style={{ overflowX:"auto", WebkitOverflowScrolling:"touch" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", minWidth:600 }}>
            <thead>
              <tr style={{ borderBottom:`1px solid ${V.w1}` }}>
                <ColH label="Rank"       col="rank" />
                <th style={{ ...mono, fontSize:9, color:V.ink4, textTransform:"uppercase", letterSpacing:"0.09em", padding:"10px 10px", textAlign:"left", fontWeight:400, background:"rgba(5,8,16,0.75)", whiteSpace:"nowrap" }}>Ticker</th>
                <th style={{ ...mono, fontSize:9, color:V.ink4, textTransform:"uppercase", letterSpacing:"0.09em", padding:"10px 10px", textAlign:"left", fontWeight:400, background:"rgba(5,8,16,0.75)", whiteSpace:"nowrap", minWidth:100 }}>Company</th>
                <ColH label="Signal"     col="signal"     right />
                <ColH label="Price"      col="price"      right />
                <ColH label="Today"      col="changePct"  right />
                <ColH label="Target"     col="targetPrice" right />
                <ColH label="RSI"        col="rsi"        right />
                <ColH label="Conf."      col="confidence" right />
                <th style={{ ...mono, fontSize:9, color:V.ink4, textTransform:"uppercase", letterSpacing:"0.09em", padding:"10px 10px", textAlign:"center", fontWeight:400, background:"rgba(5,8,16,0.75)", whiteSpace:"nowrap" }}>Info</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((s, idx) => {
                const up  = s.changePct >= 0;
                const sc  = SECTOR_HUE[s.sector] ?? "#7A9CBF";
                const sig = SIGNAL_CONFIG[s.signal] ?? SIGNAL_CONFIG["HOLD"];
                const isH = hovRow === s.ticker;
                return (
                  <tr key={s.ticker}
                    onClick={() => onSelectTicker ? onSelectTicker(s.ticker) : setSelected(s)}
                    onMouseEnter={() => setHovRow(s.ticker)}
                    onMouseLeave={() => setHovRow(null)}
                    style={{ borderBottom:"1px solid rgba(130,180,255,0.04)", background: isH ? V.dh : "transparent", transition:"background 0.15s", cursor:"pointer" }}>
                    <td style={{ padding:"13px 10px", textAlign:"right", whiteSpace:"nowrap" }}>
                      <span style={{ ...mono, fontSize:12, color: idx < 3 ? V.gold : V.ink4, fontWeight:500 }}>
                        {idx === 0 ? "1st" : idx === 1 ? "2nd" : idx === 2 ? "3rd" : `#${s.rank}`}
                      </span>
                    </td>
                    <td style={{ padding:"13px 10px", whiteSpace:"nowrap" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                        <div>
                          <p style={{ ...mono, fontSize:13, fontWeight:500, color: isH ? "#93C5FD" : "#7EB6FF" }}>{s.ticker}</p>
                          <span style={{ ...mono, fontSize:8, padding:"1px 5px", borderRadius:4, background:`${sc}15`, color:sc, border:`1px solid ${sc}22` }}>{s.sector}</span>
                        </div>
                        {isH && <ArrowRight size={13} color="#7EB6FF" style={{ flexShrink:0 }} />}
                      </div>
                    </td>
                    <td style={{ padding:"13px 10px", fontSize:12, color:V.ink2, maxWidth:120 }}>
                      <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", display:"block" }}>{s.name}</span>
                    </td>
                    <td style={{ padding:"13px 10px", textAlign:"right", whiteSpace:"nowrap" }}>
                      <span style={{ ...mono, fontSize:10, padding:"3px 8px", borderRadius:5, background:sig.bg, color:sig.color, border:`1px solid ${sig.border}`, fontWeight:600 }}>{sig.label}</span>
                    </td>
                    <td style={{ padding:"13px 10px", textAlign:"right" }}>
                      <span style={{ ...mono, fontSize:13, fontWeight:600, color:V.ink0 }}>{f$(s.price)}</span>
                    </td>
                    <td style={{ padding:"13px 10px", textAlign:"right", whiteSpace:"nowrap" }}>
                      <span style={{ ...mono, fontSize:11, color: up ? V.gain : V.loss }}>{fp(s.changePct)}</span>
                    </td>
                    <td style={{ padding:"13px 10px", textAlign:"right", whiteSpace:"nowrap" }}>
                      {s.targetPrice > 0 && !isNaN(s.targetPrice) ? (
                        <>
                          <p style={{ ...mono, fontSize:12, color: s.targetPrice > s.price ? V.gain : V.loss, fontWeight:500 }}>{f$(s.targetPrice)}</p>
                          <p style={{ ...mono, fontSize:9, color:V.ink4 }}>{fp(((s.targetPrice - s.price) / s.price) * 100)}</p>
                        </>
                      ) : (
                        <p style={{ ...mono, fontSize:11, color:V.ink4 }}>--</p>
                      )}
                    </td>
                    <td style={{ padding:"13px 10px", textAlign:"right", whiteSpace:"nowrap" }}>
                      <span style={{ ...mono, fontSize:11, color: s.rsi < 30 ? V.gain : s.rsi > 70 ? V.loss : V.ink2 }}>{s.rsi}</span>
                    </td>
                    <td style={{ padding:"13px 14px 13px 10px", minWidth:100 }}>
                      <ConfBar pct={s.confidence} color={sig.color} />
                    </td>
                    <td style={{ padding:"8px 10px", textAlign:"center" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:4, justifyContent:"center" }}>
                        <button
                          onClick={e => { e.stopPropagation(); setSelected(s); }}
                          title="View AI Analysis"
                          style={{ display:"inline-flex", alignItems:"center", gap:3, padding:"2px 7px", borderRadius:5, background:"rgba(155,114,245,0.08)", border:"1px solid rgba(155,114,245,0.18)", color:"#9B72F5", fontSize:9, fontFamily:"'Geist Mono',monospace", cursor:"pointer", whiteSpace:"nowrap" }}>
                          <Brain size={8} /> AI
                        </button>
                        <YahooBtn ticker={s.ticker} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding:"10px 16px", borderTop:`1px solid ${V.w1}`, display:"flex", alignItems:"center", gap:6 }}>
          <Brain size={11} color={V.ink4} />
          <span style={{ ...mono, fontSize:9, color:V.ink4, textTransform:"uppercase", letterSpacing:"0.08em" }}>
            Click any row for full AI analysis -- Auto-refreshes every hour during market hours
          </span>
        </div>
      </div>

      <p style={{ ...mono, color:V.ink4, fontSize:9, marginTop:10, lineHeight:1.6 }}>
        AI analysis by Claude Opus using RSI, SMA, momentum, volume, and live news. Not financial advice. Past performance does not guarantee future results.
      </p>

      {selected && <StockModal stock={selected} onClose={() => setSelected(null)} />}
      {showSim   && <SimModal  stocks={stocks}  onClose={() => setShowSim(false)} />}

      <style>{`
        @keyframes shimmer{0%{background-position:-400% 0}100%{background-position:400% 0}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes live-pulse{0%,100%{opacity:1}50%{opacity:.4}}
      `}</style>
    </div>
  );
}
