"use client";

import { useState, useEffect } from "react";
import { Calendar, TrendingUp, TrendingDown, Clock, AlertTriangle, ExternalLink, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";

/* ---- Types -------------------------------------------------- */
interface EarningsEvent {
  ticker: string;
  name: string;
  sector: string;
  date: string;       // YYYY-MM-DD
  time: "pre" | "post" | "unknown";
  epsEstimate: number | null;
  epsActual: number | null;
  revEstimate: number | null;
  surprise: number | null; // % surprise
  isUpcoming: boolean;
}

interface Props { onSelectTicker?: (ticker: string) => void; }

/* ---- Universe (same as Top15) ------------------------------ */
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
  { t:"UNH",   n:"UnitedHealth Group",      s:"Healthcare"  },
  { t:"LLY",   n:"Eli Lilly & Co.",         s:"Healthcare"  },
  { t:"PFE",   n:"Pfizer Inc.",             s:"Healthcare"  },
  { t:"MRNA",  n:"Moderna Inc.",            s:"Healthcare"  },
  { t:"ABBV",  n:"AbbVie Inc.",             s:"Healthcare"  },
  { t:"PLTR",  n:"Palantir Tech.",          s:"Technology"  },
  { t:"CRWD",  n:"CrowdStrike",             s:"Technology"  },
  { t:"PANW",  n:"Palo Alto Networks",      s:"Technology"  },
  { t:"NET",   n:"Cloudflare Inc.",         s:"Technology"  },
  { t:"SNOW",  n:"Snowflake Inc.",          s:"Technology"  },
  { t:"XOM",   n:"ExxonMobil Corp.",        s:"Energy"      },
  { t:"CVX",   n:"Chevron Corp.",           s:"Energy"      },
  { t:"MSTR",  n:"MicroStrategy Inc.",      s:"Technology"  },
  { t:"SIRI",  n:"Sirius XM Holdings",      s:"Consumer"    },
];

const POLYGON_KEY = "1xwzcvUOF9pft6PRNylO2Xc6X2QeQCGr";

/* ---- Design tokens ----------------------------------------- */
const V = {
  d0:"#050810",
  w1:"rgba(130,180,255,0.055)", w2:"rgba(130,180,255,0.10)",
  ink0:"#F2F6FF", ink1:"#C8D5E8", ink2:"#7A9CBF", ink3:"#3D5A7A", ink4:"#1F3550",
  gain:"#00C896", gainDim:"rgba(0,200,150,0.08)", gainWire:"rgba(0,200,150,0.20)",
  loss:"#E8445A", lossDim:"rgba(232,68,90,0.08)", lossWire:"rgba(232,68,90,0.20)",
  arc:"#4F8EF7", arcDim:"rgba(79,142,247,0.08)", arcWire:"rgba(79,142,247,0.22)",
  gold:"#E8A030", goldDim:"rgba(232,160,48,0.08)", goldWire:"rgba(232,160,48,0.20)",
  ame:"#9B72F5", ameDim:"rgba(155,114,245,0.08)", ameWire:"rgba(155,114,245,0.22)",
};
const mono: React.CSSProperties = { fontFamily:"'Geist Mono','Courier New',monospace" };
const glass = (ex?: React.CSSProperties): React.CSSProperties => ({
  background: "linear-gradient(145deg,rgba(255,255,255,0.028) 0%,rgba(255,255,255,0.010) 100%)",
  border: `1px solid ${V.w2}`, borderRadius: 14,
  boxShadow: "0 4px 16px rgba(0,0,0,0.45)",
  position: "relative" as const, ...ex,
});

const SECTOR_COLOR: Record<string, string> = {
  Technology:"#4F8EF7", Financials:"#9B72F5",
  Healthcare:"#00C896", Consumer:"#E8A030", Energy:"#F97316",
};

/* ---- Helpers ----------------------------------------------- */
function formatDate(d: string): string {
  const date = new Date(d + "T12:00:00");
  return date.toLocaleDateString("en-US", { weekday:"short", month:"short", day:"numeric" });
}

function daysUntil(d: string): number {
  const today = new Date(); today.setHours(0,0,0,0);
  const target = new Date(d + "T00:00:00"); target.setHours(0,0,0,0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function getWeekLabel(d: string): string {
  const days = daysUntil(d);
  if (days < 0) return "Past";
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days <= 7) return "This Week";
  if (days <= 14) return "Next Week";
  return "Upcoming";
}

/* ---- Fetch earnings from Polygon --------------------------- */
async function fetchEarningsForTicker(ticker: string, name: string, sector: string): Promise<EarningsEvent | null> {
  try {
    // Get last reported financials
    const r = await fetch(
      `https://api.polygon.io/vX/reference/financials?ticker=${ticker}&timeframe=quarterly&limit=2&sort=filing_date&order=desc&apiKey=${POLYGON_KEY}`
    );
    if (!r.ok) return null;
    const d = await r.json() as {
      results?: Array<{
        fiscal_period: string;
        fiscal_year: string;
        filing_date: string;
        financials?: {
          income_statement?: {
            basic_earnings_per_share?: { value: number };
            revenues?: { value: number };
          }
        }
      }>
    };

    const results = d.results ?? [];
    const latest = results[0];
    if (!latest) return null;

    const epsActual = latest.financials?.income_statement?.basic_earnings_per_share?.value ?? null;
    const revActual = latest.financials?.income_statement?.revenues?.value ?? null;

    // Estimate next earnings date (~90 days after last filing)
    const lastFiling = new Date(latest.filing_date);
    const nextEarnings = new Date(lastFiling);
    nextEarnings.setDate(nextEarnings.getDate() + 90);
    const nextDate = nextEarnings.toISOString().split("T")[0];

    const today = new Date().toISOString().split("T")[0];
    const isUpcoming = nextDate >= today;

    return {
      ticker, name, sector,
      date: isUpcoming ? nextDate : latest.filing_date,
      time: "unknown",
      epsEstimate: null,
      epsActual: isUpcoming ? null : epsActual,
      revEstimate: null,
      surprise: null,
      isUpcoming,
    };
  } catch { return null; }
}

/* ---- EarningsRow component --------------------------------- */
function EarningsRow({ event, onClick }: { event: EarningsEvent; onClick: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const days = daysUntil(event.date);
  const sc = SECTOR_COLOR[event.sector] ?? V.arc;
  const urgency = days === 0 ? V.gain : days === 1 ? V.gold : days <= 7 ? V.arc : V.ink2;
  const hasSurprise = event.surprise !== null;

  return (
    <div style={{ borderBottom:`1px solid ${V.w1}` }}>
      <div
        style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 16px", cursor:"pointer", transition:"background 0.15s" }}
        onMouseEnter={e => (e.currentTarget.style.background = "rgba(130,180,255,0.03)")}
        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
        onClick={() => setExpanded(e => !e)}
      >
        {/* Date badge */}
        <div style={{ minWidth:72, textAlign:"center", padding:"6px 8px", borderRadius:9, background: days <= 1 ? `${urgency}15` : "rgba(255,255,255,0.03)", border:`1px solid ${days <= 1 ? `${urgency}30` : V.w1}` }}>
          <p style={{ ...mono, fontSize:9, color: urgency, fontWeight:600, margin:0 }}>
            {days === 0 ? "TODAY" : days === 1 ? "TOMORROW" : formatDate(event.date).split(",")[0].toUpperCase()}
          </p>
          <p style={{ ...mono, fontSize:11, color:V.ink0, margin:0, marginTop:1 }}>
            {days === 0 || days === 1 ? formatDate(event.date).split(", ")[1] : formatDate(event.date).replace(/\w+, /, "")}
          </p>
        </div>

        {/* Ticker + name */}
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:2, flexWrap:"wrap" }}>
            <button
              onClick={e => { e.stopPropagation(); onClick(); }}
              style={{ ...mono, fontSize:14, fontWeight:600, color:"#7EB6FF", background:"none", border:"none", cursor:"pointer", padding:0 }}>
              {event.ticker}
            </button>
            <span style={{ ...mono, fontSize:8, padding:"2px 6px", borderRadius:4, background:`${sc}15`, color:sc, border:`1px solid ${sc}22` }}>
              {event.sector}
            </span>
            {event.time !== "unknown" && (
              <span style={{ ...mono, fontSize:8, color:V.ink4, display:"flex", alignItems:"center", gap:3 }}>
                <Clock size={9} />{event.time === "pre" ? "Pre-market" : "After-hours"}
              </span>
            )}
          </div>
          <p style={{ fontSize:12, color:V.ink3, margin:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{event.name}</p>
        </div>

        {/* EPS */}
        <div style={{ textAlign:"right", minWidth:80, flexShrink:0 }}>
          {event.isUpcoming ? (
            <div>
              <p style={{ ...mono, fontSize:9, color:V.ink4, margin:0, textTransform:"uppercase", letterSpacing:"0.08em" }}>Est. Date</p>
              <p style={{ ...mono, fontSize:11, color:V.ink2, margin:0, marginTop:2 }}>~{days}d</p>
            </div>
          ) : event.epsActual !== null ? (
            <div>
              <p style={{ ...mono, fontSize:9, color:V.ink4, margin:0, textTransform:"uppercase", letterSpacing:"0.08em" }}>EPS</p>
              <p style={{ ...mono, fontSize:13, fontWeight:600, color: event.epsActual >= 0 ? V.gain : V.loss, margin:0, marginTop:2 }}>
                {event.epsActual >= 0 ? "+" : ""}{event.epsActual.toFixed(2)}
              </p>
            </div>
          ) : null}
        </div>

        {/* Surprise */}
        {hasSurprise && (
          <div style={{ textAlign:"right", minWidth:60, flexShrink:0 }}>
            <p style={{ ...mono, fontSize:9, color:V.ink4, margin:0, textTransform:"uppercase", letterSpacing:"0.08em" }}>Beat</p>
            <p style={{ ...mono, fontSize:12, fontWeight:600, color: event.surprise! >= 0 ? V.gain : V.loss, margin:0, marginTop:2 }}>
              {event.surprise! >= 0 ? "+" : ""}{event.surprise!.toFixed(1)}%
            </p>
          </div>
        )}

        {/* Expand icon */}
        <div style={{ color:V.ink4, flexShrink:0 }}>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ padding:"0 16px 16px", display:"flex", gap:10, flexWrap:"wrap" }}>
          <a
            href={`https://finance.yahoo.com/quote/${event.ticker}`}
            target="_blank" rel="noopener noreferrer"
            style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"6px 12px", borderRadius:8, background:V.arcDim, border:`1px solid ${V.arcWire}`, color:"#7EB6FF", textDecoration:"none", fontSize:11, fontFamily:"'Geist Mono',monospace" }}>
            <ExternalLink size={11} /> Yahoo Finance
          </a>
          <button
            onClick={onClick}
            style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"6px 12px", borderRadius:8, background:"rgba(255,255,255,0.03)", border:`1px solid ${V.w2}`, color:V.ink2, cursor:"pointer", fontSize:11, fontFamily:"'Geist Mono',monospace" }}>
            View Chart
          </button>
          <div style={{ ...mono, fontSize:10, color:V.ink4, display:"flex", alignItems:"center", gap:4, padding:"6px 12px", background:"rgba(255,255,255,0.02)", borderRadius:8, border:`1px solid ${V.w1}` }}>
            <AlertTriangle size={10} />
            {event.isUpcoming ? "Estimated date based on last filing. Confirm on company IR page." : "Historical earnings data from SEC filings."}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---- Main Component ---------------------------------------- */
export default function EarningsCalendar({ onSelectTicker }: Props) {
  const [events, setEvents] = useState<EarningsEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "upcoming" | "recent">("all");
  const [sectorFilter, setSectorFilter] = useState<string>("All");

  const load = async () => {
    setLoading(true);
    const BATCH = 6;
    const results: EarningsEvent[] = [];
    for (let i = 0; i < UNI.length; i += BATCH) {
      const batch = UNI.slice(i, i + BATCH);
      const batchResults = await Promise.all(
        batch.map(s => fetchEarningsForTicker(s.t, s.n, s.s))
      );
      results.push(...batchResults.filter((e): e is EarningsEvent => e !== null));
      if (i + BATCH < UNI.length) await new Promise(r => setTimeout(r, 200));
    }
    // Sort by date
    results.sort((a, b) => {
      const ad = daysUntil(a.date), bd = daysUntil(b.date);
      // Upcoming first (sorted ascending), then recent (sorted descending)
      if (ad >= 0 && bd >= 0) return ad - bd;
      if (ad < 0 && bd < 0) return bd - ad;
      return ad >= 0 ? -1 : 1;
    });
    setEvents(results);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const sectors = ["All", ...Array.from(new Set(UNI.map(s => s.s))).sort()];

  const filtered = events.filter(e => {
    if (filter === "upcoming" && !e.isUpcoming) return false;
    if (filter === "recent" && e.isUpcoming) return false;
    if (sectorFilter !== "All" && e.sector !== sectorFilter) return false;
    return true;
  });

  // Group by week label
  const groups: Record<string, EarningsEvent[]> = {};
  for (const e of filtered) {
    const label = getWeekLabel(e.date);
    if (!groups[label]) groups[label] = [];
    groups[label].push(e);
  }
  const groupOrder = ["Today", "Tomorrow", "This Week", "Next Week", "Upcoming", "Past"];

  const upcomingCount = events.filter(e => e.isUpcoming).length;
  const thisWeekCount = events.filter(e => { const d = daysUntil(e.date); return d >= 0 && d <= 7; }).length;

  return (
    <div style={{ padding:"20px 16px", maxWidth:1280, margin:"0 auto" }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20, gap:12, flexWrap:"wrap" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:42, height:42, borderRadius:12, background:"rgba(232,160,48,0.10)", border:`1px solid ${V.goldWire}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <Calendar size={21} color={V.gold} />
          </div>
          <div>
            <h2 style={{ fontSize:19, fontWeight:700, color:V.ink0, margin:0 }}>Earnings Calendar</h2>
            <p style={{ ...mono, color:V.ink4, fontSize:9, margin:0, marginTop:3, textTransform:"uppercase", letterSpacing:"0.08em" }}>
              Upcoming & recent earnings — {UNI.length} tracked stocks
            </p>
          </div>
        </div>
        <button onClick={load} disabled={loading}
          style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 14px", borderRadius:9, background:"rgba(255,255,255,0.03)", border:`1px solid ${V.w1}`, color:V.ink2, cursor: loading ? "not-allowed" : "pointer", fontSize:12, fontFamily:"'Bricolage Grotesque',system-ui,sans-serif", opacity: loading ? 0.5 : 1 }}>
          <RefreshCw size={12} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:8, marginBottom:16 }}>
        {[
          { icon:<Calendar size={13} color={V.gold} />,     label:"Upcoming",       val: loading ? "--" : `${upcomingCount}` },
          { icon:<Clock size={13} color={V.arc} />,         label:"This Week",      val: loading ? "--" : `${thisWeekCount}` },
          { icon:<TrendingUp size={13} color={V.gain} />,   label:"Tracked Stocks", val:`${UNI.length}` },
          { icon:<AlertTriangle size={13} color={V.gold} />,label:"Note",           val:"Est. dates" },
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

      {/* Filters */}
      <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}>
        {(["all","upcoming","recent"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ ...mono, fontSize:10, padding:"6px 14px", borderRadius:99, border:`1px solid ${filter === f ? V.arcWire : V.w1}`, background: filter === f ? V.arcDim : "rgba(255,255,255,0.02)", color: filter === f ? "#7EB6FF" : V.ink3, cursor:"pointer", textTransform:"capitalize", letterSpacing:"0.04em" }}>
            {f === "all" ? "All" : f === "upcoming" ? "Upcoming" : "Recent"}
          </button>
        ))}
        <div style={{ width:1, background:V.w1, margin:"0 4px" }} />
        {sectors.map(s => (
          <button key={s} onClick={() => setSectorFilter(s)}
            style={{ ...mono, fontSize:10, padding:"6px 14px", borderRadius:99, border:`1px solid ${sectorFilter === s ? `${SECTOR_COLOR[s] ?? V.arc}44` : V.w1}`, background: sectorFilter === s ? `${SECTOR_COLOR[s] ?? V.arc}10` : "rgba(255,255,255,0.02)", color: sectorFilter === s ? (SECTOR_COLOR[s] ?? "#7EB6FF") : V.ink3, cursor:"pointer", letterSpacing:"0.04em" }}>
            {s}
          </button>
        ))}
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          <p style={{ ...mono, fontSize:11, color:V.ink4, marginBottom:8 }}>Fetching earnings data for {UNI.length} stocks...</p>
          {[...Array(6)].map((_, i) => (
            <div key={i} style={{ height:68, borderRadius:12, background:"linear-gradient(105deg,#0C1220 30%,#151F30 50%,#0C1220 70%)", backgroundSize:"400% 100%", animation:"shimmer 2s ease-in-out infinite" }} />
          ))}
        </div>
      )}

      {/* Events grouped by week */}
      {!loading && filtered.length === 0 && (
        <div style={{ ...glass({ padding:"32px 24px", textAlign:"center" }) }}>
          <p style={{ color:V.ink3, fontSize:14 }}>No earnings events match your filters.</p>
        </div>
      )}

      {!loading && groupOrder.filter(g => groups[g]?.length).map(groupLabel => (
        <div key={groupLabel} style={{ marginBottom:20 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
            <div style={{ height:1, flex:1, background:V.w1 }} />
            <span style={{ ...mono, fontSize:9, color: groupLabel === "Today" ? V.gain : groupLabel === "Tomorrow" ? V.gold : groupLabel === "Past" ? V.ink4 : V.arc, textTransform:"uppercase", letterSpacing:"0.12em", fontWeight:600 }}>
              {groupLabel} ({groups[groupLabel].length})
            </span>
            <div style={{ height:1, flex:1, background:V.w1 }} />
          </div>
          <div style={{ ...glass({ overflow:"hidden" }) }}>
            {groups[groupLabel].map(e => (
              <EarningsRow
                key={e.ticker}
                event={e}
                onClick={() => onSelectTicker?.(e.ticker)}
              />
            ))}
          </div>
        </div>
      ))}

      <p style={{ ...mono, fontSize:9, color:V.ink4, lineHeight:1.7, marginTop:8 }}>
        Upcoming dates are estimated based on last SEC filing date + ~90 days. Always verify on the company investor relations page. Data sourced from Polygon.io.
      </p>

      <style>{`
        @keyframes shimmer{0%{background-position:-400% 0}100%{background-position:400% 0}}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>
    </div>
  );
}
