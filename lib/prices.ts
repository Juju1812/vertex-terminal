/**
 * lib/prices.ts — Canonical price resolver for Vertex Terminal
 *
 * WHY THIS EXISTS
 * ───────────────
 * The Polygon.io free tier snapshot endpoint (/v2/snapshot) returns
 * day.c = 0 whenever the US market is closed (nights, weekends, holidays)
 * or the ticker hasn't traded in the current session yet.
 *
 * The old code used:  price = snap?.day?.c || MOCK_PRICE
 * That silently fell through to stale hardcoded data outside market hours.
 *
 * CORRECT STRATEGY (used everywhere in this module)
 * ──────────────────────────────────────────────────
 * 1. Try the multi-ticker snapshot  →  fast, works during live market hours.
 * 2. For every ticker where day.c == 0 or is missing, fetch the last 5 daily
 *    bars from the aggregates endpoint (/v2/aggs).  The last bar's close is
 *    ALWAYS the most recent official price — identical to what the chart shows.
 * 3. Never display MOCK / hardcoded prices for price/change fields.
 *
 * This file exports:
 *   resolvePrice(ticker)        – single ticker, returns LivePrice
 *   resolvePrices(tickers[])   – bulk, one snapshot + targeted bar fills
 */

const API_KEY = "1xwzcvUOF9pft6PRNylO2Xc6X2QeQCGr";
const BASE    = "https://api.polygon.io";

export interface LivePrice {
  ticker:    string;
  price:     number;   // most recent official close (or live last sale)
  changePct: number;   // vs previous close
  change:    number;   // absolute change
  high:      number;
  low:       number;
  open:      number;
  volume:    number;
  source:    "snapshot" | "bars"; // diagnostic — tells you which path ran
}

/* ── Internal fetch helper ─────────────────────────────────────── */
async function apiFetch<T>(path: string): Promise<T | null> {
  try {
    const sep = path.includes("?") ? "&" : "?";
    const r   = await fetch(`${BASE}${path}${sep}apiKey=${API_KEY}`, {
      // next.js cache: 'no-store' so we always get fresh data
      cache: "no-store",
    } as RequestInit);
    if (!r.ok) return null;
    return r.json() as Promise<T>;
  } catch {
    return null;
  }
}

/* ── Fetch the last N daily bars for a single ticker ───────────── */
export async function fetchBars(
  ticker: string,
  days = 92
): Promise<Array<{ date: string; close: number }>> {
  const to   = new Date().toISOString().split("T")[0];
  const from = new Date(Date.now() - days * 86_400_000)
    .toISOString()
    .split("T")[0];

  const d = await apiFetch<{ results?: { c: number; o:number; h:number; l:number; v:number; t: number }[] }>(
    `/v2/aggs/ticker/${ticker}/range/1/day/${from}/${to}?adjusted=true&sort=asc&limit=120`
  );

  if (!d?.results?.length) return [];

  return d.results.map(b => ({
    date:   new Date(b.t).toISOString().split("T")[0],
    close:  b.c,
    open:   b.o,
    high:   b.h,
    low:    b.l,
    volume: b.v,
  })) as Array<{ date:string; close:number; open?:number; high?:number; low?:number; volume?:number }>;
}

/* ─────────────────────────────────────────────────────────────────
   resolvePrices  — the main workhorse
   Resolves live prices for an array of tickers using the optimal
   combination of snapshot + bars fallback.
   ───────────────────────────────────────────────────────────────── */
export async function resolvePrices(tickers: string[]): Promise<Map<string, LivePrice>> {
  const result = new Map<string, LivePrice>();
  if (!tickers.length) return result;

  const unique = [...new Set(tickers)];

  /* ── Step 1: bulk snapshot ──────────────────────────────────── */
  const snapData = await apiFetch<{
    tickers?: Array<{
      ticker:   string;
      day:      { c:number; o:number; h:number; l:number; v:number };
      prevDay:  { c:number };
    }>;
  }>(`/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${unique.join(",")}`);

  const snapMap = new Map<string, typeof snapData extends { tickers?: Array<infer T> } ? T : never>();
  if (snapData?.tickers) {
    for (const s of snapData.tickers) {
      snapMap.set(s.ticker, s as any);
    }
  }

  /* ── Step 2: classify each ticker ──────────────────────────── */
  const needBars: string[] = [];

  for (const ticker of unique) {
    const s = snapMap.get(ticker);
    // A valid live snapshot has day.c > 0 AND prevDay.c > 0
    if (s && s.day?.c > 0 && s.prevDay?.c > 0) {
      const price = s.day.c;
      const prev  = s.prevDay.c;
      const chg   = price - prev;
      result.set(ticker, {
        ticker,
        price,
        change:    +chg.toFixed(2),
        changePct: +((chg / prev) * 100).toFixed(2),
        high:      s.day.h || price,
        low:       s.day.l || price,
        open:      s.day.o || price,
        volume:    s.day.v || 0,
        source:    "snapshot",
      });
    } else {
      // day.c is 0 (market closed/pre-market/not traded yet) → need bars
      needBars.push(ticker);
    }
  }

  /* ── Step 3: bars fallback for everything the snapshot missed ── */
  if (needBars.length > 0) {
    // Fetch all missing tickers in parallel — aggs endpoint has no bulk option
    const barResults = await Promise.all(
      needBars.map(async ticker => {
        const bars = await fetchBars(ticker, 5); // only need last 2 bars
        return { ticker, bars };
      })
    );

    for (const { ticker, bars } of barResults) {
      if (bars.length < 2) continue; // truly no data

      const last = bars[bars.length - 1] as any;
      const prev = bars[bars.length - 2] as any;
      const chg  = last.close - prev.close;

      // For OHLV: try to use what the snapshot gave us if it had partial data
      const snap = snapMap.get(ticker) as any;

      result.set(ticker, {
        ticker,
        price:     last.close,
        change:    +chg.toFixed(2),
        changePct: +((chg / prev.close) * 100).toFixed(2),
        high:      snap?.day?.h > 0 ? snap.day.h : (last.high  ?? +(last.close * 1.005).toFixed(2)),
        low:       snap?.day?.l > 0 ? snap.day.l : (last.low   ?? +(last.close * 0.995).toFixed(2)),
        open:      snap?.day?.o > 0 ? snap.day.o : (last.open  ?? prev.close),
        volume:    snap?.day?.v > 0 ? snap.day.v : (last.volume ?? 0),
        source:    "bars",
      });
    }
  }

  return result;
}

/* ── Single-ticker convenience wrapper ─────────────────────────── */
export async function resolvePrice(ticker: string): Promise<LivePrice | null> {
  const m = await resolvePrices([ticker]);
  return m.get(ticker) ?? null;
}

/* ── Seed bars (deterministic, for instant UI before API responds) */
export function seedBars(base: number, days = 90): Array<{ date:string; close:number }> {
  const out: Array<{ date:string; close:number }> = [];
  let p = base * 0.81, seed = Math.round(base * 137);
  const r = () => {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    return (seed >>> 0) / 0xffffffff;
  };
  const now = new Date();
  for (let i = days; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    p += (r() - 0.47) * 0.022 * p;
    out.push({ date: d.toISOString().split("T")[0], close: +p.toFixed(2) });
  }
  return out;
}
