import { NextRequest, NextResponse } from "next/server";

const POLYGON_KEY = process.env.NEXT_PUBLIC_POLYGON_API_KEY ?? "1xwzcvUOF9pft6PRNylO2Xc6X2QeQCGr";
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const POLYGON_BASE = "https://api.polygon.io";

/* ---- Types -------------------------------------------------- */
interface AggBar {
  c: number; o: number; h: number; l: number; v: number; t: number;
}

interface StockAnalysis {
  ticker: string;
  name: string;
  sector: string;
  price: number;
  change: number;
  changePct: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  // Technical indicators
  rsi: number;
  sma20: number;
  sma50: number;
  volumeAvg20: number;
  volumeRatio: number;
  momentum5d: number;
  momentum20d: number;
  support: number;
  resistance: number;
  // AI output
  signal: "STRONG BUY" | "BUY" | "HOLD" | "SELL" | "STRONG SELL";
  confidence: number;
  targetPrice: number;
  thesis: string;
  risks: string;
  tags: string[];
  score: number;
  floor: number;
  ceiling: number;
}

/* ---- Technical Analysis ------------------------------------ */
function calcRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff; else losses -= diff;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Math.round(100 - 100 / (1 + rs));
}

function calcSMA(closes: number[], period: number): number {
  if (closes.length < period) return closes[closes.length - 1] ?? 0;
  const slice = closes.slice(-period);
  return +(slice.reduce((a, b) => a + b, 0) / period).toFixed(2);
}

function calcMomentum(closes: number[], days: number): number {
  if (closes.length < days + 1) return 0;
  const past = closes[closes.length - days - 1];
  const now  = closes[closes.length - 1];
  return +((now - past) / past * 100).toFixed(2);
}

function calcSupport(bars: AggBar[]): number {
  const lows = bars.slice(-20).map(b => b.l);
  return +Math.min(...lows).toFixed(2);
}

function calcResistance(bars: AggBar[]): number {
  const highs = bars.slice(-20).map(b => b.h);
  return +Math.max(...highs).toFixed(2);
}

/* ---- Polygon helpers --------------------------------------- */
async function fetchBars(ticker: string, days = 60): Promise<AggBar[]> {
  const to   = new Date().toISOString().split("T")[0];
  const from = new Date(Date.now() - days * 86_400_000).toISOString().split("T")[0];
  try {
    const r = await fetch(
      `${POLYGON_BASE}/v2/aggs/ticker/${ticker}/range/1/day/${from}/${to}?adjusted=true&sort=asc&limit=${days}&apiKey=${POLYGON_KEY}`
    );
    if (!r.ok) return [];
    const d = await r.json() as { results?: AggBar[] };
    return d.results ?? [];
  } catch { return []; }
}

async function fetchNews(ticker: string): Promise<string[]> {
  try {
    const r = await fetch(
      `${POLYGON_BASE}/v2/reference/news?ticker=${ticker}&limit=5&order=desc&sort=published_utc&apiKey=${POLYGON_KEY}`
    );
    if (!r.ok) return [];
    const d = await r.json() as { results?: { title: string; description?: string }[] };
    return (d.results ?? []).map(n => `${n.title}${n.description ? ": " + n.description.slice(0, 120) : ""}`);
  } catch { return []; }
}

async function fetchSnapshot(ticker: string): Promise<{ price: number; change: number; changePct: number; high: number; low: number; open: number; volume: number } | null> {
  try {
    const r = await fetch(
      `${POLYGON_BASE}/v2/snapshot/locale/us/markets/stocks/tickers/${ticker}?apiKey=${POLYGON_KEY}`
    );
    if (!r.ok) return null;
    const d = await r.json() as { ticker?: { day: { c: number; h: number; l: number; o: number; v: number }; prevDay: { c: number } } };
    const t = d.ticker;
    if (!t || !t.day?.c || !t.prevDay?.c) return null;
    const price = t.day.c, prev = t.prevDay.c, chg = price - prev;
    return { price, change: +chg.toFixed(2), changePct: +((chg / prev) * 100).toFixed(2), high: t.day.h, low: t.day.l, open: t.day.o, volume: t.day.v };
  } catch { return null; }
}

/* ---- Run Claude AI analysis -------------------------------- */
async function runClaudeAnalysis(stocks: {
  ticker: string; name: string; sector: string;
  price: number; changePct: number; volume: number;
  rsi: number; sma20: number; sma50: number;
  volumeRatio: number; momentum5d: number; momentum20d: number;
  support: number; resistance: number;
  news: string[];
}[]): Promise<Record<string, {
  signal: string; confidence: number; targetPrice: number;
  thesis: string; risks: string; tags: string[];
}>> {

  const prompt = `You are a senior quantitative analyst at a top hedge fund. Analyze these ${stocks.length} stocks using the provided technical data and recent news. Give a rigorous, data-driven assessment for each.

STOCKS DATA:
${stocks.map(s => `
--- ${s.ticker} (${s.name}, ${s.sector}) ---
Price: $${s.price} | Change: ${s.changePct}%
RSI(14): ${s.rsi} | SMA20: $${s.sma20} | SMA50: $${s.sma50}
Volume Ratio vs 20d avg: ${s.volumeRatio}x
5-day momentum: ${s.momentum5d}% | 20-day momentum: ${s.momentum20d}%
Support: $${s.support} | Resistance: $${s.resistance}
Recent News:
${s.news.length ? s.news.map((n, i) => `  ${i + 1}. ${n}`).join("\n") : "  No recent news available"}
`).join("\n")}

For EACH stock respond in this EXACT JSON format (no extra text, just valid JSON):
{
  "analyses": [
    {
      "ticker": "XXXX",
      "signal": "STRONG BUY|BUY|HOLD|SELL|STRONG SELL",
      "confidence": 0-100,
      "targetPrice": 0.00,
      "thesis": "2-3 sentence specific thesis citing the actual data above. Reference specific numbers (RSI, momentum, price vs SMA, news). Be precise and quantitative.",
      "risks": "1-2 sentence key downside risk specific to this stock right now.",
      "tags": ["Tag1", "Tag2", "Tag3"]
    }
  ]
}

Guidelines:
- RSI > 70 = overbought (bearish signal), RSI < 30 = oversold (bullish signal)
- Price above SMA20 and SMA50 = bullish trend
- Volume ratio > 1.5 = unusual volume (amplifies the price direction signal)
- Strong negative momentum = bearish, strong positive = bullish  
- Weight news sentiment heavily - bad news overrides good technicals
- Be contrarian when appropriate - not everything should be a BUY
- Confidence 80-95 = very strong conviction, 60-79 = moderate, 40-59 = low conviction
- Target price should be realistic 30-day target based on support/resistance levels
- Tags should be short (2-3 words max): e.g. "RSI Oversold", "Volume Surge", "News Catalyst", "Trend Break", "Momentum Strong"
- Do NOT give generic analyses. Every thesis must reference the specific numbers provided.`;

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-5",
        max_tokens: 4000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!r.ok) {
      console.error("Claude API error:", await r.text());
      return {};
    }

    const data = await r.json() as { content: { type: string; text: string }[] };
    const text = data.content.find(c => c.type === "text")?.text ?? "";

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return {};

    const parsed = JSON.parse(jsonMatch[0]) as {
      analyses: Array<{
        ticker: string; signal: string; confidence: number;
        targetPrice: number; thesis: string; risks: string; tags: string[];
      }>
    };

    const result: Record<string, { signal: string; confidence: number; targetPrice: number; thesis: string; risks: string; tags: string[] }> = {};
    for (const a of parsed.analyses) {
      result[a.ticker] = {
        signal: a.signal,
        confidence: Math.min(98, Math.max(30, a.confidence)),
        targetPrice: a.targetPrice,
        thesis: a.thesis,
        risks: a.risks,
        tags: a.tags?.slice(0, 4) ?? [],
      };
    }
    return result;
  } catch (err) {
    console.error("Claude analysis error:", err);
    return {};
  }
}

/* ---- Score calculation ------------------------------------- */
function calcScore(
  rsi: number, momentum5d: number, momentum20d: number,
  volumeRatio: number, signal: string, confidence: number
): number {
  let score = 50;
  // RSI contribution
  if (rsi < 30) score += 20; else if (rsi < 45) score += 10;
  else if (rsi > 70) score -= 20; else if (rsi > 60) score -= 8;
  // Momentum
  score += Math.min(20, Math.max(-20, momentum5d * 2));
  score += Math.min(15, Math.max(-15, momentum20d));
  // Volume
  if (volumeRatio > 2) score += 10; else if (volumeRatio > 1.5) score += 5;
  // AI signal
  const sigBoost: Record<string, number> = { "STRONG BUY":25, "BUY":15, "HOLD":0, "SELL":-15, "STRONG SELL":-25 };
  score += (sigBoost[signal] ?? 0) * (confidence / 100);
  return Math.min(100, Math.max(0, Math.round(score)));
}

/* ---- Main API handler -------------------------------------- */
export async function POST(req: NextRequest) {
  try {
    const { tickers } = await req.json() as { tickers: { t: string; n: string; s: string }[] };

    if (!ANTHROPIC_KEY) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
    }

    // Step 1: Fetch all price data in parallel (batched)
    const BATCH = 4;
    const allBars: Record<string, AggBar[]> = {};
    const allSnapshots: Record<string, { price: number; change: number; changePct: number; high: number; low: number; open: number; volume: number } | null> = {};

    for (let i = 0; i < tickers.length; i += BATCH) {
      const batch = tickers.slice(i, i + BATCH);
      const results = await Promise.all(
        batch.map(async ({ t }) => ({
          ticker: t,
          bars: await fetchBars(t, 60),
          snapshot: await fetchSnapshot(t),
        }))
      );
      for (const r of results) {
        allBars[r.ticker] = r.bars;
        allSnapshots[r.ticker] = r.snapshot;
      }
      if (i + BATCH < tickers.length) await new Promise(res => setTimeout(res, 300));
    }

    // Step 2: Fetch news in parallel
    const newsResults = await Promise.all(
      tickers.map(async ({ t }) => ({ ticker: t, news: await fetchNews(t) }))
    );
    const allNews: Record<string, string[]> = {};
    for (const n of newsResults) allNews[n.ticker] = n.news;

    // Step 3: Calculate technical indicators for each stock
    const techData = tickers.map(({ t, n, s }) => {
      const bars    = allBars[t] ?? [];
      const snap    = allSnapshots[t];
      const closes  = bars.map(b => b.c);
      const volumes = bars.map(b => b.v);

      // Price from snapshot (live) or last bar
      let price = 0, change = 0, changePct = 0, high = 0, low = 0, open = 0, volume = 0;
      if (snap && snap.price > 0) {
        ({ price, change, changePct, high, low, open, volume } = snap);
      } else if (bars.length >= 2) {
        const last = bars[bars.length - 1];
        const prev = bars[bars.length - 2];
        price = last.c; change = +(last.c - prev.c).toFixed(2);
        changePct = +((change / prev.c) * 100).toFixed(2);
        high = last.h; low = last.l; open = last.o; volume = last.v;
      }

      const rsi         = calcRSI(closes);
      const sma20       = calcSMA(closes, 20);
      const sma50       = calcSMA(closes, 50);
      const momentum5d  = calcMomentum(closes, 5);
      const momentum20d = calcMomentum(closes, 20);
      const support     = calcSupport(bars);
      const resistance  = calcResistance(bars);
      const volAvg20    = volumes.slice(-20).reduce((a, b) => a + b, 0) / Math.min(20, volumes.length || 1);
      const volumeRatio = volAvg20 > 0 ? +(volume / volAvg20).toFixed(2) : 1;

      return {
        ticker: t, name: n, sector: s,
        price, change, changePct, high, low, open, volume,
        rsi, sma20, sma50, volumeRatio, momentum5d, momentum20d,
        support, resistance, news: allNews[t] ?? [],
        bars,
      };
    }).filter(s => s.price > 0);

    // Step 4: Run Claude AI analysis on all stocks at once
    const aiResults = await runClaudeAnalysis(techData);

    // Step 5: Build final stock objects
    const stocks: StockAnalysis[] = techData.map(s => {
      const ai = aiResults[s.ticker];
      const signal    = (ai?.signal as StockAnalysis["signal"]) ?? "HOLD";
      const confidence = ai?.confidence ?? 50;
      const targetPrice = ai?.targetPrice ?? +(s.price * 1.05).toFixed(2);
      const thesis    = ai?.thesis ?? "Insufficient data for analysis.";
      const risks     = ai?.risks ?? "Market risk and macro uncertainty.";
      const tags      = ai?.tags ?? [];
      const score     = calcScore(s.rsi, s.momentum5d, s.momentum20d, s.volumeRatio, signal, confidence);

      // Floor/ceiling based on support/resistance + AI target
      const floor   = +(Math.min(s.support, s.price * 0.94)).toFixed(2);
      const ceiling = +(Math.max(s.resistance, targetPrice)).toFixed(2);

      return {
        ...s,
        signal, confidence, targetPrice, thesis, risks, tags,
        score, floor, ceiling,
      };
    });

    // Step 6: Sort by score descending, add rank
    stocks.sort((a, b) => b.score - a.score);
    stocks.forEach((s, i) => { s.rank = i + 1; (s as StockAnalysis & { rank: number }).rank = i + 1; });

    return NextResponse.json({ stocks: stocks.slice(0, 15), analyzedAt: new Date().toISOString() });

  } catch (err) {
    console.error("Analyze error:", err);
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }
}

// Add rank to StockAnalysis
declare module "./route" {
  interface StockAnalysis { rank: number; }
}
