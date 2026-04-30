"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Plus, TrendingUp, TrendingDown, Search } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

const POLYGON_KEY = "1xwzcvUOF9pft6PRNylO2Xc6X2QeQCGr";
const BASE = "https://api.polygon.io";

/* ---- Types -------------------------------------------------- */
interface CompareStock {
  ticker: string;
  name: string;
  color: string;
  startPrice: number;
  currentPrice: number;
  changePct: number;
  bars: { date: string; normalized: number; price: number }[];
}

interface Props {
  initialTicker: string;
  onClose: () => void;
}

/* ---- Colors for each stock line ---------------------------- */
const LINE_COLORS = ["#00e5a0", "#f0a500", "#7eb6ff", "#ff4560", "#c084fc", "#fb923c"];

/* ---- Ticker names ------------------------------------------ */
const NAMES: Record<string, string> = {
  AAPL:"Apple", MSFT:"Microsoft", NVDA:"NVIDIA", GOOGL:"Alphabet",
  META:"Meta", TSLA:"Tesla", AMZN:"Amazon", AMD:"AMD",
  AVGO:"Broadcom", ORCL:"Oracle", CRM:"Salesforce", NOW:"ServiceNow",
  ADBE:"Adobe", INTC:"Intel", QCOM:"Qualcomm", JPM:"JPMorgan",
  V:"Visa", MA:"Mastercard", BAC:"BofA", GS:"Goldman",
  COIN:"Coinbase", PLTR:"Palantir", CRWD:"CrowdStrike", PANW:"Palo Alto",
  NET:"Cloudflare", SNOW:"Snowflake", UNH:"UnitedHealth", LLY:"Eli Lilly",
  PFE:"Pfizer", MRNA:"Moderna", ABBV:"AbbVie", XOM:"ExxonMobil",
  CVX:"Chevron", OXY:"Occidental", MSTR:"MicroStrategy", TSM:"TSMC",
  ASML:"ASML", NVO:"Novo Nordisk", BABA:"Alibaba", TCEHY:"Tencent",
};

/* ---- Design tokens ----------------------------------------- */
const V = {
  void:"var(--void,#050407)", surface:"var(--surface,#0d0b16)", raised:"var(--raised,#1a1628)",
  border:"var(--border,rgba(60,48,100,0.5))", borderHi:"var(--border-hi,rgba(90,72,150,0.6))",
  ink0:"var(--ink0,#f4f0ff)", ink1:"var(--ink1,#cdc7e0)", ink2:"var(--ink2,#8a82a8)", ink3:"var(--ink3,#4a4468)", ink4:"var(--ink4,#2d2848)",
  gain:"var(--gain,#00e5a0)", loss:"var(--loss,#ff4560)", gold:"var(--gold,#f0a500)",
  goldDim:"var(--gold-dim,rgba(240,165,0,0.10))", goldWire:"var(--gold-wire,rgba(240,165,0,0.28))",
};
const mono: React.CSSProperties = { fontFamily:"'DM Mono','Courier New',monospace" };

/* ---- Fetch normalized bars --------------------------------- */
async function fetchBars(ticker: string, days: number): Promise<{ date: string; normalized: number; price: number }[]> {
  const to   = new Date().toISOString().split("T")[0];
  const from = new Date(Date.now() - days * 86400000).toISOString().split("T")[0];
  try {
    const r = await fetch(
      `${BASE}/v2/aggs/ticker/${ticker}/range/1/day/${from}/${to}?adjusted=true&sort=asc&limit=300&apiKey=${POLYGON_KEY}`
    );
    const d = r.ok ? await r.json() as { results?: { t: number; c: number }[] } : null;
    if (!d?.results?.length) return [];
    const base = d.results[0].c;
    return d.results.map(b => ({
      date: new Date(b.t).toISOString().split("T")[0],
      normalized: +((b.c / base - 1) * 100).toFixed(2),
      price: b.c,
    }));
  } catch { return []; }
}

async function fetchName(ticker: string): Promise<string> {
  if (NAMES[ticker]) return NAMES[ticker];
  try {
    const r = await fetch(`${BASE}/v3/reference/tickers/${ticker}?apiKey=${POLYGON_KEY}`);
    const d = r.ok ? await r.json() as { results?: { name: string } } : null;
    return d?.results?.name ?? ticker;
  } catch { return ticker; }
}

/* ---- Merge bars by date ------------------------------------ */
function mergeBars(stocks: CompareStock[]): Record<string, number | string>[] {
  const dateSet = new Set<string>();
  for (const s of stocks) s.bars.forEach(b => dateSet.add(b.date));
  const dates = [...dateSet].sort();

  return dates.map(date => {
    const row: Record<string, number | string> = {
      date: new Date(date + "T12:00:00").toLocaleDateString("en-US", { month:"short", day:"numeric" }),
    };
    for (const s of stocks) {
      const bar = s.bars.find(b => b.date === date);
      if (bar) row[s.ticker] = bar.normalized;
    }
    return row;
  });
}

/* ---- Main Component ---------------------------------------- */
export default function StockComparison({ initialTicker, onClose }: Props) {
  const [stocks,   setStocks]   = useState<CompareStock[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [adding,   setAdding]   = useState(false);
  const [search,   setSearch]   = useState("");
  const [range,    setRange]    = useState<30 | 90 | 180>(90);
  const [showSearch, setShowSearch] = useState(false);

  const addStock = useCallback(async (ticker: string) => {
    ticker = ticker.trim().toUpperCase();
    if (!ticker || stocks.find(s => s.ticker === ticker)) return;
    if (stocks.length >= 6) return;
    setAdding(true);
    const [bars, name] = await Promise.all([fetchBars(ticker, range), fetchName(ticker)]);
    if (!bars.length) { setAdding(false); return; }
    const color = LINE_COLORS[stocks.length % LINE_COLORS.length];
    const startPrice   = bars[0].price;
    const currentPrice = bars[bars.length - 1].price;
    const changePct    = +((currentPrice - startPrice) / startPrice * 100).toFixed(2);
    setStocks(prev => [...prev, { ticker, name, color, startPrice, currentPrice, changePct, bars }]);
    setAdding(false);
    setSearch("");
    setShowSearch(false);
  }, [stocks, range]);

  const removeStock = (ticker: string) => setStocks(prev => prev.filter(s => s.ticker !== ticker));

  // Load initial ticker
  useEffect(() => {
    setLoading(true);
    fetchBars(initialTicker, range).then(async bars => {
      if (bars.length) {
        const name = await fetchName(initialTicker);
        const startPrice   = bars[0].price;
        const currentPrice = bars[bars.length - 1].price;
        const changePct    = +((currentPrice - startPrice) / startPrice * 100).toFixed(2);
        setStocks([{
          ticker: initialTicker, name, color: LINE_COLORS[0],
          startPrice, currentPrice, changePct, bars,
        }]);
      }
      setLoading(false);
    });
  }, []); // eslint-disable-line

  // Reload when range changes
  useEffect(() => {
    if (!stocks.length) return;
    setLoading(true);
    const tickers = stocks.map(s => s.ticker);
    Promise.all(tickers.map(async (t, i) => {
      const [bars, name] = await Promise.all([fetchBars(t, range), fetchName(t)]);
      if (!bars.length) return null;
      const startPrice   = bars[0].price;
      const currentPrice = bars[bars.length - 1].price;
      const changePct    = +((currentPrice - startPrice) / startPrice * 100).toFixed(2);
      return { ticker: t, name, color: LINE_COLORS[i % LINE_COLORS.length], startPrice, currentPrice, changePct, bars };
    })).then(results => {
      setStocks(results.filter(Boolean) as CompareStock[]);
      setLoading(false);
    });
  }, [range]); // eslint-disable-line

  const merged = mergeBars(stocks);
  const suggestions = Object.keys(NAMES).filter(t =>
    !stocks.find(s => s.ticker === t) &&
    (t.includes(search.toUpperCase()) || NAMES[t].toLowerCase().includes(search.toLowerCase()))
  ).slice(0, 8);

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.88)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:"16px" }}>
      <div style={{ background:V.surface, border:`1px solid ${V.borderHi}`, borderRadius:20, width:"100%", maxWidth:900, maxHeight:"90vh", display:"flex", flexDirection:"column", overflow:"hidden", boxShadow:"0 32px 80px rgba(0,0,0,0.8)" }}>

        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 20px", borderBottom:`1px solid ${V.border}` }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:34, height:34, borderRadius:9, background:V.goldDim, border:`1px solid ${V.goldWire}`, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <TrendingUp size={16} color={V.gold}/>
            </div>
            <div>
              <p style={{ fontSize:14, fontWeight:700, color:V.ink0, margin:0 }}>Stock Comparison</p>
              <p style={{ ...mono, fontSize:9, color:V.ink4, margin:0, textTransform:"uppercase", letterSpacing:"0.1em" }}>Normalized performance · {range}d</p>
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            {/* Range toggles */}
            {([30, 90, 180] as const).map(r => (
              <button key={r} onClick={() => setRange(r)}
                style={{ ...mono, fontSize:10, padding:"4px 10px", borderRadius:7, border:`1px solid ${range===r?V.goldWire:V.border}`, background:range===r?V.goldDim:"transparent", color:range===r?V.gold:V.ink3, cursor:"pointer" }}>
                {r === 30 ? "1M" : r === 90 ? "3M" : "6M"}
              </button>
            ))}
            <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:V.ink3, padding:6, display:"flex", borderRadius:7 }}>
              <X size={16}/>
            </button>
          </div>
        </div>

        {/* Stock chips */}
        <div style={{ display:"flex", alignItems:"center", gap:8, padding:"12px 20px", borderBottom:`1px solid ${V.border}`, flexWrap:"wrap" }}>
          {stocks.map(s => {
            const up = s.changePct >= 0;
            return (
              <div key={s.ticker} style={{ display:"flex", alignItems:"center", gap:7, padding:"6px 10px", borderRadius:9, background:`${s.color}12`, border:`1px solid ${s.color}30` }}>
                <div style={{ width:8, height:8, borderRadius:"50%", background:s.color, flexShrink:0 }}/>
                <span style={{ ...mono, fontSize:12, fontWeight:600, color:s.color }}>{s.ticker}</span>
                <span style={{ fontSize:10, color:V.ink3 }}>{s.name}</span>
                <span style={{ ...mono, fontSize:10, color: up ? V.gain : V.loss }}>{up ? "+" : ""}{s.changePct.toFixed(1)}%</span>
                {stocks.length > 1 && (
                  <button onClick={() => removeStock(s.ticker)} style={{ background:"none", border:"none", cursor:"pointer", color:V.ink3, padding:0, display:"flex", marginLeft:2 }}>
                    <X size={11}/>
                  </button>
                )}
              </div>
            );
          })}

          {/* Add stock */}
          {stocks.length < 6 && (
            <div style={{ position:"relative" }}>
              <button onClick={() => setShowSearch(s => !s)} disabled={adding}
                style={{ display:"flex", alignItems:"center", gap:5, padding:"6px 12px", borderRadius:9, background:"rgba(255,255,255,0.04)", border:`1px solid ${V.border}`, color:V.ink2, cursor:"pointer", fontSize:11, fontFamily:"'Syne',system-ui,sans-serif" }}>
                {adding ? "Adding..." : <><Plus size={12}/> Add Stock</>}
              </button>
              {showSearch && (
                <div style={{ position:"absolute", top:"calc(100% + 6px)", left:0, width:260, background:V.raised, border:`1px solid ${V.borderHi}`, borderRadius:12, overflow:"hidden", zIndex:10, boxShadow:"0 16px 48px rgba(0,0,0,0.7)" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:7, padding:"10px 12px", borderBottom:`1px solid ${V.border}` }}>
                    <Search size={12} color={V.ink3}/>
                    <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && search) addStock(search); }}
                      placeholder="Ticker or company..."
                      style={{ background:"transparent", border:"none", outline:"none", color:V.ink0, ...mono, fontSize:13, flex:1 }}/>
                  </div>
                  {suggestions.map(t => (
                    <button key={t} onClick={() => addStock(t)}
                      style={{ display:"flex", alignItems:"center", justifyContent:"space-between", width:"100%", padding:"9px 14px", background:"none", border:"none", cursor:"pointer", borderBottom:`1px solid rgba(60,48,100,0.3)`, transition:"background 0.15s" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(240,165,0,0.05)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "none")}>
                      <span style={{ ...mono, fontSize:12, fontWeight:600, color:V.gold }}>{t}</span>
                      <span style={{ fontSize:11, color:V.ink3 }}>{NAMES[t]}</span>
                    </button>
                  ))}
                  {search && !suggestions.length && (
                    <button onClick={() => addStock(search)}
                      style={{ display:"flex", alignItems:"center", gap:6, width:"100%", padding:"10px 14px", background:"none", border:"none", cursor:"pointer", color:V.gold, fontSize:12, ...mono }}>
                      <Plus size={11}/> Add {search.toUpperCase()}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Chart */}
        <div style={{ flex:1, padding:"16px 20px 12px", minHeight:0 }}>
          {loading ? (
            <div style={{ height:"100%", minHeight:300, borderRadius:12, background:"linear-gradient(105deg,#0d0b16 30%,#1a1628 50%,#0d0b16 70%)", backgroundSize:"400% 100%", animation:"shimmer 2s ease-in-out infinite" }}/>
          ) : merged.length < 2 ? (
            <div style={{ height:300, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <p style={{ ...mono, fontSize:12, color:V.ink4 }}>Loading chart data...</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={merged} margin={{ top:4, right:8, left:0, bottom:0 }}>
                <CartesianGrid strokeDasharray="2 8" stroke="rgba(255,255,255,0.03)" vertical={false}/>
                <XAxis dataKey="date" tick={{ fill:V.ink4, fontSize:8, fontFamily:"DM Mono" }} tickLine={false} axisLine={false} interval="preserveStartEnd"/>
                <YAxis tick={{ fill:V.ink4, fontSize:8, fontFamily:"DM Mono" }} tickLine={false} axisLine={false}
                  tickFormatter={(v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(0)}%`} width={48}/>
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div style={{ background:"rgba(8,6,16,0.97)", border:`1px solid ${V.borderHi}`, borderRadius:10, padding:"10px 14px" }}>
                        <p style={{ ...mono, fontSize:9, color:V.ink4, marginBottom:6 }}>{label}</p>
                        {payload.map((p, i) => {
                          const stock = stocks.find(s => s.ticker === p.dataKey);
                          const val = p.value as number;
                          return (
                            <div key={i} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
                              <div style={{ width:8, height:8, borderRadius:"50%", background:stock?.color ?? "#fff", flexShrink:0 }}/>
                              <span style={{ ...mono, fontSize:11, color:stock?.color ?? V.ink0, fontWeight:600 }}>{p.dataKey}</span>
                              <span style={{ ...mono, fontSize:11, color: val >= 0 ? V.gain : V.loss }}>{val >= 0 ? "+" : ""}{val?.toFixed(2)}%</span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  }}
                />
                {stocks.map(s => (
                  <Line key={s.ticker} type="monotone" dataKey={s.ticker}
                    stroke={s.color} strokeWidth={2} dot={false}
                    connectNulls activeDot={{ r:5, fill:s.color, stroke:"#050407", strokeWidth:2 }}/>
                ))}
                {/* Zero line */}
                <Line dataKey={() => 0} stroke="rgba(255,255,255,0.08)" strokeWidth={1} strokeDasharray="4 4" dot={false} legendType="none"/>
              </LineChart>
            </ResponsiveContainer>
          )}
          <p style={{ ...mono, fontSize:9, color:V.ink4, margin:"8px 0 0", textAlign:"center" }}>
            Normalized to 0% at start of period · Not financial advice
          </p>
        </div>
      </div>

      <style>{`@keyframes shimmer{0%{background-position:-400% 0}100%{background-position:400% 0}}`}</style>
    </div>
  );
}
