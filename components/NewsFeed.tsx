"use client";

import { useState, useEffect, useCallback } from "react";
import { Newspaper, ExternalLink, RefreshCw, TrendingUp, TrendingDown, Minus, Clock, Tag, Search, X } from "lucide-react";

/* ---- Types -------------------------------------------------- */
interface NewsArticle {
  id: string;
  title: string;
  description: string;
  url: string;
  published: string;
  publisher: string;
  tickers: string[];
  sentiment: "bullish" | "bearish" | "neutral";
  imageUrl?: string;
}

interface Props { onSelectTicker?: (t: string) => void; }

/* ---- Universe tickers for filtering ------------------------ */
const UNIVERSE_TICKERS = [
  "NVDA","MSFT","AAPL","META","GOOGL","AMD","AVGO","ORCL","CRM","NOW",
  "ADBE","INTC","QCOM","JPM","V","MA","BAC","GS","COIN","AMZN","TSLA",
  "NKE","SBUX","RIVN","UNH","LLY","PFE","MRNA","ABBV","PLTR","CRWD",
  "PANW","NET","SNOW","XOM","CVX","MSTR","SIRI","TSM","BABA","TCEHY",
];

const POLYGON_KEY = "1xwzcvUOF9pft6PRNylO2Xc6X2QeQCGr";

/* ---- Design tokens ----------------------------------------- */
const V = {
  w1:"rgba(130,180,255,0.055)", w2:"rgba(130,180,255,0.10)",
  ink0:"#F2F6FF", ink1:"#C8D5E8", ink2:"#7A9CBF", ink3:"#3D5A7A", ink4:"#1F3550",
  gain:"#00C896", gainDim:"rgba(0,200,150,0.08)", gainWire:"rgba(0,200,150,0.20)",
  loss:"#E8445A", lossDim:"rgba(232,68,90,0.08)", lossWire:"rgba(232,68,90,0.20)",
  arc:"#4F8EF7", arcDim:"rgba(79,142,247,0.08)", arcWire:"rgba(79,142,247,0.22)",
  gold:"#E8A030", goldDim:"rgba(232,160,48,0.08)", goldWire:"rgba(232,160,48,0.20)",
  ame:"#9B72F5",
};
const mono: React.CSSProperties = { fontFamily:"'Geist Mono','Courier New',monospace" };
const glass = (ex?: React.CSSProperties): React.CSSProperties => ({
  background:"linear-gradient(145deg,rgba(255,255,255,0.028) 0%,rgba(255,255,255,0.010) 100%)",
  border:`1px solid ${V.w2}`, borderRadius:14,
  boxShadow:"0 4px 16px rgba(0,0,0,0.45)",
  position:"relative" as const, ...ex,
});

/* ---- Helpers ----------------------------------------------- */
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function guessSentiment(title: string, desc: string): "bullish" | "bearish" | "neutral" {
  const text = (title + " " + desc).toLowerCase();
  const bull = ["surge","soar","rally","beat","record","growth","profit","rises","gain","up","positive","strong","bullish","upgrade","buy","outperform","exceed","breakout","boosts","jumped","climbs"];
  const bear = ["fall","drop","decline","miss","loss","down","weak","bearish","downgrade","sell","underperform","disappoints","cuts","plunge","slump","crash","tumbles","concern","risk","warns","below"];
  let score = 0;
  for (const w of bull) if (text.includes(w)) score++;
  for (const w of bear) if (text.includes(w)) score--;
  if (score > 0) return "bullish";
  if (score < 0) return "bearish";
  return "neutral";
}

/* ---- Fetch news from Polygon ------------------------------- */
async function fetchNews(tickers?: string[], limit = 50): Promise<NewsArticle[]> {
  try {
    const tickerParam = tickers?.length ? `&ticker=${tickers.slice(0, 5).join(",ticker=")}` : "";
    const r = await fetch(
      `https://api.polygon.io/v2/reference/news?limit=${limit}&order=desc&sort=published_utc${tickerParam}&apiKey=${POLYGON_KEY}`
    );
    if (!r.ok) return [];
    const d = await r.json() as {
      results?: Array<{
        id: string;
        title: string;
        description?: string;
        article_url: string;
        published_utc: string;
        publisher: { name: string };
        tickers?: string[];
        image_url?: string;
      }>
    };
    return (d.results ?? []).map(a => ({
      id: a.id,
      title: a.title,
      description: a.description ?? "",
      url: a.article_url,
      published: a.published_utc,
      publisher: a.publisher?.name ?? "Unknown",
      tickers: (a.tickers ?? []).filter(t => UNIVERSE_TICKERS.includes(t)),
      sentiment: guessSentiment(a.title, a.description ?? ""),
      imageUrl: a.image_url,
    }));
  } catch { return []; }
}

/* ---- SentimentBadge ---------------------------------------- */
function SentimentBadge({ s }: { s: "bullish" | "bearish" | "neutral" }) {
  const cfg = {
    bullish: { color:V.gain, bg:V.gainDim, wire:V.gainWire, icon:<TrendingUp size={9} />, label:"Bullish" },
    bearish: { color:V.loss, bg:V.lossDim, wire:V.lossWire, icon:<TrendingDown size={9} />, label:"Bearish" },
    neutral: { color:V.arc,  bg:V.arcDim,  wire:V.arcWire,  icon:<Minus size={9} />,       label:"Neutral"  },
  }[s];
  return (
    <span style={{ ...mono, fontSize:8, display:"inline-flex", alignItems:"center", gap:3, padding:"2px 7px", borderRadius:99, background:cfg.bg, color:cfg.color, border:`1px solid ${cfg.wire}`, textTransform:"uppercase", letterSpacing:"0.06em" }}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

/* ---- NewsCard ---------------------------------------------- */
function NewsCard({ article, onTickerClick }: { article: NewsArticle; onTickerClick: (t: string) => void }) {
  const [hov, setHov] = useState(false);

  return (
    <div style={{ ...glass({ padding:0, overflow:"hidden" }), transition:"border-color 0.2s, transform 0.2s", borderColor: hov ? V.w2 : `rgba(130,180,255,0.07)`, transform: hov ? "translateY(-1px)" : "none" }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
      <a href={article.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration:"none", display:"block", padding:"16px 18px" }}>

        {/* Header */}
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12, marginBottom:10 }}>
          <div style={{ flex:1, minWidth:0 }}>
            <p style={{ fontSize:14, fontWeight:600, color:V.ink0, lineHeight:1.45, margin:"0 0 6px" }}>{article.title}</p>
            {article.description && (
              <p style={{ fontSize:12, color:V.ink3, lineHeight:1.6, margin:0, display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" as const, overflow:"hidden" }}>
                {article.description.slice(0, 180)}{article.description.length > 180 ? "..." : ""}
              </p>
            )}
          </div>
          {article.imageUrl && (
            <div style={{ width:72, height:72, borderRadius:10, overflow:"hidden", flexShrink:0, background:"rgba(255,255,255,0.04)" }}>
              <img src={article.imageUrl} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
          <SentimentBadge s={article.sentiment} />
          <span style={{ ...mono, fontSize:9, color:V.ink4, display:"flex", alignItems:"center", gap:3 }}>
            <Clock size={9} />{timeAgo(article.published)}
          </span>
          <span style={{ ...mono, fontSize:9, color:V.ink4 }}>·</span>
          <span style={{ ...mono, fontSize:9, color:V.ink4, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:140 }}>{article.publisher}</span>
          <span style={{ ...mono, fontSize:9, color:V.ink4, marginLeft:"auto", display:"flex", alignItems:"center", gap:3 }}>
            <ExternalLink size={9} />Read
          </span>
        </div>
      </a>

      {/* Ticker tags */}
      {article.tickers.length > 0 && (
        <div style={{ padding:"8px 18px 12px", borderTop:`1px solid ${V.w1}`, display:"flex", flexWrap:"wrap", gap:6 }}>
          <Tag size={10} color={V.ink4} style={{ marginTop:2, flexShrink:0 }} />
          {article.tickers.slice(0, 6).map(t => (
            <button key={t} onClick={() => onTickerClick(t)}
              style={{ ...mono, fontSize:9, padding:"2px 8px", borderRadius:99, background:V.arcDim, border:`1px solid ${V.arcWire}`, color:"#7EB6FF", cursor:"pointer", transition:"background 0.15s" }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(79,142,247,0.14)")}
              onMouseLeave={e => (e.currentTarget.style.background = V.arcDim)}>
              {t}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---- Main Component ---------------------------------------- */
export default function NewsFeed({ onSelectTicker }: Props) {
  const [articles, setArticles]   = useState<NewsArticle[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState<"all" | "bullish" | "bearish" | "neutral">("all");
  const [tickerFilter, setTickerFilter] = useState<string>("");
  const [search, setSearch]       = useState("");
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const tickers = tickerFilter ? [tickerFilter] : undefined;
    const data = await fetchNews(tickers, 60);
    setArticles(data);
    setLastUpdate(new Date());
    setLoading(false);
  }, [tickerFilter]);

  useEffect(() => { load(); }, [load]);

  const filtered = articles.filter(a => {
    if (filter !== "all" && a.sentiment !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!a.title.toLowerCase().includes(q) && !a.publisher.toLowerCase().includes(q) && !a.tickers.some(t => t.toLowerCase().includes(q))) return false;
    }
    return true;
  });

  const bullCount = articles.filter(a => a.sentiment === "bullish").length;
  const bearCount = articles.filter(a => a.sentiment === "bearish").length;
  const neuCount  = articles.filter(a => a.sentiment === "neutral").length;

  // Top mentioned tickers
  const tickerCounts: Record<string, number> = {};
  for (const a of articles) for (const t of a.tickers) tickerCounts[t] = (tickerCounts[t] ?? 0) + 1;
  const topTickers = Object.entries(tickerCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);

  return (
    <div style={{ padding:"20px 16px", maxWidth:1280, margin:"0 auto" }}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20, gap:12, flexWrap:"wrap" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:42, height:42, borderRadius:12, background:"rgba(0,200,150,0.10)", border:`1px solid ${V.gainWire}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <Newspaper size={21} color={V.gain} />
          </div>
          <div>
            <h2 style={{ fontSize:19, fontWeight:700, color:V.ink0, margin:0 }}>News Feed</h2>
            <p style={{ ...mono, color:V.ink4, fontSize:9, margin:0, marginTop:3, textTransform:"uppercase", letterSpacing:"0.08em" }}>
              {lastUpdate ? `Updated ${timeAgo(lastUpdate.toISOString())}` : "Loading..."} · {articles.length} articles
            </p>
          </div>
        </div>
        <button onClick={load} disabled={loading}
          style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 14px", borderRadius:9, background:"rgba(255,255,255,0.03)", border:`1px solid ${V.w1}`, color:V.ink2, cursor: loading ? "not-allowed" : "pointer", fontSize:12, fontFamily:"'Bricolage Grotesque',system-ui,sans-serif", opacity: loading ? 0.5 : 1 }}>
          <RefreshCw size={12} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
          Refresh
        </button>
      </div>

      {/* Sentiment stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:16 }}>
        {[
          { label:"Bullish", val:bullCount, color:V.gain, bg:V.gainDim, wire:V.gainWire, icon:<TrendingUp size={13} color={V.gain} />, f:"bullish" as const },
          { label:"Bearish", val:bearCount, color:V.loss, bg:V.lossDim, wire:V.lossWire, icon:<TrendingDown size={13} color={V.loss} />, f:"bearish" as const },
          { label:"Neutral", val:neuCount,  color:V.arc,  bg:V.arcDim,  wire:V.arcWire,  icon:<Minus size={13} color={V.arc} />,        f:"neutral" as const },
        ].map(s => (
          <button key={s.label} onClick={() => setFilter(f => f === s.f ? "all" : s.f)}
            style={{ ...glass({ padding:"11px 14px", display:"flex", alignItems:"center", gap:10, cursor:"pointer", border:`1px solid ${filter === s.f ? s.wire : V.w1}`, background: filter === s.f ? s.bg : "linear-gradient(145deg,rgba(255,255,255,0.028) 0%,rgba(255,255,255,0.010) 100%)" }), fontFamily:"inherit" }}>
            <div style={{ width:28, height:28, borderRadius:7, background:"rgba(255,255,255,0.04)", border:`1px solid ${V.w1}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>{s.icon}</div>
            <div style={{ textAlign:"left" }}>
              <p style={{ ...mono, color:V.ink4, fontSize:8, textTransform:"uppercase", letterSpacing:"0.09em", marginBottom:2 }}>{s.label}</p>
              <p style={{ ...mono, fontSize:15, fontWeight:600, color:s.color }}>{loading ? "--" : s.val}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Top tickers + search row */}
      <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap", alignItems:"center" }}>
        {/* Search */}
        <div style={{ position:"relative", flex:1, minWidth:160 }}>
          <Search size={12} color={V.ink4} style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search news..."
            style={{ width:"100%", background:"rgba(255,255,255,0.03)", border:`1px solid ${V.w1}`, borderRadius:9, color:V.ink0, ...mono, fontSize:12, padding:"8px 32px 8px 28px", outline:"none", boxSizing:"border-box" as const }} />
          {search && <button onClick={() => setSearch("")} style={{ position:"absolute", right:8, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:V.ink3, display:"flex", alignItems:"center" }}><X size={12} /></button>}
        </div>

        {/* Top mentioned tickers */}
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {tickerFilter && (
            <button onClick={() => setTickerFilter("")}
              style={{ ...mono, fontSize:9, padding:"5px 10px", borderRadius:99, background:V.lossDim, border:`1px solid ${V.lossWire}`, color:V.loss, cursor:"pointer", display:"flex", alignItems:"center", gap:4 }}>
              <X size={9} /> Clear filter
            </button>
          )}
          {topTickers.map(([t, count]) => (
            <button key={t} onClick={() => setTickerFilter(f => f === t ? "" : t)}
              style={{ ...mono, fontSize:9, padding:"5px 10px", borderRadius:99, background: tickerFilter === t ? V.arcDim : "rgba(255,255,255,0.02)", border:`1px solid ${tickerFilter === t ? V.arcWire : V.w1}`, color: tickerFilter === t ? "#7EB6FF" : V.ink3, cursor:"pointer" }}>
              {t} <span style={{ color:V.ink4 }}>({count})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} style={{ height:120, borderRadius:14, background:"linear-gradient(105deg,#0C1220 30%,#151F30 50%,#0C1220 70%)", backgroundSize:"400% 100%", animation:"shimmer 2s ease-in-out infinite", animationDelay:`${i * 0.1}s` }} />
          ))}
        </div>
      )}

      {/* No results */}
      {!loading && filtered.length === 0 && (
        <div style={{ ...glass({ padding:"32px 24px", textAlign:"center" }) }}>
          <p style={{ color:V.ink3, fontSize:14 }}>No articles match your filters.</p>
          <button onClick={() => { setFilter("all"); setSearch(""); setTickerFilter(""); }}
            style={{ ...mono, fontSize:11, color:"#7EB6FF", background:"none", border:`1px solid ${V.arcWire}`, borderRadius:8, padding:"6px 14px", cursor:"pointer", marginTop:12 }}>
            Clear filters
          </button>
        </div>
      )}

      {/* Articles grid */}
      {!loading && filtered.length > 0 && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(min(100%,420px),1fr))", gap:12 }}>
          {filtered.map(a => (
            <NewsCard key={a.id} article={a} onTickerClick={t => { onSelectTicker?.(t); }} />
          ))}
        </div>
      )}

      <p style={{ ...mono, fontSize:9, color:V.ink4, lineHeight:1.7, marginTop:16 }}>
        News sourced from Polygon.io. Sentiment is estimated automatically and may not reflect actual market impact. Not financial advice.
      </p>

      <style>{`
        @keyframes shimmer{0%{background-position:-400% 0}100%{background-position:400% 0}}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>
    </div>
  );
}
