import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SUPABASE_URL   = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_KEY   = process.env.SUPABASE_SECRET_KEY ?? "";
const POLYGON_KEY    = process.env.NEXT_PUBLIC_POLYGON_API_KEY ?? "1xwzcvUOF9pft6PRNylO2Xc6X2QeQCGr";
const FINNHUB_KEY    = process.env.FINNHUB_API_KEY ?? "";
const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
const CRON_SECRET    = process.env.CRON_SECRET ?? "";
const APP_URL        = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.arbibx.com";

const HDR = { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };

interface OptedInUser {
  email:    string;
  holdings: Array<{ ticker: string; shares: number; buyPrice: number }> | null;
}

/* ── Estimated next earnings date per ticker ──────────────────
   Same heuristic as the EarningsCalendar component: pull the last
   few quarterly filings from Polygon and project the next one
   using the average inter-filing interval. Returns null if we
   can't establish a confident estimate. */
async function fetchNextEarnings(ticker: string): Promise<string | null> {
  try {
    const r = await fetch(
      `https://api.polygon.io/vX/reference/financials?ticker=${ticker}&timeframe=quarterly&limit=4&sort=filing_date&order=desc&apiKey=${POLYGON_KEY}`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!r.ok) return null;
    const d = await r.json() as { results?: Array<{ filing_date: string }> };
    const rows = d.results ?? [];
    if (!rows.length) return null;

    let avgInterval = 91;
    if (rows.length >= 2) {
      const intervals: number[] = [];
      for (let i = 0; i < rows.length - 1; i++) {
        const a = new Date(rows[i].filing_date).getTime();
        const b = new Date(rows[i + 1].filing_date).getTime();
        intervals.push((a - b) / 86400000);
      }
      avgInterval = Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length);
    }

    const last = new Date(rows[0].filing_date);
    const next = new Date(last.getTime() + avgInterval * 86400000);
    const nextStr = next.toISOString().split("T")[0];
    const today   = new Date().toISOString().split("T")[0];
    return nextStr >= today ? nextStr : null;
  } catch { return null; }
}

/* Finnhub's earnings calendar — returns the actual confirmed
   next-report date rather than an estimate from filing intervals.
   Much more reliable than Polygon for foreign ADRs (NVO, ARM, etc.)
   and for any ticker Polygon's beta financials endpoint omits.
   Free tier: 60 calls/min, more than enough at our user scale. */
async function fetchNextEarningsFinnhub(ticker: string): Promise<string | null> {
  if (!FINNHUB_KEY) return null;
  try {
    const today = new Date();
    const to    = new Date(today.getTime() + 120 * 86_400_000); // look 4 months ahead
    const fromStr = today.toISOString().split("T")[0];
    const toStr   = to.toISOString().split("T")[0];
    const r = await fetch(
      `https://finnhub.io/api/v1/calendar/earnings?from=${fromStr}&to=${toStr}&symbol=${ticker}&token=${FINNHUB_KEY}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!r.ok) return null;
    const d = await r.json() as { earningsCalendar?: Array<{ date: string; symbol: string }> };
    const rows = (d.earningsCalendar ?? [])
      .filter(e => e.date && e.symbol?.toUpperCase() === ticker.toUpperCase())
      .sort((a, b) => a.date.localeCompare(b.date));
    return rows[0]?.date ?? null;
  } catch { return null; }
}

/* Run requests in parallel batches of 10 so providers don't
   throttle us when we have a large pool of unique tickers.
   Strategy: try Polygon's filing-interval estimate first (no
   external rate limit), then for any ticker that returns null
   fall back to Finnhub's actual earnings calendar. */
async function bulkFetchEarnings(tickers: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const chunkSize = 10;

  // Pass 1: Polygon
  for (let i = 0; i < tickers.length; i += chunkSize) {
    const chunk = tickers.slice(i, i + chunkSize);
    const results = await Promise.all(chunk.map(async t => ({ t, date: await fetchNextEarnings(t) })));
    for (const r of results) if (r.date) out[r.t] = r.date;
  }

  // Pass 2: Finnhub for whatever Polygon missed
  if (FINNHUB_KEY) {
    const missing = tickers.filter(t => !out[t]);
    for (let i = 0; i < missing.length; i += chunkSize) {
      const chunk = missing.slice(i, i + chunkSize);
      const results = await Promise.all(chunk.map(async t => ({ t, date: await fetchNextEarningsFinnhub(t) })));
      for (const r of results) if (r.date) out[r.t] = r.date;
    }
  }

  return out;
}

async function fetchOptedInUsers(): Promise<OptedInUser[]> {
  if (!SUPABASE_URL) return [];
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/portfolios?digest_optin=eq.true&select=email,holdings`,
    { headers: HDR }
  );
  if (!r.ok) return [];
  return await r.json() as OptedInUser[];
}

/* ── Email + push notification ─────────────────────────────── */

function buildEmailHtml(email: string, items: Array<{ ticker: string; date: string; daysAway: number; shares: number; buyPrice: number }>): { subject: string; html: string } {
  const rows = items.map(i => {
    const niceDate = new Date(i.date + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
    const when     = i.daysAway === 0 ? "Today"
                  : i.daysAway === 1 ? "Tomorrow"
                  : `In ${i.daysAway} days`;
    return `
      <tr>
        <td style="padding:12px 14px;border-bottom:1px solid rgba(90,72,150,0.20);">
          <div style="font-family:'DM Mono',monospace;font-size:14px;font-weight:700;color:#f0a500;letter-spacing:0.04em;">${i.ticker}</div>
          <div style="font-size:11px;color:#7A9CBF;margin-top:2px;">${i.shares} sh @ $${i.buyPrice.toFixed(2)}</div>
        </td>
        <td style="padding:12px 14px;border-bottom:1px solid rgba(90,72,150,0.20);text-align:right;">
          <div style="font-size:12px;font-weight:600;color:#f4f0ff;">${when}</div>
          <div style="font-size:10px;color:#7A9CBF;font-family:'DM Mono',monospace;margin-top:2px;">${niceDate}</div>
        </td>
      </tr>
    `;
  }).join("");

  const tickerList = items.map(i => i.ticker).join(", ");
  const subject = items.length === 1
    ? `📊 ${items[0].ticker} reports ${items[0].daysAway === 0 ? "today" : items[0].daysAway === 1 ? "tomorrow" : `in ${items[0].daysAway} days`}`
    : `📊 ${items.length} of your stocks report soon — ${tickerList.slice(0, 60)}${tickerList.length > 60 ? "…" : ""}`;

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#08060f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,system-ui,sans-serif;color:#cdc7e0;">
  <div style="max-width:580px;margin:0 auto;padding:32px 20px;">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:24px;">
      <div style="width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#f0a500,#ffbe1a);"></div>
      <div>
        <div style="font-size:18px;font-weight:700;color:#f4f0ff;">ArbibX</div>
        <div style="font-size:10px;color:#7A9CBF;text-transform:uppercase;letter-spacing:0.12em;">Earnings reminder</div>
      </div>
    </div>
    <div style="background:#120f1e;border:1px solid rgba(90,72,150,0.3);border-radius:14px;padding:6px 0;">
      <p style="margin:14px 18px 8px;font-size:13px;color:#cdc7e0;line-height:1.55;">
        ${items.length === 1 ? "One of your holdings reports earnings soon:" : `${items.length} of your holdings report earnings in the next few days:`}
      </p>
      <table style="width:100%;border-collapse:collapse;margin-top:6px;">
        ${rows}
      </table>
      <p style="margin:14px 18px;font-size:11px;color:#7A9CBF;line-height:1.5;">
        Earnings can move a stock 5-15% in either direction. Consider reviewing your position size and any open price alerts before the report.
      </p>
    </div>
    <p style="font-size:11px;color:#4a4468;margin-top:24px;text-align:center;line-height:1.5;">
      You're getting this because you opted into ArbibX email alerts.
      <br/>Manage in <a href="${APP_URL}" style="color:#f0a500;text-decoration:none;">Settings → Email digest</a>.
    </p>
  </div>
</body></html>`;

  return { subject, html };
}

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY) return false;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method:  "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "ArbibX Earnings <brief@arbibx.com>",
        to,
        subject,
        html,
      }),
    });
    return r.ok;
  } catch { return false; }
}

async function sendPush(email: string, title: string, body: string): Promise<void> {
  try {
    await fetch(`${APP_URL}/api/push-send`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ email, title, body, url: "/?tab=earnings" }),
    });
  } catch { /* push is best-effort */ }
}

/* ── Cron handler ─────────────────────────────────────────── */

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const isVercelCron = auth === `Bearer ${CRON_SECRET}` || req.headers.get("x-vercel-cron") === "1";
  const secretParam  = req.nextUrl.searchParams.get("secret");
  const isManual     = CRON_SECRET && secretParam === CRON_SECRET;
  if (!isVercelCron && !isManual) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!SUPABASE_URL || !RESEND_API_KEY) {
    return NextResponse.json({ error: "Missing env vars" }, { status: 503 });
  }

  const users = await fetchOptedInUsers();
  if (!users.length) return NextResponse.json({ ok: true, sent: 0, message: "No opted-in users" });

  // Collect unique tickers across every user's portfolio so we
  // hit Polygon once per ticker, not once per user-ticker pair
  const allTickers = new Set<string>();
  for (const u of users) for (const h of (u.holdings ?? [])) allTickers.add(h.ticker.toUpperCase());
  if (!allTickers.size) return NextResponse.json({ ok: true, sent: 0, message: "No holdings" });

  const earnings = await bulkFetchEarnings([...allTickers]);

  // The earnings dates are estimates, so include anything 0-3
  // days out as "reporting soon" — better to send a slightly
  // early reminder than miss the actual report
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayMs = 86_400_000;
  const upcoming: Record<string, { date: string; daysAway: number }> = {};
  for (const [ticker, dateStr] of Object.entries(earnings)) {
    const d = new Date(dateStr + "T12:00:00Z");
    d.setHours(0, 0, 0, 0);
    const daysAway = Math.round((d.getTime() - today.getTime()) / dayMs);
    if (daysAway >= 0 && daysAway <= 3) {
      upcoming[ticker] = { date: dateStr, daysAway };
    }
  }

  // Debug helper: ?inspect=1 returns what the system saw without
  // sending anything. Use this to verify the system is checking the
  // right tickers when "sent: 0" looks suspicious.
  if (req.nextUrl.searchParams.get("inspect") === "1") {
    const tickerStatus = [...allTickers].map(t => ({
      ticker:    t,
      nextDate:  earnings[t] ?? "not estimated",
      upcoming:  !!upcoming[t],
      daysAway:  upcoming[t]?.daysAway ?? null,
    })).sort((a, b) => (a.nextDate < b.nextDate ? -1 : 1));
    return NextResponse.json({
      inspect:        true,
      uniqueTickers:  allTickers.size,
      withEstimate:   Object.keys(earnings).length,
      reportingSoon:  Object.keys(upcoming).length,
      today:          new Date().toISOString().split("T")[0],
      tickerStatus,
    });
  }

  if (!Object.keys(upcoming).length) {
    return NextResponse.json({ ok: true, sent: 0, message: "No earnings in the next 3 days" });
  }

  let sent = 0, skipped = 0, failed = 0;
  for (const u of users) {
    const items = (u.holdings ?? [])
      .map(h => {
        const tk = h.ticker.toUpperCase();
        const e  = upcoming[tk];
        if (!e) return null;
        return { ticker: tk, date: e.date, daysAway: e.daysAway, shares: h.shares, buyPrice: h.buyPrice };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => a.daysAway - b.daysAway);

    if (!items.length) { skipped++; continue; }

    const { subject, html } = buildEmailHtml(u.email, items);
    const ok = await sendEmail(u.email, subject, html);
    if (!ok) { failed++; continue; }

    // Best-effort push notification (no-op for users without a sub)
    const pushTitle = items.length === 1
      ? `${items[0].ticker} earnings ${items[0].daysAway === 0 ? "today" : items[0].daysAway === 1 ? "tomorrow" : `in ${items[0].daysAway}d`}`
      : `${items.length} of your stocks report earnings soon`;
    const pushBody = items.slice(0, 3).map(i => `${i.ticker} (${i.daysAway === 0 ? "today" : `+${i.daysAway}d`})`).join(", ");
    void sendPush(u.email, pushTitle, pushBody);

    sent++;
  }

  console.log(`[earnings-reminders] sent=${sent} skipped=${skipped} failed=${failed}`);
  return NextResponse.json({ ok: true, sent, skipped, failed, total: users.length });
}
