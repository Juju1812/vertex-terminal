import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 120;
export const dynamic = "force-dynamic";


const POLYGON_KEY = process.env.NEXT_PUBLIC_POLYGON_API_KEY ?? "1xwzcvUOF9pft6PRNylO2Xc6X2QeQCGr";
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const POLYGON_BASE = "https://api.polygon.io";

/* ---- Types -------------------------------------------------- */
interface AggBar {
  c: number; o: number; h: number; l: number; v: number; t: number;
}

interface StockAnalysis {
  rank: number;
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
  rsi: number;
  sma20: number;
  sma50: number;
  volumeRatio: number;
  momentum5d: number;
  momentum20d: number;
  support: number;
  resistance: number;
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
  if (!bars.length) return 0;
  const lows = bars.slice(-20).map(b => b.l).filter(v => v > 0);
  return lows.length ? +Math.min(...lows).toFixed(2) : 0;
}

function calcResistance(bars: AggBar[]): number {
  if (!bars.length) return 0;
  const highs = bars.slice(-20).map(b => b.h).filter(v => v > 0);
  return highs.length ? +Math.max(...highs).toFixed(2) : 0;
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
        model: "claude-haiku-4-5",
        max_tokens: 8000,
        messages: [
          {
            role: "user",
            content: prompt
          },
          {
            role: "assistant",
            content: '{"analyses":['
          }
        ],
      }),
    });

    if (!r.ok) {
      const errText = await r.text();
      console.error("Claude API error status:", r.status, errText);
      return {};
    }

    const data = await r.json() as { content: { type: string; text: string }[]; error?: { message: string } };
    
    if (data.error) {
      console.error("Claude API returned error:", data.error.message);
      return {};
    }

    const rawText = data.content?.find(c => c.type === "text")?.text ?? "";
    // We prefilled with {"analyses":[ so prepend it back
    const fullText = '{"analyses":[' + rawText;
    console.log("Claude response preview:", fullText.slice(0, 300));

    // Parse the JSON
    let parsed: { analyses: Array<{ ticker: string; signal: string; confidence: number; targetPrice: number; thesis: string; risks: string; tags: string[] }> };
    try {
      parsed = JSON.parse(fullText);
    } catch {
      // Try to fix truncated JSON by closing it
      const fixed = fullText.replace(/,\s*$/, "") + "]}";
      try {
        parsed = JSON.parse(fixed);
      } catch {
        console.error("JSON parse failed even after fix. Preview:", fullText.slice(0, 500));
        return {};
      }
    }

    console.log("Parsed analyses count:", parsed.analyses?.length);

    const result: Record<string, { signal: string; confidence: number; targetPrice: number; thesis: string; risks: string; tags: string[] }> = {};
    for (const a of parsed.analyses ?? []) {
      result[a.ticker] = {
        signal: a.signal,
        confidence: Math.min(98, Math.max(30, a.confidence)),
        targetPrice: a.targetPrice,
        thesis: a.thesis,
        risks: a.risks,
        tags: a.tags?.slice(0, 4) ?? [],
      };
    }
    console.log("Final result tickers:", Object.keys(result).join(", "));
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

    const tickerList = tickers.map(t => t.t);

    // Step 1: Bulk snapshot for ALL tickers in ONE request (fast)
    let snapMap: Record<string, { price: number; change: number; changePct: number; high: number; low: number; open: number; volume: number }> = {};
    try {
      const snapRes = await fetch(
        `${POLYGON_BASE}/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${tickerList.join(",")}&apiKey=${POLYGON_KEY}`
      );
      if (snapRes.ok) {
        const snapData = await snapRes.json() as { tickers?: Array<{ ticker: string; day: { c: number; h: number; l: number; o: number; v: number }; prevDay: { c: number } }> };
        for (const s of snapData.tickers ?? []) {
          if (s.day?.c > 0 && s.prevDay?.c > 0) {
            const chg = s.day.c - s.prevDay.c;
            snapMap[s.ticker] = {
              price: s.day.c, change: +chg.toFixed(2),
              changePct: +((chg / s.prevDay.c) * 100).toFixed(2),
              high: s.day.h, low: s.day.l, open: s.day.o, volume: s.day.v,
            };
          }
        }
      }
    } catch { /* ignore */ }

    // Step 2: For tickers missing from snapshot, fetch bars in parallel (no delays)
    const needBars = tickerList.filter(t => !snapMap[t]);
    const allBars: Record<string, AggBar[]> = {};

    if (needBars.length > 0) {
      const barResults = await Promise.all(
        needBars.map(t => fetchBars(t, 90).then(bars => ({ t, bars })))
      );
      for (const { t, bars } of barResults) {
        allBars[t] = bars;
      }
    }

    // Step 3: Only fetch news for tickers that have price data
    const hasPrice = tickerList.filter(t => {
      if (snapMap[t]) return true;
      const bars = allBars[t] ?? [];
      return bars.length >= 1;
    });

    // Fetch news in parallel for all priced stocks
    const newsResults = await Promise.all(
      hasPrice.map(t => fetchNews(t).then(news => ({ t, news })))
    );
    const allNews: Record<string, string[]> = {};
    for (const { t, news } of newsResults) allNews[t] = news;

    // Step 4: Calculate technical indicators
    const techData = tickers.map(({ t, n, s }) => {
      const snap   = snapMap[t];
      const bars   = allBars[t] ?? [];
      const closes = bars.map(b => b.c);
      const volumes = bars.map(b => b.v);

      let price = 0, change = 0, changePct = 0, high = 0, low = 0, open = 0, volume = 0;
      if (snap) {
        ({ price, change, changePct, high, low, open, volume } = snap);
      } else if (bars.length >= 1) {
        const last = bars[bars.length - 1];
        const prev = bars.length >= 2 ? bars[bars.length - 2] : null;
        price = last.c;
        change = prev ? +(last.c - prev.c).toFixed(2) : 0;
        changePct = prev && prev.c > 0 ? +((change / prev.c) * 100).toFixed(2) : 0;
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

    console.log(`Analyzing ${techData.length} stocks with price data`);

    // Step 5: Run Claude AI analysis in 3 parallel batches
    const third = Math.ceil(techData.length / 3);
    const [aiResults1, aiResults2, aiResults3] = await Promise.all([
      runClaudeAnalysis(techData.slice(0, third)),
      runClaudeAnalysis(techData.slice(third, third * 2)),
      runClaudeAnalysis(techData.slice(third * 2)),
    ]);
    const aiResults = { ...aiResults1, ...aiResults2, ...aiResults3 };

    // Step 6: Build final stock objects
    const stocks: StockAnalysis[] = techData.map(s => {
      const ai = aiResults[s.ticker];
      const signal     = (ai?.signal as StockAnalysis["signal"]) ?? "HOLD";
      const confidence = ai?.confidence ?? 50;
      const rawTarget  = ai?.targetPrice ?? 0;
      const targetPrice = rawTarget > 0 ? rawTarget : +(s.price * 1.05).toFixed(2);
      const thesis    = ai?.thesis ?? "Insufficient data for analysis.";
      const risks     = ai?.risks ?? "Market risk and macro uncertainty.";
      const tags      = ai?.tags ?? [];
      const score     = calcScore(s.rsi, s.momentum5d, s.momentum20d, s.volumeRatio, signal, confidence);
      const floor     = +(Math.min(s.support > 0 ? s.support : s.price * 0.94, s.price * 0.94)).toFixed(2);
      const ceiling   = +(Math.max(s.resistance > 0 ? s.resistance : s.price * 1.08, targetPrice)).toFixed(2);

      return {
        ...s,
        rank: 0,
        signal, confidence, targetPrice, thesis, risks, tags,
        score, floor, ceiling,
      };
    });

    stocks.sort((a, b) => b.score - a.score);
    stocks.forEach((s, i) => { s.rank = i + 1; });

    return NextResponse.json({ stocks: stocks.slice(0, 15), analyzedAt: new Date().toISOString() });

  } catch (err) {
    console.error("Analyze error:", err);
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }
}
