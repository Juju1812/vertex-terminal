import type { Metadata } from "next";
import TickerView from "./TickerView";

/* Server component shell — handles metadata for SEO + Open Graph,
   then renders the client TickerView for the interactive UI.
   The client component handles its own data fetching to keep the
   page snappy (no blocking SSR on slow Polygon calls). */

const POLYGON_KEY = process.env.NEXT_PUBLIC_POLYGON_API_KEY ?? "1xwzcvUOF9pft6PRNylO2Xc6X2QeQCGr";

interface PageProps {
  params: Promise<{ ticker: string }>;
}

interface TickerSnapshot {
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

/* Pull a one-shot live snapshot for the ticker so meta tags
   contain real numbers (better SEO + better link previews). All
   Polygon calls run with a tight timeout so a slow API doesn't
   block server render — fall back to plain ticker data if needed. */
async function fetchTickerSnapshot(ticker: string): Promise<TickerSnapshot | null> {
  try {
    const [snapRes, refRes] = await Promise.all([
      fetch(
        `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers/${ticker}?apiKey=${POLYGON_KEY}`,
        { signal: AbortSignal.timeout(2500), next: { revalidate: 60 } }
      ),
      fetch(
        `https://api.polygon.io/v3/reference/tickers/${ticker}?apiKey=${POLYGON_KEY}`,
        { signal: AbortSignal.timeout(2500), next: { revalidate: 86400 } }
      ),
    ]);
    if (!snapRes.ok) return null;
    const snap = await snapRes.json() as {
      ticker?: { day: { c: number; o: number; h: number; l: number; v: number }; prevDay: { c: number } };
    };
    const day  = snap.ticker?.day;
    const prev = snap.ticker?.prevDay;
    if (!day?.c || !prev?.c) return null;

    let name = ticker, sector = "", marketCap: number | null = null;
    if (refRes.ok) {
      const ref = await refRes.json() as {
        results?: { name?: string; sic_description?: string; market_cap?: number };
      };
      name      = ref.results?.name ?? ticker;
      sector    = ref.results?.sic_description ?? "";
      marketCap = ref.results?.market_cap ?? null;
    }

    return {
      name,
      sector,
      price:     day.c,
      changePct: ((day.c - prev.c) / prev.c) * 100,
      open:      day.o,
      high:      day.h,
      low:       day.l,
      volume:    day.v,
      marketCap,
    };
  } catch { return null; }
}

function fmtCap(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString()}`;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { ticker: rawTicker } = await params;
  const ticker = rawTicker.toUpperCase();
  const snap = await fetchTickerSnapshot(ticker);

  // Dynamic, SEO-friendly title and description with real numbers.
  // Falls back to generic copy if Polygon is unreachable.
  let title: string;
  let description: string;

  if (snap) {
    const arrow = snap.changePct >= 0 ? "▲" : "▼";
    const pct   = `${snap.changePct >= 0 ? "+" : ""}${snap.changePct.toFixed(2)}%`;
    title       = `${ticker} ${snap.name ? `(${snap.name})` : ""} Stock — $${snap.price.toFixed(2)} ${arrow} ${pct} | ArbibX`.trim();

    const sectorBit = snap.sector ? ` ${snap.sector} sector.` : "";
    const capBit    = snap.marketCap ? ` Market cap ${fmtCap(snap.marketCap)}.` : "";
    description = `${snap.name || ticker} (${ticker}) trades at $${snap.price.toFixed(2)}, ${pct} today.${sectorBit}${capBit} See live chart, AI analysis, technical indicators, recent news, and earnings on ArbibX.`;
  } else {
    title       = `${ticker} Stock — Live Price, AI Analysis, News | ArbibX`;
    description = `Live price, 90-day chart, technical indicators, AI-powered analysis, and breaking news for ${ticker}. Real-time data on the ArbibX terminal.`;
  }

  return {
    title,
    description,
    alternates: {
      canonical: `https://www.arbibx.com/stock/${ticker}`,
    },
    keywords: [
      `${ticker} stock`,
      `${ticker} price`,
      `${ticker} stock analysis`,
      `${ticker} forecast`,
      `${ticker} news`,
      `${ticker} earnings`,
      "AI stock analysis",
      "stock terminal",
    ],
    openGraph: {
      title,
      description,
      type:        "website",
      url:         `https://www.arbibx.com/stock/${ticker}`,
      siteName:    "ArbibX",
      locale:      "en_US",
      images: [{ url: "/logo.png", width: 512, height: 512, alt: `${ticker} on ArbibX` }],
    },
    twitter: {
      card:        "summary_large_image",
      title,
      description,
      images:      ["/logo.png"],
    },
    robots: {
      index:  true,
      follow: true,
      googleBot: {
        index:        true,
        follow:       true,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
  };
}

export default async function StockPage({ params }: PageProps) {
  const { ticker: rawTicker } = await params;
  const ticker = rawTicker.toUpperCase();
  const snap   = await fetchTickerSnapshot(ticker);

  // JSON-LD structured data — helps Google build rich snippets,
  // knowledge-panel cards, and FAQ rich results for ticker pages.
  const ldName = snap?.name || ticker;
  const ldDesc = snap
    ? `${ldName} (${ticker}) trades at $${snap.price.toFixed(2)} on ArbibX with AI-powered analysis, live charts, and breaking news.`
    : `Live data and AI analysis for ${ticker} on ArbibX.`;

  const corporation: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type":    "Corporation",
    "name":     ldName,
    "tickerSymbol": ticker,
    "url":      `https://www.arbibx.com/stock/${ticker}`,
    "description": ldDesc,
  };
  if (snap?.sector)    corporation.industry = snap.sector;
  if (snap?.marketCap) corporation.marketCap = snap.marketCap;

  const faq = {
    "@context": "https://schema.org",
    "@type":    "FAQPage",
    "mainEntity": [
      {
        "@type":    "Question",
        "name":     `What is the current price of ${ticker}?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text":  snap
            ? `${ticker} (${ldName}) is currently trading at $${snap.price.toFixed(2)}, ${snap.changePct >= 0 ? "up" : "down"} ${Math.abs(snap.changePct).toFixed(2)}% on the day.`
            : `View the live price for ${ticker} on ArbibX. Prices update in real time.`,
        },
      },
      {
        "@type":    "Question",
        "name":     `Where can I find AI analysis for ${ticker}?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text":  `ArbibX runs Claude AI on ${ticker} alongside other tickers daily. Open the AI Top 15 tab or use the in-app "Ask Claude" assistant for an instant analysis with confidence score, target price, and risk notes.`,
        },
      },
      {
        "@type":    "Question",
        "name":     `Is ${ticker} a buy?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text":  `Whether ${ticker} is a buy depends on your goals, time horizon, and risk tolerance. Use ArbibX's AI analysis, technical indicators, news feed, and earnings calendar to make an informed decision. Always do your own research before investing.`,
        },
      },
    ],
  };

  // Substantive visible content for SEO — Google ranks pages by what's
  // in the rendered HTML, not just metadata. Server-rendered so crawlers
  // see it without executing JS. Sits below the interactive chart.
  const fmtPrice = snap ? `$${snap.price.toFixed(2)}` : null;
  const fmtPct   = snap ? `${snap.changePct >= 0 ? "+" : ""}${snap.changePct.toFixed(2)}%` : null;

  return (
    <>
      <script type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(corporation) }} />
      <script type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faq) }} />
      <TickerView ticker={ticker} />

      {/* SEO content block — invisible to most users (sits below the
          interactive view, after the CTA buttons), but indexed by
          search engines. Substantive prose plus the same Q&A as the
          FAQ JSON-LD so the rich-result text matches the visible text. */}
      <section
        aria-label={`About ${ticker}`}
        style={{
          maxWidth: 980,
          margin: "0 auto",
          padding: "24px 20px 60px",
          fontFamily: "'Syne', system-ui, sans-serif",
          color: "var(--ink2, #7A9CBF)",
          fontSize: 14,
          lineHeight: 1.7,
        }}
      >
        <h2 style={{
          fontFamily: "'Cabinet Grotesk', 'Syne', system-ui, sans-serif",
          fontSize: 22, fontWeight: 700,
          color: "var(--ink0, #f4f0ff)",
          margin: "0 0 12px",
          letterSpacing: "-0.01em",
        }}>
          About {ldName} ({ticker})
        </h2>

        {snap ? (
          <p>
            <strong style={{ color: "var(--ink0, #f4f0ff)" }}>{ldName}</strong> ({ticker}) trades at{" "}
            <strong style={{ color: "var(--gold, #f0a500)" }}>{fmtPrice}</strong>, {fmtPct} on the day
            (open ${snap.open.toFixed(2)}, high ${snap.high.toFixed(2)}, low ${snap.low.toFixed(2)},
            {" "}volume {(snap.volume / 1e6).toFixed(2)}M shares).
            {snap.sector && <> The company operates in the {snap.sector.toLowerCase()} sector.</>}
            {snap.marketCap && <> Current market cap is {fmtCap(snap.marketCap)}.</>}
          </p>
        ) : (
          <p>
            {ticker} is a publicly traded US stock. ArbibX provides live pricing, AI-powered analysis,
            technical indicators, breaking news, and earnings data for {ticker} along with thousands
            of other US-listed tickers.
          </p>
        )}

        <p style={{ marginTop: 14 }}>
          ArbibX runs Claude AI across a curated universe of liquid US stocks every hour, surfacing
          the 15 most actionable picks with confidence scores, target prices, and risk notes. The
          terminal also includes a sector heatmap, watchlists with price alerts, portfolio tracking
          with AI grading, and a built-in conversational AI that answers questions about any ticker
          using live market data.
        </p>

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
              What is the current price of {ticker}?
            </p>
            <p style={{ margin: 0 }}>
              {snap
                ? `${ticker} (${ldName}) is currently trading at ${fmtPrice}, ${snap.changePct >= 0 ? "up" : "down"} ${Math.abs(snap.changePct).toFixed(2)}% on the day. Pricing updates in real time on ArbibX during market hours.`
                : `View the live price for ${ticker} at the top of this page. Prices update in real time during market hours.`}
            </p>
          </div>

          <div>
            <p style={{ color: "var(--ink0, #f4f0ff)", fontWeight: 600, margin: "0 0 4px" }}>
              Where can I find AI analysis for {ticker}?
            </p>
            <p style={{ margin: 0 }}>
              ArbibX runs Claude AI across a wide universe of US stocks and surfaces the most
              actionable picks in the AI Top 15 tab. For a question-and-answer style analysis on
              {" "}{ticker} specifically, use the in-app "Ask Claude" assistant — it sees the live
              price, sector, and your portfolio context, and replies with reasoning grounded in
              today's numbers.
            </p>
          </div>

          <div>
            <p style={{ color: "var(--ink0, #f4f0ff)", fontWeight: 600, margin: "0 0 4px" }}>
              Is {ticker} a buy?
            </p>
            <p style={{ margin: 0 }}>
              Whether {ticker} is a buy depends on your investment goals, time horizon, and risk
              tolerance. Use ArbibX's AI analysis, the 90-day chart, technical indicators, news
              feed, and the earnings calendar to make an informed decision. Always do your own
              research and consider consulting a licensed advisor before investing.
            </p>
          </div>
        </div>

        <p style={{
          fontSize: 11,
          color: "var(--ink4, #1F3550)",
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          marginTop: 28,
          fontFamily: "'DM Mono', monospace",
        }}>
          Not financial advice · For informational purposes only · Data via Polygon.io
        </p>
      </section>
    </>
  );
}
