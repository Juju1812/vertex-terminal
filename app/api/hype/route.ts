import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/* ── /api/hype — "what the internet is talking about" ────────
   Pulls the latest news from Polygon, counts how many headlines
   mention each ticker over the last 24h, scores sentiment from
   the title text, and returns the top 12 most-discussed tickers
   with a "vibe" tag. Cached server-side for 5 min. */

const POLYGON_KEY  = process.env.NEXT_PUBLIC_POLYGON_API_KEY ?? "1xwzcvUOF9pft6PRNylO2Xc6X2QeQCGr";
const POLYGON_BASE = "https://api.polygon.io";

let cache: { result: HypeResp; expiresAt: number } | null = null;
const CACHE_MS = 5 * 60 * 1000;

interface PolygonNews {
  id:           string;
  title:        string;
  description?: string;
  published_utc: string;
  article_url:  string;
  publisher?:   { name?: string };
  tickers?:     string[];
  // Polygon's beta sentiment field (when available on the plan)
  insights?:    Array<{ ticker: string; sentiment?: "positive" | "neutral" | "negative" }>;
}

interface HypeItem {
  ticker:       string;
  name:         string;
  mentions:     number;
  vibe:         "bullish" | "bearish" | "neutral";
  sentiment:    number; // -1 to 1
  topHeadline?: string;
  topUrl?:      string;
  topPublisher?: string;
  price:        number;
  changePct:    number;
}
interface HypeResp { items: HypeItem[]; updatedAt: string; lookbackHours: number; error?: string }

const POSITIVE_WORDS = ["beat", "beats", "surge", "soars", "soar", "jump", "jumps", "rally", "rallies", "gain", "gains", "rise", "rises", "rose", "up", "high", "highs", "record", "boost", "boosts", "boom", "win", "wins", "winning", "bullish", "outperform", "upgrade", "upgrades", "rocket", "moon", "breakout", "breakthrough", "approve", "approved", "deal", "partnership", "expand", "growth", "strong", "milestone", "raised", "raise", "buy", "buying"];
const NEGATIVE_WORDS = ["miss", "misses", "drop", "drops", "fall", "falls", "fell", "plunge", "plunges", "tumble", "tumbles", "slide", "slides", "down", "low", "lows", "crash", "crashes", "loss", "losses", "lose", "loses", "bearish", "downgrade", "downgrades", "sell", "selling", "sells", "warn", "warns", "warning", "concern", "concerns", "fear", "fears", "weak", "cuts", "cut", "delay", "delays", "delayed", "lawsuit", "fraud", "investigation", "probe", "ban", "banned", "halt", "recall", "bankruptcy", "layoff", "layoffs", "fire", "fired"];

function scoreTitle(title: string): number {
  const lc = ` ${title.toLowerCase()} `;
  let pos = 0, neg = 0;
  for (const w of POSITIVE_WORDS) if (lc.includes(` ${w} `) || lc.includes(` ${w}.`) || lc.includes(` ${w},`)) pos++;
  for (const w of NEGATIVE_WORDS) if (lc.includes(` ${w} `) || lc.includes(` ${w}.`) || lc.includes(` ${w},`)) neg++;
  if (pos + neg === 0) return 0;
  return (pos - neg) / (pos + neg);
}

function vibeFromScore(s: number): "bullish" | "bearish" | "neutral" {
  if (s >= 0.25) return "bullish";
  if (s <= -0.25) return "bearish";
  return "neutral";
}

async function fetchNews(limit: number): Promise<PolygonNews[]> {
  // Polygon news is sorted desc by published_utc by default
  const r = await fetch(`${POLYGON_BASE}/v2/reference/news?limit=${limit}&order=desc&sort=published_utc&apiKey=${POLYGON_KEY}`);
  if (!r.ok) return [];
  const d = await r.json() as { results?: PolygonNews[] };
  return d.results ?? [];
}

async function fetchSnapshots(tickers: string[]): Promise<Record<string, { price: number; changePct: number; name?: string }>> {
  if (!tickers.length) return {};
  const out: Record<string, { price: number; changePct: number; name?: string }> = {};
  // One snapshot call covers all the tickers
  try {
    const r = await fetch(`${POLYGON_BASE}/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${tickers.join(",")}&apiKey=${POLYGON_KEY}`);
    if (!r.ok) return out;
    const d = await r.json() as {
      tickers?: Array<{ ticker: string; todaysChangePerc?: number; day?: { c: number } }>;
    };
    for (const t of d.tickers ?? []) {
      if (t.day?.c && t.day.c > 0) {
        out[t.ticker] = { price: t.day.c, changePct: +(t.todaysChangePerc ?? 0).toFixed(2) };
      }
    }
  } catch { /* */ }
  return out;
}

async function fetchNames(tickers: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  await Promise.all(tickers.slice(0, 20).map(async t => {
    try {
      const r = await fetch(`${POLYGON_BASE}/v3/reference/tickers/${t}?apiKey=${POLYGON_KEY}`);
      if (!r.ok) return;
      const d = await r.json() as { results?: { name?: string } };
      if (d.results?.name) out[t] = d.results.name;
    } catch { /* */ }
  }));
  return out;
}

export async function GET() {
  try {
    if (cache && Date.now() < cache.expiresAt) {
      return NextResponse.json(cache.result);
    }

    const lookbackHours = 24;
    const cutoff = Date.now() - lookbackHours * 3_600_000;
    const news = await fetchNews(500);
    const recent = news.filter(n => {
      const t = Date.parse(n.published_utc);
      return Number.isFinite(t) && t >= cutoff;
    });

    // Tally mentions + accumulate sentiment per ticker. Polygon's
    // own insights[].sentiment is preferred when present; fall back
    // to a keyword scorer over the title.
    interface Acc { mentions: number; scoreSum: number; scoreN: number; topHeadline?: PolygonNews }
    const tally = new Map<string, Acc>();
    for (const n of recent) {
      const tickers = (n.tickers ?? []).filter(Boolean);
      const titleScore = scoreTitle(n.title ?? "");
      for (const t of tickers) {
        const ticker = t.toUpperCase();
        // Skip ETFs and indices that dominate noise
        if (/^(SPY|QQQ|VOO|VTI|IWM|DIA)$/.test(ticker)) continue;
        const acc = tally.get(ticker) ?? { mentions: 0, scoreSum: 0, scoreN: 0 };
        acc.mentions += 1;
        const polygonSent = n.insights?.find(i => i.ticker.toUpperCase() === ticker)?.sentiment;
        const polygonScore = polygonSent === "positive" ? 1 : polygonSent === "negative" ? -1 : null;
        const useScore = polygonScore ?? titleScore;
        acc.scoreSum += useScore;
        acc.scoreN += 1;
        if (!acc.topHeadline) acc.topHeadline = n;
        tally.set(ticker, acc);
      }
    }

    const ranked = [...tally.entries()]
      .filter(([, a]) => a.mentions >= 2)         // need at least 2 mentions to count as "buzz"
      .sort((a, b) => b[1].mentions - a[1].mentions)
      .slice(0, 12);

    if (!ranked.length) {
      const empty: HypeResp = { items: [], updatedAt: new Date().toISOString(), lookbackHours };
      return NextResponse.json(empty);
    }

    const tickers = ranked.map(([t]) => t);
    const [snaps, names] = await Promise.all([
      fetchSnapshots(tickers),
      fetchNames(tickers),
    ]);

    const items: HypeItem[] = ranked.map(([ticker, acc]) => {
      const sentiment = acc.scoreN > 0 ? acc.scoreSum / acc.scoreN : 0;
      const snap = snaps[ticker];
      return {
        ticker,
        name:         names[ticker] ?? ticker,
        mentions:     acc.mentions,
        vibe:         vibeFromScore(sentiment),
        sentiment:    +sentiment.toFixed(2),
        topHeadline:  acc.topHeadline?.title,
        topUrl:       acc.topHeadline?.article_url,
        topPublisher: acc.topHeadline?.publisher?.name,
        price:        snap?.price ?? 0,
        changePct:    snap?.changePct ?? 0,
      };
    });

    const result: HypeResp = { items, updatedAt: new Date().toISOString(), lookbackHours };
    cache = { result, expiresAt: Date.now() + CACHE_MS };
    return NextResponse.json(result);
  } catch (err) {
    console.error("[hype] error:", err);
    return NextResponse.json({ error: "Failed to load hype" }, { status: 500 });
  }
}
