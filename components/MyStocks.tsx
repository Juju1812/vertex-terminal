"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus, Trash2, TrendingUp, TrendingDown, RefreshCw,
  BookOpen, Star, AlertTriangle, CheckCircle, XCircle, Info,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Holding {
  id: string;
  ticker: string;
  shares: number;
  buyPrice: number;
}

interface EnrichedHolding extends Holding {
  name: string;
  currentPrice: number;
  totalCost: number;
  currentValue: number;
  pnl: number;
  pnlPct: number;
  dayChangePct: number;
}

interface PortfolioGrade {
  letter: string;         // A+ … F
  score: number;          // 0-100
  summary: string;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────
const API_KEY = "1xwzcvUOF9pft6PRNylO2Xc6X2QeQCGr";
const BASE    = "https://api.polygon.io";

const KNOWN: Record<string, { name: string; price: number; dayChg: number }> = {
  AAPL: { name:"Apple Inc.",              price:228.52, dayChg: 1.42 },
  MSFT: { name:"Microsoft Corp.",          price:415.32, dayChg:-0.52 },
  NVDA: { name:"NVIDIA Corp.",             price:875.42, dayChg: 2.90 },
  GOOGL:{ name:"Alphabet Inc.",            price:178.94, dayChg: 0.81 },
  META: { name:"Meta Platforms",           price:554.78, dayChg: 1.63 },
  TSLA: { name:"Tesla Inc.",               price:248.50, dayChg:-3.58 },
  AMZN: { name:"Amazon.com Inc.",          price:201.17, dayChg:-0.44 },
  AMD:  { name:"Advanced Micro Devices",   price:162.34, dayChg: 3.72 },
  PLTR: { name:"Palantir Technologies",    price: 38.92, dayChg: 4.96 },
  JPM:  { name:"JPMorgan Chase & Co.",     price:224.31, dayChg: 0.50 },
  V:    { name:"Visa Inc.",               price:296.14, dayChg: 0.83 },
  UNH:  { name:"UnitedHealth Group",       price:512.88, dayChg:-0.81 },
  LLY:  { name:"Eli Lilly & Co.",          price:798.44, dayChg: 1.24 },
  AVGO: { name:"Broadcom Inc.",            price:1642.33,dayChg: 1.11 },
  CRM:  { name:"Salesforce Inc.",          price:299.11, dayChg: 0.68 },
  ORCL: { name:"Oracle Corp.",             price:142.67, dayChg: 0.92 },
  CRWD: { name:"CrowdStrike Holdings",     price:368.92, dayChg: 2.44 },
  COIN: { name:"Coinbase Global",          price:234.67, dayChg: 5.21 },
};

const STORAGE_KEY = "vertex-my-stocks";

// ─── Polygon fetch ────────────────────────────────────────────────────────────
async function polyGet<T>(path: string): Promise<T | null> {
  try {
    const sep = path.includes("?") ? "&" : "?";
    const r = await fetch(`${BASE}${path}${sep}apiKey=${API_KEY}`);
    if (!r.ok) return null;
    return r.json();
  } catch { return null; }
}

async function fetchPrices(tickers: string[]): Promise<Record<string, { price: number; dayChg: number; name: string }>> {
  if (!tickers.length) return {};
  const joined = tickers.join(",");
  const data = await polyGet<{
    tickers?: Array<{
      ticker: string;
      day: { c: number };
      prevDay: { c: number };
    }>;
  }>(`/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${joined}`);

  const result: Record<string, { price: number; dayChg: number; name: string }> = {};
  tickers.forEach(t => {
    const snap = data?.tickers?.find(x => x.ticker === t);
    const known = KNOWN[t];
    if (snap?.day?.c && snap?.prevDay?.c) {
      const price  = snap.day.c;
      const dayChg = ((price - snap.prevDay.c) / snap.prevDay.c) * 100;
      result[t] = { price, dayChg: +dayChg.toFixed(2), name: known?.name ?? t };
    } else if (known) {
      result[t] = { price: known.price, dayChg: known.dayChg, name: known.name };
    } else {
      result[t] = { price: 0, dayChg: 0, name: t };
    }
  });
  return result;
}

// ─── Portfolio grader ─────────────────────────────────────────────────────────
function gradePortfolio(holdings: EnrichedHolding[]): PortfolioGrade {
  if (!holdings.length) return { letter:"N/A", score:0, summary:"Add holdings to receive a grade.", strengths:[], weaknesses:[], suggestions:["Add at least 3 holdings to get started."] };

  let score = 50; // baseline
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const suggestions: string[] = [];

  // 1. Diversification (count unique holdings)
  const count = holdings.length;
  if (count >= 8)      { score += 15; strengths.push(`Well diversified across ${count} positions.`); }
  else if (count >= 5) { score += 8;  strengths.push(`Reasonable diversification (${count} positions).`); }
  else if (count >= 3) { score += 2; }
  else { score -= 10;  weaknesses.push("Highly concentrated — fewer than 3 holdings increases risk."); suggestions.push("Add 3–5 more holdings from different sectors to reduce concentration risk."); }

  // 2. Winners vs losers
  const winners = holdings.filter(h => h.pnlPct > 0).length;
  const losers  = holdings.filter(h => h.pnlPct < 0).length;
  const winRate = winners / count;
  if (winRate > 0.7)       { score += 15; strengths.push(`${winners}/${count} positions are profitable.`); }
  else if (winRate > 0.5)  { score += 7; }
  else if (winRate < 0.35) { score -= 12; weaknesses.push(`${losers}/${count} positions are in the red.`); suggestions.push("Review losing positions — consider trimming those down >15%."); }

  // 3. Average return
  const avgReturn = holdings.reduce((s, h) => s + h.pnlPct, 0) / count;
  if (avgReturn > 20)       { score += 15; strengths.push(`Exceptional avg return of +${avgReturn.toFixed(1)}%.`); }
  else if (avgReturn > 10)  { score += 10; strengths.push(`Solid avg return of +${avgReturn.toFixed(1)}%.`); }
  else if (avgReturn > 0)   { score += 4; }
  else if (avgReturn < -10) { score -= 15; weaknesses.push(`Portfolio down ${avgReturn.toFixed(1)}% on average.`); suggestions.push("Consider reallocating from underperformers to stronger momentum names."); }
  else if (avgReturn < 0)   { score -= 6; }

  // 4. Concentration risk — largest position
  const totalValue = holdings.reduce((s, h) => s + h.currentValue, 0);
  const maxPct = Math.max(...holdings.map(h => (h.currentValue / totalValue) * 100));
  if (maxPct > 40)      { score -= 8;  weaknesses.push(`Top position is ${maxPct.toFixed(0)}% of portfolio — dangerously concentrated.`); suggestions.push("Trim your largest position to under 25% for better risk management."); }
  else if (maxPct < 25) { score += 6;  strengths.push("No single position dominates — good balance."); }

  // 5. Tech concentration
  const techTickers = ["NVDA","MSFT","AAPL","META","GOOGL","AMD","PLTR","ORCL","CRWD","CRM","AVGO"];
  const techPct = holdings.filter(h => techTickers.includes(h.ticker)).length / count;
  if (techPct > 0.8)      { score -= 6; weaknesses.push("Heavy tech concentration — vulnerable to sector rotation."); suggestions.push("Add exposure to Financials, Healthcare or Consumer sectors."); }
  else if (techPct < 0.5) { score += 5; strengths.push("Good sector balance beyond tech."); }

  // Clamp and grade
  score = Math.min(100, Math.max(0, Math.round(score)));
  const letter =
    score >= 95 ? "A+" : score >= 90 ? "A"  : score >= 85 ? "A-" :
    score >= 80 ? "B+" : score >= 75 ? "B"  : score >= 70 ? "B-" :
    score >= 65 ? "C+" : score >= 60 ? "C"  : score >= 55 ? "C-" :
    score >= 50 ? "D+" : score >= 45 ? "D"  : "F";

  const summary =
    score >= 85 ? "Outstanding portfolio — excellent diversification and strong returns." :
    score >= 70 ? "Good portfolio with room for improvement in diversification or returns." :
    score >= 55 ? "Average portfolio — notable weaknesses need to be addressed." :
    "Below-average portfolio — significant changes recommended to improve risk/reward.";

  if (!suggestions.length) suggestions.push("Keep monitoring momentum and rebalance quarterly.");

  return { letter, score, summary, strengths, weaknesses, suggestions };
}

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmt$ = (n: number, d = 2) =>
  new Intl.NumberFormat("en-US", { style:"currency", currency:"USD", minimumFractionDigits:d, maximumFractionDigits:d }).format(n);
const fmtPct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;

// ─── Grade badge colors ───────────────────────────────────────────────────────
function gradeColor(letter: string): string {
  if (letter.startsWith("A")) return "#00FF94";
  if (letter.startsWith("B")) return "#00D4FF";
  if (letter.startsWith("C")) return "#FFB800";
  if (letter.startsWith("D")) return "#FF7B00";
  return "#FF3B5C";
}

// ─── Add Holding form ─────────────────────────────────────────────────────────
function AddHoldingRow({ onAdd }: { onAdd: (h: Omit<Holding,"id">) => void }) {
  const [ticker,   setTicker]   = useState("");
  const [shares,   setShares]   = useState("");
  const [buyPrice, setBuyPrice] = useState("");
  const [err,      setErr]      = useState("");

  const submit = () => {
    const t = ticker.trim().toUpperCase();
    const s = parseFloat(shares);
    const b = parseFloat(buyPrice);
    if (!t)       return setErr("Enter a ticker.");
    if (!s || s <= 0) return setErr("Enter valid share count.");
    if (!b || b <= 0) return setErr("Enter valid buy price.");
    onAdd({ ticker: t, shares: s, buyPrice: b });
    setTicker(""); setShares(""); setBuyPrice(""); setErr("");
  };

  const inp: React.CSSProperties = { background:"#060B14", border:"1px solid #1E293B", borderRadius:7, color:"#E2EAF4", fontFamily:"monospace", fontSize:13, padding:"8px 10px", outline:"none", width:"100%" };

  return (
    <div style={{ background:"#0D1321", border:"1px solid #1E293B", borderRadius:10, padding:14, marginBottom:16 }}>
      <p style={{ fontSize:12, color:"#7A9BBF", marginBottom:10, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.07em" }}>Add Holding</p>
      <div style={{ display:"grid", gridTemplateColumns:"120px 120px 150px 1fr", gap:8, alignItems:"end" }}>
        <div>
          <label style={{ fontSize:10, color:"#3D5A7A", display:"block", marginBottom:4, fontFamily:"monospace" }}>TICKER</label>
          <input value={ticker} onChange={e=>setTicker(e.target.value.toUpperCase())} placeholder="e.g. AAPL" style={inp} onKeyDown={e=>e.key==="Enter"&&submit()} />
        </div>
        <div>
          <label style={{ fontSize:10, color:"#3D5A7A", display:"block", marginBottom:4, fontFamily:"monospace" }}>SHARES</label>
          <input value={shares} onChange={e=>setShares(e.target.value)} placeholder="e.g. 10" type="number" min="0.001" step="any" style={inp} onKeyDown={e=>e.key==="Enter"&&submit()} />
        </div>
        <div>
          <label style={{ fontSize:10, color:"#3D5A7A", display:"block", marginBottom:4, fontFamily:"monospace" }}>BUY PRICE ($)</label>
          <input value={buyPrice} onChange={e=>setBuyPrice(e.target.value)} placeholder="e.g. 180.00" type="number" min="0.01" step="any" style={inp} onKeyDown={e=>e.key==="Enter"&&submit()} />
        </div>
        <div>
          <button onClick={submit}
            style={{ display:"flex", alignItems:"center", gap:6, background:"rgba(0,212,255,0.12)", border:"1px solid rgba(0,212,255,0.3)", borderRadius:7, color:"#00D4FF", padding:"8px 16px", cursor:"pointer", fontSize:13, fontWeight:600, whiteSpace:"nowrap" }}>
            <Plus size={14} /> Add
          </button>
        </div>
      </div>
      {err && <p style={{ color:"#FF3B5C", fontSize:11, marginTop:8, fontFamily:"monospace" }}>⚠ {err}</p>}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function MyStocks() {
  const [holdings,  setHoldings]  = useState<Holding[]>([]);
  const [prices,    setPrices]    = useState<Record<string,{price:number;dayChg:number;name:string}>>({});
  const [loading,   setLoading]   = useState(false);
  const [lastFetch, setLastFetch] = useState<Date|null>(null);

  // Persist to localStorage
  useEffect(() => {
    try { const saved = localStorage.getItem(STORAGE_KEY); if (saved) setHoldings(JSON.parse(saved)); } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(holdings)); } catch {}
  }, [holdings]);

  // Fetch prices whenever holdings change
  const fetchAll = useCallback(async () => {
    if (!holdings.length) return;
    setLoading(true);
    const tickers = [...new Set(holdings.map(h => h.ticker))];
    const data = await fetchPrices(tickers);
    setPrices(data);
    setLastFetch(new Date());
    setLoading(false);
  }, [holdings]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // CRUD
  const addHolding = (h: Omit<Holding,"id">) => {
    setHoldings(prev => [...prev, { ...h, id: `${Date.now()}-${Math.random()}` }]);
  };
  const removeHolding = (id: string) => setHoldings(prev => prev.filter(h => h.id !== id));

  // Enrich
  const enriched: EnrichedHolding[] = holdings.map(h => {
    const p = prices[h.ticker];
    const currentPrice = p?.price ?? h.buyPrice;
    const totalCost    = h.shares * h.buyPrice;
    const currentValue = h.shares * currentPrice;
    const pnl          = currentValue - totalCost;
    const pnlPct       = ((currentPrice - h.buyPrice) / h.buyPrice) * 100;
    const dayChangePct = p?.dayChg ?? 0;
    const name         = p?.name ?? KNOWN[h.ticker]?.name ?? h.ticker;
    return { ...h, name, currentPrice, totalCost, currentValue, pnl, pnlPct, dayChangePct };
  });

  const totalCost  = enriched.reduce((s,h) => s + h.totalCost,    0);
  const totalValue = enriched.reduce((s,h) => s + h.currentValue, 0);
  const totalPnl   = totalValue - totalCost;
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

  const grade = gradePortfolio(enriched);
  const gradeCol = gradeColor(grade.letter);

  const mono: React.CSSProperties = { fontFamily:"monospace" };
  const muted: React.CSSProperties = { color:"#7A9BBF" };
  const card: React.CSSProperties  = { background:"#0D1321", border:"1px solid #1E293B", borderRadius:12 };

  return (
    <div style={{ padding:24, maxWidth:1200 }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:40, height:40, borderRadius:10, background:"rgba(168,85,247,0.12)", border:"1px solid rgba(168,85,247,0.25)", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <BookOpen size={20} color="#A855F7" />
          </div>
          <div>
            <h2 style={{ margin:0, fontSize:18, fontWeight:700 }}>My Stocks</h2>
            <p style={{ ...muted, margin:0, fontSize:12 }}>Track holdings · P&L · AI Portfolio Grade</p>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          {lastFetch && <span style={{ ...mono, ...muted, fontSize:10 }}>Updated {lastFetch.toLocaleTimeString()}</span>}
          <button onClick={fetchAll} disabled={loading || !holdings.length}
            style={{ display:"flex", alignItems:"center", gap:6, background:"#111E30", border:"1px solid #1E293B", borderRadius:8, color: loading?"#3D5A7A":"#7A9BBF", padding:"7px 12px", cursor:"pointer", fontSize:12 }}>
            <RefreshCw size={13} style={{ animation: loading ? "spin 1s linear infinite":"none" }} />
            Refresh prices
          </button>
        </div>
      </div>

      {/* Add form */}
      <AddHoldingRow onAdd={addHolding} />

      {holdings.length > 0 && (
        <>
          {/* Summary strip */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:16 }}>
            {[
              { label:"Portfolio Value", val: fmt$(totalValue), color:"#E2EAF4" },
              { label:"Total Cost",      val: fmt$(totalCost),  color:"#7A9BBF" },
              { label:"Total P&L",       val: fmt$(totalPnl),   color: totalPnl>=0?"#00FF94":"#FF3B5C" },
              { label:"Total Return",    val: fmtPct(totalPnlPct), color: totalPnlPct>=0?"#00FF94":"#FF3B5C" },
            ].map(s => (
              <div key={s.label} style={{ ...card, padding:"12px 14px" }}>
                <div style={{ ...mono, ...muted, fontSize:9, textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:4 }}>{s.label}</div>
                <div style={{ ...mono, fontSize:18, fontWeight:700, color:s.color }}>{s.val}</div>
              </div>
            ))}
          </div>

          {/* Holdings table */}
          <div style={{ ...card, overflow:"hidden", marginBottom:16 }}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr style={{ borderBottom:"1px solid #1E293B" }}>
                  {["Ticker","Company","Shares","Buy Price","Current Price","Value","Unreal. P&L","% Return","Day",""].map(h => (
                    <th key={h} style={{ ...mono, fontSize:10, color:"#3D5A7A", textTransform:"uppercase", letterSpacing:"0.07em", padding:"10px 12px", textAlign: h===""?"center":"left", fontWeight:500, whiteSpace:"nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {enriched.map(h => {
                  const up    = h.pnlPct >= 0;
                  const dayUp = h.dayChangePct >= 0;
                  return (
                    <tr key={h.id} style={{ borderBottom:"1px solid #111E30", transition:"background 0.15s" }}
                      onMouseEnter={e=>(e.currentTarget.style.background="#111E30")}
                      onMouseLeave={e=>(e.currentTarget.style.background="transparent")}>
                      <td style={{ padding:"12px 12px" }}>
                        <span style={{ ...mono, fontSize:13, fontWeight:700, color:"#00D4FF" }}>{h.ticker}</span>
                      </td>
                      <td style={{ padding:"12px 12px", fontSize:12, ...muted, maxWidth:160 }}>
                        <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", display:"block" }}>{h.name}</span>
                      </td>
                      <td style={{ padding:"12px 12px", ...mono, fontSize:12 }}>{h.shares.toLocaleString()}</td>
                      <td style={{ padding:"12px 12px", ...mono, fontSize:12 }}>{fmt$(h.buyPrice)}</td>
                      <td style={{ padding:"12px 12px", ...mono, fontSize:13, fontWeight:600 }}>
                        {h.currentPrice > 0 ? fmt$(h.currentPrice) : <span style={muted}>—</span>}
                      </td>
                      <td style={{ padding:"12px 12px", ...mono, fontSize:12 }}>{fmt$(h.currentValue)}</td>
                      <td style={{ padding:"12px 12px" }}>
                        <span style={{ ...mono, fontSize:12, color: up?"#00FF94":"#FF3B5C" }}>
                          {up?"+":""}{fmt$(h.pnl)}
                        </span>
                      </td>
                      <td style={{ padding:"12px 12px" }}>
                        <span style={{ ...mono, fontSize:12, padding:"2px 8px", borderRadius:5, background: up?"rgba(0,255,148,0.1)":"rgba(255,59,92,0.1)", color: up?"#00FF94":"#FF3B5C", display:"inline-flex", alignItems:"center", gap:4 }}>
                          {up ? <TrendingUp size={11}/> : <TrendingDown size={11}/>}
                          {fmtPct(h.pnlPct)}
                        </span>
                      </td>
                      <td style={{ padding:"12px 12px" }}>
                        <span style={{ ...mono, fontSize:11, color: dayUp?"#00FF94":"#FF3B5C" }}>
                          {fmtPct(h.dayChangePct)}
                        </span>
                      </td>
                      <td style={{ padding:"12px 12px", textAlign:"center" }}>
                        <button onClick={() => removeHolding(h.id)}
                          style={{ background:"none", border:"none", cursor:"pointer", color:"#3D5A7A", padding:4, borderRadius:4 }}
                          onMouseEnter={e=>(e.currentTarget.style.color="#FF3B5C")}
                          onMouseLeave={e=>(e.currentTarget.style.color="#3D5A7A")}>
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* AI Portfolio Grade */}
          <div style={{ ...card, overflow:"hidden" }}>
            {/* Grade header */}
            <div style={{ display:"flex", alignItems:"stretch", borderBottom:"1px solid #1E293B" }}>
              {/* Big grade badge */}
              <div style={{ padding:"24px 28px", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", borderRight:"1px solid #1E293B", minWidth:120, background:`${gradeCol}08` }}>
                <div style={{ fontSize:10, ...mono, color:gradeCol, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:4 }}>Portfolio Grade</div>
                <div style={{ fontSize:52, fontWeight:900, lineHeight:1, color:gradeCol, textShadow:`0 0 30px ${gradeCol}55` }}>{grade.letter}</div>
                <div style={{ ...mono, fontSize:11, color:gradeCol, marginTop:4 }}>{grade.score}/100</div>
              </div>

              {/* Score bar + summary */}
              <div style={{ flex:1, padding:"20px 22px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                  <Star size={15} color={gradeCol} fill={gradeCol} />
                  <span style={{ fontWeight:700, fontSize:14 }}>AI Portfolio Analysis</span>
                </div>
                <p style={{ ...muted, fontSize:13, lineHeight:1.6, margin:"0 0 14px" }}>{grade.summary}</p>
                {/* Score bar */}
                <div style={{ height:6, background:"#111E30", borderRadius:99, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${grade.score}%`, background:`linear-gradient(90deg,${gradeCol}88,${gradeCol})`, borderRadius:99, transition:"width 0.8s ease" }} />
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", marginTop:4 }}>
                  <span style={{ ...mono, fontSize:9, color:"#3D5A7A" }}>0</span>
                  <span style={{ ...mono, fontSize:9, color:"#3D5A7A" }}>100</span>
                </div>
              </div>
            </div>

            {/* Three columns: strengths / weaknesses / suggestions */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)" }}>
              {/* Strengths */}
              <div style={{ padding:"16px 18px", borderRight:"1px solid #1E293B" }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:10 }}>
                  <CheckCircle size={13} color="#00FF94" />
                  <span style={{ fontSize:11, fontWeight:700, color:"#00FF94", textTransform:"uppercase", letterSpacing:"0.07em" }}>Strengths</span>
                </div>
                {grade.strengths.length ? grade.strengths.map((s,i) => (
                  <div key={i} style={{ display:"flex", gap:8, marginBottom:8 }}>
                    <span style={{ color:"#00FF94", fontSize:12, marginTop:1 }}>✓</span>
                    <span style={{ fontSize:12, color:"#7A9BBF", lineHeight:1.5 }}>{s}</span>
                  </div>
                )) : <p style={{ ...muted, fontSize:12 }}>No strengths identified yet.</p>}
              </div>

              {/* Weaknesses */}
              <div style={{ padding:"16px 18px", borderRight:"1px solid #1E293B" }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:10 }}>
                  <XCircle size={13} color="#FF3B5C" />
                  <span style={{ fontSize:11, fontWeight:700, color:"#FF3B5C", textTransform:"uppercase", letterSpacing:"0.07em" }}>Weaknesses</span>
                </div>
                {grade.weaknesses.length ? grade.weaknesses.map((w,i) => (
                  <div key={i} style={{ display:"flex", gap:8, marginBottom:8 }}>
                    <AlertTriangle size={12} color="#FF3B5C" style={{ marginTop:2, flexShrink:0 }} />
                    <span style={{ fontSize:12, color:"#7A9BBF", lineHeight:1.5 }}>{w}</span>
                  </div>
                )) : <p style={{ ...muted, fontSize:12 }}>No major weaknesses found.</p>}
              </div>

              {/* Suggestions */}
              <div style={{ padding:"16px 18px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:10 }}>
                  <Info size={13} color="#00D4FF" />
                  <span style={{ fontSize:11, fontWeight:700, color:"#00D4FF", textTransform:"uppercase", letterSpacing:"0.07em" }}>Suggestions</span>
                </div>
                {grade.suggestions.map((s,i) => (
                  <div key={i} style={{ display:"flex", gap:8, marginBottom:8 }}>
                    <span style={{ color:"#00D4FF", fontSize:12, marginTop:1 }}>→</span>
                    <span style={{ fontSize:12, color:"#7A9BBF", lineHeight:1.5 }}>{s}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Empty state */}
      {!holdings.length && (
        <div style={{ ...card, padding:48, textAlign:"center" }}>
          <BookOpen size={36} color="#1E293B" style={{ marginBottom:12 }} />
          <p style={{ fontSize:15, fontWeight:600, marginBottom:6 }}>No holdings yet</p>
          <p style={{ ...muted, fontSize:13 }}>Add your first stock above to start tracking your portfolio.</p>
        </div>
      )}

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
