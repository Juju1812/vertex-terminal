import type { Metadata } from "next";
import SharedPortfolioView from "./SharedPortfolioView";

interface PageProps { params: Promise<{ id: string }>; }

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY ?? "";
const POLYGON_KEY  = process.env.NEXT_PUBLIC_POLYGON_API_KEY ?? "1xwzcvUOF9pft6PRNylO2Xc6X2QeQCGr";

interface Holding { ticker: string; shares: number; buyPrice: number; }

/* Compute the portfolio aggregate (grade + total return + position
   count) so the OG image preview shows real numbers. Hits Supabase
   directly with a 2.5s timeout so a slow request can never block
   server render. Returns null on any failure → falls back to the
   default OG card. */
async function fetchAggregate(id: string): Promise<{
  grade: string;
  pnlPct: number | null;
  positions: number;
  ownerName: string | null;
} | null> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/shared_portfolios?id=eq.${encodeURIComponent(id)}&select=owner_email,snapshot`,
      {
        headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` },
        signal:  AbortSignal.timeout(2500),
      }
    );
    if (!r.ok) return null;
    const rows = await r.json() as Array<{ owner_email: string; snapshot: { holdings?: Holding[] } }>;
    if (!rows.length) return null;
    const holdings = rows[0].snapshot?.holdings ?? [];
    if (!holdings.length) return null;

    // Bulk price for current values
    const tickers = [...new Set(holdings.map(h => h.ticker))];
    const priceMap: Record<string, number> = {};
    try {
      const pr = await fetch(
        `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${tickers.join(",")}&apiKey=${POLYGON_KEY}`,
        { signal: AbortSignal.timeout(2500) }
      );
      if (pr.ok) {
        const d = await pr.json() as { tickers?: Array<{ ticker: string; day: { c: number } }> };
        for (const t of d.tickers ?? []) if (t.day?.c > 0) priceMap[t.ticker] = t.day.c;
      }
    } catch { /* */ }

    let totalCost = 0, totalValue = 0;
    for (const h of holdings) {
      const cur = priceMap[h.ticker] ?? h.buyPrice;
      totalCost  += h.shares * h.buyPrice;
      totalValue += h.shares * cur;
    }
    const pnlPct = totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : null;

    // Simple grade heuristic mirroring the in-app grading.
    // Picks A+/A/B/C/D based on total return and position diversity.
    let grade = "C";
    const diversityBonus = Math.min(holdings.length, 10) >= 6 ? 5 : 0;
    const score = (pnlPct ?? 0) + diversityBonus;
    if (score >= 30) grade = "A+";
    else if (score >= 20) grade = "A";
    else if (score >= 10) grade = "B+";
    else if (score >= 0)  grade = "B";
    else if (score >= -10) grade = "C";
    else grade = "D";

    // Owner name: first name from email, capitalised
    const ownerName = rows[0].owner_email
      ? rows[0].owner_email.split("@")[0].split(/[._-]/)[0].replace(/^./, c => c.toUpperCase())
      : null;

    return { grade, pnlPct, positions: holdings.length, ownerName };
  } catch { return null; }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const agg = await fetchAggregate(id);

  // OG URL — passes the computed aggregates if available, falls
  // back to a default-portfolio card otherwise.
  const ogParams = new URLSearchParams({ type: "portfolio" });
  if (agg) {
    ogParams.set("grade", agg.grade);
    if (agg.pnlPct != null) ogParams.set("pnl", agg.pnlPct.toFixed(2));
    ogParams.set("n", String(agg.positions));
    if (agg.ownerName) ogParams.set("name", `${agg.ownerName}'s portfolio`);
  }
  const ogUrl = `https://www.arbibx.com/api/og?${ogParams.toString()}`;

  // Title & description
  let title       = "Shared Portfolio · ArbibX";
  let description = "AI-graded portfolio snapshot on ArbibX. AI-powered stock terminal.";
  if (agg) {
    const arrow = (agg.pnlPct ?? 0) >= 0 ? "▲" : "▼";
    const pct   = agg.pnlPct != null ? `${agg.pnlPct >= 0 ? "+" : ""}${agg.pnlPct.toFixed(1)}%` : "";
    title       = `${agg.ownerName ? `${agg.ownerName}'s portfolio` : "A portfolio"} · ${agg.grade} grade ${pct ? `${arrow} ${pct}` : ""} · ArbibX`;
    description = `AI grade: ${agg.grade}. ${agg.positions} positions${agg.pnlPct != null ? `, ${pct} total return` : ""}. View the full breakdown on ArbibX.`;
  }

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type:    "website",
      url:     `https://www.arbibx.com/p/${id}`,
      siteName:"ArbibX",
      images:  [{ url: ogUrl, width: 1200, height: 630, alt: "Shared portfolio on ArbibX" }],
    },
    twitter: {
      card:    "summary_large_image",
      title,
      description,
      images:  [ogUrl],
    },
  };
}

export default async function SharedPortfolioPage({ params }: PageProps) {
  const { id } = await params;
  return <SharedPortfolioView id={id} />;
}
