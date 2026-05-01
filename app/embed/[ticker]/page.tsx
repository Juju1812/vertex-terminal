import type { Metadata } from "next";
import { notFound } from "next/navigation";

/* ── /embed/[ticker] — minimalist iframe-embeddable widget ────
   For paste-into-Substack/Notion/blog use. Renders a tiny card
   with ticker, name, price, change, and a 30-day sparkline. The
   whole thing is a clickable link back to /stock/[ticker] —
   every embed becomes a free backlink + brand exposure. */

const POLYGON_KEY = process.env.NEXT_PUBLIC_POLYGON_API_KEY ?? "1xwzcvUOF9pft6PRNylO2Xc6X2QeQCGr";

export const revalidate = 1800;

interface PageProps {
  params:       Promise<{ ticker: string }>;
  searchParams: Promise<{ theme?: string }>;
}

interface EmbedData {
  ticker:    string;
  name:      string;
  price:     number;
  changePct: number;
  closes:    number[];
}

async function fetchEmbedData(ticker: string): Promise<EmbedData | null> {
  try {
    // 30-day daily aggregates for the sparkline + reference for the name
    const since = new Date(Date.now() - 45 * 86_400_000).toISOString().split("T")[0];
    const today = new Date().toISOString().split("T")[0];
    const [aggsRes, refRes] = await Promise.all([
      fetch(
        `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/1/day/${since}/${today}?adjusted=true&sort=asc&limit=45&apiKey=${POLYGON_KEY}`,
        { signal: AbortSignal.timeout(3000), next: { revalidate: 1800 } }
      ),
      fetch(
        `https://api.polygon.io/v3/reference/tickers/${ticker}?apiKey=${POLYGON_KEY}`,
        { signal: AbortSignal.timeout(3000), next: { revalidate: 604_800 } }
      ),
    ]);
    if (!aggsRes.ok) return null;
    const aggs = await aggsRes.json() as { results?: Array<{ c: number }> };
    const closes = (aggs.results ?? []).map(r => r.c).filter(c => c > 0);
    if (closes.length < 2) return null;

    const cur  = closes[closes.length - 1];
    const prev = closes[closes.length - 2];
    const changePct = ((cur - prev) / prev) * 100;

    let name = ticker;
    if (refRes.ok) {
      const ref = await refRes.json() as { results?: { name?: string } };
      name = ref.results?.name ?? ticker;
    }

    return { ticker, name, price: cur, changePct, closes };
  } catch { return null; }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { ticker: raw } = await params;
  const ticker = raw.toUpperCase();
  return {
    title: `${ticker} — ArbibX`,
    description: `Live ${ticker} price embed powered by ArbibX.`,
    robots: { index: false, follow: false },
  };
}

/* Build the sparkline SVG path from the closes array. Normalises
   to the [0,100] x [0,40] viewport so the container can scale. */
function sparklinePath(closes: number[], w: number, h: number): string {
  if (closes.length < 2) return "";
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;
  const stepX = w / (closes.length - 1);
  return closes
    .map((c, i) => {
      const x = i * stepX;
      const y = h - ((c - min) / range) * h;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

export default async function EmbedPage({ params, searchParams }: PageProps) {
  const { ticker: raw } = await params;
  const { theme = "dark" }     = await searchParams;
  const ticker = raw.toUpperCase().slice(0, 8);
  if (!/^[A-Z][A-Z0-9.\-]{0,9}$/.test(ticker)) notFound();

  const data = await fetchEmbedData(ticker);

  const W = 320, H = 60;
  const isLight = theme === "light";
  const lineColor = data && data.changePct >= 0 ? "#00c896" : "#e8445a";
  const fillColor = data && data.changePct >= 0 ? "rgba(0,200,150,0.18)" : "rgba(232,68,90,0.18)";
  const path = data ? sparklinePath(data.closes, W, H) : "";
  const fillPath = data ? `${path} L ${W} ${H} L 0 ${H} Z` : "";

  return (
    <html lang="en">
      <head>
        <style>{`
          html, body { margin: 0; padding: 0; height: 100%; }
          body {
            background: ${isLight ? "#fffdf6" : "#08060f"};
            color: ${isLight ? "#1f1408" : "#f4f0ff"};
            font-family: -apple-system, BlinkMacSystemFont, 'Inter', system-ui, sans-serif;
            overflow: hidden;
          }
          a { text-decoration: none; color: inherit; }
          .vx-embed {
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            box-sizing: border-box;
            width: 100%;
            min-height: 100vh;
            padding: 14px 16px;
            border: 1px solid ${isLight ? "rgba(120,75,0,0.20)" : "rgba(90,72,150,0.45)"};
            background: ${isLight
              ? "linear-gradient(180deg, #fffdf6 0%, #fbf6e6 100%)"
              : "linear-gradient(180deg, rgba(12,10,22,0.9) 0%, rgba(8,6,16,0.96) 100%)"};
            position: relative;
          }
          .vx-embed:hover { background: ${isLight ? "#fbf3df" : "rgba(20,16,32,0.95)"}; }
          .vx-embed__head { display: flex; align-items: center; gap: 8px; }
          .vx-embed__logo {
            width: 18px; height: 18px; border-radius: 5px;
            background: linear-gradient(135deg, #f0a500, #ffbe1a);
            display: flex; align-items: center; justify-content: center;
            font-size: 11px; font-weight: 900; color: #0a0800;
            letter-spacing: -0.04em;
          }
          .vx-embed__brand {
            font-size: 9px; font-weight: 700;
            letter-spacing: 0.18em; text-transform: uppercase;
            color: ${isLight ? "rgba(120,75,0,0.7)" : "#7A9CBF"};
          }
          .vx-embed__live {
            margin-left: auto;
            display: inline-flex; align-items: center; gap: 5px;
            font-size: 8px; font-weight: 700;
            letter-spacing: 0.14em; text-transform: uppercase;
            color: ${isLight ? "#5a3500" : "#f0a500"};
          }
          .vx-embed__live::before {
            content: ""; width: 5px; height: 5px; border-radius: 99px;
            background: ${isLight ? "#5a3500" : "#f0a500"};
          }
          .vx-embed__row {
            display: flex; align-items: baseline;
            justify-content: space-between; gap: 10px;
            margin-top: 4px;
          }
          .vx-embed__ticker {
            font-size: 22px; font-weight: 800;
            letter-spacing: -0.02em;
            color: ${isLight ? "#1f1408" : "#f4f0ff"};
          }
          .vx-embed__name {
            font-size: 10px;
            color: ${isLight ? "rgba(80,60,30,0.7)" : "#7A9CBF"};
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
            max-width: 60%;
            text-align: right;
          }
          .vx-embed__price {
            font-family: 'Courier New', monospace;
            font-size: 18px; font-weight: 700;
            color: ${isLight ? "#1f1408" : "#f4f0ff"};
            margin-top: 2px;
          }
          .vx-embed__pct {
            display: inline-flex; align-items: center; gap: 3px;
            margin-left: 8px;
            font-family: 'Courier New', monospace;
            font-size: 12px; font-weight: 700;
          }
          .vx-embed__chart { margin-top: 4px; flex: 1; min-height: 50px; }
          .vx-embed__foot {
            display: flex; align-items: center; justify-content: space-between;
            font-size: 9px;
            color: ${isLight ? "rgba(80,60,30,0.55)" : "#3D5A7A"};
            margin-top: 4px;
          }
          .vx-embed__cta {
            color: ${isLight ? "#5a3500" : "#f0a500"};
            font-weight: 700;
            letter-spacing: 0.04em;
          }
        `}</style>
      </head>
      <body>
        <a className="vx-embed" href={`https://www.arbibx.com/stock/${ticker}`} target="_blank" rel="noopener noreferrer">
          <div className="vx-embed__head">
            <div className="vx-embed__logo">X</div>
            <div className="vx-embed__brand">ArbibX</div>
            <div className="vx-embed__live">Live</div>
          </div>

          {data ? (
            <>
              <div className="vx-embed__row">
                <div className="vx-embed__ticker">{ticker}</div>
                <div className="vx-embed__name" title={data.name}>{data.name}</div>
              </div>
              <div>
                <span className="vx-embed__price">${data.price.toFixed(2)}</span>
                <span className="vx-embed__pct" style={{ color: lineColor }}>
                  {data.changePct >= 0 ? "▲" : "▼"} {data.changePct >= 0 ? "+" : ""}{data.changePct.toFixed(2)}%
                </span>
              </div>
              <div className="vx-embed__chart">
                <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: "100%", display: "block" }}>
                  <path d={fillPath} fill={fillColor} />
                  <path d={path} fill="none" stroke={lineColor} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
                </svg>
              </div>
              <div className="vx-embed__foot">
                <span>30-day chart · arbibx.com</span>
                <span className="vx-embed__cta">Open →</span>
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: isLight ? "rgba(80,60,30,0.6)" : "#7A9CBF" }}>
              {ticker} — data unavailable
            </div>
          )}
        </a>
      </body>
    </html>
  );
}
