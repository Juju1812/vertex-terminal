import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

/* ── /sector/[name] — sector & theme landing pages ───────────
   Targets queries like "best technology stocks", "best AI stocks
   to buy", "top semiconductor stocks 2026" — all stable, high-
   intent searches that get a slow drip of organic traffic for
   years. Each page is fully server-rendered with prose, JSON-LD,
   live data, and internal links to /stock/[ticker]. */

const POLYGON_KEY = process.env.NEXT_PUBLIC_POLYGON_API_KEY ?? "1xwzcvUOF9pft6PRNylO2Xc6X2QeQCGr";

export const revalidate = 1800;

interface PageProps { params: Promise<{ name: string }>; }

interface TickerSnap {
  ticker:    string;
  name:      string;
  price:     number;
  changePct: number;
  marketCap: number | null;
}

interface SectorDef {
  slug:        string;
  title:       string;
  shortLabel:  string;
  blurb:       string;
  tickers:     string[];
}

/* Sector + theme definitions. Each one targets specific search
   queries — "best [theme] stocks" + "top [theme] stocks 2026".
   Tickers ordered by expected market cap so the natural visual
   ordering matches what users expect. */
export const SECTORS: SectorDef[] = [
  {
    slug: "technology",
    title: "Technology Stocks",
    shortLabel: "Technology",
    blurb: "The largest publicly-traded technology companies — from cloud platforms and software giants to consumer hardware and semiconductors.",
    tickers: ["NVDA","MSFT","AAPL","GOOGL","META","AMZN","AVGO","ORCL","CRM","ADBE","CSCO","ACN","NOW","INTU","IBM","QCOM","AMD","INTC","ANET","PANW"],
  },
  {
    slug: "semiconductors",
    title: "Semiconductor Stocks",
    shortLabel: "Semis",
    blurb: "The chipmakers powering AI, data centers, smartphones, and the modern economy. Includes both fabless designers and integrated manufacturers.",
    tickers: ["NVDA","AVGO","AMD","TSM","QCOM","INTC","AMAT","ARM","LRCX","KLAC","MU","ADI","MRVL","NXPI","ON","MCHP","SMCI","SMH","SOXX"],
  },
  {
    slug: "ai-stocks",
    title: "AI Stocks",
    shortLabel: "AI",
    blurb: "Companies driving the artificial intelligence revolution — from chip designers and cloud providers to pure-play AI software.",
    tickers: ["NVDA","MSFT","GOOGL","META","AMZN","AVGO","TSM","ORCL","PLTR","AMD","CRM","NOW","SMCI","ANET","ARM","SNOW","CRWD"],
  },
  {
    slug: "cloud-computing",
    title: "Cloud Computing Stocks",
    shortLabel: "Cloud",
    blurb: "Hyperscaler clouds, cloud-native SaaS, and infrastructure providers powering the shift to elastic compute and storage.",
    tickers: ["MSFT","AMZN","GOOGL","ORCL","CRM","NOW","SNOW","DDOG","NET","MDB","WDAY","TEAM","ZS","FTNT","OKTA"],
  },
  {
    slug: "cybersecurity",
    title: "Cybersecurity Stocks",
    shortLabel: "Cyber",
    blurb: "Pure-play security software companies addressing endpoint, network, identity, and cloud-workload protection.",
    tickers: ["CRWD","PANW","FTNT","ZS","OKTA","NET","S","CYBR","TENB","RBRK","CHKP"],
  },
  {
    slug: "ev-stocks",
    title: "EV Stocks",
    shortLabel: "EVs",
    blurb: "Electric-vehicle makers, charging-infrastructure providers, and EV-aligned battery / materials companies.",
    tickers: ["TSLA","BYDDY","RIVN","LCID","NIO","XPEV","LI","CHPT","BLNK","STLA","F","GM"],
  },
  {
    slug: "healthcare",
    title: "Healthcare Stocks",
    shortLabel: "Healthcare",
    blurb: "Diversified pharma, biotech, medical devices, and managed-care companies.",
    tickers: ["LLY","UNH","JNJ","ABBV","NVO","PFE","MRK","TMO","ABT","DHR","BMY","AMGN","ISRG","REGN","VRTX","GILD","SYK","CVS"],
  },
  {
    slug: "biotech",
    title: "Biotech Stocks",
    shortLabel: "Biotech",
    blurb: "Drug developers focused on novel therapeutics — gene therapy, immuno-oncology, mRNA platforms, and rare disease.",
    tickers: ["LLY","NVO","ABBV","AMGN","REGN","VRTX","GILD","BIIB","MRNA","BNTX","ALNY","INCY","BMRN","ILMN","SGEN","NBIX"],
  },
  {
    slug: "financials",
    title: "Financial Stocks",
    shortLabel: "Financials",
    blurb: "Money-center banks, regional banks, asset managers, and consumer-finance companies.",
    tickers: ["BRK.B","JPM","V","MA","BAC","WFC","GS","MS","C","AXP","BLK","SCHW","SPGI","MMC","BX","KKR","CB"],
  },
  {
    slug: "bank-stocks",
    title: "Bank Stocks",
    shortLabel: "Banks",
    blurb: "Major US-listed banks — money-center, super-regional, and investment banks.",
    tickers: ["JPM","BAC","WFC","C","GS","MS","USB","PNC","TFC","BK","STT","SCHW","AXP","COF"],
  },
  {
    slug: "fintech",
    title: "Fintech Stocks",
    shortLabel: "Fintech",
    blurb: "Payment networks, digital wallets, lending platforms, and crypto-aligned fintech.",
    tickers: ["V","MA","PYPL","SQ","FI","COIN","HOOD","SOFI","NU","AFRM","UPST"],
  },
  {
    slug: "energy",
    title: "Energy Stocks",
    shortLabel: "Energy",
    blurb: "Integrated supermajors, E&P companies, oilfield services, and pipeline operators.",
    tickers: ["XOM","CVX","COP","SLB","EOG","PSX","MPC","VLO","OXY","HES","PXD","FANG","HAL","OKE","WMB"],
  },
  {
    slug: "consumer-discretionary",
    title: "Consumer Discretionary Stocks",
    shortLabel: "Consumer Discretionary",
    blurb: "Retailers, restaurants, automotive, and luxury goods — companies whose revenue tracks consumer spending.",
    tickers: ["AMZN","TSLA","HD","MCD","NKE","SBUX","LOW","BKNG","ABNB","CMG","TJX","ROST","DIS","HLT","MAR"],
  },
  {
    slug: "consumer-staples",
    title: "Consumer Staples Stocks",
    shortLabel: "Consumer Staples",
    blurb: "Defensive consumer companies — food & beverage, household products, and tobacco.",
    tickers: ["WMT","COST","PG","KO","PEP","PM","MO","MDLZ","CL","KMB","CHD","KHC"],
  },
  {
    slug: "communication-services",
    title: "Communication Services Stocks",
    shortLabel: "Communication",
    blurb: "Media, telecom, social platforms, and gaming companies.",
    tickers: ["GOOGL","META","NFLX","DIS","TMUS","CMCSA","T","VZ","CHTR","SPOT","WBD","EA"],
  },
  {
    slug: "industrials",
    title: "Industrial Stocks",
    shortLabel: "Industrials",
    blurb: "Aerospace, defense, machinery, transportation, and industrial conglomerates.",
    tickers: ["GE","CAT","DE","HON","BA","LMT","RTX","UPS","FDX","UNP","CSX","NSC","ETN","ITW","EMR"],
  },
  {
    slug: "streaming-stocks",
    title: "Streaming Stocks",
    shortLabel: "Streaming",
    blurb: "Subscription video, audio, and gaming-streaming services.",
    tickers: ["NFLX","DIS","SPOT","ROKU","WBD","PARA","FUBO"],
  },
  {
    slug: "dividend-stocks",
    title: "Top Dividend Stocks",
    shortLabel: "Dividend",
    blurb: "Established companies known for consistent dividend payments and steady total returns.",
    tickers: ["JNJ","PG","KO","PEP","VZ","T","XOM","CVX","ABBV","MRK","MO","PM","IBM","CAT","HD","COST","WMT","JPM","MMM","O"],
  },
  {
    slug: "ev-charging",
    title: "EV Charging Stocks",
    shortLabel: "EV Charging",
    blurb: "Companies building out the public and private EV-charging network — hardware, software, and host operators.",
    tickers: ["TSLA","CHPT","BLNK","EVGO","WBX"],
  },
  {
    slug: "crypto-stocks",
    title: "Crypto Stocks",
    shortLabel: "Crypto",
    blurb: "Public companies levered to crypto — exchanges, miners, and balance-sheet bitcoin holders.",
    tickers: ["COIN","MSTR","HOOD","MARA","RIOT","CLSK","HUT","BITF"],
  },
];

function findSector(slug: string): SectorDef | undefined {
  const norm = slug.toLowerCase();
  return SECTORS.find(s => s.slug === norm);
}

async function fetchSnaps(tickers: string[]): Promise<TickerSnap[]> {
  if (!tickers.length) return [];
  try {
    // One bulk snapshot call covers all tickers in the sector
    const r = await fetch(
      `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${tickers.join(",")}&apiKey=${POLYGON_KEY}`,
      { signal: AbortSignal.timeout(5000), next: { revalidate: 1800 } }
    );
    if (!r.ok) return [];
    const d = await r.json() as {
      tickers?: Array<{ ticker: string; day: { c: number }; prevDay: { c: number } }>;
    };
    const map: Record<string, { price: number; changePct: number }> = {};
    for (const t of d.tickers ?? []) {
      const cur = t.day?.c, prev = t.prevDay?.c;
      if (cur > 0 && prev > 0) map[t.ticker] = { price: cur, changePct: ((cur - prev) / prev) * 100 };
    }
    // Preserve order, fall back to ticker only when no snapshot data
    return tickers.map(t => {
      const s = map[t];
      return s ? { ticker: t, name: t, price: s.price, changePct: s.changePct, marketCap: null } : { ticker: t, name: t, price: 0, changePct: 0, marketCap: null };
    });
  } catch { return []; }
}

function fmtPct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

/* ── Metadata ─────────────────────────────────────────────── */

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { name } = await params;
  const sector = findSector(name);
  if (!sector) {
    return { title: "Sector not found · ArbibX" };
  }
  const title       = `Best ${sector.title} 2026 — Live Prices & AI Analysis | ArbibX`;
  const description = `Top ${sector.shortLabel.toLowerCase()} stocks ranked with live prices, day moves, and AI-powered analysis. ${sector.blurb} Updated continuously on ArbibX.`;
  const canonical   = `https://www.arbibx.com/sector/${sector.slug}`;

  return {
    title,
    description,
    alternates: { canonical },
    keywords: [
      `best ${sector.shortLabel.toLowerCase()} stocks`,
      `top ${sector.shortLabel.toLowerCase()} stocks`,
      `${sector.shortLabel.toLowerCase()} stocks 2026`,
      `${sector.shortLabel.toLowerCase()} stocks to buy`,
      `${sector.title.toLowerCase()}`,
      "stock screener", "AI stock analysis",
    ],
    openGraph: {
      title, description,
      type: "website",
      url:  canonical,
      siteName: "ArbibX",
      images: [{ url: `https://www.arbibx.com/api/og?type=default&h=${encodeURIComponent("Best " + sector.title)}&s=${encodeURIComponent("Live prices, AI analysis, and side-by-side comparison")}`, width: 1200, height: 630, alt: `${sector.title} on ArbibX` }],
    },
    twitter: {
      card: "summary_large_image",
      title, description,
      images: [`https://www.arbibx.com/api/og?type=default&h=${encodeURIComponent("Best " + sector.title)}`],
    },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
  };
}

/* ── Page ─────────────────────────────────────────────────── */

export default async function SectorPage({ params }: PageProps) {
  const { name } = await params;
  const sector = findSector(name);
  if (!sector) notFound();

  const snaps = await fetchSnaps(sector.tickers);
  const visible = snaps.filter(s => s.price > 0);
  const sorted  = [...visible].sort((a, b) => b.changePct - a.changePct);
  const topMover = sorted[0];
  const worstMover = sorted[sorted.length - 1];

  // ItemList JSON-LD: tells Google these tickers are a curated set
  // tied to this sector. Each item links to the canonical Stock URL.
  const itemList = {
    "@context": "https://schema.org",
    "@type":    "ItemList",
    "name":     `Best ${sector.title}`,
    "description": sector.blurb,
    "itemListElement": sector.tickers.slice(0, 20).map((t, i) => ({
      "@type":    "ListItem",
      "position": i + 1,
      "item": {
        "@type":        "Corporation",
        "name":         t,
        "tickerSymbol": t,
        "url":          `https://www.arbibx.com/stock/${t}`,
      },
    })),
  };

  const faq = {
    "@context": "https://schema.org",
    "@type":    "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name":  `What are the best ${sector.shortLabel.toLowerCase()} stocks to buy?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text":  `The ${sector.shortLabel.toLowerCase()} sector includes leaders like ${sector.tickers.slice(0, 5).join(", ")} alongside ${sector.tickers.length - 5}+ other names. ArbibX runs Claude AI across thousands of stocks daily and surfaces the most actionable picks with confidence scores. Use the AI Top 15 tab for a daily-refreshed shortlist.`,
        },
      },
      {
        "@type": "Question",
        "name":  `Which ${sector.shortLabel.toLowerCase()} stock is up the most today?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text":  topMover ? `${topMover.ticker} is leading with a ${fmtPct(topMover.changePct)} move on the day. View live prices for the full list above.` : `Live prices are available on ArbibX for every stock in this sector.`,
        },
      },
      {
        "@type": "Question",
        "name":  `How does ArbibX rank ${sector.shortLabel.toLowerCase()} stocks?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text":  `ArbibX combines live market data from Polygon.io with Claude-powered AI analysis. Each ticker on this page links to its full chart, technical indicators, news, and AI signal — including target price and risk notes when available.`,
        },
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }} />
      <script type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faq) }} />

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
            padding: "24px 24px",
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
              Sector · Live Data · AI-Powered
            </p>
            <h1 style={{
              fontFamily: "'Cabinet Grotesk', 'Syne', system-ui, sans-serif",
              fontSize: "clamp(28px, 4.5vw, 44px)", fontWeight: 700,
              color: "var(--ink0, #f4f0ff)",
              margin: "0 0 8px",
              letterSpacing: "-0.02em",
            }}>
              Best {sector.title} 2026
            </h1>
            <p style={{ fontSize: 15, color: "var(--ink2, #7A9CBF)", margin: 0, lineHeight: 1.55, maxWidth: 760 }}>
              {sector.blurb}
            </p>
          </div>

          {/* Tickers list */}
          <div style={{
            borderRadius: 12,
            border: "1px solid var(--border, rgba(60,48,100,0.5))",
            background: "rgba(255,255,255,0.02)",
            overflow: "hidden",
            marginBottom: 24,
          }}>
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto auto", gap: 12, padding: "12px 18px", borderBottom: "1px solid var(--border, rgba(60,48,100,0.5))", background: "rgba(255,255,255,0.03)", fontFamily: "'DM Mono', monospace", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--ink3, #3D5A7A)" }}>
              <span>#</span>
              <span>Ticker</span>
              <span style={{ textAlign: "right" }}>Price</span>
              <span style={{ textAlign: "right" }}>Day</span>
            </div>
            {visible.map((s, i) => {
              const positive = s.changePct >= 0;
              const color = positive ? "var(--gain, #00e5a0)" : "var(--loss, #ff4560)";
              return (
                <Link key={s.ticker}
                  href={`/stock/${s.ticker}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "auto 1fr auto auto", gap: 12,
                    padding: "12px 18px",
                    borderBottom: i < visible.length - 1 ? "1px solid var(--border, rgba(60,48,100,0.3))" : "none",
                    color: "inherit", textDecoration: "none",
                    transition: "background 0.15s ease",
                    alignItems: "center",
                  }}>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: i < 3 ? "var(--gold, #f0a500)" : "var(--ink4, #1F3550)", fontWeight: 600 }}>
                    {i + 1}
                  </span>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 14, fontWeight: 600, color: "var(--gold, #f0a500)", letterSpacing: "0.04em" }}>
                    {s.ticker}
                  </span>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: "var(--ink0, #f4f0ff)", textAlign: "right" }}>
                    ${s.price.toFixed(2)}
                  </span>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color, textAlign: "right", fontWeight: 600 }}>
                    {positive ? "▲" : "▼"} {positive ? "+" : ""}{s.changePct.toFixed(2)}%
                  </span>
                </Link>
              );
            })}
            {!visible.length && (
              <p style={{ padding: "30px 18px", textAlign: "center", color: "var(--ink3, #3D5A7A)", fontSize: 13 }}>
                Live prices momentarily unavailable. Refresh in a few seconds.
              </p>
            )}
          </div>

          {/* Prose */}
          <section style={{ fontSize: 14, lineHeight: 1.7, color: "var(--ink2, #7A9CBF)" }}>
            <h2 style={{
              fontFamily: "'Cabinet Grotesk', 'Syne', system-ui, sans-serif",
              fontSize: 22, fontWeight: 700,
              color: "var(--ink0, #f4f0ff)",
              margin: "8px 0 12px",
              letterSpacing: "-0.01em",
            }}>
              How to use this {sector.shortLabel.toLowerCase()} stocks list
            </h2>
            <p>
              The {sector.tickers.length} stocks above represent the most-traded names in the
              {" "}<strong style={{ color: "var(--ink0, #f4f0ff)" }}>{sector.shortLabel.toLowerCase()}</strong>
              {" "}category. Click any ticker to open its full ArbibX page — live chart, 90-day
              technicals, recent news, AI signal, target price, and risk notes.
              {topMover && (
                <>
                  {" "}Today&apos;s leader is <strong style={{ color: "var(--gold, #f0a500)" }}>{topMover.ticker}</strong>{" "}
                  ({fmtPct(topMover.changePct)})
                  {worstMover && worstMover !== topMover && (
                    <>, while <strong style={{ color: "var(--loss, #ff4560)" }}>{worstMover.ticker}</strong> is the day&apos;s laggard ({fmtPct(worstMover.changePct)})</>
                  )}
                  .
                </>
              )}
            </p>
            <p style={{ marginTop: 12 }}>
              ArbibX uses Claude AI to surface the most actionable picks across every sector daily.
              For a deeper read on any name in this list, click through to its dedicated page or
              ask the in-app AI assistant — it sees your portfolio, watchlist, and live prices
              when answering.
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
                  What are the best {sector.shortLabel.toLowerCase()} stocks to buy?
                </p>
                <p style={{ margin: 0 }}>
                  Whether any specific stock is a good buy depends on your goals, time horizon, and
                  risk tolerance. The list above ranks the most-traded names with live prices.
                  ArbibX&apos;s AI Top 15 tab refreshes daily and surfaces the most actionable
                  picks across every sector.
                </p>
              </div>
              <div>
                <p style={{ color: "var(--ink0, #f4f0ff)", fontWeight: 600, margin: "0 0 4px" }}>
                  Which {sector.shortLabel.toLowerCase()} stock is up the most today?
                </p>
                <p style={{ margin: 0 }}>
                  {topMover
                    ? `${topMover.ticker} is leading with a ${fmtPct(topMover.changePct)} move on the day. The full live ranking is at the top of this page.`
                    : "Live prices update during market hours — refresh to see today's top mover."}
                </p>
              </div>
              <div>
                <p style={{ color: "var(--ink0, #f4f0ff)", fontWeight: 600, margin: "0 0 4px" }}>
                  How does ArbibX pick {sector.shortLabel.toLowerCase()} stocks?
                </p>
                <p style={{ margin: 0 }}>
                  ArbibX runs Claude AI across thousands of US stocks every hour and ranks them by
                  signal strength, confidence, and target-price upside. Each pick is annotated with
                  reasoning and risk notes you can read in plain English.
                </p>
              </div>
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
