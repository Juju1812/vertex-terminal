import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

/* ── /compare/[pair] — head-to-head ticker comparison page ─────
   Slug format: AAPL-vs-NVDA, AAPL-vs-NVDA-vs-GOOGL, etc.
   Up to 4 tickers. Fully server-rendered for SEO so Google sees
   substantive prose, JSON-LD, and a comparison table without
   running JS. The /stock/[ticker] internal links spread link
   equity from these pages back into the per-ticker surface.

   This is one of the highest-leverage SEO surfaces in finance —
   "X vs Y" queries have stable demand, low competition, and
   long-tail variations are limitless. */

const POLYGON_KEY = process.env.NEXT_PUBLIC_POLYGON_API_KEY ?? "1xwzcvUOF9pft6PRNylO2Xc6X2QeQCGr";

export const revalidate = 1800;

interface PageProps { params: Promise<{ pair: string }>; }

interface TickerSnap {
  ticker:    string;
  name:      string;
  sector:    string;
  price:     number;
  changePct: number;
  open:      number;
  high:      number;
  low:       number;
  volume:    number;
  marketCap: number | null;
}

/* Parse the URL slug into a normalized list of uppercase tickers.
   "aapl-vs-nvda-vs-googl" → ["AAPL", "NVDA", "GOOGL"].
   Returns empty array on malformed input. */
function parsePair(raw: string): string[] {
  if (!raw) return [];
  // Tolerate both "vs" and "v" as separators since users type both
  const parts = raw.toUpperCase().split(/-VS-|-V-|-/g).filter(Boolean);
  // Each part should be a valid ticker (1-6 chars, A-Z + numbers)
  const valid = parts.filter(p => /^[A-Z][A-Z0-9.]{0,9}$/.test(p));
  // Dedupe while preserving order, cap at 4 tickers
  return [...new Set(valid)].slice(0, 4);
}

async function fetchSnap(ticker: string): Promise<TickerSnap | null> {
  try {
    const [snapRes, refRes] = await Promise.all([
      fetch(
        `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers/${ticker}?apiKey=${POLYGON_KEY}`,
        { signal: AbortSignal.timeout(2500), next: { revalidate: 1800 } }
      ),
      fetch(
        `https://api.polygon.io/v3/reference/tickers/${ticker}?apiKey=${POLYGON_KEY}`,
        { signal: AbortSignal.timeout(2500), next: { revalidate: 604_800 } }
      ),
    ]);
    if (!snapRes.ok) return null;
    const snap = await snapRes.json() as {
      ticker?: { day: { c: number; o: number; h: number; l: number; v: number }; prevDay: { c: number } };
    };
    const day = snap.ticker?.day, prev = snap.ticker?.prevDay;
    if (!day?.c || !prev?.c) return null;

    let name = ticker, sector = "", marketCap: number | null = null;
    if (refRes.ok) {
      const ref = await refRes.json() as { results?: { name?: string; sic_description?: string; market_cap?: number } };
      name      = ref.results?.name ?? ticker;
      sector    = ref.results?.sic_description ?? "";
      marketCap = ref.results?.market_cap ?? null;
    }

    return {
      ticker, name, sector,
      price:     day.c,
      changePct: ((day.c - prev.c) / prev.c) * 100,
      open: day.o, high: day.h, low: day.l, volume: day.v,
      marketCap,
    };
  } catch { return null; }
}

function fmtCap(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString()}`;
}
function fmtVol(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  return `${n}`;
}

/* ── Metadata ─────────────────────────────────────────────── */

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { pair } = await params;
  const tickers = parsePair(pair);
  if (!tickers.length) {
    return {
      title: "Compare stocks · ArbibX",
      description: "Side-by-side comparison of US-listed stocks with live price, market cap, sector, and AI-powered analysis.",
    };
  }

  const titleStr = tickers.join(" vs ");
  const title       = `${titleStr} — Stock Comparison, Price & AI Analysis | ArbibX`;
  const description = `${titleStr} side-by-side: live price, market cap, day change, sector, and AI-powered analysis. Decide which stock is the better buy on ArbibX.`;
  const canonical   = `https://www.arbibx.com/compare/${tickers.map(t => t).join("-vs-")}`;

  // OG image: ticker card for the first ticker (good enough — all
  // tickers in the comparison link back to their /stock/* page so
  // the share preview already provides useful context)
  const ogUrl = `https://www.arbibx.com/api/og?type=ticker&t=${tickers[0]}`;

  return {
    title,
    description,
    alternates: { canonical },
    keywords: [
      ...tickers.map(t => `${t} stock`),
      `${tickers.join(" vs ")}`,
      `${tickers[0]} vs ${tickers[1] ?? ""}`.trim(),
      `compare ${tickers.join(" and ")}`,
      "stock comparison",
      "stock analysis",
    ],
    openGraph: {
      title, description,
      type: "website",
      url:  canonical,
      siteName: "ArbibX",
      images: [{ url: ogUrl, width: 1200, height: 630, alt: `${titleStr} on ArbibX` }],
    },
    twitter: {
      card: "summary_large_image",
      title, description,
      images: [ogUrl],
    },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
  };
}

/* ── Page ─────────────────────────────────────────────────── */

export default async function ComparePage({ params }: PageProps) {
  const { pair } = await params;
  const tickers = parsePair(pair);
  if (tickers.length < 2) notFound();

  const snaps = await Promise.all(tickers.map(fetchSnap));
  const valid = snaps.filter((s): s is TickerSnap => s !== null);
  if (valid.length < 2) notFound();

  const titleStr = valid.map(s => s.ticker).join(" vs ");

  // Pick "winners" per metric for the prose section
  const byCap   = [...valid].sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0));
  const byDay   = [...valid].sort((a, b) => b.changePct - a.changePct);
  const byVol   = [...valid].sort((a, b) => b.volume - a.volume);
  const biggest = byCap[0];
  const dayWinner = byDay[0];
  const volLeader = byVol[0];

  // JSON-LD: FAQ + ItemList (each comparison item references the
  // canonical Stock URL so Google can stitch the two pages together
  // in its understanding of "these are related").
  const faq = {
    "@context": "https://schema.org",
    "@type":    "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name":  `Which is the better stock — ${titleStr}?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text":  `Whether ${titleStr} is the better investment depends on your goals, risk tolerance, and time horizon. ${biggest.name} (${biggest.ticker}) has the largest market cap at ${fmtCap(biggest.marketCap)}. Today, ${dayWinner.ticker} is leading with a ${dayWinner.changePct >= 0 ? "+" : ""}${dayWinner.changePct.toFixed(2)}% move. Use ArbibX's AI analysis, technical indicators, and recent news to decide which fits your portfolio.`,
        },
      },
      {
        "@type": "Question",
        "name":  `What's the price of ${valid.map(s => s.ticker).join(" and ")} today?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text":  valid.map(s => `${s.ticker} is trading at $${s.price.toFixed(2)} (${s.changePct >= 0 ? "+" : ""}${s.changePct.toFixed(2)}% on the day)`).join(". ") + ".",
        },
      },
      {
        "@type": "Question",
        "name":  `Which has the larger market cap?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text":  `${biggest.name} (${biggest.ticker}) is the largest by market cap at ${fmtCap(biggest.marketCap)}. The full ranking: ${byCap.map(s => `${s.ticker} (${fmtCap(s.marketCap)})`).join(", ")}.`,
        },
      },
    ],
  };

  const itemList = {
    "@context": "https://schema.org",
    "@type":    "ItemList",
    "name":     `${titleStr} — stock comparison`,
    "itemListElement": valid.map((s, i) => ({
      "@type":    "ListItem",
      "position": i + 1,
      "item": {
        "@type":        "Corporation",
        "name":         s.name,
        "tickerSymbol": s.ticker,
        "url":          `https://www.arbibx.com/stock/${s.ticker}`,
      },
    })),
  };

  return (
    <>
      <script type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faq) }} />
      <script type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }} />

      <main style={{
        minHeight: "100vh",
        background: "var(--void, #050407)",
        color:      "var(--ink1, #cdc7e0)",
        fontFamily: "'Syne', system-ui, sans-serif",
        padding:    "32px 20px",
      }}>
        <div style={{ maxWidth: 1080, margin: "0 auto" }}>

          {/* Header */}
          <div className="vx-page-header" style={{
            padding: "20px 22px",
            borderRadius: 14,
            border: "1px solid var(--border, rgba(60,48,100,0.5))",
            marginBottom: 22,
            backdropFilter: "blur(40px) saturate(1.5)",
            WebkitBackdropFilter: "blur(40px) saturate(1.5)",
          }}>
            <p style={{
              fontFamily: "'DM Mono', monospace", fontSize: 10,
              color: "var(--gold, #f0a500)",
              textTransform: "uppercase", letterSpacing: "0.16em",
              margin: 0, marginBottom: 8, fontWeight: 600,
            }}>
              Stock Comparison · Live Data
            </p>
            <h1 style={{
              fontFamily: "'Cabinet Grotesk', 'Syne', system-ui, sans-serif",
              fontSize: "clamp(28px, 4.5vw, 44px)", fontWeight: 700,
              color: "var(--ink0, #f4f0ff)",
              margin: "0 0 6px",
              letterSpacing: "-0.02em",
            }}>
              {titleStr}
            </h1>
            <p style={{ fontSize: 14, color: "var(--ink2, #7A9CBF)", margin: 0, lineHeight: 1.55 }}>
              Side-by-side comparison of {valid.map(s => `${s.name} (${s.ticker})`).join(", ")} — live price, market cap, day change, and sector classification.
            </p>
          </div>

          {/* Comparison cards */}
          <div style={{
            display: "grid",
            gridTemplateColumns: `repeat(${valid.length}, 1fr)`,
            gap: 12,
            marginBottom: 24,
          }}>
            {valid.map(s => {
              const positive = s.changePct >= 0;
              const color = positive ? "var(--gain, #00e5a0)" : "var(--loss, #ff4560)";
              return (
                <Link key={s.ticker}
                  href={`/stock/${s.ticker}`}
                  style={{
                    display: "block",
                    padding: "20px 18px",
                    borderRadius: 12,
                    border: "1px solid var(--border, rgba(60,48,100,0.5))",
                    background: "rgba(255,255,255,0.03)",
                    color: "inherit", textDecoration: "none",
                    transition: "border-color 0.18s ease, background 0.18s ease",
                  }}>
                  <div style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 22, fontWeight: 700,
                    color: "var(--gold, #f0a500)",
                    letterSpacing: "0.04em",
                    marginBottom: 4,
                  }}>
                    {s.ticker}
                  </div>
                  <div style={{
                    fontSize: 12,
                    color: "var(--ink2, #7A9CBF)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    marginBottom: 12,
                  }}>
                    {s.name}
                  </div>
                  <div style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 28, fontWeight: 700,
                    color: "var(--ink0, #f4f0ff)",
                    letterSpacing: "-0.01em",
                    marginBottom: 4,
                  }}>
                    ${s.price.toFixed(2)}
                  </div>
                  <div style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 13, fontWeight: 600,
                    color,
                  }}>
                    {positive ? "▲" : "▼"} {positive ? "+" : ""}{s.changePct.toFixed(2)}%
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Comparison table */}
          <div style={{
            borderRadius: 12,
            border: "1px solid var(--border, rgba(60,48,100,0.5))",
            background: "rgba(255,255,255,0.02)",
            overflow: "hidden",
            marginBottom: 24,
          }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'DM Mono', monospace", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid var(--border, rgba(60,48,100,0.5))" }}>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--ink3, #3D5A7A)" }}>
                    Metric
                  </th>
                  {valid.map(s => (
                    <th key={s.ticker} style={{ padding: "12px 16px", textAlign: "right", fontSize: 11, fontWeight: 700, color: "var(--gold, #f0a500)", letterSpacing: "0.04em" }}>
                      {s.ticker}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "Price",        get: (s: TickerSnap) => `$${s.price.toFixed(2)}` },
                  { label: "Day change",   get: (s: TickerSnap) => `${s.changePct >= 0 ? "+" : ""}${s.changePct.toFixed(2)}%`, color: (s: TickerSnap) => s.changePct >= 0 ? "var(--gain, #00e5a0)" : "var(--loss, #ff4560)" },
                  { label: "Day open",     get: (s: TickerSnap) => `$${s.open.toFixed(2)}` },
                  { label: "Day high",     get: (s: TickerSnap) => `$${s.high.toFixed(2)}` },
                  { label: "Day low",      get: (s: TickerSnap) => `$${s.low.toFixed(2)}` },
                  { label: "Volume",       get: (s: TickerSnap) => fmtVol(s.volume) },
                  { label: "Market cap",   get: (s: TickerSnap) => fmtCap(s.marketCap) },
                  { label: "Sector",       get: (s: TickerSnap) => s.sector || "—" },
                ].map((row, i) => (
                  <tr key={row.label} style={{ borderBottom: i < 7 ? "1px solid var(--border, rgba(60,48,100,0.3))" : "none" }}>
                    <td style={{ padding: "11px 16px", color: "var(--ink2, #7A9CBF)", fontWeight: 500 }}>
                      {row.label}
                    </td>
                    {valid.map(s => (
                      <td key={s.ticker} style={{
                        padding: "11px 16px",
                        textAlign: "right",
                        color: row.color ? row.color(s) : "var(--ink0, #f4f0ff)",
                        fontWeight: 600,
                      }}>
                        {row.get(s)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* SEO prose */}
          <section style={{ fontSize: 14, lineHeight: 1.7, color: "var(--ink2, #7A9CBF)" }}>
            <h2 style={{
              fontFamily: "'Cabinet Grotesk', 'Syne', system-ui, sans-serif",
              fontSize: 22, fontWeight: 700,
              color: "var(--ink0, #f4f0ff)",
              margin: "8px 0 12px",
              letterSpacing: "-0.01em",
            }}>
              {titleStr} — which stock is the better buy?
            </h2>
            <p>
              <strong style={{ color: "var(--ink0, #f4f0ff)" }}>{biggest.name}</strong> ({biggest.ticker})
              {" "}leads this comparison by market capitalization at{" "}
              <strong style={{ color: "var(--gold, #f0a500)" }}>{fmtCap(biggest.marketCap)}</strong>.
              {" "}{dayWinner.ticker} is today&apos;s top mover with a{" "}
              <strong style={{ color: dayWinner.changePct >= 0 ? "var(--gain, #00e5a0)" : "var(--loss, #ff4560)" }}>
                {dayWinner.changePct >= 0 ? "+" : ""}{dayWinner.changePct.toFixed(2)}%
              </strong>
              {" "}move,{" "}while {volLeader.ticker} sees the highest trading volume at {fmtVol(volLeader.volume)} shares.
            </p>
            <p style={{ marginTop: 12 }}>
              Whether <strong style={{ color: "var(--ink0, #f4f0ff)" }}>{titleStr}</strong> is the better
              investment for your portfolio depends on your time horizon, risk tolerance, and existing
              exposure. ArbibX runs Claude AI across thousands of US stocks daily and surfaces the most
              actionable picks with confidence scores and target prices. For a personalized analysis on
              {" "}{titleStr}, use the in-app &quot;Ask Claude&quot; assistant — it sees the live prices
              from this page plus your portfolio context.
            </p>

            <h3 style={{
              fontFamily: "'Cabinet Grotesk', system-ui, sans-serif",
              fontSize: 17, fontWeight: 700,
              color: "var(--ink0, #f4f0ff)",
              margin: "26px 0 10px",
            }}>
              Per-stock breakdown
            </h3>
            <ul style={{ paddingLeft: 22, margin: 0 }}>
              {valid.map(s => (
                <li key={s.ticker} style={{ marginBottom: 6 }}>
                  <Link href={`/stock/${s.ticker}`} style={{ color: "var(--gold, #f0a500)", fontWeight: 600, textDecoration: "none" }}>
                    {s.ticker}
                  </Link>
                  {" — "}
                  {s.name} trades at ${s.price.toFixed(2)}, day change {s.changePct >= 0 ? "+" : ""}{s.changePct.toFixed(2)}%
                  {s.sector && `, ${s.sector.toLowerCase()} sector`}
                  {s.marketCap && `, market cap ${fmtCap(s.marketCap)}`}.
                </li>
              ))}
            </ul>

            <h3 style={{
              fontFamily: "'Cabinet Grotesk', system-ui, sans-serif",
              fontSize: 17, fontWeight: 700,
              color: "var(--ink0, #f4f0ff)",
              margin: "26px 0 10px",
            }}>
              Frequently asked
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <p style={{ color: "var(--ink0, #f4f0ff)", fontWeight: 600, margin: "0 0 4px" }}>
                  Which is the better stock — {titleStr}?
                </p>
                <p style={{ margin: 0 }}>
                  It depends on your goals. {biggest.name} ({biggest.ticker}) has the larger market cap
                  at {fmtCap(biggest.marketCap)}. Today {dayWinner.ticker} is the strongest performer
                  ({dayWinner.changePct >= 0 ? "+" : ""}{dayWinner.changePct.toFixed(2)}%). For a
                  qualitative read on each name use the AI Top 15 tab on ArbibX.
                </p>
              </div>
              <div>
                <p style={{ color: "var(--ink0, #f4f0ff)", fontWeight: 600, margin: "0 0 4px" }}>
                  What is the current price of {valid.map(s => s.ticker).join(" and ")}?
                </p>
                <p style={{ margin: 0 }}>
                  {valid.map(s => `${s.ticker} is trading at $${s.price.toFixed(2)} (${s.changePct >= 0 ? "+" : ""}${s.changePct.toFixed(2)}% on the day)`).join(". ")}.
                  Live prices update every minute on the ArbibX terminal.
                </p>
              </div>
              <div>
                <p style={{ color: "var(--ink0, #f4f0ff)", fontWeight: 600, margin: "0 0 4px" }}>
                  How does ArbibX compare stocks?
                </p>
                <p style={{ margin: 0 }}>
                  ArbibX pulls live snapshot data from Polygon.io and pairs it with Claude-powered AI
                  analysis. Comparison pages show price, market cap, day change, sector, and key
                  technicals side by side. The deeper analysis (target prices, signals, risk notes)
                  lives on each ticker&apos;s dedicated page.
                </p>
              </div>
            </div>

            <div style={{ marginTop: 28, padding: "14px 18px", borderRadius: 10, background: "rgba(240,165,0,0.06)", border: "1px solid rgba(240,165,0,0.20)" }}>
              <p style={{ margin: 0, fontSize: 13, color: "var(--ink1, #cdc7e0)" }}>
                Want deeper analysis on either name?{" "}
                {valid.map((s, i) => (
                  <span key={s.ticker}>
                    {i > 0 && " · "}
                    <Link href={`/stock/${s.ticker}`} style={{ color: "var(--gold, #f0a500)", textDecoration: "none", fontWeight: 700 }}>
                      Open {s.ticker}
                    </Link>
                  </span>
                ))}
              </p>
            </div>

            <p style={{
              fontSize: 11, color: "var(--ink4, #1F3550)",
              textTransform: "uppercase", letterSpacing: "0.12em",
              marginTop: 28, fontFamily: "'DM Mono', monospace",
            }}>
              Not financial advice · For informational purposes only · Data via Polygon.io
            </p>
          </section>

          <div style={{ marginTop: 28, display: "flex", gap: 10, justifyContent: "center" }}>
            <Link href="/"
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "10px 18px", borderRadius: 10,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid var(--border, rgba(60,48,100,0.5))",
                color: "var(--ink2, #7A9CBF)", textDecoration: "none",
                fontFamily: "'DM Mono', monospace", fontSize: 12,
              }}>
              ← Back to terminal
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
