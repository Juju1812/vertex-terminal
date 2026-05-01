import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

interface ArticleIn {
  id:    string;
  title: string;
  desc?: string;
  /** Comma-separated tickers — used for context only */
  tickers?: string[];
}

interface SentimentOut {
  id:        string;
  sentiment: "bullish" | "bearish" | "neutral";
  reason:    string;
}

/* ── Per-instance cache for sentiment results ──────────────────
   Stable Polygon article IDs → sentiment + reasoning. 24h TTL is
   well past how long a news headline stays "interesting", but we
   never re-judge an old article. Memory cost is trivial (~150
   bytes/entry × thousands of articles = a few MB). Lost on cold
   start, which is fine — Haiku rebuild is fast and cheap. */
interface CacheEntry { sentiment: "bullish" | "bearish" | "neutral"; reason: string; expiresAt: number }
const cache = new Map<string, CacheEntry>();
const CACHE_MS = 24 * 60 * 60 * 1000;

function getCached(id: string): CacheEntry | null {
  const hit = cache.get(id);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) { cache.delete(id); return null; }
  return hit;
}
function setCached(id: string, sentiment: "bullish" | "bearish" | "neutral", reason: string) {
  cache.set(id, { sentiment, reason, expiresAt: Date.now() + CACHE_MS });
  // Light eviction so the Map can't grow unbounded over a long-lived instance
  if (cache.size > 5000) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt).slice(0, 1000);
    for (const [k] of oldest) cache.delete(k);
  }
}

const MODEL_CHAIN = ["claude-haiku-4-5", "claude-sonnet-4-6"] as const;

/* Ask Claude to score a batch of headlines at once. Single call
   covers up to ~25 articles, returns one JSON object per article. */
async function scoreBatch(articles: ArticleIn[]): Promise<SentimentOut[]> {
  if (!articles.length || !ANTHROPIC_KEY) return [];

  const lines = articles.map((a, i) =>
    `${i + 1}. [${a.tickers?.slice(0, 2).join(",") ?? "—"}] ${a.title}${a.desc ? ` — ${a.desc.slice(0, 200)}` : ""}`
  ).join("\n");

  const prompt =
`Score the market-impact sentiment of each news headline below from the perspective of a trader holding the mentioned stock(s). Respond with a JSON array, one object per article, in the SAME ORDER as the input. Each object must have:
- "n": the article number (1-indexed)
- "s": "bullish" | "bearish" | "neutral"
- "r": a tight 6-12 word explanation of WHY (no fluff, no preamble)

Use "bullish" only when the news is meaningfully positive for the stock(s) — earnings beats, upgrades, strong guidance, product wins, deal closures.
Use "bearish" only when meaningfully negative — earnings misses, downgrades, lawsuits, regulatory pressure, lost contracts, bad guidance.
Use "neutral" for industry news, broad market commentary, analyst surveys, mixed reports, or anything ambiguous.

ARTICLES:
${lines}

Return ONLY the JSON array, no preamble, no markdown fences. Example:
[{"n":1,"s":"bullish","r":"Q3 EPS beat by 18%, raised full-year guidance"},{"n":2,"s":"neutral","r":"Industry-wide trend report, no company-specific catalyst"}]`;

  for (const model of MODEL_CHAIN) {
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method:  "POST",
        headers: {
          "Content-Type":      "application/json",
          "x-api-key":         ANTHROPIC_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 2500,
          messages: [
            { role: "user", content: prompt },
            { role: "assistant", content: "[" },  // prefill so the model continues from the array opener
          ],
        }),
      });
      if (!r.ok) {
        console.warn(`[news-sentiment] ${model} HTTP ${r.status}`);
        continue;
      }
      const d = await r.json() as { content: Array<{ type: string; text: string }> };
      const text = d.content?.find(c => c.type === "text")?.text ?? "";
      // Re-form the array (we prefilled "[")
      const json = "[" + text.replace(/```json\s*|\s*```/g, "").trim();
      const parsed = JSON.parse(json) as Array<{ n: number; s: string; r: string }>;

      return parsed.map(p => {
        const idx = (p.n ?? 0) - 1;
        const article = articles[idx];
        if (!article) return null;
        const s = (p.s ?? "neutral").toLowerCase();
        const sentiment: SentimentOut["sentiment"] =
          s === "bullish" ? "bullish" :
          s === "bearish" ? "bearish" : "neutral";
        return { id: article.id, sentiment, reason: (p.r ?? "").slice(0, 120) };
      }).filter((x): x is SentimentOut => x !== null);
    } catch (err) {
      console.warn(`[news-sentiment] ${model} threw:`, err);
    }
  }
  return [];
}

export async function POST(req: NextRequest): Promise<Response> {
  if (!ANTHROPIC_KEY) {
    return NextResponse.json({ error: "Sentiment scoring not configured" }, { status: 503 });
  }

  let body: { articles: ArticleIn[] };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const articles = (body.articles ?? []).filter(a => a?.id && a?.title).slice(0, 30);
  if (!articles.length) return NextResponse.json({ results: [] });

  // Pull anything cached, score the rest in one batched Claude call
  const results: SentimentOut[] = [];
  const todo: ArticleIn[] = [];
  for (const a of articles) {
    const hit = getCached(a.id);
    if (hit) results.push({ id: a.id, sentiment: hit.sentiment, reason: hit.reason });
    else todo.push(a);
  }

  if (todo.length) {
    const fresh = await scoreBatch(todo);
    for (const f of fresh) {
      setCached(f.id, f.sentiment, f.reason);
      results.push(f);
    }
  }

  return NextResponse.json({
    results,
    cached: articles.length - todo.length,
    fresh:  todo.length,
  });
}
