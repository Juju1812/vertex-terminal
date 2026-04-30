"use client";

import { useState, useEffect, useCallback } from "react";
import { Calendar, TrendingUp, TrendingDown, Clock, AlertTriangle, ExternalLink, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";

/* ---- Types -------------------------------------------------- */
interface EarningsEvent {
  ticker: string;
  name: string;
  sector: string;
  date: string;        // YYYY-MM-DD
  isEstimated: boolean;
  epsActual: number | null;
  epsEstimate: number | null;
  isUpcoming: boolean;
}

interface Props { onSelectTicker?: (ticker: string) => void; }

/* ---- Universe --------------------------------------------- */
const UNI = [
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
  { t:"JPM",   n:"JPMorgan Chase",          s:"Financials"  },
  { t:"V",     n:"Visa Inc.",               s:"Financials"  },
  { t:"MA",    n:"Mastercard Inc.",         s:"Financials"  },
  { t:"BAC",   n:"Bank of America",         s:"Financials"  },
  { t:"GS",    n:"Goldman Sachs",           s:"Financials"  },
  { t:"COIN",  n:"Coinbase Global",         s:"Financials"  },
  { t:"AMZN",  n:"Amazon.com",              s:"Consumer"    },
  { t:"TSLA",  n:"Tesla Inc.",              s:"Consumer"    },
  { t:"NKE",   n:"Nike Inc.",               s:"Consumer"    },
  { t:"SBUX",  n:"Starbucks Corp.",         s:"Consumer"    },
  { t:"RIVN",  n:"Rivian Automotive",       s:"Consumer"    },
  { t:"LCID",  n:"Lucid Group",             s:"Consumer"    },
  { t:"UNH",   n:"UnitedHealth Group",      s:"Healthcare"  },
  { t:"LLY",   n:"Eli Lilly & Co.",         s:"Healthcare"  },
  { t:"PFE",   n:"Pfizer Inc.",             s:"Healthcare"  },
  { t:"MRNA",  n:"Moderna Inc.",            s:"Healthcare"  },
  { t:"ABBV",  n:"AbbVie Inc.",             s:"Healthcare"  },
  { t:"NVO",   n:"Novo Nordisk (ADR)",      s:"Healthcare"  },
  { t:"PLTR",  n:"Palantir Tech.",          s:"Technology"  },
  { t:"CRWD",  n:"CrowdStrike",             s:"Technology"  },
  { t:"PANW",  n:"Palo Alto Networks",      s:"Technology"  },
  { t:"NET",   n:"Cloudflare Inc.",         s:"Technology"  },
  { t:"SNOW",  n:"Snowflake Inc.",          s:"Technology"  },
  { t:"XOM",   n:"ExxonMobil Corp.",        s:"Energy"      },
  { t:"CVX",   n:"Chevron Corp.",           s:"Energy"      },
  { t:"OXY",   n:"Occidental Petroleum",    s:"Energy"      },
  { t:"TSM",   n:"Taiwan Semi (ADR)",       s:"Technology"  },
  { t:"ASML",  n:"ASML Holding (ADR)",      s:"Technology"  },
  { t:"BABA",  n:"Alibaba Group (ADR)",     s:"Consumer"    },
  { t:"MSTR",  n:"MicroStrategy Inc.",      s:"Technology"  },
  { t:"SIRI",  n:"Sirius XM Holdings",      s:"Consumer"    },
  { t:"GBTC",  n:"Grayscale Bitcoin Tr.",   s:"Financials"  },
];

const POLYGON_KEY = "1xwzcvUOF9pft6PRNylO2Xc6X2QeQCGr";

/* ---- Design tokens ----------------------------------------- */
const V = {
  w1:"var(--border,rgba(60,48,100,0.4))",
  w2:"var(--border-hi,rgba(90,72,150,0.5))",
  ink0:"var(--ink0,#f4f0ff)",
  ink1:"var(--ink1,#cdc7e0)",
  ink2:"var(--ink2,#8a82a8)",
  ink3:"var(--ink3,#4a4468)",
  ink4:"var(--ink4,#2d2848)",
  gain:"var(--gain,#00e5a0)",
  gainDim:"var(--gain-dim,rgba(0,229,160,0.08))",
  gainWire:"var(--gain-wire,rgba(0,229,160,0.22))",
  loss:"var(--loss,#ff4560)",
  lossDim:"var(--loss-dim,rgba(255,69,96,0.08))",
  lossWire:"var(--loss-wire,rgba(255,69,96,0.22))",
  arc:"#7eb6ff",  arcDim:"rgba(126,182,255,0.08)", arcWire:"rgba(126,182,255,0.22)",
  gold:"var(--gold,#f0a500)",
  goldDim:"var(--gold-dim,rgba(240,165,0,0.10))",
  goldWire:"var(--gold-wire,rgba(240,165,0,0.28))",
};
const mono: React.CSSProperties = { fontFamily:"'DM Mono','Courier New',monospace" };
const glass = (ex?: React.CSSProperties): React.CSSProperties => ({
  background:"linear-gradient(145deg,rgba(255,255,255,0.032) 0%,rgba(255,255,255,0.010) 100%)",
  border:`1px solid ${V.w1}`, borderRadius:16,
  boxShadow:"0 4px 24px rgba(0,0,0,0.55)",
  position:"relative" as const, ...ex,
});

const SECTOR_COLOR: Record<string,string> = {
  Technology:"#7eb6ff", Financials:"#c084fc", Healthcare:"#00e5a0",
  Consumer:"#f0a500", Energy:"#fb923c",
};

/* ---- Helpers ---------------------------------------------- */
function formatDate(d: string): string {
  return new Date(d + "T12:00:00").toLocaleDateString("en-US", { weekday:"short", month:"short", day:"numeric" });
}

function daysUntil(d: string): number {
  const today = new Date(); today.setHours(0,0,0,0);
  const target = new Date(d + "T00:00:00"); target.setHours(0,0,0,0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function getGroupLabel(d: string): string {
  const days = daysUntil(d);
  if (days < 0) return "Past";
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days <= 7) return "This Week";
  if (days <= 14) return "Next Week";
  return "Upcoming";
}

/* ---- Fetch real earnings dates from Polygon --------------- */
async function fetchEarningsForTicker(ticker: string, name: string, sector: string): Promise<EarningsEvent | null> {
  try {
    // Get last 2 quarterly filings to calculate next expected date
    const r = await fetch(
      `https://api.polygon.io/vX/reference/financials?ticker=${ticker}&timeframe=quarterly&limit=4&sort=filing_date&order=desc&apiKey=${POLYGON_KEY}`
    );
    if (!r.ok) return null;

    const d = await r.json() as {
      results?: Array<{
        filing_date: string;
        period_of_report_date: string;
        financials?: {
          income_statement?: {
            basic_earnings_per_share?: { value: number };
          };
        };
      }>;
    };

    const results = d.results ?? [];
    if (!results.length) return null;

    const latest = results[0];
    const epsActual = latest.financials?.income_statement?.basic_earnings_per_share?.value ?? null;

    // Calculate average days between filings to estimate next date accurately
    let avgInterval = 91; // default ~quarter
    if (results.length >= 2) {
      const intervals: number[] = [];
      for (let i = 0; i < results.length - 1; i++) {
        const a = new Date(results[i].filing_date).getTime();
        const b = new Date(results[i + 1].filing_date).getTime();
        intervals.push((a - b) / 86400000);
      }
      avgInterval = Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length);
    }

    // Next expected filing date
    const lastFiling = new Date(latest.filing_date);
    const nextDate = new Date(lastFiling.getTime() + avgInterval * 86400000);
    const nextDateStr = nextDate.toISOString().split("T")[0];
    const today = new Date().toISOString().split("T")[0];
    const isUpcoming = nextDateStr >= today;

    return {
      ticker, name, sector,
      date: isUpcoming ? nextDateStr : latest.filing_date,
      isEstimated: isUpcoming,
      epsActual: isUpcoming ? null : epsActual,
      epsEstimate: null,
      isUpcoming,
    };
  } catch { return null; }
}

/* ---- EarningsRow ------------------------------------------ */
function EarningsRow({ event, onClick }: { event: EarningsEvent; onClick: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const days = daysUntil(event.date);
  const sc   = SECTOR_COLOR[event.sector] ?? V.arc;
  const urgencyColor = days === 0 ? V.gain : days === 1 ? V.gold : days <= 7 ? V.arc : V.ink2;

  return (
    <div style={{ borderBottom:`1px solid ${V.w1}` }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 16px", cursor:"pointer", transition:"background 0.15s" }}
        onMouseEnter={e => (e.currentTarget.style.background = "rgba(240,165,0,0.03)")}
        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
        onClick={() => setExpanded(e => !e)}>

        {/* Date badge */}
        <div style={{ minWidth:76, textAlign:"center", padding:"6px 8px", borderRadius:10, background: days <= 1 ? `${urgencyColor}15` : "rgba(255,255,255,0.03)", border:`1px solid ${days <= 1 ? `${urgencyColor}30` : V.w1}` }}>
          <p style={{ ...mono, fontSize:9, color:urgencyColor, fontWeight:600, margin:0 }}>
            {days === 0 ? "TODAY" : days === 1 ? "TMRW" : formatDate(event.date).split(",")[0].toUpperCase()}
          </p>
          <p style={{ ...mono, fontSize:10, color:V.ink0, margin:0, marginTop:1 }}>
            {days <= 1 ? formatDate(event.date).split(", ")[1] : formatDate(event.date).replace(/\w+, /, "")}
          </p>
          {event.isEstimated && <p style={{ ...mono, fontSize:7, color:V.ink4, margin:0 }}>EST.</p>}
        </div>

        {/* Ticker + name */}
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:2, flexWrap:"wrap" }}>
            <button onClick={e => { e.stopPropagation(); onClick(); }}
              style={{ ...mono, fontSize:14, fontWeight:700, color:V.gold, background:"none", border:"none", cursor:"pointer", padding:0 }}>
              {event.ticker}
            </button>
            <span style={{ ...mono, fontSize:8, padding:"2px 6px", borderRadius:4, background:`${sc}15`, color:sc, border:`1px solid ${sc}22` }}>
              {event.sector}
            </span>
          </div>
          <p style={{ fontSize:11, color:V.ink3, margin:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{event.name}</p>
        </div>

        {/* EPS / days away */}
        <div style={{ textAlign:"right", minWidth:80, flexShrink:0 }}>
          {event.isUpcoming ? (
            <div>
              <p style={{ ...mono, fontSize:9, color:V.ink4, margin:0, textTransform:"uppercase" }}>Est. date</p>
              <p style={{ ...mono, fontSize:12, color:V.ink2, margin:0, marginTop:2 }}>~{days}d</p>
            </div>
          ) : event.epsActual !== null ? (
            <div>
              <p style={{ ...mono, fontSize:9, color:V.ink4, margin:0, textTransform:"uppercase" }}>EPS</p>
              <p style={{ ...mono, fontSize:13, fontWeight:600, color: event.epsActual >= 0 ? V.gain : V.loss, margin:0, marginTop:2 }}>
                {event.epsActual >= 0 ? "+" : ""}{event.epsActual.toFixed(2)}
              </p>
            </div>
          ) : null}
        </div>

        <div style={{ color:V.ink4, flexShrink:0 }}>
          {expanded ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}
        </div>
      </div>

      {expanded && (
        <div style={{ padding:"0 16px 14px", display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
          <a href={`https://finance.yahoo.com/quote/${event.ticker}`} target="_blank" rel="noopener noreferrer"
            style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"6px 12px", borderRadius:8, background:V.goldDim, border:`1px solid ${V.goldWire}`, color:V.gold, textDecoration:"none", fontSize:11, ...mono }}>
            <ExternalLink size={10}/> Yahoo Finance
          </a>
          <button onClick={onClick}
            style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"6px 12px", borderRadius:8, background:"rgba(255,255,255,0.03)", border:`1px solid ${V.w1}`, color:V.ink2, cursor:"pointer", fontSize:11, ...mono }}>
            View Chart
          </button>
          {event.isEstimated && (
            <div style={{ display:"flex", gap:6, alignItems:"center", padding:"6px 10px", borderRadius:8, background:"rgba(240,165,0,0.06)", border:`1px solid ${V.goldWire}` }}>
              <AlertTriangle size={10} color={V.gold}/>
              <span style={{ ...mono, fontSize:9, color:V.gold }}>Estimated — verify on IR page</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---- Main Component --------------------------------------- */
export default function EarningsCalendar({ onSelectTicker }: Props) {
  const [events,    setEvents]    = useState<EarningsEvent[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [filter,    setFilter]    = useState<"all"|"upcoming"|"recent">("all");
  const [sectorFilter, setSectorFilter] = useState("All");

  const load = useCallback(async () => {
    setLoading(true);
    const results: EarningsEvent[] = [];
    const BATCH = 5;
    for (let i = 0; i < UNI.length; i += BATCH) {
      const batch = UNI.slice(i, i + BATCH);
      const batchResults = await Promise.all(
        batch.map(s => fetchEarningsForTicker(s.t, s.n, s.s))
      );
      results.push(...batchResults.filter((e): e is EarningsEvent => e !== null));
      if (i + BATCH < UNI.length) await new Promise(r => setTimeout(r, 200));
    }

    results.sort((a, b) => {
      const ad = daysUntil(a.date), bd = daysUntil(b.date);
      if (ad >= 0 && bd >= 0) return ad - bd;
      if (ad < 0 && bd < 0) return bd - ad;
      return ad >= 0 ? -1 : 1;
    });

    setEvents(results);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const sectors = ["All", ...Array.from(new Set(UNI.map(s => s.s))).sort()];

  const filtered = events.filter(e => {
    if (filter === "upcoming" && !e.isUpcoming) return false;
    if (filter === "recent"   &&  e.isUpcoming) return false;
    if (sectorFilter !== "All" && e.sector !== sectorFilter) return false;
    return true;
  });

  const groups: Record<string, EarningsEvent[]> = {};
  for (const e of filtered) {
    const label = getGroupLabel(e.date);
    if (!groups[label]) groups[label] = [];
    groups[label].push(e);
  }
  const groupOrder = ["Today","Tomorrow","This Week","Next Week","Upcoming","Past"];

  const upcomingCount  = events.filter(e => e.isUpcoming).length;
  const thisWeekCount  = events.filter(e => { const d = daysUntil(e.date); return d >= 0 && d <= 7; }).length;
  const confirmedCount = events.filter(e => !e.isEstimated).length;

  return (
    <div style={{ padding:"20px 16px", maxWidth:1280, margin:"0 auto" }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20, gap:12, flexWrap:"wrap" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:42, height:42, borderRadius:12, background:V.goldDim, border:`1px solid ${V.goldWire}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <Calendar size={21} color={V.gold}/>
          </div>
          <div>
            <h2 style={{ fontSize:19, fontWeight:700, color:V.ink0, margin:0 }}>Earnings Calendar</h2>
            <p style={{ ...mono, color:V.ink4, fontSize:9, margin:0, marginTop:3, textTransform:"uppercase", letterSpacing:"0.1em" }}>
              {UNI.length} tracked stocks · Polygon.io SEC filings
            </p>
          </div>
        </div>
        <button onClick={load} disabled={loading}
          style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 14px", borderRadius:9, background:"rgba(255,255,255,0.03)", border:`1px solid ${V.w1}`, color:V.ink2, cursor:loading?"not-allowed":"pointer", fontSize:12, fontFamily:"'Syne',system-ui,sans-serif", opacity:loading?0.5:1 }}>
          <RefreshCw size={12} style={{ animation:loading?"spin 1s linear infinite":"none" }}/>
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:8, marginBottom:16 }}>
        {[
          { icon:<Calendar size={13} color={V.gold}/>,    label:"Upcoming",  val:loading?"--":`${upcomingCount}` },
          { icon:<Clock size={13} color={V.arc}/>,        label:"This Week", val:loading?"--":`${thisWeekCount}` },
          { icon:<TrendingUp size={13} color={V.gain}/>,  label:"Tracked",   val:`${UNI.length}` },
          { icon:<AlertTriangle size={13} color={V.gold}/>,label:"Data",     val:"SEC filings" },
        ].map(s=>(
          <div key={s.label} style={{ ...glass({ padding:"11px 14px", display:"flex", alignItems:"center", gap:10 }) }}>
            <div style={{ width:28, height:28, borderRadius:7, background:"rgba(255,255,255,0.04)", border:`1px solid ${V.w1}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>{s.icon}</div>
            <div>
              <p style={{ ...mono, fontSize:8, color:V.ink4, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:2 }}>{s.label}</p>
              <p style={{ ...mono, fontSize:13, fontWeight:500, color:V.ink0 }}>{s.val}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}>
        {(["all","upcoming","recent"] as const).map(f=>(
          <button key={f} onClick={()=>setFilter(f)}
            style={{ ...mono, fontSize:10, padding:"6px 14px", borderRadius:99, border:`1px solid ${filter===f?V.goldWire:V.w1}`, background:filter===f?V.goldDim:"rgba(255,255,255,0.02)", color:filter===f?V.gold:V.ink3, cursor:"pointer", textTransform:"capitalize", letterSpacing:"0.04em" }}>
            {f==="all"?"All":f==="upcoming"?"Upcoming":"Recent"}
          </button>
        ))}
        <div style={{ width:1, background:V.w1, margin:"0 4px" }}/>
        {sectors.map(s=>(
          <button key={s} onClick={()=>setSectorFilter(s)}
            style={{ ...mono, fontSize:10, padding:"6px 14px", borderRadius:99, border:`1px solid ${sectorFilter===s?`${SECTOR_COLOR[s]??V.arc}44`:V.w1}`, background:sectorFilter===s?`${SECTOR_COLOR[s]??V.arc}10`:"rgba(255,255,255,0.02)", color:sectorFilter===s?(SECTOR_COLOR[s]??V.arc):V.ink3, cursor:"pointer" }}>
            {s}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          <p style={{ ...mono, fontSize:11, color:V.ink4, marginBottom:8 }}>Fetching earnings data for {UNI.length} stocks...</p>
          {[...Array(5)].map((_,i)=>(
            <div key={i} style={{ height:68, borderRadius:12, background:"linear-gradient(105deg,#0d0b16 30%,#1a1628 50%,#0d0b16 70%)", backgroundSize:"400% 100%", animation:"shimmer 2s ease-in-out infinite", animationDelay:`${i*0.1}s` }}/>
          ))}
          <style>{`@keyframes shimmer{0%{background-position:-400% 0}100%{background-position:400% 0}}`}</style>
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div style={{ ...glass({ padding:"32px 24px", textAlign:"center" }) }}>
          <p style={{ color:V.ink3, fontSize:14 }}>No earnings events match your filters.</p>
        </div>
      )}

      {/* Grouped events */}
      {!loading && groupOrder.filter(g => groups[g]?.length).map(groupLabel => (
        <div key={groupLabel} style={{ marginBottom:20 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
            <div style={{ height:1, flex:1, background:V.w1 }}/>
            <span style={{ ...mono, fontSize:9, color: groupLabel==="Today"?V.gain:groupLabel==="Tomorrow"?V.gold:groupLabel==="Past"?V.ink4:V.arc, textTransform:"uppercase", letterSpacing:"0.12em", fontWeight:600 }}>
              {groupLabel} ({groups[groupLabel].length})
            </span>
            <div style={{ height:1, flex:1, background:V.w1 }}/>
          </div>
          <div style={{ ...glass({ overflow:"hidden" }) }}>
            {groups[groupLabel].map(e => (
              <EarningsRow key={e.ticker} event={e} onClick={() => onSelectTicker?.(e.ticker)}/>
            ))}
          </div>
        </div>
      ))}

      <p style={{ ...mono, fontSize:9, color:V.ink4, lineHeight:1.7, marginTop:8 }}>
        Dates are calculated from Polygon.io SEC filing history. Estimated upcoming dates are based on average filing intervals.
        Always verify on the company's investor relations page before trading. Not financial advice.
      </p>

      <style>{`
        @keyframes shimmer{0%{background-position:-400% 0}100%{background-position:400% 0}}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>
    </div>
  );
}
