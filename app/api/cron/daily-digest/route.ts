import { NextRequest, NextResponse } from "next/server";

export const dynamic    = "force-dynamic";
export const maxDuration = 300;

const SUPABASE_URL   = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_KEY   = process.env.SUPABASE_SECRET_KEY ?? "";
const POLYGON_KEY    = process.env.NEXT_PUBLIC_POLYGON_API_KEY ?? "1xwzcvUOF9pft6PRNylO2Xc6X2QeQCGr";
const ANTHROPIC_KEY  = process.env.ANTHROPIC_API_KEY ?? "";
const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
const CRON_SECRET    = process.env.CRON_SECRET ?? "";

const HDR = { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" };
const MODEL_CHAIN = ["claude-haiku-4-5", "claude-sonnet-4-6"] as const;

interface OptedInUser {
  email:    string;
  holdings: Array<{ ticker: string; shares: number; buyPrice: number }> | null;
}

interface PriceMap { [ticker: string]: { price: number; changePct: number; prevClose: number } }

/* ── Helpers ──────────────────────────────────────────────── */

async function fetchOptedInUsers(): Promise<OptedInUser[]> {
  if (!SUPABASE_URL) return [];
  // Server-side Pro gate: even if a free user flips digest_optin via
  // tampered localStorage, the cron only ships to subscription_status="pro".
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/portfolios?digest_optin=eq.true&subscription_status=eq.pro&select=email,holdings`,
    { headers: HDR }
  );
  if (!r.ok) {
    console.warn("[digest] fetch users failed:", r.status, await r.text().catch(() => ""));
    return [];
  }
  return await r.json() as OptedInUser[];
}

async function fetchPrices(tickers: string[]): Promise<PriceMap> {
  const uniq = [...new Set(tickers.map(t => t.toUpperCase()))].filter(Boolean);
  if (!uniq.length) return {};
  const out: PriceMap = {};
  // Polygon supports ~250 tickers per snapshot call — chunk to be safe
  for (let i = 0; i < uniq.length; i += 200) {
    const chunk = uniq.slice(i, i + 200);
    try {
      const r = await fetch(
        `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${chunk.join(",")}&apiKey=${POLYGON_KEY}`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (!r.ok) continue;
      const d = await r.json() as {
        tickers?: Array<{ ticker: string; day: { c: number }; prevDay: { c: number } }>;
      };
      for (const t of d.tickers ?? []) {
        const cur  = t.day?.c, prev = t.prevDay?.c;
        if (cur > 0 && prev > 0) {
          out[t.ticker] = { price: cur, prevClose: prev, changePct: ((cur - prev) / prev) * 100 };
        }
      }
    } catch { /* skip chunk */ }
  }
  return out;
}

async function fetchTopHeadlines(tickers: string[]): Promise<string[]> {
  if (!tickers.length) return [];
  try {
    const r = await fetch(
      `https://api.polygon.io/v2/reference/news?ticker=${tickers.slice(0, 5).join(",")}&limit=8&order=desc&apiKey=${POLYGON_KEY}`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!r.ok) return [];
    const d = await r.json() as { results?: Array<{ title: string; tickers: string[] }> };
    return (d.results ?? []).slice(0, 6).map(n =>
      `${n.tickers?.length ? `[${n.tickers.slice(0, 2).join(", ")}] ` : ""}${n.title}`
    );
  } catch { return [] }
}

async function generateDigest(args: {
  email: string;
  positions: Array<{ ticker: string; shares: number; buyPrice: number; cur: number; pnlPct: number; dayPct: number }>;
  totalValue: number;
  totalCost: number;
  dayChangeUsd: number;
  headlines: string[];
}): Promise<{ subject: string; html: string } | null> {
  if (!ANTHROPIC_KEY) return null;

  const totalPnlPct = args.totalCost > 0
    ? ((args.totalValue - args.totalCost) / args.totalCost) * 100
    : 0;
  const dayPct = args.totalValue > 0
    ? (args.dayChangeUsd / (args.totalValue - args.dayChangeUsd)) * 100
    : 0;

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  const positionsBlock = args.positions
    .sort((a, b) => Math.abs(b.dayPct) - Math.abs(a.dayPct))
    .map(p => `- ${p.ticker}: ${p.shares} sh @ $${p.buyPrice.toFixed(2)} → $${p.cur.toFixed(2)} (today ${p.dayPct >= 0 ? "+" : ""}${p.dayPct.toFixed(2)}%, total ${p.pnlPct >= 0 ? "+" : ""}${p.pnlPct.toFixed(1)}%)`)
    .join("\n");

  const newsBlock = args.headlines.length
    ? args.headlines.map(h => `- ${h}`).join("\n")
    : "(no notable headlines on user's holdings)";

  const prompt =
`You are writing a personalised pre-market briefing for an ArbibX subscriber. Today is ${today}.

USER'S PORTFOLIO:
${positionsBlock || "(empty portfolio)"}

PORTFOLIO TOTALS:
Value: $${args.totalValue.toFixed(2)}
Total P&L: ${totalPnlPct >= 0 ? "+" : ""}${totalPnlPct.toFixed(1)}%
Yesterday's session change: ${dayPct >= 0 ? "+" : ""}${dayPct.toFixed(2)}% (${args.dayChangeUsd >= 0 ? "+" : ""}$${args.dayChangeUsd.toFixed(2)})

RECENT HEADLINES on user's holdings:
${newsBlock}

Write a tight pre-market brief in HTML for an email. Structure:
1. ONE sentence opener — what mood the user should walk into the open with given their portfolio's day yesterday.
2. "What moved your portfolio" — 2-4 bullets calling out the biggest movers and brief reasoning. If a headline ties to a mover, reference it inline.
3. "What to watch today" — 2 bullets on what specific catalysts/data could move their positions today (earnings, macro events, sector rotations).
4. ONE-line risk reminder (e.g. an outsized position or unusual volatility you noticed).

RULES:
- Use real numbers from the data above, never invent figures.
- HTML only, no markdown. Use <p>, <ul><li>, <strong>. No tables, no images, no inline styles.
- Strong tags around tickers and percentages.
- Conversational but professional. ~150-250 words total.
- End with the line: <p style="font-size:11px;color:#888">Not financial advice · Generated by Claude AI on ArbibX</p>

Return ONLY the HTML body content (no <html>, <head>, <body> wrapper). Do not preface with "Here's your..." — start directly with the briefing.`;

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
          max_tokens: 1500,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!r.ok) { console.warn(`[digest] ${model} HTTP ${r.status}`); continue; }
      const d = await r.json() as { content: Array<{ type: string; text: string }> };
      const text = d.content?.find(c => c.type === "text")?.text ?? "";
      if (!text) continue;

      const arrow   = dayPct >= 0 ? "↑" : "↓";
      const subject = `Your morning brief · ${arrow} ${dayPct >= 0 ? "+" : ""}${dayPct.toFixed(2)}% yesterday`;
      return { subject, html: text };
    } catch (err) {
      console.warn(`[digest] ${model} threw:`, err);
    }
  }
  return null;
}

function wrapEmail(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
  </head>
  <body style="margin:0;padding:0;background:#08060f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,system-ui,sans-serif;color:#cdc7e0;">
    <div style="max-width:580px;margin:0 auto;padding:32px 20px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:24px;">
        <div style="width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#f0a500,#ffbe1a);display:inline-block;"></div>
        <div>
          <div style="font-size:18px;font-weight:700;color:#f4f0ff;letter-spacing:-0.01em;">ArbibX</div>
          <div style="font-size:10px;color:#7A9CBF;text-transform:uppercase;letter-spacing:0.12em;">Daily AI brief</div>
        </div>
      </div>
      <div style="background:#120f1e;border:1px solid rgba(90,72,150,0.3);border-radius:14px;padding:24px;line-height:1.6;font-size:14px;color:#cdc7e0;">
        ${bodyHtml}
      </div>
      <p style="font-size:11px;color:#4a4468;margin-top:24px;text-align:center;line-height:1.5;">
        You're getting this because you opted into the daily AI brief on
        <a href="https://www.arbibx.com" style="color:#f0a500;text-decoration:none;">arbibx.com</a>.
        <br/>Unsubscribe in
        <a href="https://www.arbibx.com" style="color:#f0a500;text-decoration:none;">Settings → Email digest</a>.
      </p>
    </div>
  </body>
</html>`;
}

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY) return false;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method:  "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "ArbibX Daily Brief <brief@arbibx.com>",
        to,
        subject,
        html: wrapEmail(html),
      }),
    });
    if (!r.ok) {
      console.warn("[digest] Resend error:", r.status, await r.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[digest] Resend threw:", err);
    return false;
  }
}

/* ── GET handler (cron entry point) ─────────────────────── */

export async function GET(req: NextRequest) {
  // Vercel Cron sends a special header; for ad-hoc curl tests, allow
  // a CRON_SECRET query param too.
  const auth = req.headers.get("authorization") ?? "";
  const isVercelCron = auth === `Bearer ${CRON_SECRET}` || req.headers.get("x-vercel-cron") === "1";
  const secretParam  = req.nextUrl.searchParams.get("secret");
  const isManual     = CRON_SECRET && secretParam === CRON_SECRET;
  if (!isVercelCron && !isManual) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!SUPABASE_URL || !SUPABASE_KEY || !ANTHROPIC_KEY || !RESEND_API_KEY) {
    return NextResponse.json({ error: "Missing env vars" }, { status: 503 });
  }

  const users = await fetchOptedInUsers();
  if (!users.length) {
    return NextResponse.json({ ok: true, sent: 0, skipped: 0, message: "No opted-in users" });
  }

  // Collect every unique ticker across all portfolios so we hit Polygon
  // once instead of N times
  const allTickers = new Set<string>();
  for (const u of users) for (const h of (u.holdings ?? [])) allTickers.add(h.ticker.toUpperCase());
  const prices = await fetchPrices([...allTickers]);

  let sent = 0, skipped = 0, failed = 0;
  // Send sequentially (Resend has burst limits, and Anthropic charges per
  // call) — a few seconds total for typical user counts.
  for (const u of users) {
    if (!u.holdings?.length) { skipped++; continue; }

    const positions = u.holdings
      .map(h => {
        const tk  = h.ticker.toUpperCase();
        const pq  = prices[tk];
        if (!pq) return null;
        const cur    = pq.price;
        const cost   = h.shares * h.buyPrice;
        const value  = h.shares * cur;
        const pnlPct = cost > 0 ? ((value - cost) / cost) * 100 : 0;
        const dayPct = pq.changePct;
        return { ticker: tk, shares: h.shares, buyPrice: h.buyPrice, cur, pnlPct, dayPct };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    if (!positions.length) { skipped++; continue; }

    const totalValue   = positions.reduce((s, p) => s + p.shares * p.cur, 0);
    const totalCost    = positions.reduce((s, p) => s + p.shares * p.buyPrice, 0);
    const dayChangeUsd = positions.reduce((s, p) => {
      const prev = prices[p.ticker]?.prevClose ?? p.cur;
      return s + p.shares * (p.cur - prev);
    }, 0);

    const headlines = await fetchTopHeadlines(positions.map(p => p.ticker));

    const digest = await generateDigest({
      email: u.email,
      positions,
      totalValue,
      totalCost,
      dayChangeUsd,
      headlines,
    });
    if (!digest) { failed++; continue; }

    const ok = await sendEmail(u.email, digest.subject, digest.html);
    ok ? sent++ : failed++;
  }

  console.log(`[digest] sent=${sent} skipped=${skipped} failed=${failed}`);
  return NextResponse.json({ ok: true, sent, skipped, failed, total: users.length });
}
