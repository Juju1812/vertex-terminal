import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const POLYGON_KEY  = process.env.NEXT_PUBLIC_POLYGON_API_KEY ?? "1xwzcvUOF9pft6PRNylO2Xc6X2QeQCGr";
const POLYGON_BASE = "https://api.polygon.io";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;

/* ── In-memory result cache (5-minute TTL) ───────────────────
   Track record is identical for everyone — cache it server-side
   so we don't re-fetch all the historical prices on every visit. */
let cache: { result: unknown; expiresAt: number } | null = null;
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

/* ── Main GET handler ───────────────────────────────────── */

export async function GET(req: NextRequest) {
  try {
    if (cache && Date.now() < cache.expiresAt) {
      return NextResponse.json(cache.result);
    }

    const days = Math.max(7, Math.min(365, parseInt(req.nextUrl.searchParams.get("days") ?? "90", 10)));
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
    const sorted = [...picks].sort((a, b) => b.returnPct - a.returnPct);
    const best  = sorted.slice(0, 5);
    const worst = sorted.slice(-5).reverse();

    // SPY benchmark over the same window: pick the oldest snapshot
    // date and compare SPY's close then to its current price
    const oldestSnap = snapshots[snapshots.length - 1];
    let spyBenchmark: { startPrice: number; currentPrice: number; returnPct: number; sinceIso: string } | null = null;
    if (oldestSnap) {
      const [start, current] = await Promise.all([
        fetchClose("SPY", oldestSnap.created_at),
        currentPrices["SPY"]
          ? Promise.resolve(currentPrices["SPY"])
          : fetchCurrentPrices(["SPY"]).then(m => m.SPY ?? null),
      ]);
      if (start && current) {
        spyBenchmark = {
          startPrice: start,
          currentPrice: current,
          returnPct: +(((current - start) / start) * 100).toFixed(2),
          sinceIso: oldestSnap.created_at,
        };
      }
    }

    const result = {
      snapshotCount: snapshots.length,
      days,
      picks,
      aggregate: {
        totalPicks: picks.length,
        wins, losses, flat,
        winRate,
        avgReturn,
        best,
        worst,
      },
      spyBenchmark,
      vsBenchmark: spyBenchmark ? +(avgReturn - spyBenchmark.returnPct).toFixed(2) : null,
    };

    cache = { result, expiresAt: Date.now() + CACHE_MS };
    return NextResponse.json(result);
  } catch (err) {
    console.error("[track-record] error:", err);
    return NextResponse.json({ error: "Failed to compute track record" }, { status: 500 });
  }
}
