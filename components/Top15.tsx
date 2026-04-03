"use client";

import { useState, useEffect, useCallback } from "react";
import {
  TrendingUp, TrendingDown, DollarSign,
  Trophy, Target, Shield, Zap, ChevronUp, ChevronDown, X,
  ArrowRight, ExternalLink,
} from "lucide-react";
import { CountdownBar } from "@/components/CountdownBar";
import { resolvePrices } from "@/lib/prices";

/* ── Types ─────────────────────────────────────────────────── */
interface Stock {
  rank:number; ticker:string; name:string; price:number;
  changePct:number; change:number; floor:number; ceiling:number;
  conf:number; sector:string; score:number; volume:number;
}
interface Alloc {
  ticker:string; name:string; price:number;
  dollars:number; shares:number; pct:number; note:string;
}
interface Top15Props {
  onSelectTicker?: (ticker: string) => void;
}

/* ── Universe ───────────────────────────────────────────────── */
const UNI = [
  {t:"NVDA", n:"NVIDIA Corp.",          s:"Technology"},
  {t:"MSFT", n:"Microsoft Corp.",        s:"Technology"},
  {t:"AAPL", n:"Apple Inc.",             s:"Technology"},
  {t:"META", n:"Meta Platforms",         s:"Technology"},
  {t:"GOOGL",n:"Alphabet Inc.",          s:"Technology"},
  {t:"AMZN", n:"Amazon.com",             s:"Consumer"},
  {t:"AMD",  n:"Advanced Micro Dev.",    s:"Technology"},
  {t:"PLTR", n:"Palantir Tech.",         s:"Technology"},
  {t:"JPM",  n:"JPMorgan Chase",         s:"Financials"},
  {t:"V",    n:"Visa Inc.",              s:"Financials"},
  {t:"UNH",  n:"UnitedHealth Group",     s:"Healthcare"},
  {t:"LLY",  n:"Eli Lilly & Co.",        s:"Healthcare"},
  {t:"TSLA", n:"Tesla Inc.",             s:"Consumer"},
  {t:"ORCL", n:"Oracle Corp.",           s:"Technology"},
  {t:"CRWD", n:"CrowdStrike",            s:"Technology"},
  {t:"PANW", n:"Palo Alto Networks",     s:"Technology"},
  {t:"AVGO", n:"Broadcom Inc.",          s:"Technology"},
  {t:"CRM",  n:"Salesforce Inc.",        s:"Technology"},
  {t:"NOW",  n:"ServiceNow Inc.",        s:"Technology"},
  {t:"COIN", n:"Coinbase Global",        s:"Financials"},
];

const SECTOR_HUE: Record<string,string> = {
  Technology:"#4F8EF7", Financials:"#9B72F5",
  Healthcare:"#00C896", Consumer:"#E8A030",
};

/* ── Scoring ────────────────────────────────────────────────── */
const calcConf = (chg:number, vol:number) => {
  let c = 60;
  if (chg > 3) c += 18; else if (chg > 1) c += 10; else if (chg < -2) c -= 12;
  if (vol > 50e6) c += 12; else if (vol > 25e6) c += 6;
  return Math.min(96, Math.max(42, c));
};
const calcScore = (chg:number, vol:number, conf:number) =>
  +(Math.min(Math.max(chg/5,-1),1)*40 + Math.min(vol/60e6,1)*30 + (conf/100)*30).toFixed(2);
const calcLevels = (price:number, chg:number) => ({
  floor:   +(price * (1 - (chg < 0 ? .06 : .04))).toFixed(2),
  ceiling: +(price * (1 + (chg > 2 ? .14 : chg > 0 ? .10 : .08))).toFixed(2),
});

/* ── Build ranked list from resolved live prices ─────────────── */
async function fetchTop15(): Promise<Stock[]> {
  // Use the shared resolver — snapshot + bars fallback for all 20 tickers
  const priceMap = await resolvePrices(UNI.map(u => u.t));

  const rows = UNI.map(u => {
    const lp = priceMap.get(u.t);

    // Only use data we actually resolved — never fall back to a hardcoded mock
    if (!lp || lp.price <= 0) return null;

    const conf = calcConf(lp.changePct, lp.volume);
    const { floor, ceiling } = calcLevels(lp.price, lp.changePct);

    return {
      rank:      0,
      ticker:    u.t,
      name:      u.n,
      sector:    u.s,
      price:     lp.price,
      change:    lp.change,
      changePct: lp.changePct,
      high:      lp.high,
      low:       lp.low,
      open:      lp.open,
      volume:    lp.volume,
      floor,
      ceiling,
      conf,
      score:     calcScore(lp.changePct, lp.volume, conf),
    } as Stock;
  }).filter((r): r is Stock => r !== null);

  rows.sort((a, b) => b.score - a.score);
  rows.forEach((r, i) => r.rank = i + 1);
  return rows.slice(0, 15);
}

/* ── Portfolio simulator ─────────────────────────────────────── */
function simulate(stocks: Stock[], cash: number): Alloc[] {
  const picks = stocks.slice(0, 8);
  const tw = picks.reduce((s, p) => s + p.conf * Math.max(p.score + 60, 1), 0);
  return picks.map(p => {
    const w = (p.conf * Math.max(p.score + 60, 1)) / tw;
    const dollars = Math.round(cash * w * 100) / 100;
    const upside  = (((p.ceiling - p.price) / p.price) * 100).toFixed(1);
    return {
      ticker: p.ticker, name: p.name, price: p.price,
      dollars, shares: Math.floor(dollars / p.price),
      pct: +(w * 100).toFixed(1),
      note: `${(w * 100).toFixed(1)}% · +${upside}% target · ${p.conf}% conf`,
    };
  }).sort((a, b) => b.dollars - a.dollars);
}

/* ── Format ──────────────────────────────────────────────────── */
const f$ = (n:number, d=2) =>
  new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",
    minimumFractionDigits:d, maximumFractionDigits:d}).format(n);
const fp = (n:number) => `${n>=0?"+":""}${n.toFixed(2)}%`;

const yhooUrl = (ticker:string) => `https://finance.yahoo.com/quote/${ticker}`;

/* ── Design tokens ───────────────────────────────────────────── */
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
  background:"linear-gradient(145deg,rgba(255,255,255,0.030) 0%,rgba(255,255,255,0.012) 100%)",
  backdropFilter:"blur(24px) saturate(1.5)",
  WebkitBackdropFilter:"blur(24px) saturate(1.5)",
  border:`1px solid ${V.w2}`,
  borderRadius:14,
  boxShadow:"0 4px 16px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)",
  position:"relative" as const,
  overflow:"hidden",
  ...ex,
});

/* ── ConfBar ─────────────────────────────────────────────────── */
function ConfBar({ pct }: { pct:number }) {
  const color = pct >= 80 ? V.gain : pct >= 65 ? V.gold : V.loss;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:7 }}>
      <div style={{ flex:1, height:2, background:"rgba(255,255,255,0.05)", borderRadius:99, overflow:"hidden" }}>
        <div style={{ width:`${pct}%`, height:"100%", background:color, borderRadius:99,
          transition:"width 0.9s cubic-bezier(0.16,1,0.3,1)" }}/>
      </div>
      <span style={{ ...mono, fontSize:10, color, minWidth:26 }}>{pct}%</span>
    </div>
  );
}

/* ── Yahoo Finance link button ───────────────────────────────── */
function YahooBtn({ ticker, compact=false }: { ticker:string; compact?:boolean }) {
  return (
    <a
      href={yhooUrl(ticker)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={e => e.stopPropagation()}   // don't trigger row click
      title={`View ${ticker} on Yahoo Finance`}
      style={{
        display:"inline-flex", alignItems:"center", gap:compact?3:4,
        padding: compact ? "2px 7px" : "4px 9px",
        borderRadius:6,
        background:"rgba(79,142,247,0.08)",
        border:`1px solid rgba(79,142,247,0.18)`,
        color:"#7EB6FF",
        textDecoration:"none",
        fontSize: compact ? 9 : 10,
        fontFamily:"'Geist Mono','Courier New',monospace",
        whiteSpace:"nowrap",
        transition:"background 0.15s, border-color 0.15s",
        flexShrink:0,
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.background = "rgba(79,142,247,0.16)";
        (e.currentTarget as HTMLElement).style.borderColor = "rgba(79,142,247,0.35)";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.background = "rgba(79,142,247,0.08)";
        (e.currentTarget as HTMLElement).style.borderColor = "rgba(79,142,247,0.18)";
      }}
    >
      <ExternalLink size={compact?8:10}/>
      {!compact && "Yahoo"}
    </a>
  );
}

/* ── Simulator modal ─────────────────────────────────────────── */
function SimModal({ stocks, onClose }: { stocks:Stock[]; onClose:()=>void }) {
  const [cash, setCash] = useState("50000");
  const num    = Math.max(100, parseFloat(cash.replace(/,/g,"")) || 50000);
  const allocs = simulate(stocks, num);
  const total  = allocs.reduce((s, a) => s + a.dollars, 0);

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:999,
        display:"flex", alignItems:"flex-end", justifyContent:"center",
        backdropFilter:"blur(4px)" }}>
      <div style={{ ...glass({ borderRadius:"18px 18px 0 0",
        boxShadow:"0 -20px 60px rgba(0,0,0,0.6)" }),
        width:"100%", maxWidth:680, maxHeight:"90vh", overflow:"auto",
        animation:"vx-rise 0.3s cubic-bezier(0.16,1,0.3,1) both" }}>

        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
          padding:"16px 20px", borderBottom:`1px solid ${V.w1}`,
          position:"sticky", top:0, background:"rgba(8,13,24,0.97)",
          backdropFilter:"blur(20px)", zIndex:1 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:32, height:32, borderRadius:9,
              background:"linear-gradient(135deg,#4F8EF7,#00C896)",
              display:"flex", alignItems:"center", justifyContent:"center" }}>
              <DollarSign size={15} color="#fff"/>
            </div>
            <div>
              <p style={{ fontWeight:600, fontSize:14, color:V.ink0 }}>Portfolio Simulator</p>
              <p style={{ ...mono, fontSize:9, color:V.ink4, textTransform:"uppercase",
                letterSpacing:"0.07em" }}>AI-weighted · Top 8 by signal strength</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer",
            color:V.ink3, padding:6, borderRadius:7, display:"flex",
            minWidth:34, minHeight:34, alignItems:"center", justifyContent:"center" }}>
            <X size={16}/>
          </button>
        </div>

        <div style={{ padding:"14px 20px", borderBottom:`1px solid ${V.w1}`,
          display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
          <label style={{ ...mono, fontSize:9, color:V.ink3, textTransform:"uppercase",
            letterSpacing:"0.08em", whiteSpace:"nowrap" }}>Investment</label>
          <div style={{ position:"relative", flex:1, minWidth:120 }}>
            <span style={{ position:"absolute", left:10, top:"50%",
              transform:"translateY(-50%)", color:V.ink3, ...mono, fontSize:14 }}>$</span>
            <input type="number" value={cash} onChange={e => setCash(e.target.value)}
              min="100" step="1000"
              style={{ width:"100%", background:"rgba(255,255,255,0.03)",
                border:`1px solid ${V.w2}`, borderRadius:9, color:V.ink0,
                ...mono, fontSize:14, padding:"9px 12px 9px 22px", outline:"none" }}/>
          </div>
          <p style={{ ...mono, fontSize:11, color:V.gain, whiteSpace:"nowrap" }}>
            Reserve: {f$(num - total)}
          </p>
        </div>

        <div style={{ padding:"12px 20px" }}>
          {allocs.map((a, i) => (
            <div key={a.ticker} style={{ display:"flex", alignItems:"center", gap:10,
              padding:"10px 0", borderBottom:`1px solid rgba(130,180,255,0.05)`,
              flexWrap:"wrap" }}>
              <span style={{ ...mono, color:V.ink4, fontSize:10, minWidth:22 }}>#{i+1}</span>
              <span style={{ ...mono, fontWeight:500, fontSize:13, color:"#7EB6FF", minWidth:48 }}>
                {a.ticker}
              </span>
              <div style={{ flex:1, minWidth:100 }}>
                <div style={{ height:2, background:"rgba(255,255,255,0.05)",
                  borderRadius:99, overflow:"hidden", marginBottom:3 }}>
                  <div style={{ width:`${a.pct}%`, height:"100%",
                    background:"linear-gradient(90deg,#4F8EF7,#00C896)", borderRadius:99 }}/>
                </div>
                <span style={{ ...mono, color:V.ink4, fontSize:9 }}>{a.note}</span>
              </div>
              <div style={{ textAlign:"right", flexShrink:0 }}>
                <p style={{ ...mono, fontSize:13, fontWeight:500, color:V.ink0 }}>
                  {f$(a.dollars)}
                </p>
                <p style={{ ...mono, fontSize:9, color:V.ink3 }}>{a.shares} sh · {a.pct}%</p>
              </div>
            </div>
          ))}
        </div>

        <div style={{ padding:"12px 20px", borderTop:`1px solid ${V.w1}`,
          display:"flex", justifyContent:"space-between", alignItems:"center",
          flexWrap:"wrap", gap:8, background:"rgba(5,8,16,0.8)" }}>
          <p style={{ fontSize:11, color:V.ink3, maxWidth:280 }}>
            Weighted by confidence × momentum. Fractional shares excluded.
          </p>
          <div style={{ textAlign:"right" }}>
            <p style={{ ...mono, fontSize:9, color:V.ink4, textTransform:"uppercase",
              letterSpacing:"0.08em" }}>Total Deployed</p>
            <p style={{ ...mono, fontSize:20, fontWeight:500, color:V.gain,
              letterSpacing:"-0.02em" }}>{f$(total)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN EXPORT
   ══════════════════════════════════════════════════════════════ */
export default function Top15({ onSelectTicker }: Top15Props) {
  const [stocks,  setStocks]  = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSim, setShowSim] = useState(false);
  const [sortCol, setSortCol] = useState<keyof Stock>("rank");
  const [sortDir, setSortDir] = useState<"asc"|"desc">("asc");
  const [hovRow,  setHovRow]  = useState<string|null>(null);

  const loadData = useCallback(async () => {
    const d = await fetchTop15();
    setStocks(d);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const sorted = [...stocks].sort((a, b) => {
    const av = a[sortCol] as number, bv = b[sortCol] as number;
    return sortDir === "asc" ? av - bv : bv - av;
  });

  const toggle = (col: keyof Stock) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  };

  if (loading) return (
    <div style={{ padding:24, display:"flex", flexDirection:"column", gap:12 }}>
      {[180, 60, 60, 60, 60, 60].map((h, i) => (
        <div key={i} style={{
          background:"linear-gradient(105deg,#0C1220 30%,#151F30 50%,#0C1220 70%)",
          backgroundSize:"400% 100%",
          animation:"shimmer 2.2s ease-in-out infinite",
          borderRadius:12, height:h }} />
      ))}
      <style>{`@keyframes shimmer{0%{background-position:-400% 0}100%{background-position:400% 0}}`}</style>
    </div>
  );

  const ColH = ({ label, col, right }: { label:string; col:keyof Stock; right?:boolean }) => (
    <th onClick={() => toggle(col)}
      style={{ ...mono, fontSize:9,
        color:sortCol===col?"#7EB6FF":V.ink4,
        textTransform:"uppercase", letterSpacing:"0.09em",
        padding:"10px 10px", cursor:"pointer", userSelect:"none",
        textAlign:right?"right":"left",
        fontWeight:sortCol===col?500:400,
        whiteSpace:"nowrap", background:"rgba(5,8,16,0.75)" }}>
      <span style={{ display:"inline-flex", alignItems:"center", gap:3 }}>
        {label}
        {sortCol===col
          ? (sortDir==="asc" ? <ChevronUp size={10} color="#7EB6FF"/> : <ChevronDown size={10} color="#7EB6FF"/>)
          : <span style={{ opacity:.18 }}>⇅</span>}
      </span>
    </th>
  );

  return (
    <div style={{ padding:"20px 16px", maxWidth:1280, margin:"0 auto" }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between",
        marginBottom:18, gap:12, flexWrap:"wrap" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:40, height:40, borderRadius:11,
            background:"linear-gradient(135deg,rgba(232,160,48,0.15),rgba(232,160,48,0.06))",
            border:"1px solid rgba(232,160,48,0.25)",
            display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <Trophy size={20} color={V.gold}/>
          </div>
          <div>
            <h2 style={{ fontSize:18, fontWeight:700, color:V.ink0, margin:0,
              letterSpacing:"-0.01em" }}>Top 15 Stocks</h2>
            <p style={{ ...mono, color:V.ink4, fontSize:9, margin:0, marginTop:2,
              textTransform:"uppercase", letterSpacing:"0.08em" }}>
              Live prices · Click any row to view full details
            </p>
          </div>
        </div>
        <button onClick={() => setShowSim(true)} className="vx-btn vx-btn-arc"
          style={{ fontFamily:"'Bricolage Grotesque',system-ui,sans-serif",
            fontWeight:600, flexShrink:0 }}>
          <DollarSign size={13}/> Simulate Portfolio
        </button>
      </div>

      {/* Countdown */}
      <div style={{ marginBottom:16 }}>
        <CountdownBar onRefresh={loadData} label="Next ranking update"/>
      </div>

      {/* Stat strip */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:8, marginBottom:16 }}>
        {[
          { icon:<TrendingUp size={13} color={V.gain}/>,
            label:"Bullish",
            val:`${stocks.filter(s=>s.changePct>0).length}/${stocks.length}` },
          { icon:<Shield size={13} color="#7EB6FF"/>,
            label:"Avg Confidence",
            val:`${Math.round(stocks.reduce((s,x)=>s+x.conf,0)/(stocks.length||1))}%` },
          { icon:<Target size={13} color={V.gold}/>,
            label:"Avg Upside",
            val:`+${(stocks.reduce((s,x)=>s+((x.ceiling-x.price)/x.price)*100,0)/(stocks.length||1)).toFixed(1)}%` },
          { icon:<Zap size={13} color={V.ame}/>,
            label:"Sectors",
            val:`${[...new Set(stocks.map(s=>s.sector))].length} covered` },
        ].map(s => (
          <div key={s.label} style={{ ...glass({ padding:"11px 14px",
            display:"flex", alignItems:"center", gap:10 }) }}>
            <div style={{ width:28, height:28, borderRadius:7,
              background:"rgba(255,255,255,0.04)", border:`1px solid ${V.w1}`,
              display:"flex", alignItems:"center", justifyContent:"center",
              flexShrink:0 }}>{s.icon}</div>
            <div>
              <p style={{ ...mono, color:V.ink4, fontSize:8, textTransform:"uppercase",
                letterSpacing:"0.09em", marginBottom:2 }}>{s.label}</p>
              <p style={{ ...mono, fontSize:13, fontWeight:500, color:V.ink0 }}>{s.val}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{ ...glass({ overflow:"hidden" }) }}>
        <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", minWidth:640 }}>
            <thead>
              <tr style={{ borderBottom:`1px solid ${V.w1}` }}>
                <ColH label="Rank"    col="rank"/>
                <th style={{ ...mono, fontSize:9, color:V.ink4, textTransform:"uppercase",
                  letterSpacing:"0.09em", padding:"10px 10px", textAlign:"left",
                  fontWeight:400, background:"rgba(5,8,16,0.75)", whiteSpace:"nowrap" }}>
                  Ticker
                </th>
                <th style={{ ...mono, fontSize:9, color:V.ink4, textTransform:"uppercase",
                  letterSpacing:"0.09em", padding:"10px 10px", textAlign:"left",
                  fontWeight:400, background:"rgba(5,8,16,0.75)", whiteSpace:"nowrap",
                  minWidth:120 }}>Company</th>
                <ColH label="Price"   col="price"     right/>
                <ColH label="Today"   col="changePct" right/>
                <ColH label="Floor"   col="floor"     right/>
                <ColH label="Ceiling" col="ceiling"   right/>
                <ColH label="Conf."   col="conf"      right/>
                <th style={{ ...mono, fontSize:9, color:V.ink4, textTransform:"uppercase",
                  letterSpacing:"0.09em", padding:"10px 12px", textAlign:"center",
                  fontWeight:400, background:"rgba(5,8,16,0.75)", whiteSpace:"nowrap" }}>
                  Link
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((s, idx) => {
                const up  = s.changePct >= 0;
                const sc  = SECTOR_HUE[s.sector] ?? "#7A9CBF";
                const isH = hovRow === s.ticker;
                const clickable = !!onSelectTicker;

                return (
                  <tr key={s.ticker}
                    onClick={() => onSelectTicker?.(s.ticker)}
                    onMouseEnter={() => setHovRow(s.ticker)}
                    onMouseLeave={() => setHovRow(null)}
                    style={{
                      borderBottom:`1px solid rgba(130,180,255,0.04)`,
                      background: isH ? V.dh : "transparent",
                      transition:"background 0.15s",
                      cursor: clickable ? "pointer" : "default",
                    }}>

                    {/* Rank */}
                    <td style={{ padding:"13px 10px", textAlign:"right", whiteSpace:"nowrap" }}>
                      <span style={{ ...mono, fontSize:12,
                        color:idx<3?V.gold:V.ink4, fontWeight:500 }}>
                        {idx===0?"🥇":idx===1?"🥈":idx===2?"🥉":`#${s.rank}`}
                      </span>
                    </td>

                    {/* Ticker + sector + arrow */}
                    <td style={{ padding:"13px 10px", whiteSpace:"nowrap" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                        <div>
                          <p style={{ ...mono, fontSize:13, fontWeight:500,
                            color:isH?"#93C5FD":"#7EB6FF",
                            letterSpacing:"-0.01em" }}>{s.ticker}</p>
                          <span style={{ ...mono, fontSize:8, padding:"1px 5px",
                            borderRadius:4, background:`${sc}15`, color:sc,
                            border:`1px solid ${sc}22` }}>{s.sector}</span>
                        </div>
                        {isH && clickable && (
                          <ArrowRight size={13} color="#7EB6FF" style={{ flexShrink:0 }}/>
                        )}
                      </div>
                    </td>

                    {/* Company */}
                    <td style={{ padding:"13px 10px", fontSize:12, color:V.ink2, maxWidth:150 }}>
                      <span style={{ overflow:"hidden", textOverflow:"ellipsis",
                        whiteSpace:"nowrap", display:"block" }}>{s.name}</span>
                    </td>

                    {/* Price — always from live API */}
                    <td style={{ padding:"13px 10px", textAlign:"right" }}>
                      <span style={{ ...mono, fontSize:13, fontWeight:600, color:V.ink0 }}>
                        {f$(s.price)}
                      </span>
                    </td>

                    {/* Today % */}
                    <td style={{ padding:"13px 10px", textAlign:"right", whiteSpace:"nowrap" }}>
                      <span style={{ ...mono, fontSize:11, padding:"3px 7px", borderRadius:5,
                        background:up?V.gainDim:V.lossDim, color:up?V.gain:V.loss,
                        border:`1px solid ${up?V.gainWire:V.lossWire}`,
                        display:"inline-flex", alignItems:"center", gap:2 }}>
                        {up?<TrendingUp size={9}/>:<TrendingDown size={9}/>}{fp(s.changePct)}
                      </span>
                    </td>

                    {/* Floor */}
                    <td style={{ padding:"13px 10px", textAlign:"right", whiteSpace:"nowrap" }}>
                      <span style={{ ...mono, fontSize:11, color:V.loss }}>{f$(s.floor)}</span>
                    </td>

                    {/* Ceiling */}
                    <td style={{ padding:"13px 10px", textAlign:"right", whiteSpace:"nowrap" }}>
                      <p style={{ ...mono, fontSize:12, color:V.gain, fontWeight:500 }}>
                        {f$(s.ceiling)}
                      </p>
                      <p style={{ ...mono, fontSize:9, color:V.ink4 }}>
                        +{(((s.ceiling-s.price)/s.price)*100).toFixed(1)}%
                      </p>
                    </td>

                    {/* Confidence */}
                    <td style={{ padding:"13px 14px 13px 10px", minWidth:110 }}>
                      <ConfBar pct={s.conf}/>
                    </td>

                    {/* Yahoo Finance link */}
                    <td style={{ padding:"8px 12px", textAlign:"center" }}>
                      <YahooBtn ticker={s.ticker} compact/>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {onSelectTicker && (
          <div style={{ padding:"10px 16px", borderTop:`1px solid ${V.w1}`,
            display:"flex", alignItems:"center", gap:6 }}>
            <ArrowRight size={11} color={V.ink4}/>
            <span style={{ ...mono, fontSize:9, color:V.ink4, textTransform:"uppercase",
              letterSpacing:"0.08em" }}>
              Tap any row to view full stock details
            </span>
          </div>
        )}
      </div>

      <p style={{ ...mono, color:V.ink4, fontSize:9, marginTop:10, lineHeight:1.6 }}>
        ⚡ Prices from Polygon.io — live during market hours, last close otherwise · Not financial advice
      </p>

      {showSim && <SimModal stocks={stocks} onClose={() => setShowSim(false)}/>}
      <style>{`@keyframes vx-rise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}
