import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY  = process.env.SUPABASE_SECRET_KEY!;
const POLYGON_KEY   = process.env.NEXT_PUBLIC_POLYGON_API_KEY ?? "1xwzcvUOF9pft6PRNylO2Xc6X2QeQCGr";
const CRON_SECRET   = process.env.CRON_SECRET; // optional shared secret to prevent abuse
const APP_URL       = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.arbibx.com";

/* Vercel cron alert checker.
   Runs every 5 minutes (configured in vercel.json) during US market
   hours. Reads all non-triggered alerts from Supabase, bulk-fetches
   current prices in one Polygon snapshot call, and fires email +
   web-push for any that have hit their target. Marks fired alerts
   triggered in Supabase so they don't double-fire on the next run. */

interface Alert {
  id: string;
  owner_email: string;
  ticker: string;
  condition: "above" | "below";
  target_price: number;
  triggered: boolean;
}

async function fetchPendingAlerts(): Promise<Alert[]> {
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/price_alerts?triggered=eq.false&select=id,owner_email,ticker,condition,target_price,triggered`,
      { headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` } }
    );
    if (!r.ok) return [];
    return await r.json() as Alert[];
  } catch { return []; }
}

async function fetchCurrentPrices(tickers: string[]): Promise<Record<string, number>> {
  if (!tickers.length) return {};
  try {
    const r = await fetch(
      `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${tickers.join(",")}&apiKey=${POLYGON_KEY}`
    );
    if (!r.ok) return {};
    const d = await r.json() as { tickers?: Array<{ ticker: string; day: { c: number } }> };
    const out: Record<string, number> = {};
    for (const t of d.tickers ?? []) if (t.day?.c > 0) out[t.ticker] = t.day.c;
    return out;
  } catch { return {}; }
}

async function markTriggered(id: string): Promise<void> {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/price_alerts?id=eq.${id}`, {
      method: "PATCH",
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
      },
      body: JSON.stringify({ triggered: true, triggered_at: new Date().toISOString() }),
    });
  } catch { /* */ }
}

async function fireAlert(alert: Alert, currentPrice: number): Promise<void> {
  try {
    await fetch(`${APP_URL}/api/send-alert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: alert.owner_email,
        ticker: alert.ticker,
        condition: alert.condition,
        targetPrice: alert.target_price,
        currentPrice,
      }),
    });
  } catch (err) {
    console.warn(`[cron] fire failed for ${alert.id}:`, err);
  }
}

export async function GET(req: NextRequest) {
  // Vercel attaches Authorization: Bearer <CRON_SECRET> when CRON_SECRET is
  // set in env. Reject any other caller. If CRON_SECRET isn't set, skip the
  // check (allows local testing).
  if (CRON_SECRET) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const startedAt = Date.now();
  const pending = await fetchPendingAlerts();
  if (!pending.length) {
    return NextResponse.json({ checked: 0, fired: 0, ms: Date.now() - startedAt });
  }

  // Bulk-fetch prices for all unique tickers in pending alerts
  const tickers = [...new Set(pending.map(a => a.ticker))];
  const prices = await fetchCurrentPrices(tickers);

  let fired = 0;
  for (const alert of pending) {
    const cur = prices[alert.ticker];
    if (!cur) continue;
    const hit =
      (alert.condition === "above" && cur >= alert.target_price) ||
      (alert.condition === "below" && cur <= alert.target_price);
    if (!hit) continue;
    // Mark first to prevent double-fire across overlapping cron runs
    await markTriggered(alert.id);
    // Then fire (email + push)
    await fireAlert(alert, cur);
    fired++;
  }

  return NextResponse.json({
    checked: pending.length,
    fired,
    tickers: tickers.length,
    ms: Date.now() - startedAt,
  });
}
