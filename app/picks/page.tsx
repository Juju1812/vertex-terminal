import type { Metadata } from "next";
import Link from "next/link";
import Footer from "@/components/Footer";

/* ── /picks — public AI Top 15 page ──────────────────────────
   Server-rendered, no-login, fully indexable. The viral lever
   for sharing on X/Reddit/Discord. Reads the latest snapshot
   from analysis_snapshots in Supabase so the page reflects what
   the AI is currently flagging as the top 15 picks.

   Free tier in-app shows only 5 of 15 to drive Pro upgrades —
   this public page is the marketing version, showing all 15
   with company / price / signal / target / confidence. The
   deeper analysis (target rationale, risk notes, AI thesis,
   live charts) lives behind the app shell + Pro gate. */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY ?? "";
const POLYGON_KEY  = process.env.NEXT_PUBLIC_POLYGON_API_KEY ?? "1xwzcvUOF9pft6PRNylO2Xc6X2QeQCGr";

export const revalidate = 1800;

interface SnapshotPick {
  ticker:      string;
  name:        string;
  sector:      string;
  price:       number;
  signal:      string;
  confidence:  number;
  targetPrice: number;
}

interface EnrichedPick extends SnapshotPick {
  livePrice:   number;
  changePct:   number;
  upsidePct:   number;
}

async function fetchLatestSnapshot(): Promise<{ picks: SnapshotPick[]; createdAt: string } | null> {
  if (!SUPABASE_URL) return null;
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/analysis_snapshots?order=created_at.desc&limit=1&select=created_at,picks`,
      {
        headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` },
        signal: AbortSignal.timeout(4000),
        next: { revalidate: 1800 },
      }
    );
    if (!r.ok) return null;
    const rows = await r.json() as Array<{ created_at: string; picks: SnapshotPick[] }>;
    const row = rows[0];
    if (!row?.picks || !Array.isArray(row.picks)) return null;
    return { picks: row.picks, createdAt: row.created_at };
  } catch { return null; }
}

async function fetchLivePrices(tickers: string[]): Promise<Record<string, { price: number; changePct: number }>> {
  if (!tickers.length) return {};
  try {
    const r = await fetch(
      `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${tickers.join(",")}&apiKey=${POLYGON_KEY}`,
      { signal: AbortSignal.timeout(4000), next: { revalidate: 1800 } }
    );
    if (!r.ok) return {};
    const d = await r.json() as { tickers?: Array<{ ticker: string; day: { c: number }; prevDay: { c: number } }> };
    const out: Record<string, { price: number; changePct: number }> = {};
    for (const t of d.tickers ?? []) {
      const cur = t.day?.c, prev = t.prevDay?.c;
      if (cur > 0 && prev > 0) out[t.ticker] = { price: cur, changePct: ((cur - prev) / prev) * 100 };
    }
    return out;
  } catch { return {}; }
}

export async function generateMetadata(): Promise<Metadata> {
  const snap = await fetchLatestSnapshot();
  const top3 = snap?.picks.slice(0, 3).map(p => p.ticker).join(", ") ?? "the top 15 stocks";
  const todayStr = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  const title       = `Today's AI Top 15 Stock Picks · ${todayStr} · ArbibX`;
  const description = `Today the AI is flagging ${top3} and 12 more as the most actionable picks across thousands of US-listed stocks. Live prices, confidence scores, and target prices. Updated continuously.`;

  return {
    title,
    description,
    alternates: { canonical: "https://www.arbibx.com/picks" },
    keywords: [
      "AI stock picks today",
      "best stocks to buy today",
      "top stock picks 2026",
      "AI stock recommendations",
      "Claude AI stocks",
      "stock signals",
    ],
    openGraph: {
      title, description,
      type: "website",
      url:  "https://www.arbibx.com/picks",
      siteName: "ArbibX",
      images: [{
        url: `https://www.arbibx.com/api/og?type=default&h=${encodeURIComponent("Today's AI Top 15 picks")}&s=${encodeURIComponent("Live signals from Claude across thousands of stocks")}`,
        width: 1200, height: 630, alt: "AI Top 15 picks on ArbibX",
      }],
    },
    twitter: {
      card: "summary_large_image",
      title, description,
      images: [`https://www.arbibx.com/api/og?type=default&h=${encodeURIComponent("AI Top 15 picks today")}`],
    },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
  };
}

function fmtPct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function signalColor(sig: string): string {
  const s = sig.toUpperCase().trim();
  if (s === "STRONG BUY") return "var(--gain, #00e5a0)";
  if (s === "BUY")        return "var(--gain, #00e5a0)";
  if (s === "HOLD")       return "var(--ink2, #7A9CBF)";
  return "var(--loss, #ff4560)";
}
function signalBg(sig: string): string {
  const s = sig.toUpperCase().trim();
  if (s === "STRONG BUY") return "rgba(0,229,160,0.16)";
  if (s === "BUY")        return "rgba(0,229,160,0.10)";
  if (s === "HOLD")       return "rgba(122,156,191,0.10)";
  return "rgba(255,69,96,0.10)";
}

export default async function PicksPage() {
  const snap = await fetchLatestSnapshot();
  const tickers = (snap?.picks ?? []).map(p => p.ticker);
  const livePrices = await fetchLivePrices(tickers);

  const enriched: EnrichedPick[] = (snap?.picks ?? []).map(p => {
    const live = livePrices[p.ticker];
    const livePrice  = live?.price ?? p.price;
    const changePct  = live?.changePct ?? 0;
    const upsidePct  = p.targetPrice > 0 && livePrice > 0
      ? ((p.targetPrice - livePrice) / livePrice) * 100
      : 0;
    return { ...p, livePrice, changePct, upsidePct };
  });

  const buyCount   = enriched.filter(p => /^(STRONG )?BUY$/i.test(p.signal.trim())).length;
  const avgUpside  = enriched.length
    ? enriched.reduce((s, p) => s + p.upsidePct, 0) / enriched.length
    : 0;

  const todayStr = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const updatedRel = snap?.createdAt
    ? (() => {
        const m = Math.floor((Date.now() - new Date(snap.createdAt).getTime()) / 60_000);
        if (m < 1) return "just now";
        if (m < 60) return `${m}m ago`;
        const h = Math.floor(m / 60);
        return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
      })()
    : "—";

  // ItemList JSON-LD so Google understands this is a curated list
  const itemList = enriched.length ? {
    "@context": "https://schema.org",
    "@type":    "ItemList",
    "name":     `AI Top ${enriched.length} stock picks · ${todayStr}`,
    "description": "Today's AI-ranked stock picks with live prices and target prices.",
    "itemListElement": enriched.map((p, i) => ({
      "@type":    "ListItem",
      "position": i + 1,
      "item": {
        "@type":        "Corporation",
        "name":         p.name || p.ticker,
        "tickerSymbol": p.ticker,
        "url":          `https://www.arbibx.com/stock/${p.ticker}`,
      },
    })),
  } : null;

  return (
    <>
      {itemList && (
        <script type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }} />
      )}

      <main style={{
        minHeight: "100vh",
        background: "var(--void, #050407)",
        color:      "var(--ink1, #cdc7e0)",
        fontFamily: "'Syne', system-ui, sans-serif",
        display:    "flex", flexDirection: "column",
      }}>
        <div style={{ flex: 1, padding: "44px 20px 60px" }}>
          <div style={{ maxWidth: 1080, margin: "0 auto" }}>

            {/* Hero header */}
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <p style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: 11, color: "var(--gold, #f0a500)",
                textTransform: "uppercase", letterSpacing: "0.18em",
                margin: 0, marginBottom: 12, fontWeight: 700,
              }}>
                Live AI rankings · Updated {updatedRel}
              </p>
              <h1 style={{
                fontFamily: "'Cabinet Grotesk', 'Syne', system-ui, sans-serif",
                fontSize: "clamp(34px, 6vw, 52px)", fontWeight: 800,
                color: "var(--ink0, #f4f0ff)",
                margin: "0 0 12px",
                letterSpacing: "-0.03em", lineHeight: 1.05,
              }}>
                Today&apos;s AI Top {enriched.length || 15} picks
              </h1>
              <p style={{
                fontSize: 16, color: "var(--ink2, #7A9CBF)",
                margin: "0 auto", maxWidth: 580, lineHeight: 1.55,
              }}>
                Claude AI ranked thousands of US-listed stocks by signal strength, momentum,
                and confidence — these are today&apos;s most actionable picks.
              </p>
            </div>

            {/* Quick stats bar */}
            {enriched.length > 0 && (
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: 10,
                marginBottom: 22,
              }}>
                {[
                  { label: "BUY signals", value: `${buyCount}/${enriched.length}`, color: "var(--gain, #00e5a0)" },
                  { label: "Avg upside",  value: fmtPct(avgUpside),                color: avgUpside >= 0 ? "var(--gain, #00e5a0)" : "var(--loss, #ff4560)" },
                  { label: "Universe",    value: "thousands of US stocks",         color: "var(--ink0, #f4f0ff)" },
                  { label: "AI model",    value: "Claude Opus",                    color: "var(--gold, #f0a500)" },
                ].map(s => (
                  <div key={s.label} style={{
                    padding: "14px 16px",
                    borderRadius: 12,
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid var(--border, rgba(60,48,100,0.5))",
                  }}>
                    <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--ink4, #1F3550)", textTransform: "uppercase", letterSpacing: "0.12em", margin: 0, fontWeight: 600 }}>
                      {s.label}
                    </p>
                    <p style={{
                      fontFamily: "'Cabinet Grotesk', system-ui, sans-serif",
                      fontSize: 22, fontWeight: 700, color: s.color,
                      margin: "4px 0 0", letterSpacing: "-0.01em",
                    }}>
                      {s.value}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Picks list */}
            {enriched.length === 0 ? (
              <div style={{
                padding: 30, textAlign: "center",
                borderRadius: 14,
                background: "rgba(255,255,255,0.02)",
                border: "1px solid var(--border, rgba(60,48,100,0.5))",
                color: "var(--ink2, #7A9CBF)",
              }}>
                <p style={{ margin: 0, fontSize: 14 }}>The next AI snapshot is being generated. Check back in a few minutes.</p>
              </div>
            ) : (
              <div style={{
                borderRadius: 14,
                background: "rgba(255,255,255,0.02)",
                border: "1px solid var(--border, rgba(60,48,100,0.5))",
                overflow: "hidden",
              }}>
                {/* Header row */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "44px 1fr auto 96px 96px",
                  gap: 12,
                  padding: "12px 18px",
                  background: "rgba(255,255,255,0.03)",
                  borderBottom: "1px solid var(--border, rgba(60,48,100,0.5))",
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 9,
                  fontWeight: 700,
                  color: "var(--ink3, #3D5A7A)",
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                }}>
                  <span>#</span>
                  <span>Ticker · Company</span>
                  <span>Signal</span>
                  <span style={{ textAlign: "right" }}>Price</span>
                  <span style={{ textAlign: "right" }}>Upside</span>
                </div>

                {enriched.map((p, i) => {
                  const sigColor = signalColor(p.signal);
                  const sigBgC   = signalBg(p.signal);
                  const upPositive = p.upsidePct >= 0;
                  return (
                    <Link key={p.ticker}
                      href={`/stock/${p.ticker}`}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "44px 1fr auto 96px 96px",
                        gap: 12, alignItems: "center",
                        padding: "14px 18px",
                        borderBottom: i < enriched.length - 1 ? "1px solid var(--border, rgba(60,48,100,0.3))" : "none",
                        textDecoration: "none", color: "inherit",
                        transition: "background 0.12s ease",
                      }}>
                      <span style={{
                        fontFamily: "'DM Mono', monospace", fontSize: 12,
                        color: i < 3 ? "var(--gold, #f0a500)" : "var(--ink4, #1F3550)",
                        fontWeight: 700,
                      }}>
                        {i + 1}
                      </span>
                      <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 14, fontWeight: 700, color: "var(--ticker-blue, #7EB6FF)", letterSpacing: "0.04em" }}>{p.ticker}</span>
                        <span style={{ fontSize: 11, color: "var(--ink2, #7A9CBF)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                      </span>
                      <span style={{
                        padding: "4px 9px", borderRadius: 99,
                        fontSize: 10, fontWeight: 700,
                        fontFamily: "'DM Mono', monospace",
                        color: sigColor, background: sigBgC,
                        border: `1px solid ${sigColor}40`,
                        letterSpacing: "0.04em",
                        whiteSpace: "nowrap",
                      }}>
                        {p.signal.toUpperCase()}
                      </span>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: "var(--ink0, #f4f0ff)", textAlign: "right", fontWeight: 600 }}>
                        ${p.livePrice.toFixed(2)}
                      </span>
                      <span style={{
                        fontFamily: "'DM Mono', monospace", fontSize: 12,
                        textAlign: "right", fontWeight: 700,
                        color: upPositive ? "var(--gain, #00e5a0)" : "var(--loss, #ff4560)",
                      }}>
                        {fmtPct(p.upsidePct)}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}

            {/* CTA */}
            <div style={{
              marginTop: 28,
              padding: "22px 24px",
              borderRadius: 14,
              background: "linear-gradient(135deg, rgba(240,165,0,0.08), rgba(155,114,245,0.06))",
              border: "1px solid rgba(240,165,0,0.32)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              gap: 14, flexWrap: "wrap",
            }}>
              <div style={{ flex: 1, minWidth: 240 }}>
                <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--gold, #f0a500)", textTransform: "uppercase", letterSpacing: "0.16em", margin: 0, fontWeight: 700 }}>
                  Want the full analysis?
                </p>
                <p style={{ fontFamily: "'Cabinet Grotesk', system-ui, sans-serif", fontSize: 17, fontWeight: 700, color: "var(--ink0, #f4f0ff)", margin: "4px 0 4px", letterSpacing: "-0.01em" }}>
                  Open the AI terminal — live charts, AI thesis, and risk notes per pick.
                </p>
                <p style={{ fontSize: 12, color: "var(--ink2, #7A9CBF)", margin: 0, lineHeight: 1.5 }}>
                  Free to browse. Ask Claude any question about the picks.
                </p>
              </div>
              <Link href="/?tab=top15"
                style={{
                  padding: "12px 20px",
                  borderRadius: 10,
                  background: "linear-gradient(135deg,#f0a500,#ffbe1a)",
                  color: "#0a0800",
                  fontFamily: "'Cabinet Grotesk', system-ui, sans-serif",
                  fontSize: 13, fontWeight: 800,
                  textDecoration: "none",
                  letterSpacing: "0.02em",
                  boxShadow: "0 6px 24px rgba(240,165,0,0.40)",
                  whiteSpace: "nowrap",
                }}>
                Open the terminal →
              </Link>
            </div>

            {/* SEO footer text */}
            <section style={{ marginTop: 36, fontSize: 13, lineHeight: 1.7, color: "var(--ink2, #7A9CBF)" }}>
              <h2 style={{
                fontFamily: "'Cabinet Grotesk', system-ui, sans-serif",
                fontSize: 20, fontWeight: 700,
                color: "var(--ink0, #f4f0ff)",
                margin: "0 0 12px",
                letterSpacing: "-0.01em",
              }}>
                How the AI Top 15 works
              </h2>
              <p>
                Every hour during market hours, ArbibX runs Claude AI across thousands of US-listed
                stocks with their latest fundamentals, technicals (RSI, momentum, support/resistance),
                volume signals, and earnings proximity. The AI ranks them by signal strength and
                confidence, then surfaces the {enriched.length || 15} most actionable picks with
                target prices and risk notes.
              </p>
              <p style={{ marginTop: 12 }}>
                This is general market information, not personalised financial advice. Always
                do your own research and consider consulting a licensed advisor before making
                investment decisions. Past performance does not guarantee future results.
              </p>
              <p style={{ marginTop: 12, fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--ink4, #1F3550)", textTransform: "uppercase", letterSpacing: "0.12em" }}>
                Snapshot updated {updatedRel} · Live prices via Polygon.io · AI by Claude
              </p>
            </section>
          </div>
        </div>

        <Footer />
      </main>
    </>
  );
}
