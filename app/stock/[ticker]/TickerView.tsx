"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  TrendingUp, TrendingDown, Star, StarOff,
  ArrowLeft, ExternalLink, GitCompare, Newspaper,
  Activity, Target, Shield, BarChart2, AlertTriangle,
} from "lucide-react";
import AnimatedPrice from "@/components/motion/AnimatedPrice";
import AdSlot from "@/components/AdSlot";
import { useCurrency } from "@/components/useCurrency";

/* ── Types & API helpers (mirrors patterns from app/page.tsx) ── */
interface Bar { date: string; close: number; }
interface Quote {
  ticker: string; name: string;
  price: number; change: number; changePct: number;
  high: number; low: number; open: number; volume: number;
  prevClose: number;
}
interface NewsItem {
  id: string;
  title: string;
  description: string;
  url: string;
  publisher: string;
  publishedUtc: string;
  imageUrl?: string;
}
interface AggBar { c: number; o: number; h: number; l: number; v: number; t: number; }

const API_KEY = process.env.NEXT_PUBLIC_POLYGON_API_KEY ?? "1xwzcvUOF9pft6PRNylO2Xc6X2QeQCGr";
const BASE = "https://api.polygon.io";

// f$ now comes from useCurrency() inside each component below.
const fp = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
const fv = (n: number) =>
  n >= 1e9 ? `${(n / 1e9).toFixed(2)}B`
    : n >= 1e6 ? `${(n / 1e6).toFixed(2)}M`
      : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K`
        : String(n);

async function fetchQuoteAndBars(ticker: string): Promise<{ quote: Quote | null; bars: Bar[] }> {
  // Snapshot for current quote
  let quote: Quote | null = null;
  try {
    const r = await fetch(`${BASE}/v2/snapshot/locale/us/markets/stocks/tickers/${ticker}?apiKey=${API_KEY}`);
    if (r.ok) {
      const d = await r.json() as { ticker?: { ticker: string; day: { c: number; h: number; l: number; o: number; v: number }; prevDay: { c: number } } };
      const t = d.ticker;
      if (t?.day?.c && t.prevDay?.c) {
        const change = +(t.day.c - t.prevDay.c).toFixed(2);
        const changePct = +((change / t.prevDay.c) * 100).toFixed(2);
        quote = {
          ticker: t.ticker, name: ticker,
          price: t.day.c, change, changePct,
          high: t.day.h, low: t.day.l, open: t.day.o, volume: t.day.v,
          prevClose: t.prevDay.c,
        };
      }
    }
  } catch { /* ignore */ }

  // Bars for chart (90 days)
  let bars: Bar[] = [];
  try {
    const to = new Date().toISOString().split("T")[0];
    const from = new Date(Date.now() - 92 * 86_400_000).toISOString().split("T")[0];
    const r = await fetch(`${BASE}/v2/aggs/ticker/${ticker}/range/1/day/${from}/${to}?adjusted=true&sort=asc&limit=120&apiKey=${API_KEY}`);
    if (r.ok) {
      const d = await r.json() as { results?: AggBar[] };
      bars = (d.results ?? []).map(b => ({
        date: new Date(b.t).toISOString().split("T")[0],
        close: b.c,
      }));
    }
  } catch { /* ignore */ }

  // If snapshot failed but bars succeeded, derive a quote from the bars
  if (!quote && bars.length >= 2) {
    const last = bars[bars.length - 1], prev = bars[bars.length - 2];
    const change = +(last.close - prev.close).toFixed(2);
    quote = {
      ticker, name: ticker,
      price: last.close, change,
      changePct: +((change / prev.close) * 100).toFixed(2),
      high: last.close * 1.005, low: last.close * 0.995, open: prev.close, volume: 0,
      prevClose: prev.close,
    };
  }

  return { quote, bars };
}

async function fetchTickerDetails(ticker: string): Promise<{ name: string; description: string; sector: string } | null> {
  try {
    const r = await fetch(`${BASE}/v3/reference/tickers/${ticker}?apiKey=${API_KEY}`);
    if (!r.ok) return null;
    const d = await r.json() as { results?: { name?: string; description?: string; sic_description?: string } };
    return {
      name: d.results?.name ?? ticker,
      description: d.results?.description ?? "",
      sector: d.results?.sic_description ?? "",
    };
  } catch { return null; }
}

async function fetchNews(ticker: string): Promise<NewsItem[]> {
  try {
    const r = await fetch(`${BASE}/v2/reference/news?ticker=${ticker}&limit=8&order=desc&sort=published_utc&apiKey=${API_KEY}`);
    if (!r.ok) return [];
    const d = await r.json() as {
      results?: Array<{
        id: string; title: string; description?: string;
        article_url: string; published_utc: string;
        publisher?: { name?: string }; image_url?: string;
      }>
    };
    return (d.results ?? []).map(n => ({
      id: n.id,
      title: n.title,
      description: n.description ?? "",
      url: n.article_url,
      publisher: n.publisher?.name ?? "—",
      publishedUtc: n.published_utc,
      imageUrl: n.image_url,
    }));
  } catch { return []; }
}

/* ── Wilder's RSI from closes (matches the Top 15 pipeline) ── */
function calcRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) gains += d; else losses -= d;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    const g = d > 0 ? d : 0;
    const l = d < 0 ? -d : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Math.round(100 - 100 / (1 + rs));
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

/* ── Layout tokens — read CSS variables for theme parity ── */
const V = {
  ink0: "var(--ink0,#f4f0ff)",
  ink1: "var(--ink1,#cdc7e0)",
  ink2: "var(--ink2,#8a82a8)",
  ink3: "var(--ink3,#4a4468)",
  ink4: "var(--ink4,#2d2848)",
  border: "var(--border,rgba(60,48,100,0.5))",
  borderHi: "var(--border-hi,rgba(90,72,150,0.6))",
  surface: "var(--surface,#120f1e)",
  raised: "var(--raised,#1a1628)",
  gain: "var(--gain,#00e5a0)",
  loss: "var(--loss,#ff4560)",
  gold: "var(--gold,#f0a500)",
};
const mono: React.CSSProperties = { fontFamily: "'DM Mono','Courier New',monospace" };
const display: React.CSSProperties = { fontFamily: "'Cabinet Grotesk','Syne',system-ui,sans-serif" };

const cardStyle: React.CSSProperties = {
  background: "linear-gradient(145deg,rgba(255,255,255,0.032) 0%,rgba(255,255,255,0.010) 100%)",
  backdropFilter: "blur(20px) saturate(1.4)",
  WebkitBackdropFilter: "blur(20px) saturate(1.4)",
  border: `1px solid ${V.border}`,
  borderRadius: 18,
  position: "relative" as const,
  overflow: "hidden",
};

function ChartTip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  const { f$ } = useCurrency();
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: V.raised, border: `1px solid ${V.borderHi}`, borderRadius: 10, padding: "8px 12px", boxShadow: "0 8px 32px rgba(0,0,0,0.7)" }}>
      <p style={{ ...mono, fontSize: 9, color: V.ink3, marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</p>
      <p style={{ ...mono, fontSize: 14, color: V.ink0, fontWeight: 500, letterSpacing: "-0.02em" }}>{f$(payload[0].value)}</p>
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────── */
export default function TickerView({ ticker }: { ticker: string }) {
  const { f$ } = useCurrency();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [bars, setBars] = useState<Bar[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [details, setDetails] = useState<{ name: string; description: string; sector: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [watched, setWatched] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    const [qb, n, d] = await Promise.all([
      fetchQuoteAndBars(ticker),
      fetchNews(ticker),
      fetchTickerDetails(ticker),
    ]);
    if (!qb.quote && !qb.bars.length) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setQuote(qb.quote);
    setBars(qb.bars);
    setNews(n);
    setDetails(d);
    setLoading(false);
  }, [ticker]);

  useEffect(() => { load(); }, [load]);

  // Sync watchlist state with localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("arbibx-watchlist");
      const list: string[] = raw ? JSON.parse(raw) : [];
      setWatched(list.includes(ticker));
    } catch { /* */ }
  }, [ticker]);

  const toggleWatch = useCallback(() => {
    try {
      const raw = localStorage.getItem("arbibx-watchlist");
      const list: string[] = raw ? JSON.parse(raw) : [];
      const next = list.includes(ticker) ? list.filter(t => t !== ticker) : [...list, ticker];
      localStorage.setItem("arbibx-watchlist", JSON.stringify(next));
      setWatched(next.includes(ticker));
    } catch { /* */ }
  }, [ticker]);

  // Derived stats
  const closes = bars.map(b => b.close);
  const rsi = closes.length >= 15 ? calcRSI(closes) : null;
  const w52 = bars.length
    ? { high: Math.max(...bars.map(b => b.close)), low: Math.min(...bars.map(b => b.close)) }
    : null;
  const w52Pct = w52 && quote && w52.high > w52.low
    ? +(((quote.price - w52.low) / (w52.high - w52.low)) * 100).toFixed(0)
    : null;

  const up = quote ? quote.changePct >= 0 : false;
  const lineColor = up ? V.gain : V.loss;
  const displayName = details?.name ?? quote?.name ?? ticker;

  if (notFound) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "'Syne',system-ui,sans-serif" }}>
        <div style={{ textAlign: "center", maxWidth: 420 }}>
          <AlertTriangle size={36} color={V.gold} style={{ marginBottom: 14 }} />
          <h1 style={{ ...display, fontSize: 28, fontWeight: 800, color: V.ink0, marginBottom: 8 }}>Ticker not found</h1>
          <p style={{ color: V.ink2, fontSize: 14, marginBottom: 24 }}>
            <span style={{ ...mono, color: V.gold }}>{ticker}</span> isn&apos;t a valid US-listed ticker, or our data provider doesn&apos;t have it indexed.
          </p>
          <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 10, background: "rgba(240,165,0,0.10)", border: "1px solid rgba(240,165,0,0.30)", color: V.gold, textDecoration: "none", ...mono, fontSize: 12 }}>
            <ArrowLeft size={14} /> Back to terminal
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", color: V.ink1, fontFamily: "'Syne',system-ui,sans-serif" }}>
      {/* Header bar — uses CSS variable for theme parity */}
      <header className="vx-page-header" style={{ position: "sticky", top: 0, zIndex: 100, backdropFilter: "blur(40px) saturate(2)", WebkitBackdropFilter: "blur(40px) saturate(2)", borderBottom: `1px solid ${V.border}` }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 10, color: V.ink2, textDecoration: "none" }}>
            <ArrowLeft size={16} />
            <div style={{ width: 28, height: 28, borderRadius: 7, overflow: "hidden", background: "linear-gradient(135deg,#f0a500,#ff6b35)" }}>
              <Image src="/logo.png" alt="ArbibX" width={28} height={28} style={{ objectFit: "cover" }} unoptimized />
            </div>
            <div style={{ lineHeight: 1 }}>
              <div style={{ ...mono, fontSize: 11, fontWeight: 500, letterSpacing: "0.1em", color: V.ink0 }}>ArbibX</div>
              <div style={{ ...mono, fontSize: 7, color: V.ink4, letterSpacing: "0.2em", marginTop: 1 }}>TERMINAL</div>
            </div>
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={toggleWatch}
              title={watched ? "Remove from watchlist" : "Add to watchlist"}
              style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "8px 12px", borderRadius: 9, background: watched ? "rgba(240,165,0,0.10)" : "rgba(255,255,255,0.04)", border: `1px solid ${watched ? "rgba(240,165,0,0.30)" : V.border}`, color: watched ? V.gold : V.ink2, cursor: "pointer", ...mono, fontSize: 11 }}>
              {watched ? <Star size={13} fill="currentColor" /> : <StarOff size={13} />}
              {watched ? "Tracked" : "Watch"}
            </button>
            <a href={`https://finance.yahoo.com/quote/${ticker}`} target="_blank" rel="noopener noreferrer"
              style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "8px 12px", borderRadius: 9, background: "rgba(240,165,0,0.10)", border: "1px solid rgba(240,165,0,0.28)", color: V.gold, textDecoration: "none", ...mono, fontSize: 11 }}>
              <ExternalLink size={11} /> Yahoo
            </a>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 16px 64px", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Hero card */}
        <div style={{ ...cardStyle, padding: "24px 24px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ ...mono, fontSize: "clamp(34px,6vw,56px)", fontWeight: 500, letterSpacing: "-0.04em", color: V.ink0, lineHeight: 1, marginBottom: 6 }}>
                {ticker}
              </h1>
              <p style={{ color: V.ink2, fontSize: 15, marginBottom: 4 }}>{displayName}</p>
              {details?.sector && (
                <span style={{ ...mono, fontSize: 9, padding: "2px 8px", borderRadius: 5, background: "rgba(240,165,0,0.08)", border: "1px solid rgba(240,165,0,0.22)", color: V.gold, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  {details.sector}
                </span>
              )}
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              {loading || !quote ? (
                <div className="skel" style={{ width: 180, height: 52 }} />
              ) : (
                <>
                  <AnimatedPrice value={quote.price} format={f$} style={{ ...mono, fontSize: "clamp(30px,5vw,48px)", fontWeight: 500, letterSpacing: "-0.04em", color: V.ink0 }} />
                  <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8, marginTop: 6 }}>
                    <span style={{ ...mono, fontSize: 11, padding: "2px 8px", borderRadius: 5, background: up ? "rgba(0,229,160,0.10)" : "rgba(255,69,96,0.10)", color: up ? V.gain : V.loss, border: `1px solid ${up ? "rgba(0,229,160,0.25)" : "rgba(255,69,96,0.25)"}`, display: "inline-flex", alignItems: "center", gap: 3 }}>
                      {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                      {fp(quote.changePct)}
                    </span>
                    <span style={{ ...mono, fontSize: 12, color: up ? V.gain : V.loss }}>
                      {quote.change >= 0 ? "+" : ""}{f$(quote.change)}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Chart card */}
        <div style={{ ...cardStyle, padding: "20px 4px 16px 4px" }}>
          <div style={{ display: "flex", alignItems: "center", padding: "0 20px 12px", gap: 8 }}>
            <Activity size={14} color={lineColor} />
            <span style={{ ...mono, fontSize: 10, color: V.ink2, textTransform: "uppercase", letterSpacing: "0.1em" }}>
              90-day chart · Polygon.io
            </span>
          </div>
          {loading ? (
            <div className="skel" style={{ height: 320, margin: "0 16px" }} />
          ) : bars.length === 0 ? (
            <p style={{ ...mono, fontSize: 12, color: V.ink3, textAlign: "center", padding: "60px 20px" }}>No chart data available.</p>
          ) : (
            <div style={{ height: 320, padding: "0 4px 8px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={bars} margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
                  <defs>
                    <linearGradient id={`g-${ticker}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={lineColor} stopOpacity={0.32} />
                      <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 8" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: V.ink4, fontSize: 9, fontFamily: "DM Mono" }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={64} />
                  <YAxis tick={{ fill: V.ink4, fontSize: 9, fontFamily: "DM Mono" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => f$(v, 0)} width={64} domain={["auto", "auto"]} />
                  <Tooltip content={<ChartTip />} cursor={{ stroke: V.borderHi, strokeWidth: 1 }} />
                  <Area type="monotone" dataKey="close" stroke={lineColor} strokeWidth={1.8} fill={`url(#g-${ticker})`} dot={false} isAnimationActive animationDuration={1400} animationEasing="ease-out" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Stats grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
          {[
            { label: "Open",    value: quote ? f$(quote.open) : "—",  icon: <BarChart2 size={11} /> },
            { label: "High",    value: quote ? f$(quote.high) : "—", icon: <TrendingUp size={11} color={V.gain} /> },
            { label: "Low",     value: quote ? f$(quote.low) : "—",  icon: <TrendingDown size={11} color={V.loss} /> },
            { label: "Volume",  value: quote ? fv(quote.volume) : "—", icon: <Activity size={11} /> },
            { label: "Prev Close", value: quote ? f$(quote.prevClose) : "—", icon: <BarChart2 size={11} /> },
            { label: "RSI(14)", value: rsi != null ? String(rsi) : "—", icon: <Shield size={11} color={rsi == null ? V.ink3 : rsi < 30 ? V.gain : rsi > 70 ? V.loss : V.gold} /> },
            { label: "90d High", value: w52 ? f$(w52.high) : "—", icon: <Target size={11} color={V.gain} /> },
            { label: "90d Low",  value: w52 ? f$(w52.low)  : "—", icon: <Target size={11} color={V.loss} /> },
            { label: "Range",    value: w52Pct != null ? `${w52Pct}%` : "—", icon: <Activity size={11} color={V.gold} /> },
          ].map(s => (
            <div key={s.label} style={{ ...cardStyle, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: "rgba(255,255,255,0.04)", border: `1px solid ${V.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: V.ink2 }}>
                {s.icon}
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ ...mono, fontSize: 8, color: V.ink4, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 2 }}>{s.label}</p>
                <p style={{ ...mono, fontSize: 14, fontWeight: 500, color: V.ink0 }}>{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* News + actions row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20 }}>
          {/* News */}
          <div style={{ ...cardStyle, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 18px", borderBottom: `1px solid ${V.border}` }}>
              <Newspaper size={14} color={V.gold} />
              <h2 style={{ ...display, fontSize: 14, fontWeight: 700, color: V.ink0, margin: 0 }}>Recent news</h2>
              <span style={{ ...mono, fontSize: 9, color: V.ink4, marginLeft: "auto" }}>{news.length} {news.length === 1 ? "article" : "articles"}</span>
            </div>
            {loading ? (
              <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
                {[0,1,2].map(i => <div key={i} className="skel" style={{ height: 64 }} />)}
              </div>
            ) : news.length === 0 ? (
              <p style={{ color: V.ink3, fontSize: 12, padding: "30px 20px", textAlign: "center" }}>
                No recent news for {ticker}.
              </p>
            ) : (
              news.map((n, i) => (
                <a key={n.id} href={n.url} target="_blank" rel="noopener noreferrer"
                  style={{ display: "flex", gap: 12, padding: "14px 18px", borderBottom: i < news.length - 1 ? `1px solid ${V.border}` : "none", textDecoration: "none", transition: "background 0.15s" }}
                  className="row-hover">
                  {n.imageUrl && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={n.imageUrl} alt="" loading="lazy"
                      style={{ width: 64, height: 64, borderRadius: 8, objectFit: "cover", flexShrink: 0, background: "rgba(255,255,255,0.04)" }}
                      onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  )}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: V.ink0, lineHeight: 1.4, margin: "0 0 4px" }}>{n.title}</p>
                    {n.description && (
                      <p style={{ fontSize: 12, color: V.ink3, lineHeight: 1.5, margin: 0, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const, overflow: "hidden" }}>
                        {n.description}
                      </p>
                    )}
                    <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                      <span style={{ ...mono, fontSize: 9, color: V.ink4 }}>{n.publisher}</span>
                      <span style={{ ...mono, fontSize: 9, color: V.ink4 }}>·</span>
                      <span style={{ ...mono, fontSize: 9, color: V.ink4 }}>{timeAgo(n.publishedUtc)}</span>
                    </div>
                  </div>
                </a>
              ))
            )}
          </div>
        </div>

        {/* Description / about (if available) */}
        {details?.description && (
          <div style={{ ...cardStyle, padding: "18px 20px" }}>
            <h2 style={{ ...display, fontSize: 14, fontWeight: 700, color: V.ink0, marginBottom: 8 }}>About</h2>
            <p style={{ fontSize: 13, color: V.ink2, lineHeight: 1.65 }}>{details.description}</p>
          </div>
        )}

        {/* Ad slot — non-Pro only. Placed before footer actions so
            it's visible after the user has consumed the page content. */}
        <AdSlot label="ticker-page" />

        {/* Footer actions */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", padding: "16px 0 0" }}>
          <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 18px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: `1px solid ${V.border}`, color: V.ink2, textDecoration: "none", ...mono, fontSize: 12 }}>
            <ArrowLeft size={12} /> Back to terminal
          </Link>
          <Link href={`/?compare=${ticker}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 18px", borderRadius: 10, background: "rgba(240,165,0,0.10)", border: "1px solid rgba(240,165,0,0.30)", color: V.gold, textDecoration: "none", ...mono, fontSize: 12 }}>
            <GitCompare size={12} /> Compare in terminal
          </Link>
        </div>

        <p style={{ ...mono, fontSize: 9, color: V.ink4, textAlign: "center", letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 8 }}>
          Not financial advice · For informational purposes only
        </p>
      </main>
    </div>
  );
}
