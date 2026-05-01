import type { MetadataRoute } from "next";

/* ── Programmatic sitemap covering 5,000+ US-listed tickers ────
   The original sitemap had ~130 hand-curated tickers — fine for
   discoverability of major names, but a massive missed surface
   for long-tail organic ("ALAB stock analysis", "GTLB forecast",
   etc.). This version pulls every active US common stock from
   Polygon's reference endpoint at request-time, with a 24h ISR
   cache so we only hit Polygon once per day per region.

   - Filters to type=CS (common stock) primarily listed on a
     US major exchange (NYSE / NASDAQ / NYSE Arca).
   - ETFs added back from a curated list since Polygon's
     reference doesn't tag them as common stock.
   - Hard cap of 6,000 entries so the sitemap stays well under
     Google's 50,000 URL / 50MB per-file limits.
   - On any Polygon failure, falls back to the original
     hand-curated list — sitemap never goes empty. */

export const revalidate = 86_400;

const POLYGON_KEY = process.env.NEXT_PUBLIC_POLYGON_API_KEY ?? "1xwzcvUOF9pft6PRNylO2Xc6X2QeQCGr";

// Curated fallback used if Polygon is unreachable. Keeps the
// most-searched names indexed even on a degraded build.
const FALLBACK_TICKERS = [
  "NVDA","MSFT","AAPL","META","GOOGL","GOOG","AMD","AVGO","ORCL","CRM",
  "ADBE","INTC","QCOM","INTU","IBM","CSCO","ACN",
  "AMAT","LRCX","KLAC","MU","ARM","MRVL","NXPI","ON","ADI","MCHP","SMCI",
  "PLTR","CRWD","PANW","ZS","FTNT","OKTA","NET","SNOW","DDOG","ANET",
  "WDAY","MDB","TWLO","TEAM","CDNS","SNPS","VEEV",
  "AMZN","TSLA","NFLX","DIS","SBUX","NKE","MCD","CMG","HD","LOW","COST",
  "WMT","TGT","BKNG","ABNB","UBER","LYFT","DASH","SHOP","SPOT","ROKU",
  "PINS","SNAP","RBLX",
  "BRK.B","JPM","V","MA","BAC","WFC","GS","MS","C","AXP","BLK","SCHW",
  "PYPL","SQ","COIN","HOOD",
  "LLY","UNH","JNJ","ABBV","PFE","MRK","TMO","ABT","DHR","BMY","AMGN",
  "ISRG","REGN","VRTX","GILD","NVO","BIIB","MRNA",
  "XOM","CVX","COP","SLB","EOG","OXY","BA","CAT","DE","GE","HON","UPS","FDX","LMT","RTX",
  "T","VZ","TMUS","CMCSA",
];

// Popular ETFs that traders actually search for — added on top
// of the Polygon common-stock list since Polygon's reference
// classifies these as ETF/ETN, not CS.
const ETF_TICKERS = [
  "SPY","QQQ","DIA","IWM","VTI","VOO","VEA","VWO","VUG","VTV",
  "XLK","XLF","XLE","XLV","XLY","XLP","XLI","XLU","XLB","XLRE","XLC",
  "GLD","SLV","TLT","IEF","SHY","HYG","LQD","BND","AGG",
  "ARKK","ARKG","ARKW","XBI","SOXL","SOXX","SMH","TQQQ","SQQQ",
  "UVXY","VXX","UPRO","SPXL","SPXS","TZA","FAS","FAZ",
  "USO","UNG","DBC","GDX","GDXJ","SLX",
  "IYR","VNQ","SCHH","MORT",
  "KWEB","FXI","INDA","EWZ","EWJ","EWG","EWU","EWC","ASHR",
];

interface PolygonTickerRow {
  ticker:           string;
  type?:            string;          // "CS" = common stock
  primary_exchange?: string;
  active?:          boolean;
  market?:          string;
}

/* Pull every active US common stock from Polygon's reference
   endpoint. Paginates through next_url (Polygon returns up to
   1000 per page). Capped at 8 pages = 8,000 max raw rows so a
   build accident can't chew through quota. */
async function fetchPolygonTickers(): Promise<string[]> {
  const out: string[] = [];
  let url: string | null =
    `https://api.polygon.io/v3/reference/tickers?market=stocks&active=true&type=CS&limit=1000&sort=ticker&order=asc&apiKey=${POLYGON_KEY}`;
  let pages = 0;
  while (url && pages < 8) {
    try {
      const r: Response = await fetch(url, {
        signal: AbortSignal.timeout(10_000),
        next: { revalidate: 86_400 },
      });
      if (!r.ok) break;
      const data = await r.json() as { results?: PolygonTickerRow[]; next_url?: string };
      for (const row of data.results ?? []) {
        if (!row.ticker) continue;
        if (row.active === false) continue;
        // Skip exotic exchange listings that won't have data on
        // our /stock/[ticker] page anyway (OTC pink sheets, etc.)
        const ex = (row.primary_exchange ?? "").toUpperCase();
        if (ex && !["XNYS","XNAS","ARCX","BATS","NYSEAMERICAN","XASE"].includes(ex)) continue;
        // Skip tickers with characters that break the URL slot
        if (!/^[A-Z][A-Z0-9.\-]{0,9}$/.test(row.ticker)) continue;
        out.push(row.ticker);
      }
      // Polygon's next_url already has the apiKey baked in some
      // responses but not others — append safely if missing.
      url = data.next_url
        ? data.next_url + (data.next_url.includes("apiKey=") ? "" : `&apiKey=${POLYGON_KEY}`)
        : null;
      pages++;
    } catch (err) {
      console.warn("[sitemap] polygon fetch failed:", err);
      break;
    }
  }
  return out;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const polygon = await fetchPolygonTickers();

  // Merge: Polygon common stocks ∪ curated fallback ∪ popular ETFs
  // Dedup by ticker, hard-cap at 6,000.
  const set = new Set<string>();
  for (const t of polygon)          set.add(t);
  for (const t of FALLBACK_TICKERS) set.add(t);
  for (const t of ETF_TICKERS)      set.add(t);
  const all = [...set].slice(0, 6000);

  const tickerEntries: MetadataRoute.Sitemap = all.map(t => ({
    url:             `https://www.arbibx.com/stock/${t}`,
    lastModified:    now,
    changeFrequency: "hourly",
    priority:        0.7,
  }));

  return [
    {
      url:             "https://www.arbibx.com",
      lastModified:    now,
      changeFrequency: "daily",
      priority:        1.0,
    },
    ...tickerEntries,
  ];
}
