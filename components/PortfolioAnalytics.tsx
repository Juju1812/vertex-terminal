"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BarChart2, TrendingUp, TrendingDown, PieChart, Award,
  RefreshCw, AlertTriangle, Target, Zap, Shield, Activity,
} from "lucide-react";
import {
  PieChart as RechartsPie, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
} from "recharts";

/* ---- Types -------------------------------------------------- */
interface Holding { id: string; ticker: string; shares: number; buyPrice: number; }
interface EnrichedHolding extends Holding {
  name: string; sector: string;
  currentPrice: number; currentValue: number;
  costBasis: number; pnl: number; pnlPct: number;
  dayChange: number; weight: number;
}

interface Props { onSelectTicker?: (t: string) => void; }

/* ---- Ticker metadata --------------------------------------- */
const TICKER_META: Record<string, { name: string; sector: string }> = {
  NVDA:  { name:"NVIDIA Corp.",         sector:"Technology"  },
  MSFT:  { name:"Microsoft Corp.",       sector:"Technology"  },
  AAPL:  { name:"Apple Inc.",            sector:"Technology"  },
  META:  { name:"Meta Platforms",        sector:"Technology"  },
  GOOGL: { name:"Alphabet Inc.",         sector:"Technology"  },
  AMD:   { name:"Advanced Micro Dev.",   sector:"Technology"  },
  AVGO:  { name:"Broadcom Inc.",         sector:"Technology"  },
  ORCL:  { name:"Oracle Corp.",          sector:"Technology"  },
  CRM:   { name:"Salesforce Inc.",       sector:"Technology"  },
  NOW:   { name:"ServiceNow Inc.",       sector:"Technology"  },
  ADBE:  { name:"Adobe Inc.",            sector:"Technology"  },
  INTC:  { name:"Intel Corp.",           sector:"Technology"  },
  QCOM:  { name:"Qualcomm Inc.",         sector:"Technology"  },
  PLTR:  { name:"Palantir Tech.",        sector:"Technology"  },
  CRWD:  { name:"CrowdStrike",           sector:"Technology"  },
  PANW:  { name:"Palo Alto Networks",    sector:"Technology"  },
  NET:   { name:"Cloudflare Inc.",       sector:"Technology"  },
  SNOW:  { name:"Snowflake Inc.",        sector:"Technology"  },
  MSTR:  { name:"MicroStrategy Inc.",    sector:"Technology"  },
  JPM:   { name:"JPMorgan Chase",        sector:"Financials"  },
  V:     { name:"Visa Inc.",             sector:"Financials"  },
  MA:    { name:"Mastercard Inc.",       sector:"Financials"  },
  BAC:   { name:"Bank of America",       sector:"Financials"  },
  GS:    { name:"Goldman Sachs",         sector:"Financials"  },
  COIN:  { name:"Coinbase Global",       sector:"Financials"  },
  GBTC:  { name:"Grayscale Bitcoin Tr.", sector:"Financials"  },
  AMZN:  { name:"Amazon.com",            sector:"Consumer"    },
  TSLA:  { name:"Tesla Inc.",            sector:"Consumer"    },
  NKE:   { name:"Nike Inc.",             sector:"Consumer"    },
  SBUX:  { name:"Starbucks Corp.",       sector:"Consumer"    },
  RIVN:  { name:"Rivian Automotive",     sector:"Consumer"    },
  LCID:  { name:"Lucid Group",           sector:"Consumer"    },
  SIRI:  { name:"Sirius XM Holdings",    sector:"Consumer"    },
  NKLA:  { name:"Nikola Corp.",          sector:"Consumer"    },
  BABA:  { name:"Alibaba Group (ADR)",   sector:"Consumer"    },
  SONY:  { name:"Sony Group (ADR)",      sector:"Consumer"    },
  TM:    { name:"Toyota Motor (ADR)",    sector:"Consumer"    },
  NSRGY: { name:"Nestle SA (ADR)",       sector:"Consumer"    },
  UNH:   { name:"UnitedHealth Group",    sector:"Healthcare"  },
  LLY:   { name:"Eli Lilly & Co.",       sector:"Healthcare"  },
  PFE:   { name:"Pfizer Inc.",           sector:"Healthcare"  },
  MRNA:  { name:"Moderna Inc.",          sector:"Healthcare"  },
  ABBV:  { name:"AbbVie Inc.",           sector:"Healthcare"  },
  NVO:   { name:"Novo Nordisk (ADR)",    sector:"Healthcare"  },
  RHHBY: { name:"Roche Holding (ADR)",   sector:"Healthcare"  },
  XOM:   { name:"ExxonMobil Corp.",      sector:"Energy"      },
  CVX:   { name:"Chevron Corp.",         sector:"Energy"      },
  OXY:   { name:"Occidental Petroleum",  sector:"Energy"      },
  TCEHY: { name:"Tencent Holdings (ADR)",sector:"Technology"  },
  BIDU:  { name:"Baidu Inc. (ADR)",      sector:"Technology"  },
  TSM:   { name:"Taiwan Semi (ADR)",     sector:"Technology"  },
  ASML:  { name:"ASML Holding (ADR)",    sector:"Technology"  },
  SAP:   { name:"SAP SE (ADR)",          sector:"Technology"  },
  ACMIF: { name:"Allied Critical Metals",sector:"Materials"   },
  BTQQF: { name:"BTQ Technologies",      sector:"Technology"  },
};

const POLYGON_KEY = "1xwzcvUOF9pft6PRNylO2Xc6X2QeQCGr";

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

const SECTOR_COLORS: Record<string, string> = {
  Technology:"#4F8EF7", Financials:"#9B72F5", Healthcare:"#00C896",
  Consumer:"#E8A030", Energy:"#F97316", Materials:"#84CC16",
};
const CHART_COLORS = ["#4F8EF7","#00C896","#9B72F5","#E8A030","#E8445A","#F97316","#84CC16","#06B6D4"];

/* ---- Formatters -------------------------------------------- */
const f$ = (n: number, d = 2) =>
  new Intl.NumberFormat("en-US", { style:"currency", currency:"USD", minimumFractionDigits:d, maximumFractionDigits:d }).format(n);
const fp = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;

/* ---- Fetch prices ------------------------------------------ */
async function fetchPrices(tickers: string[]): Promise<Record<string, { price: number; dayPct: number }>> {
  if (!tickers.length) return {};
  try {
    const r = await fetch(
      `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${tickers.join(",")}&apiKey=${POLYGON_KEY}`
    );
    if (!r.ok) return {};
    const d = await r.json() as { tickers?: Array<{ ticker: string; day: { c: number }; prevDay: { c: number } }> };
    const result: Record<string, { price: number; dayPct: number }> = {};
    for (const t of d.tickers ?? []) {
      if (t.day?.c && t.prevDay?.c) {
        result[t.ticker] = {
          price: t.day.c,
          dayPct: +((t.day.c - t.prevDay.c) / t.prevDay.c * 100).toFixed(2),
        };
      }
    }
    return result;
  } catch { return {}; }
}

/* ---- Stat card --------------------------------------------- */
function StatCard({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ ...glass({ padding:"14px 16px", display:"flex", alignItems:"center", gap:12 }) }}>
      <div style={{ width:36, height:36, borderRadius:10, background:"rgba(255,255,255,0.04)", border:`1px solid ${V.w1}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
        {icon}
      </div>
      <div>
        <p style={{ ...mono, fontSize:8, color:V.ink4, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:3 }}>{label}</p>
        <p style={{ ...mono, fontSize:16, fontWeight:600, color: color ?? V.ink0, letterSpacing:"-0.02em" }}>{value}</p>
        {sub && <p style={{ ...mono, fontSize:9, color:V.ink4, marginTop:1 }}>{sub}</p>}
      </div>
    </div>
  );
}

/* ---- Empty state ------------------------------------------- */
function EmptyState({ onGoPortfolio }: { onGoPortfolio?: () => void }) {
  return (
    <div style={{ ...glass({ padding:"48px 32px", textAlign:"center", maxWidth:480, margin:"60px auto" }) }}>
      <BarChart2 size={40} color={V.ink4} style={{ margin:"0 auto 16px" }} />
      <p style={{ fontSize:16, fontWeight:600, color:V.ink0, margin:"0 0 8px" }}>No Portfolio Data</p>
      <p style={{ fontSize:13, color:V.ink3, lineHeight:1.65, margin:"0 0 20px" }}>
        Add holdings in the Portfolio tab to see your analytics, sector breakdown, performance charts, and risk metrics.
      </p>
      <button onClick={onGoPortfolio}
        style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"10px 20px", borderRadius:10, background:"linear-gradient(135deg,#4F8EF7,#2D6FDB)", border:"none", color:"#fff", fontSize:13, fontWeight:600, fontFamily:"'Bricolage Grotesque',system-ui,sans-serif", cursor:"pointer" }}>
        Go to Portfolio
      </button>
    </div>
  );
}

/* ---- Custom tooltip ---------------------------------------- */
function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: { fill?: string } }> }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:"rgba(8,13,24,0.97)", border:`1px solid ${V.w2}`, borderRadius:10, padding:"10px 14px" }}>
      {payload.map((p, i) => (
        <p key={i} style={{ ...mono, fontSize:11, color: p.payload.fill ?? V.ink0, margin:0 }}>
          {p.name}: {typeof p.value === "number" && p.value < 200 ? `${p.value.toFixed(1)}%` : f$(p.value)}
        </p>
      ))}
    </div>
  );
}

/* ---- Main Component ---------------------------------------- */
export default function PortfolioAnalytics({ onSelectTicker, onGoPortfolio }: Props & { onGoPortfolio?: () => void }) {
  const [holdings,  setHoldings]  = useState<Holding[]>([]);
  const [enriched,  setEnriched]  = useState<EnrichedHolding[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [lastUpdate,setLastUpdate]= useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    // Load holdings from localStorage (same key as MyStocks)
    let raw: Holding[] = [];
    try {
      // Try cloud first if logged in
      const auth = localStorage.getItem("arbibx-auth-user");
      if (auth) {
        const { email, token } = JSON.parse(auth) as { email: string; token: string };
        const r = await fetch(`/api/portfolio?email=${encodeURIComponent(email)}&token=${token}`);
        if (r.ok) {
          const d = await r.json() as { holdings?: Holding[] };
          if (d.holdings?.length) raw = d.holdings;
        }
      }
      // Fallback to localStorage
      if (!raw.length) {
        const local = localStorage.getItem("arbibx-holdings-local");
        if (local) raw = JSON.parse(local) as Holding[];
      }
    } catch { /**/ }

    setHoldings(raw);

    if (!raw.length) { setLoading(false); return; }

    // Fetch current prices
    const tickers = [...new Set(raw.map(h => h.ticker))];
    const prices = await fetchPrices(tickers);

    const totalCost = raw.reduce((s, h) => s + h.shares * h.buyPrice, 0);

    const enrichedData: EnrichedHolding[] = raw.map(h => {
      const p = prices[h.ticker];
      const currentPrice = p?.price ?? h.buyPrice;
      const currentValue = h.shares * currentPrice;
      const costBasis    = h.shares * h.buyPrice;
      const pnl          = currentValue - costBasis;
      const pnlPct       = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
      const meta         = TICKER_META[h.ticker] ?? { name: h.ticker, sector: "Other" };
      return {
        ...h,
        name: meta.name,
        sector: meta.sector,
        currentPrice, currentValue, costBasis, pnl, pnlPct,
        dayChange: p?.dayPct ?? 0,
        weight: totalCost > 0 ? (costBasis / totalCost) * 100 : 0,
      };
    });

    setEnriched(enrichedData);
    setLastUpdate(new Date());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Also reload when login happens
  useEffect(() => {
    const onLogin = () => load();
    window.addEventListener("arbibx-login", onLogin);
    return () => window.removeEventListener("arbibx-login", onLogin);
  }, [load]);

  if (loading) return (
    <div style={{ padding:"24px 16px", maxWidth:1280, margin:"0 auto", display:"flex", flexDirection:"column", gap:12 }}>
      {[80, 200, 200, 120].map((h, i) => (
        <div key={i} style={{ height:h, borderRadius:14, background:"linear-gradient(105deg,#0C1220 30%,#151F30 50%,#0C1220 70%)", backgroundSize:"400% 100%", animation:"shimmer 2s ease-in-out infinite" }} />
      ))}
      <style>{`@keyframes shimmer{0%{background-position:-400% 0}100%{background-position:400% 0}}`}</style>
    </div>
  );

  if (!enriched.length) return (
    <div style={{ padding:"20px 16px", maxWidth:1280, margin:"0 auto" }}>
      <EmptyState onGoPortfolio={onGoPortfolio} />
    </div>
  );

  /* ---- Computed stats ---------------------------------------- */
  const totalValue = enriched.reduce((s, h) => s + h.currentValue, 0);
  const totalCost  = enriched.reduce((s, h) => s + h.costBasis, 0);
  const totalPnl   = totalValue - totalCost;
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
  const dayPnl     = enriched.reduce((s, h) => s + h.currentValue * h.dayChange / 100, 0);
  const winners    = enriched.filter(h => h.pnl > 0).length;
  const winRate    = enriched.length > 0 ? (winners / enriched.length) * 100 : 0;
  const maxWeight  = Math.max(...enriched.map(h => (h.currentValue / totalValue) * 100));
  const bestPos    = [...enriched].sort((a, b) => b.pnlPct - a.pnlPct)[0];
  const worstPos   = [...enriched].sort((a, b) => a.pnlPct - b.pnlPct)[0];

  /* ---- Sector breakdown data --------------------------------- */
  const sectorMap: Record<string, number> = {};
  for (const h of enriched) {
    sectorMap[h.sector] = (sectorMap[h.sector] ?? 0) + h.currentValue;
  }
  const sectorData = Object.entries(sectorMap)
    .map(([name, value]) => ({ name, value: +(value / totalValue * 100).toFixed(1), abs: value }))
    .sort((a, b) => b.value - a.value);

  /* ---- Position breakdown data ------------------------------ */
  const positionData = [...enriched]
    .sort((a, b) => b.currentValue - a.currentValue)
    .map(h => ({ name: h.ticker, value: +(h.currentValue / totalValue * 100).toFixed(1), pnl: h.pnlPct }));

  /* ---- Radar / health data ---------------------------------- */
  const diversificationScore = Math.min(100, (enriched.length / 10) * 40 + (maxWeight < 30 ? 40 : maxWeight < 50 ? 20 : 0) + 20);
  const momentumScore = Math.min(100, 50 + winRate / 2);
  const riskScore = Math.max(0, 100 - maxWeight);
  const performanceScore = Math.min(100, 50 + Math.max(-50, Math.min(50, totalPnlPct)));
  const balanceScore = Math.min(100, 100 - Math.max(0, maxWeight - 20) * 2);

  const radarData = [
    { subject:"Diversity",    A: Math.round(diversificationScore) },
    { subject:"Performance",  A: Math.round(performanceScore) },
    { subject:"Win Rate",     A: Math.round(winRate) },
    { subject:"Balance",      A: Math.round(balanceScore) },
    { subject:"Risk Mgmt",    A: Math.round(riskScore) },
  ];

  const overallScore = Math.round((diversificationScore + momentumScore + riskScore + performanceScore + balanceScore) / 5);
  const grade = overallScore >= 85 ? "A" : overallScore >= 75 ? "B" : overallScore >= 65 ? "C" : overallScore >= 55 ? "D" : "F";
  const gradeColor = grade === "A" ? V.gain : grade === "B" ? V.arc : grade === "C" ? V.gold : V.loss;

  return (
    <div style={{ padding:"20px 16px", maxWidth:1280, margin:"0 auto" }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20, gap:12, flexWrap:"wrap" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:42, height:42, borderRadius:12, background:V.arcDim, border:`1px solid ${V.arcWire}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <BarChart2 size={21} color={V.arc} />
          </div>
          <div>
            <h2 style={{ fontSize:19, fontWeight:700, color:V.ink0, margin:0 }}>Portfolio Analytics</h2>
            <p style={{ ...mono, color:V.ink4, fontSize:9, margin:0, marginTop:3, textTransform:"uppercase", letterSpacing:"0.08em" }}>
              {enriched.length} positions · {lastUpdate ? `Updated ${lastUpdate.toLocaleTimeString()}` : ""}
            </p>
          </div>
        </div>
        <button onClick={load}
          style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 14px", borderRadius:9, background:"rgba(255,255,255,0.03)", border:`1px solid ${V.w1}`, color:V.ink2, cursor:"pointer", fontSize:12, fontFamily:"'Bricolage Grotesque',system-ui,sans-serif" }}>
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* Key stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:8, marginBottom:16 }}>
        <StatCard icon={<TrendingUp size={16} color={totalPnl >= 0 ? V.gain : V.loss} />} label="Total Value" value={f$(totalValue)} sub={`${fp(totalPnlPct)} all time`} color={V.ink0} />
        <StatCard icon={<Activity size={16} color={dayPnl >= 0 ? V.gain : V.loss} />} label="Today's P&L" value={f$(dayPnl)} sub={`${dayPnl >= 0 ? "+" : ""}${(dayPnl / totalValue * 100).toFixed(2)}% today`} color={dayPnl >= 0 ? V.gain : V.loss} />
        <StatCard icon={<Target size={16} color={V.gold} />} label="Total P&L" value={f$(totalPnl)} sub={`${winners}/${enriched.length} positions winning`} color={totalPnl >= 0 ? V.gain : V.loss} />
        <StatCard icon={<Award size={16} color={gradeColor} />} label="Portfolio Grade" value={grade} sub={`Score: ${overallScore}/100`} color={gradeColor} />
      </div>

      {/* Charts row */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))", gap:14, marginBottom:16 }}>

        {/* Sector breakdown pie */}
        <div style={{ ...glass({ padding:"18px" }) }}>
          <p style={{ fontSize:13, fontWeight:600, color:V.ink0, margin:"0 0 14px", display:"flex", alignItems:"center", gap:6 }}>
            <PieChart size={14} color={V.arc} /> Sector Breakdown
          </p>
          <ResponsiveContainer width="100%" height={180}>
            <RechartsPie>
              <Pie data={sectorData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={35}>
                {sectorData.map((entry, i) => (
                  <Cell key={i} fill={SECTOR_COLORS[entry.name] ?? CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </RechartsPie>
          </ResponsiveContainer>
          <div style={{ display:"flex", flexWrap:"wrap", gap:"6px 12px", marginTop:8 }}>
            {sectorData.map((s, i) => (
              <div key={s.name} style={{ display:"flex", alignItems:"center", gap:5 }}>
                <div style={{ width:8, height:8, borderRadius:"50%", background:SECTOR_COLORS[s.name] ?? CHART_COLORS[i % CHART_COLORS.length], flexShrink:0 }} />
                <span style={{ ...mono, fontSize:9, color:V.ink2 }}>{s.name} {s.value}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Portfolio health radar */}
        <div style={{ ...glass({ padding:"18px" }) }}>
          <p style={{ fontSize:13, fontWeight:600, color:V.ink0, margin:"0 0 14px", display:"flex", alignItems:"center", gap:6 }}>
            <Shield size={14} color={V.ame} /> Portfolio Health
          </p>
          <ResponsiveContainer width="100%" height={180}>
            <RadarChart data={radarData}>
              <PolarGrid stroke={V.w2} />
              <PolarAngleAxis dataKey="subject" tick={{ fill:V.ink3, fontSize:9, fontFamily:"'Geist Mono',monospace" }} />
              <Radar name="Score" dataKey="A" stroke={V.ame} fill={V.ame} fillOpacity={0.15} />
            </RadarChart>
          </ResponsiveContainer>
          <div style={{ textAlign:"center", marginTop:4 }}>
            <span style={{ ...mono, fontSize:11, color:gradeColor }}>Grade {grade} · {overallScore}/100</span>
          </div>
        </div>

        {/* P&L by position bar chart */}
        <div style={{ ...glass({ padding:"18px" }) }}>
          <p style={{ fontSize:13, fontWeight:600, color:V.ink0, margin:"0 0 14px", display:"flex", alignItems:"center", gap:6 }}>
            <BarChart2 size={14} color={V.gold} /> P&L by Position
          </p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={enriched.map(h => ({ name:h.ticker, pnl:+h.pnlPct.toFixed(1), fill: h.pnl >= 0 ? V.gain : V.loss }))} margin={{ top:0, right:0, left:-20, bottom:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={V.w1} vertical={false} />
              <XAxis dataKey="name" tick={{ fill:V.ink4, fontSize:8, fontFamily:"'Geist Mono',monospace" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill:V.ink4, fontSize:8, fontFamily:"'Geist Mono',monospace" }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="pnl" name="P&L %" radius={[4,4,0,0]}>
                {enriched.map((h, i) => <Cell key={i} fill={h.pnl >= 0 ? V.gain : V.loss} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Position weight bar */}
      <div style={{ ...glass({ padding:"18px", marginBottom:16 }) }}>
        <p style={{ fontSize:13, fontWeight:600, color:V.ink0, margin:"0 0 14px", display:"flex", alignItems:"center", gap:6 }}>
          <Zap size={14} color={V.gold} /> Position Weights
        </p>
        <div style={{ display:"flex", height:24, borderRadius:99, overflow:"hidden", gap:2 }}>
          {[...enriched].sort((a, b) => b.currentValue - a.currentValue).map((h, i) => {
            const w = (h.currentValue / totalValue) * 100;
            return (
              <div key={h.ticker} title={`${h.ticker}: ${w.toFixed(1)}%`}
                onClick={() => onSelectTicker?.(h.ticker)}
                style={{ width:`${w}%`, background:CHART_COLORS[i % CHART_COLORS.length], cursor:"pointer", transition:"opacity 0.15s", minWidth:2, flexShrink:0 }}
                onMouseEnter={e => (e.currentTarget.style.opacity = "0.7")}
                onMouseLeave={e => (e.currentTarget.style.opacity = "1")} />
            );
          })}
        </div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:"6px 16px", marginTop:10 }}>
          {[...enriched].sort((a, b) => b.currentValue - a.currentValue).map((h, i) => (
            <div key={h.ticker} style={{ display:"flex", alignItems:"center", gap:5, cursor:"pointer" }} onClick={() => onSelectTicker?.(h.ticker)}>
              <div style={{ width:8, height:8, borderRadius:2, background:CHART_COLORS[i % CHART_COLORS.length], flexShrink:0 }} />
              <span style={{ ...mono, fontSize:9, color:V.ink2 }}>{h.ticker} {(h.currentValue / totalValue * 100).toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Best / Worst / Insights */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))", gap:12, marginBottom:16 }}>

        {/* Best performer */}
        <div style={{ ...glass({ padding:"16px", background:"linear-gradient(145deg,rgba(0,200,150,0.06) 0%,rgba(0,200,150,0.02) 100%)", borderColor:V.gainWire }) }}>
          <p style={{ ...mono, fontSize:9, color:V.gain, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:8 }}>Best Performer</p>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div>
              <button onClick={() => onSelectTicker?.(bestPos.ticker)} style={{ ...mono, fontSize:18, fontWeight:700, color:"#7EB6FF", background:"none", border:"none", cursor:"pointer", padding:0 }}>{bestPos.ticker}</button>
              <p style={{ fontSize:11, color:V.ink3, margin:"2px 0 0" }}>{bestPos.name}</p>
            </div>
            <div style={{ textAlign:"right" }}>
              <p style={{ ...mono, fontSize:16, fontWeight:600, color:V.gain }}>{fp(bestPos.pnlPct)}</p>
              <p style={{ ...mono, fontSize:10, color:V.ink3 }}>{f$(bestPos.pnl)} P&L</p>
            </div>
          </div>
        </div>

        {/* Worst performer */}
        <div style={{ ...glass({ padding:"16px", background:"linear-gradient(145deg,rgba(232,68,90,0.06) 0%,rgba(232,68,90,0.02) 100%)", borderColor:V.lossWire }) }}>
          <p style={{ ...mono, fontSize:9, color:V.loss, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:8 }}>Worst Performer</p>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div>
              <button onClick={() => onSelectTicker?.(worstPos.ticker)} style={{ ...mono, fontSize:18, fontWeight:700, color:"#7EB6FF", background:"none", border:"none", cursor:"pointer", padding:0 }}>{worstPos.ticker}</button>
              <p style={{ fontSize:11, color:V.ink3, margin:"2px 0 0" }}>{worstPos.name}</p>
            </div>
            <div style={{ textAlign:"right" }}>
              <p style={{ ...mono, fontSize:16, fontWeight:600, color:V.loss }}>{fp(worstPos.pnlPct)}</p>
              <p style={{ ...mono, fontSize:10, color:V.ink3 }}>{f$(worstPos.pnl)} P&L</p>
            </div>
          </div>
        </div>

        {/* Risk insights */}
        <div style={{ ...glass({ padding:"16px" }) }}>
          <p style={{ ...mono, fontSize:9, color:V.gold, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:8 }}>Risk Insights</p>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {maxWeight > 40 && (
              <div style={{ display:"flex", gap:6, padding:"8px 10px", borderRadius:8, background:V.lossDim, border:`1px solid ${V.lossWire}` }}>
                <AlertTriangle size={11} color={V.loss} style={{ flexShrink:0, marginTop:1 }} />
                <p style={{ fontSize:11, color:V.ink2, margin:0, lineHeight:1.5 }}>Largest position is {maxWeight.toFixed(0)}% — consider diversifying.</p>
              </div>
            )}
            {enriched.length < 5 && (
              <div style={{ display:"flex", gap:6, padding:"8px 10px", borderRadius:8, background:V.goldDim, border:`1px solid ${V.goldWire}` }}>
                <AlertTriangle size={11} color={V.gold} style={{ flexShrink:0, marginTop:1 }} />
                <p style={{ fontSize:11, color:V.ink2, margin:0, lineHeight:1.5 }}>Only {enriched.length} positions — low diversification.</p>
              </div>
            )}
            {maxWeight <= 30 && enriched.length >= 5 && (
              <div style={{ display:"flex", gap:6, padding:"8px 10px", borderRadius:8, background:V.gainDim, border:`1px solid ${V.gainWire}` }}>
                <TrendingUp size={11} color={V.gain} style={{ flexShrink:0, marginTop:1 }} />
                <p style={{ fontSize:11, color:V.ink2, margin:0, lineHeight:1.5 }}>Well diversified across {enriched.length} positions.</p>
              </div>
            )}
            <p style={{ ...mono, fontSize:9, color:V.ink4, margin:0 }}>Win rate: {winRate.toFixed(0)}% · Max position: {maxWeight.toFixed(1)}%</p>
          </div>
        </div>
      </div>

      {/* Full holdings table */}
      <div style={{ ...glass({ overflow:"hidden" }) }}>
        <div style={{ padding:"14px 18px", borderBottom:`1px solid ${V.w1}` }}>
          <p style={{ fontSize:13, fontWeight:600, color:V.ink0, margin:0 }}>All Positions</p>
        </div>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", minWidth:600 }}>
            <thead>
              <tr style={{ borderBottom:`1px solid ${V.w1}` }}>
                {["Ticker","Sector","Shares","Avg Cost","Current","Value","P&L","Weight","Today"].map(h => (
                  <th key={h} style={{ ...mono, fontSize:9, color:V.ink4, textTransform:"uppercase", letterSpacing:"0.08em", padding:"10px 12px", textAlign: h === "Ticker" || h === "Sector" ? "left" : "right", background:"rgba(5,8,16,0.8)", whiteSpace:"nowrap", fontWeight:400 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...enriched].sort((a, b) => b.currentValue - a.currentValue).map(h => (
                <tr key={h.id}
                  onClick={() => onSelectTicker?.(h.ticker)}
                  style={{ borderBottom:`1px solid rgba(130,180,255,0.04)`, cursor:"pointer", transition:"background 0.15s" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(30,45,64,0.7)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                  <td style={{ padding:"11px 12px" }}>
                    <p style={{ ...mono, fontSize:12, fontWeight:600, color:"#7EB6FF", margin:0 }}>{h.ticker}</p>
                    <p style={{ fontSize:10, color:V.ink3, margin:0 }}>{h.name}</p>
                  </td>
                  <td style={{ padding:"11px 12px" }}>
                    <span style={{ ...mono, fontSize:9, padding:"2px 6px", borderRadius:4, background:`${SECTOR_COLORS[h.sector] ?? V.arc}15`, color:SECTOR_COLORS[h.sector] ?? V.arc }}>{h.sector}</span>
                  </td>
                  <td style={{ padding:"11px 12px", textAlign:"right" }}><span style={{ ...mono, fontSize:11, color:V.ink2 }}>{h.shares}</span></td>
                  <td style={{ padding:"11px 12px", textAlign:"right" }}><span style={{ ...mono, fontSize:11, color:V.ink2 }}>{f$(h.buyPrice)}</span></td>
                  <td style={{ padding:"11px 12px", textAlign:"right" }}><span style={{ ...mono, fontSize:12, fontWeight:500, color:V.ink0 }}>{f$(h.currentPrice)}</span></td>
                  <td style={{ padding:"11px 12px", textAlign:"right" }}><span style={{ ...mono, fontSize:12, fontWeight:500, color:V.ink0 }}>{f$(h.currentValue)}</span></td>
                  <td style={{ padding:"11px 12px", textAlign:"right" }}>
                    <p style={{ ...mono, fontSize:11, fontWeight:600, color: h.pnl >= 0 ? V.gain : V.loss, margin:0 }}>{f$(h.pnl)}</p>
                    <p style={{ ...mono, fontSize:9, color: h.pnl >= 0 ? V.gain : V.loss, margin:0 }}>{fp(h.pnlPct)}</p>
                  </td>
                  <td style={{ padding:"11px 12px", textAlign:"right" }}><span style={{ ...mono, fontSize:11, color:V.ink2 }}>{(h.currentValue / totalValue * 100).toFixed(1)}%</span></td>
                  <td style={{ padding:"11px 12px", textAlign:"right" }}>
                    <span style={{ ...mono, fontSize:11, color: h.dayChange >= 0 ? V.gain : V.loss }}>{fp(h.dayChange)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding:"10px 16px", borderTop:`1px solid ${V.w1}` }}>
          <p style={{ ...mono, fontSize:9, color:V.ink4 }}>Click any row to view chart · Not financial advice</p>
        </div>
      </div>

      <style>{`@keyframes shimmer{0%{background-position:-400% 0}100%{background-position:400% 0}}`}</style>
    </div>
  );
}
