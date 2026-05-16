import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const POLYGON_KEY  = process.env.NEXT_PUBLIC_POLYGON_API_KEY ?? "1xwzcvUOF9pft6PRNylO2Xc6X2QeQCGr";
const POLYGON_BASE = "https://api.polygon.io";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;

/* ── In-memory result cache (5-minute TTL) ───────────────────
   Track record is identical for everyone — cache it server-side
   so we don't re-fetch all the historical prices on every visit.
   Keyed by `days` so the 7d / 30d / 90d / 365d ranges cache
   independently (a single shared slot would mean the first range
   any user picks gets pinned for 5 minutes). */
const cache = new Map<number, { result: unknown; expiresAt: number }>();
const CACHE_MS = 5 * 60 * 1000;

interface SnapshotRow {
  id: string;
  created_at: string;
  picks: Array<{
    ticker: string;
    name: string;
    sector: string;
    price: number;
    signal: string;
    confidence: number;
    targetPrice: number;
  }>;
}

interface PickReturn {
  ticker: string;
  signal: string;
  confidence: number;
  pickedAt: string;
  pickedPrice: number;
  currentPrice: number;
  returnPct: number;
  daysHeld: number;
}

/* ── Helpers ─────────────────────────────────────────────── */

async function fetchSnapshots(daysBack: number): Promise<SnapshotRow[]> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return [];
  const since = new Date(Date.now() - daysBack * 86_400_000).toISOString();
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/analysis_snapshots?created_at=gte.${encodeURIComponent(since)}&order=created_at.desc&select=id,created_at,picks`,
      {
        headers: {
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`,
        },
      }
    );
    if (!r.ok) {
      console.warn("[track-record] snapshot fetch failed:", r.status);
      return [];
    }
    return await r.json() as SnapshotRow[];
  } catch (err) {
    console.warn("[track-record] snapshot fetch threw:", err);
    return [];
  }
}

/* Bulk-fetch current prices for all unique tickers across all snapshots
   in ONE Polygon snapshot call. Returns ticker -> current closing price. */
async function fetchCurrentPrices(tickers: string[]): Promise<Record<string, number>> {
  if (!tickers.length) return {};
  const out: Record<string, number> = {};
  // Polygon URL has practical 2k char limit; chunk to be safe (~250 tickers/call)
  const chunkSize = 200;
  for (let i = 0; i < tickers.length; i += chunkSize) {
    const chunk = tickers.slice(i, i + chunkSize);
    try {
      const r = await fetch(
        `${POLYGON_BASE}/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${chunk.join(",")}&apiKey=${POLYGON_KEY}`
      );
      if (!r.ok) continue;
      const d = await r.json() as { tickers?: Array<{ ticker: string; day: { c: number } }> };
      for (const t of d.tickers ?? []) if (t.day?.c > 0) out[t.ticker] = t.day.c;
    } catch { /* */ }
  }
  return out;
}

/* Fetch a single ticker's daily close on a specific date (or the
   nearest preceding trading day). Used for the SPY benchmark line. */
async function fetchClose(ticker: string, isoDate: string): Promise<number | null> {
  try {
    // Polygon's open-close endpoint returns the daily close; use a 5-day
    // lookback to cover weekends/holidays.
    const dateOnly = isoDate.split("T")[0];
    const from = new Date(new Date(dateOnly).getTime() - 5 * 86_400_000).toISOString().split("T")[0];
    const r = await fetch(
      `${POLYGON_BASE}/v2/aggs/ticker/${ticker}/range/1/day/${from}/${dateOnly}?adjusted=true&sort=desc&limit=1&apiKey=${POLYGON_KEY}`
    );
    if (!r.ok) return null;
    const d = await r.json() as { results?: Array<{ c: number }> };
    return d.results?.[0]?.c ?? null;
  } catch { return null; }
}

/* Fetch a ticker's full daily-close history over a date range in
   one aggs call. Returns YYYY-MM-DD → close. Used for SPY alpha
   so we can compare each pick to the same-window SPY return rather
   than a single oldest-snapshot baseline. */
async function fetchDailyHistory(ticker: string, fromIso: string, toIso: string): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  try {
    const from = fromIso.split("T")[0];
    const to   = toIso.split("T")[0];
    const r = await fetch(
      `${POLYGON_BASE}/v2/aggs/ticker/${ticker}/range/1/day/${from}/${to}?adjusted=true&sort=asc&limit=50000&apiKey=${POLYGON_KEY}`
    );
    if (!r.ok) return out;
    const d = await r.json() as { results?: Array<{ c: number; t: number }> };
    for (const bar of d.results ?? []) {
      const date = new Date(bar.t).toISOString().split("T")[0];
      out.set(date, bar.c);
    }
  } catch { /* */ }
  return out;
}

/* Look up the SPY close on a specific calendar date, walking backward
   up to 7 days to cover weekends/holidays where no bar exists. */
function spyCloseOnOrBefore(history: Map<string, number>, dateIso: string): number | null {
  const day = new Date(dateIso.split("T")[0] + "T00:00:00Z");
  for (let i = 0; i < 7; i++) {
    const d = new Date(day.getTime() - i * 86_400_000).toISOString().split("T")[0];
    const v = history.get(d);
    if (typeof v === "number" && v > 0) return v;
  }
  return null;
}

/* ── Main GET handler ───────────────────────────────────── */

export async function GET(req: NextRequest) {
  try {
    const days = Math.max(7, Math.min(365, parseInt(req.nextUrl.searchParams.get("days") ?? "90", 10)));

    // Per-range cache: each (7|30|90|365) caches independently.
    const cached = cache.get(days);
    if (cached && Date.now() < cached.expiresAt) {
      return NextResponse.json(cached.result);
    }

    const snapshots = await fetchSnapshots(days);

    if (!snapshots.length) {
      const empty = {
        snapshotCount: 0,
        days,
        picks: [],
        aggregate: null,
        spyBenchmark: null,
        message: "No snapshots yet. Track record will start populating after the first Top 15 analysis.",
      };
      return NextResponse.json(empty);
    }

    // Filter only BUY/STRONG BUY picks (those are what the AI is
    // actually recommending, not HOLDs and SELLs)
    const buyPicks: Array<{ snap: SnapshotRow; pick: SnapshotRow["picks"][number] }> = [];
    const tickerSet = new Set<string>();
    for (const snap of snapshots) {
      for (const p of (snap.picks ?? [])) {
        const sig = (p.signal ?? "").toUpperCase().trim();
        if ((sig === "STRONG BUY" || sig === "BUY") && p.price > 0) {
          buyPicks.push({ snap, pick: p });
          tickerSet.add(p.ticker);
        }
      }
    }

    if (!buyPicks.length) {
      return NextResponse.json({
        snapshotCount: snapshots.length,
        days,
        picks: [],
        aggregate: null,
        spyBenchmark: null,
        message: "No BUY signals in the past period yet.",
      });
    }

    // Bulk-fetch current prices for every unique ticker
    const currentPrices = await fetchCurrentPrices([...tickerSet]);

    // Build per-pick return entries
    const picks: PickReturn[] = buyPicks.map(({ snap, pick }) => {
      const cur = currentPrices[pick.ticker] ?? 0;
      const returnPct = cur > 0 && pick.price > 0
        ? +(((cur - pick.price) / pick.price) * 100).toFixed(2)
        : 0;
      const daysHeld = Math.max(0, Math.round(
        (Date.now() - new Date(snap.created_at).getTime()) / 86_400_000
      ));
      return {
        ticker: pick.ticker,
        signal: pick.signal,
        confidence: pick.confidence,
        pickedAt: snap.created_at,
        pickedPrice: pick.price,
        currentPrice: cur,
        returnPct,
        daysHeld,
      };
    }).filter(p => p.currentPrice > 0);

    // Aggregates
    const wins   = picks.filter(p => p.returnPct > 0).length;
    const losses = picks.filter(p => p.returnPct < 0).length;
    const flat   = picks.length - wins - losses;
    const avgReturn = picks.length
      ? +(picks.reduce((s, p) => s + p.returnPct, 0) / picks.length).toFixed(2)
      : 0;
    const winRate = picks.length ? +((wins / picks.length) * 100).toFixed(1) : 0;

    // Dedupe by ticker before building best/worst lists — the same ticker
    // can appear in many consecutive snapshots, which would otherwise stuff
    // the Top 5 with repeats of the same name. For "best" we keep each
    // ticker's *highest* return; for "worst" its *lowest*.
    const dedupeByTicker = (arr: PickReturn[]): PickReturn[] => {
      const seen = new Set<string>();
      const out: PickReturn[] = [];
      for (const p of arr) {
        if (seen.has(p.ticker)) continue;
        seen.add(p.ticker);
        out.push(p);
      }
      return out;
    };
    const bestSorted  = [...picks].sort((a, b) => b.returnPct - a.returnPct);
    const worstSorted = [...picks].sort((a, b) => a.returnPct - b.returnPct);
    const best  = dedupeByTicker(bestSorted).slice(0, 5);
    const worst = dedupeByTicker(worstSorted).slice(0, 5);

    // SPY benchmark — fetch the full daily-close history over the
    // window once, then compute alpha PER pick (each pick's return
    // vs SPY over the SAME holding period). Average those alphas =
    // a fair "did the AI beat the market" number. The naive previous
    // approach compared per-pick returns from various dates against
    // SPY's return from only the OLDEST snapshot date — apples to
    // oranges, and it inflated SPY's number for newer picks.
    const oldestSnap = snapshots[snapshots.length - 1];
    const newestSnap = snapshots[0];
    const spyHistory = oldestSnap
      ? await fetchDailyHistory("SPY", oldestSnap.created_at, new Date().toISOString())
      : new Map<string, number>();
    const spyCurrent = currentPrices["SPY"]
      ?? (await fetchCurrentPrices(["SPY"]).then(m => m.SPY ?? null))
      ?? (spyHistory.size ? [...spyHistory.values()].pop() ?? null : null);

    let spyBenchmark: { startPrice: number; currentPrice: number; returnPct: number; sinceIso: string } | null = null;
    if (oldestSnap && spyCurrent) {
      const start = spyCloseOnOrBefore(spyHistory, oldestSnap.created_at) ?? await fetchClose("SPY", oldestSnap.created_at);
      if (start) {
        spyBenchmark = {
          startPrice: start,
          currentPrice: spyCurrent,
          returnPct: +(((spyCurrent - start) / start) * 100).toFixed(2),
          sinceIso: oldestSnap.created_at,
        };
      }
    }

    // Per-pick alpha: pick.returnPct - SPY return over the same
    // window. Skip picks where we can't resolve SPY's start price.
    let avgAlpha: number | null = null;
    if (spyCurrent && spyHistory.size) {
      const alphas: number[] = [];
      for (const p of picks) {
        const spyStart = spyCloseOnOrBefore(spyHistory, p.pickedAt);
        if (!spyStart) continue;
        const spyReturn = ((spyCurrent - spyStart) / spyStart) * 100;
        alphas.push(p.returnPct - spyReturn);
      }
      if (alphas.length) {
        avgAlpha = +(alphas.reduce((s, a) => s + a, 0) / alphas.length).toFixed(2);
      }
    }

    // ── Performance series for the chart ───────────────────
    // For each snapshot date, "if you'd bought the AI's BUY picks
    // on this date and held to today, what would your return be?"
    // Plotted alongside SPY's return from the same date so users
    // can compare the AI-follow strategy against just buying SPY.
    // Dedupe by calendar day — keep the snapshot with the most BUY
    // picks per day so multi-runs in one day don't crowd the chart.
    type SeriesPoint = { date: string; returnPct: number; spyReturnPct: number | null; picks: number };
    const dayBuckets = new Map<string, { snap: SnapshotRow; buyPicks: SnapshotRow["picks"] }>();
    for (const snap of snapshots) {
      const dateOnly = snap.created_at.split("T")[0];
      const buyPicks = (snap.picks ?? []).filter(p => {
        const sig = (p.signal ?? "").toUpperCase().trim();
        return (sig === "STRONG BUY" || sig === "BUY") && p.price > 0 && (currentPrices[p.ticker] ?? 0) > 0;
      });
      if (!buyPicks.length) continue;
      const existing = dayBuckets.get(dateOnly);
      if (!existing || buyPicks.length > existing.buyPicks.length) {
        dayBuckets.set(dateOnly, { snap, buyPicks });
      }
    }

    const series: SeriesPoint[] = [...dayBuckets.entries()]
      .map(([date, { buyPicks }]) => {
        const returns = buyPicks.map(p => {
          const cur = currentPrices[p.ticker] ?? 0;
          return ((cur - p.price) / p.price) * 100;
        });
        const avgRet = returns.reduce((s, x) => s + x, 0) / returns.length;
        const spyStart = spyCloseOnOrBefore(spyHistory, date);
        const spyRet = (spyStart && spyCurrent)
          ? ((spyCurrent - spyStart) / spyStart) * 100
          : null;
        return {
          date,
          returnPct:    +avgRet.toFixed(2),
          spyReturnPct: spyRet != null ? +spyRet.toFixed(2) : null,
          picks:        buyPicks.length,
        };
      })
      .sort((a, b) => a.date < b.date ? -1 : 1);

    const result = {
      snapshotCount: snapshots.length,
      days,
      windowOldestIso: oldestSnap?.created_at ?? null,
      windowNewestIso: newestSnap?.created_at ?? null,
      picks,
      series,
      aggregate: {
        totalPicks: picks.length,
        wins, losses, flat,
        winRate,
        avgReturn,
        best,
        worst,
      },
      spyBenchmark,
      // Per-pick alpha (fair comparison) when we have SPY history;
      // fall back to the naive number for older clients that just
      // want a quick "did we beat SPY" indicator.
      vsBenchmark: avgAlpha
        ?? (spyBenchmark ? +(avgReturn - spyBenchmark.returnPct).toFixed(2) : null),
    };

    cache.set(days, { result, expiresAt: Date.now() + CACHE_MS });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[track-record] error:", err);
    return NextResponse.json({ error: "Failed to compute track record" }, { status: 500 });
  }
}
