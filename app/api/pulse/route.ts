import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/* ── /api/pulse — "For You" feed of trending stocks ──────────
   Mixes today's biggest gainers, biggest losers, and most-active
   tickers, filters out the penny-stock noise Polygon's gainers
   endpoint loves to surface, then asks Claude for a one-liner
   per ticker explaining the move. Result is cached server-side
   for 5 min so we don't burn Anthropic credits per page view. */

const POLYGON_KEY   = process.env.NEXT_PUBLIC_POLYGON_API_KEY ?? "1xwzcvUOF9pft6PRNylO2Xc6X2QeQCGr";
const POLYGON_BASE  = "https://api.polygon.io";
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY ?? "";

let cache: { result: PulseResp; expiresAt: number } | null = null;
const CACHE_MS = 5 * 60 * 1000;

interface PolygonSnap {
  ticker: string;
  todaysChangePerc?: number;
  todaysChange?: number;
  day?: { c: number; v: number };
  prevDay?: { c: number };
}
interface PulseItem {
  ticker:    string;
  name:      string;
  price:     number;
  change:    number;
  changePct: number;
  volume:    number;
  category:  "gainer" | "loser" | "active";
  aiTake?:   string;
}
interface PulseResp {
  items:     PulseItem[];
  updatedAt: string;
}

/* ── Fetch one of Polygon's category feeds ─────────────────── */
async function fetchCategory(path: "gainers" | "losers" | "most_active" | "actives"): Promise<PolygonSnap[]> {
  try {
    const r = await fetch(`${POLYGON_BASE}/v2/snapshot/locale/us/markets/stocks/${path}?apiKey=${POLYGON_KEY}`);
    if (!r.ok) return [];
    const d = await r.json() as { tickers?: PolygonSnap[] };
    return d.tickers ?? [];
  } catch { return []; }
}

/* ── Get readable names for a batch of tickers ─────────────── */
async function fetchNames(tickers: string[]): Promise<Record<string, string>> {
  if (!tickers.length) return {};
  const out: Record<string, string> = {};
  // Use Polygon's reference tickers endpoint, one ticker at a time
  // (no bulk-name endpoint exists on Stocks Starter). Cap parallelism
  // to keep this quick.
  await Promise.all(tickers.slice(0, 30).map(async t => {
    try {
      const r = await fetch(`${POLYGON_BASE}/v3/reference/tickers/${t}?apiKey=${POLYGON_KEY}`);
      if (!r.ok) return;
      const d = await r.json() as { results?: { name?: string } };
      if (d.results?.name) out[t] = d.results.name;
    } catch { /* */ }
  }));
  return out;
}

/* ── Filter out garbage tickers (penny stocks, bad data) ───── */
function isReasonable(s: PolygonSnap): boolean {
  if (!s.day?.c || s.day.c < 5) return false;          // price ≥ $5
  if (!s.day.v || s.day.v < 200_000) return false;      // ≥200k volume
  if (!s.prevDay?.c || s.prevDay.c < 1) return false;   // sane prev close
  if (!Number.isFinite(s.todaysChangePerc)) return false;
  if (Math.abs(s.todaysChangePerc ?? 0) > 200) return false; // bogus moves
  return true;
}

/* ── Ask Claude for one-liners ────────────────────────────── */
async function fetchClaudeTakes(items: PulseItem[]): Promise<Map<string, string>> {
  const takes = new Map<string, string>();
  if (!ANTHROPIC_KEY || !items.length) return takes;

  const prompt = `You are a financial commentator writing for Gen Z investors. For each ticker below, write ONE punchy sentence (max 18 words) explaining the most likely reason it's moving today. Use plain English, no jargon walls. Don't say "the stock". If you genuinely don't know, write a generic "watch the chart for [reason]" line.

Return ONLY a JSON object mapping ticker → one-liner. No markdown, no preamble.

Tickers (with today's % move):
${items.map(i => `${i.ticker} (${i.changePct >= 0 ? "+" : ""}${i.changePct.toFixed(1)}%) — ${i.name}`).join("\n")}

JSON:`;

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 1500,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!r.ok) return takes;
    const d = await r.json() as { content?: Array<{ text?: string }> };
    const text = d.content?.[0]?.text ?? "";
    // Extract JSON object from the response (Claude sometimes wraps in
    // backticks despite the instruction not to).
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return takes;
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, string>;
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === "string" && v.trim()) takes.set(k.toUpperCase(), v.trim());
    }
  } catch (err) {
    console.warn("[pulse] Claude takes failed:", err);
  }
  return takes;
}

/* ── Main GET handler ───────────────────────────────────────── */
export async function GET() {
  try {
    if (cache && Date.now() < cache.expiresAt) {
      return NextResponse.json(cache.result);
    }

    const [gainers, losers, actives] = await Promise.all([
      fetchCategory("gainers"),
      fetchCategory("losers"),
      fetchCategory("most_active"),
    ]);

    // Filter + take the top N from each category
    const cleanGainers = gainers.filter(isReasonable).slice(0, 5);
    const cleanLosers  = losers.filter(isReasonable).slice(0, 4);
    const cleanActives = actives.filter(isReasonable).slice(0, 5);

    // Build merged item list, deduped by ticker (keep first occurrence)
    const seen = new Set<string>();
    const merged: PulseItem[] = [];
    const push = (snap: PolygonSnap, category: PulseItem["category"]) => {
      const t = snap.ticker;
      if (!t || seen.has(t)) return;
      seen.add(t);
      merged.push({
        ticker:    t,
        name:      t,
        price:     snap.day!.c,
        change:    +(snap.todaysChange ?? 0).toFixed(2),
        changePct: +(snap.todaysChangePerc ?? 0).toFixed(2),
        volume:    snap.day!.v,
        category,
      });
    };
    cleanGainers.forEach(s => push(s, "gainer"));
    cleanLosers.forEach(s  => push(s, "loser"));
    cleanActives.forEach(s => push(s, "active"));

    if (!merged.length) {
      return NextResponse.json({ items: [], updatedAt: new Date().toISOString() });
    }

    // Hydrate company names + Claude takes in parallel
    const tickers = merged.map(i => i.ticker);
    const [names, takes] = await Promise.all([
      fetchNames(tickers),
      fetchClaudeTakes(merged),
    ]);

    for (const item of merged) {
      if (names[item.ticker]) item.name = names[item.ticker];
      if (takes.has(item.ticker)) item.aiTake = takes.get(item.ticker);
    }

    const result: PulseResp = {
      items: merged,
      updatedAt: new Date().toISOString(),
    };
    cache = { result, expiresAt: Date.now() + CACHE_MS };
    return NextResponse.json(result);
  } catch (err) {
    console.error("[pulse] error:", err);
    return NextResponse.json({ error: "Failed to load pulse" }, { status: 500 });
  }
}
