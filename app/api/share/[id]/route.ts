import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY!;
const POLYGON_KEY  = process.env.NEXT_PUBLIC_POLYGON_API_KEY ?? "1xwzcvUOF9pft6PRNylO2Xc6X2QeQCGr";

interface Holding { ticker: string; shares: number; buyPrice: number; }
interface Snapshot { holdings: Holding[]; capturedAt: string; }

/* GET /api/share/[id]
   Public, no auth. Returns the snapshot enriched with current prices
   so the public viewer can show realized return per position.       */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/shared_portfolios?id=eq.${encodeURIComponent(id)}&select=id,created_at,owner_email,show_amounts,snapshot`,
      { headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` } }
    );
    if (!r.ok) return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
    const rows = await r.json() as Array<{ id: string; created_at: string; owner_email: string; show_amounts: boolean; snapshot: Snapshot }>;
    if (!rows.length) return NextResponse.json({ error: "Share not found" }, { status: 404 });

    const row = rows[0];
    const holdings = row.snapshot?.holdings ?? [];

    // Bulk-fetch current prices for all unique tickers
    const tickers = [...new Set(holdings.map(h => h.ticker))];
    const currentPrices: Record<string, number> = {};
    if (tickers.length) {
      try {
        const res = await fetch(
          `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${tickers.join(",")}&apiKey=${POLYGON_KEY}`
        );
        if (res.ok) {
          const d = await res.json() as { tickers?: Array<{ ticker: string; day: { c: number } }> };
          for (const t of d.tickers ?? []) if (t.day?.c > 0) currentPrices[t.ticker] = t.day.c;
        }
      } catch { /* */ }
    }

    // Enrich holdings with current value + return %
    const showAmounts = !!row.show_amounts;
    const enriched = holdings.map(h => {
      const cur = currentPrices[h.ticker] ?? h.buyPrice;
      const cost = h.shares * h.buyPrice;
      const val = h.shares * cur;
      const pnlPct = h.buyPrice > 0 ? +(((cur - h.buyPrice) / h.buyPrice) * 100).toFixed(2) : 0;
      // Default: hide concrete dollar amounts unless owner opted in
      return {
        ticker: h.ticker,
        shares: showAmounts ? h.shares : null,
        buyPrice: h.buyPrice,
        currentPrice: cur,
        costBasis: showAmounts ? +cost.toFixed(2) : null,
        marketValue: showAmounts ? +val.toFixed(2) : null,
        pnlDollar: showAmounts ? +(val - cost).toFixed(2) : null,
        pnlPct,
      };
    });

    return NextResponse.json({
      id: row.id,
      capturedAt: row.snapshot?.capturedAt ?? row.created_at,
      ownerHandle: row.owner_email ? row.owner_email.split("@")[0] : null,
      showAmounts,
      holdings: enriched,
      totalReturnPct: enriched.length
        ? +(enriched.reduce((s, h) => s + h.pnlPct, 0) / enriched.length).toFixed(2)
        : 0,
    });
  } catch (err) {
    console.error("[share/[id]] error:", err);
    return NextResponse.json({ error: "Failed to load share" }, { status: 500 });
  }
}
